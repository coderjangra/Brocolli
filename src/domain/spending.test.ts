import { describe, expect, it } from 'vitest';

import { monthRange, monthSpending, type SpendPayment } from './spending';

const nov = monthRange(new Date(2026, 10, 15));
const d = (day: number, month = 10) => new Date(2026, month, day, 12).getTime();

describe('monthSpending', () => {
  it('adds personal payments to my share of splits, per account', () => {
    const payments: SpendPayment[] = [
      { amountPaise: 6700, occurredAt: d(15), status: 'personal', accountKey: 'indianbank-4821' },
      { amountPaise: 48000, occurredAt: d(10), status: 'split', accountKey: 'indusind-7710' },
      { amountPaise: 1500, occurredAt: d(14), status: 'personal', accountKey: 'indianbank-4821' },
      { amountPaise: 99900, occurredAt: d(14), status: 'ignored', accountKey: 'indianbank-4821' },
      { amountPaise: 5000, occurredAt: d(14), status: 'inbox' },
      { amountPaise: 7000, occurredAt: d(30, 9), status: 'personal' },
      { amountPaise: 12345, occurredAt: d(12), status: 'personal', source: 'sample' },
    ];
    const expenses = [
      {
        occurredAt: d(10),
        shares: [
          { personId: 'me', amountPaise: 16000 },
          { personId: 'a', amountPaise: 32000 },
        ],
      },
      { occurredAt: d(11), shares: [{ personId: 'me', amountPaise: 999 }], deletedAt: 5 },
    ];
    const r = monthSpending(payments, expenses, 'me', nov);
    expect(r.personal).toBe(8200);
    expect(r.splitShare).toBe(16000);
    expect(r.total).toBe(24200);
    expect(r.byAccount).toEqual([
      { accountKey: 'indusind-7710', paidOut: 48000, count: 1 },
      { accountKey: 'indianbank-4821', paidOut: 8200, count: 2 },
    ]);
  });
});
