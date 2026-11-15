// "Where did my money go this month": personal payments + my share of splits,
// and how much left each of my bank accounts.

import type { Paise, PersonAmount, PersonId } from './types';

export interface SpendPayment {
  amountPaise: Paise;
  occurredAt: number;
  status: 'inbox' | 'split' | 'personal' | 'ignored';
  accountKey?: string;
  source?: string;
}

export interface SpendExpense {
  occurredAt: number;
  shares: readonly PersonAmount[];
  deletedAt?: number | null;
}

export interface MonthSpending {
  /** Personal payments + my share of every expense. */
  total: Paise;
  personal: Paise;
  splitShare: Paise;
  /** Money that left each account (personal + split payments), largest first. */
  byAccount: { accountKey: string | null; paidOut: Paise; count: number }[];
}

export function monthRange(ref: Date): [number, number] {
  return [
    new Date(ref.getFullYear(), ref.getMonth(), 1).getTime(),
    new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime(),
  ];
}

export function monthSpending(
  payments: readonly SpendPayment[],
  expenses: readonly SpendExpense[],
  me: PersonId,
  [from, to]: [number, number],
): MonthSpending {
  const inMonth = (t: number) => t >= from && t < to;
  let personal = 0;
  const accounts = new Map<string | null, { paidOut: Paise; count: number }>();
  for (const p of payments) {
    if (!inMonth(p.occurredAt) || p.source === 'sample') continue;
    if (p.status !== 'personal' && p.status !== 'split') continue;
    if (p.status === 'personal') personal += p.amountPaise;
    const key = p.accountKey ?? null;
    const row = accounts.get(key) ?? { paidOut: 0, count: 0 };
    row.paidOut += p.amountPaise;
    row.count += 1;
    accounts.set(key, row);
  }
  let splitShare = 0;
  for (const e of expenses) {
    if (e.deletedAt || !inMonth(e.occurredAt)) continue;
    for (const s of e.shares) if (s.personId === me) splitShare += s.amountPaise;
  }
  return {
    total: personal + splitShare,
    personal,
    splitShare,
    byAccount: [...accounts.entries()]
      .map(([accountKey, v]) => ({ accountKey, ...v }))
      .sort((a, b) => b.paidOut - a.paidOut),
  };
}
