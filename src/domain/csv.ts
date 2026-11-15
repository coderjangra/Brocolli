// CSV export of the whole ledger (SPEC §6.9 "export data (CSV/JSON)").

import { paiseToDecimalString } from './money';
import type { Paise, PersonAmount, PersonId } from './types';

export interface CsvExpense {
  occurredAt: number;
  description: string;
  groupId?: string;
  totalPaise: Paise;
  payers: readonly PersonAmount[];
  shares: readonly PersonAmount[];
  deletedAt?: number | null;
}

export interface CsvSettlement {
  createdAt: number;
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountPaise: Paise;
  method: string;
  groupId?: string;
  deletedAt?: number | null;
}

const HEADER = [
  'Date',
  'Type',
  'Description',
  'Group',
  'Amount (INR)',
  'Paid by',
  'Split between',
  'Your share (INR)',
  'Your balance change (INR)',
];

export function csvCell(value: string): string {
  // Neutralise spreadsheet formulas and quote anything with separators.
  const safe = /^[=+\-@]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function isoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function amountOf(list: readonly PersonAmount[], id: PersonId): Paise {
  return list.filter((p) => p.personId === id).reduce((sum, p) => sum + p.amountPaise, 0);
}

export function ledgerToCsv(
  expenses: readonly CsvExpense[],
  settlements: readonly CsvSettlement[],
  me: PersonId,
  nameOf: (id: PersonId) => string,
  groupName: (id: string | undefined) => string,
): string {
  const rows: { at: number; cells: string[] }[] = [];
  for (const e of expenses) {
    if (e.deletedAt) continue;
    const myShare = amountOf(e.shares, me);
    const myEffect = amountOf(e.payers, me) - myShare;
    rows.push({
      at: e.occurredAt,
      cells: [
        isoDate(e.occurredAt),
        'Expense',
        e.description,
        groupName(e.groupId),
        paiseToDecimalString(e.totalPaise),
        e.payers.map((p) => `${nameOf(p.personId)} (${paiseToDecimalString(p.amountPaise)})`).join('; '),
        e.shares.map((p) => `${nameOf(p.personId)} (${paiseToDecimalString(p.amountPaise)})`).join('; '),
        paiseToDecimalString(myShare),
        paiseToDecimalString(myEffect),
      ],
    });
  }
  for (const s of settlements) {
    if (s.deletedAt) continue;
    const effect = s.fromPersonId === me ? s.amountPaise : s.toPersonId === me ? -s.amountPaise : 0;
    rows.push({
      at: s.createdAt,
      cells: [
        isoDate(s.createdAt),
        `Settlement (${s.method})`,
        `${nameOf(s.fromPersonId)} paid ${nameOf(s.toPersonId)}`,
        groupName(s.groupId),
        paiseToDecimalString(s.amountPaise),
        nameOf(s.fromPersonId),
        nameOf(s.toPersonId),
        '0.00',
        paiseToDecimalString(effect),
      ],
    });
  }
  rows.sort((a, b) => a.at - b.at);
  return [HEADER, ...rows.map((r) => r.cells)].map((r) => r.map(csvCell).join(',')).join('\n');
}
