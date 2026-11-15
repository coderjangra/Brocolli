import { describe, expect, it } from 'vitest';

import { describeChanges, type ExpenseSnapshot } from './history';

const names: Record<string, string> = { me: 'You', a: 'Aman', r: 'Rahul' };
const nameOf = (id: string) => names[id] ?? id;
const groupName = (id: string | undefined) => (id ? `group ${id}` : 'no group');

const base: ExpenseSnapshot = {
  description: 'Dinner',
  totalPaise: 45000,
  occurredAt: new Date(2026, 10, 10, 20).getTime(),
  splitKind: 'equal',
  payers: [{ personId: 'me', amountPaise: 45000 }],
  shares: [
    { personId: 'me', amountPaise: 22500 },
    { personId: 'a', amountPaise: 22500 },
  ],
};

describe('describeChanges', () => {
  it('reports nothing when nothing changed', () => {
    expect(describeChanges(base, { ...base }, nameOf, groupName)).toEqual([]);
  });

  it('describes amount, name, people and split kind changes', () => {
    const after: ExpenseSnapshot = {
      ...base,
      description: 'Dinner at Haldiram',
      totalPaise: 48000,
      splitKind: 'exact',
      payers: [{ personId: 'me', amountPaise: 48000 }],
      shares: [
        { personId: 'me', amountPaise: 16000 },
        { personId: 'a', amountPaise: 16000 },
        { personId: 'r', amountPaise: 16000 },
      ],
    };
    expect(describeChanges(base, after, nameOf, groupName)).toEqual([
      'Renamed “Dinner” → “Dinner at Haldiram”',
      'Amount ₹450 → ₹480',
      'Split between You, Aman → You, Aman, Rahul',
      'Split equally → by exact amounts',
    ]);
  });

  it('notices payer, date and group changes', () => {
    const after: ExpenseSnapshot = {
      ...base,
      groupId: 'g1',
      occurredAt: new Date(2026, 10, 12, 9).getTime(),
      payers: [{ personId: 'a', amountPaise: 45000 }],
    };
    const changes = describeChanges(base, after, nameOf, groupName);
    expect(changes).toContain('Paid by You → Aman');
    expect(changes).toContain('Moved from no group to group g1');
    expect(changes.some((c) => c.startsWith('Date '))).toBe(true);
  });

  it('notices re-weighting with the same people', () => {
    const after: ExpenseSnapshot = {
      ...base,
      shares: [
        { personId: 'me', amountPaise: 30000 },
        { personId: 'a', amountPaise: 15000 },
      ],
    };
    expect(describeChanges(base, after, nameOf, groupName)).toEqual(['Changed how it is split']);
  });
});
