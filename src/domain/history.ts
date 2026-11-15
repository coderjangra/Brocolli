// Human-readable edit history for an expense (SPEC §6.7):
// "Amount ₹450 → ₹480", "Split between Aman, Rahul → Aman, Rahul, You".

import { formatMoney } from './format';
import type { Paise, PersonAmount, PersonId, SplitKind } from './types';

export interface ExpenseSnapshot {
  description: string;
  totalPaise: Paise;
  occurredAt: number;
  groupId?: string;
  splitKind: SplitKind;
  payers: readonly PersonAmount[];
  shares: readonly PersonAmount[];
}

export interface HistoryEntry {
  at: number;
  changes: string[];
}

const SPLIT_LABEL: Record<SplitKind, string> = {
  equal: 'equally',
  exact: 'by exact amounts',
  percent: 'by percent',
  shares: 'by shares',
  item: 'by item',
};

function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function people(list: readonly PersonAmount[], nameOf: (id: PersonId) => string): string {
  return list.map((p) => nameOf(p.personId)).join(', ') || 'nobody';
}

function sameAmounts(a: readonly PersonAmount[], b: readonly PersonAmount[]): boolean {
  const key = (l: readonly PersonAmount[]) =>
    [...l]
      .map((p) => `${p.personId}:${p.amountPaise}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}

export function describeChanges(
  before: ExpenseSnapshot,
  after: ExpenseSnapshot,
  nameOf: (id: PersonId) => string,
  groupName: (id: string | undefined) => string,
): string[] {
  const out: string[] = [];
  if (before.description.trim() !== after.description.trim()) {
    out.push(`Renamed “${before.description}” → “${after.description}”`);
  }
  if (before.totalPaise !== after.totalPaise) {
    out.push(`Amount ${formatMoney(before.totalPaise)} → ${formatMoney(after.totalPaise)}`);
  }
  if (dateKey(before.occurredAt) !== dateKey(after.occurredAt)) {
    out.push(`Date ${shortDate(before.occurredAt)} → ${shortDate(after.occurredAt)}`);
  }
  if ((before.groupId ?? '') !== (after.groupId ?? '')) {
    out.push(`Moved from ${groupName(before.groupId)} to ${groupName(after.groupId)}`);
  }
  const beforePayers = people(before.payers, nameOf);
  const afterPayers = people(after.payers, nameOf);
  if (beforePayers !== afterPayers) out.push(`Paid by ${beforePayers} → ${afterPayers}`);
  // With a new total every payer amount moves; only re-splits of the same total are news.
  else if (before.totalPaise === after.totalPaise && !sameAmounts(before.payers, after.payers)) {
    out.push('Changed who paid how much');
  }

  const beforeShares = people(before.shares, nameOf);
  const afterShares = people(after.shares, nameOf);
  if (beforeShares !== afterShares) out.push(`Split between ${beforeShares} → ${afterShares}`);
  if (before.splitKind !== after.splitKind) {
    out.push(`Split ${SPLIT_LABEL[before.splitKind]} → ${SPLIT_LABEL[after.splitKind]}`);
  } else if (
    beforeShares === afterShares &&
    before.totalPaise === after.totalPaise &&
    !sameAmounts(before.shares, after.shares)
  ) {
    out.push('Changed how it is split');
  }
  return out;
}
