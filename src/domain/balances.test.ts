import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { netBalances, netBetween, pairKey, personNets } from './balances';
import { simplifyDebts } from './simplify';
import { computeShares } from './split';
import type { ExpenseInput, Paise, PersonId, SettlementInput, Transfer } from './types';

function equalExpense(totalPaise: Paise, payer: PersonId, people: PersonId[]): ExpenseInput {
  return {
    totalPaise,
    currency: 'INR',
    payers: [{ personId: payer, amountPaise: totalPaise }],
    shares: computeShares(totalPaise, people, { kind: 'equal' }, payer),
  };
}

function settlement(
  from: PersonId,
  to: PersonId,
  amountPaise: Paise,
  status: SettlementInput['status'] = 'confirmed',
): SettlementInput {
  return { fromPersonId: from, toPersonId: to, amountPaise, currency: 'INR', status };
}

/** paid − share per person, straight from the raw rows. */
function expectedNets(expenses: ExpenseInput[]): Map<PersonId, Paise> {
  const nets = new Map<PersonId, Paise>();
  const add = (id: PersonId, amount: Paise) => nets.set(id, (nets.get(id) ?? 0) + amount);
  for (const expense of expenses) {
    expense.payers.forEach((p) => add(p.personId, p.amountPaise));
    expense.shares.forEach((s) => add(s.personId, -s.amountPaise));
  }
  for (const [id, amount] of nets) if (amount === 0) nets.delete(id);
  return nets;
}

function applyTransfers(nets: ReadonlyMap<PersonId, Paise>, transfers: Transfer[]) {
  const after = new Map(nets);
  for (const t of transfers) {
    after.set(t.from, (after.get(t.from) ?? 0) + t.amountPaise);
    after.set(t.to, (after.get(t.to) ?? 0) - t.amountPaise);
  }
  return after;
}

describe('netBalances', () => {
  it('single payer: everyone else owes the payer their share', () => {
    const nets = netBalances([equalExpense(10000, 'me', ['me', 'rahul', 'aman'])], [], 'INR');
    expect(netBetween(nets, 'me', 'rahul')).toBe(3333);
    expect(netBetween(nets, 'rahul', 'me')).toBe(-3333);
    expect(netBetween(nets, 'me', 'aman')).toBe(3333);
    expect(netBetween(nets, 'rahul', 'aman')).toBe(0);
    expect(netBetween(nets, 'me', 'me')).toBe(0);
  });

  it('nets expenses in both directions into one number per friend', () => {
    const nets = netBalances(
      [equalExpense(60000, 'me', ['me', 'rahul']), equalExpense(20000, 'rahul', ['me', 'rahul'])],
      [],
      'INR',
    );
    expect(netBetween(nets, 'me', 'rahul')).toBe(20000);
    expect(nets.size).toBe(1);
  });

  it('a payer who is not in the split is owed the whole amount', () => {
    const nets = netBalances([equalExpense(9000, 'me', ['rahul', 'aman', 'zoya'])], [], 'INR');
    expect(netBetween(nets, 'me', 'rahul')).toBe(3000);
    expect(personNets(nets).get('me')).toBe(9000);
  });

  it('multi-payer: each debtor is spread across payers by what they are owed', () => {
    // ₹1200 dinner: a paid 900, b paid 300; split equally 4 ways (300 each).
    // a is owed 600, b is owed 0, c and d each owe 300 → both pay a.
    const expense: ExpenseInput = {
      totalPaise: 120000,
      currency: 'INR',
      payers: [
        { personId: 'a', amountPaise: 90000 },
        { personId: 'b', amountPaise: 30000 },
      ],
      shares: computeShares(120000, ['a', 'b', 'c', 'd'], { kind: 'equal' }, 'a'),
    };
    const nets = netBalances([expense], [], 'INR');
    expect(netBetween(nets, 'a', 'c')).toBe(30000);
    expect(netBetween(nets, 'a', 'd')).toBe(30000);
    expect(netBetween(nets, 'a', 'b')).toBe(0);
    expect(netBetween(nets, 'b', 'c')).toBe(0);
  });

  it('multi-payer with two creditors splits proportionally and exactly', () => {
    // a paid 600, b paid 400, c owes all 1000 → 600 to a, 400 to b.
    const expense: ExpenseInput = {
      totalPaise: 1000,
      currency: 'INR',
      payers: [
        { personId: 'a', amountPaise: 600 },
        { personId: 'b', amountPaise: 400 },
      ],
      shares: [{ personId: 'c', amountPaise: 1000 }],
    };
    const nets = netBalances([expense], [], 'INR');
    expect(netBetween(nets, 'a', 'c')).toBe(600);
    expect(netBetween(nets, 'b', 'c')).toBe(400);
  });

  it('confirmed settlements reduce the balance; pending and cancelled do not', () => {
    const expenses = [equalExpense(10000, 'me', ['me', 'rahul'])];
    expect(netBetween(netBalances(expenses, [], 'INR'), 'me', 'rahul')).toBe(5000);

    const partly = netBalances(expenses, [settlement('rahul', 'me', 2000)], 'INR');
    expect(netBetween(partly, 'me', 'rahul')).toBe(3000);

    const ignored = netBalances(
      expenses,
      [settlement('rahul', 'me', 2000, 'pending'), settlement('rahul', 'me', 2000, 'cancelled')],
      'INR',
    );
    expect(netBetween(ignored, 'me', 'rahul')).toBe(5000);
  });

  it('settling in full removes the pair; overpaying flips the direction', () => {
    const expenses = [equalExpense(10000, 'me', ['me', 'rahul'])];
    expect(netBalances(expenses, [settlement('rahul', 'me', 5000)], 'INR').size).toBe(0);
    const over = netBalances(expenses, [settlement('rahul', 'me', 6000)], 'INR');
    expect(netBetween(over, 'rahul', 'me')).toBe(1000);
  });

  it('keeps currencies separate and skips deleted rows', () => {
    const inr = equalExpense(10000, 'me', ['me', 'rahul']);
    const usd = { ...equalExpense(700, 'rahul', ['me', 'rahul']), currency: 'USD' };
    const deleted = { ...equalExpense(99900, 'me', ['me', 'rahul']), deletedAt: 1731200000000 };
    const usdSettlement = { ...settlement('rahul', 'me', 5000), currency: 'USD' };
    const deletedSettlement = { ...settlement('rahul', 'me', 5000), deletedAt: 1731200000000 };

    const all = [inr, usd, deleted];
    const inrNets = netBalances(all, [usdSettlement, deletedSettlement], 'INR');
    expect(netBetween(inrNets, 'me', 'rahul')).toBe(5000);
    expect(netBetween(netBalances(all, [], 'USD'), 'rahul', 'me')).toBe(350);
  });

  it('throws on an expense that breaks the money invariant', () => {
    const broken = { ...equalExpense(10000, 'me', ['me', 'rahul']), totalPaise: 10001 };
    expect(() => netBalances([broken], [], 'INR')).toThrow(/invalid expense/);
  });

  it('pairKey is order-independent', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    expect(() => pairKey('a|b', 'c')).toThrow();
  });
});

describe('simplifyDebts', () => {
  it('6-person group: at most n−1 transfers and every net preserved', () => {
    const group = ['aman', 'diya', 'kabir', 'meera', 'rahul', 'zoya'];
    const expenses: ExpenseInput[] = [
      equalExpense(240000, 'aman', group), // trip cab
      equalExpense(95050, 'diya', group), // groceries
      equalExpense(48000, 'kabir', ['kabir', 'meera', 'rahul']), // chai point
      equalExpense(130001, 'meera', ['aman', 'diya', 'zoya', 'meera']), // dinner
      equalExpense(7000, 'rahul', ['rahul', 'zoya']),
      {
        totalPaise: 60000,
        currency: 'INR',
        payers: [
          { personId: 'zoya', amountPaise: 45000 },
          { personId: 'aman', amountPaise: 15000 },
        ],
        shares: computeShares(60000, group, { kind: 'equal' }, 'zoya'),
      },
    ];
    const nets = personNets(netBalances(expenses, [], 'INR'));
    expect(nets).toEqual(expectedNets(expenses));

    const transfers = simplifyDebts(nets);
    expect(transfers.length).toBeLessThanOrEqual(group.length - 1);
    expect(transfers.every((t) => Number.isInteger(t.amountPaise) && t.amountPaise > 0)).toBe(true);
    expect(transfers.every((t) => nets.get(t.from)! < 0 && nets.get(t.to)! > 0)).toBe(true);
    // Paying the transfers leaves everyone at exactly zero.
    expect([...applyTransfers(nets, transfers).values()].every((v) => v === 0)).toBe(true);
  });

  it('collapses a chain: a owes b, b owes c → a pays c', () => {
    const nets = new Map([
      ['a', -500],
      ['b', 0],
      ['c', 500],
    ]);
    expect(simplifyDebts(nets)).toEqual([{ from: 'a', to: 'c', amountPaise: 500 }]);
  });

  it('pairs the largest debtor with the largest creditor first', () => {
    const nets = new Map([
      ['a', 700],
      ['b', 300],
      ['c', -600],
      ['d', -400],
    ]);
    expect(simplifyDebts(nets)).toEqual([
      { from: 'c', to: 'a', amountPaise: 600 },
      { from: 'd', to: 'b', amountPaise: 300 },
      { from: 'd', to: 'a', amountPaise: 100 },
    ]);
  });

  it('returns nothing when everyone is settled', () => {
    expect(simplifyDebts(new Map())).toEqual([]);
    expect(simplifyDebts(new Map([['a', 0]]))).toEqual([]);
  });

  it('rejects nets that do not sum to zero, and floats', () => {
    expect(() => simplifyDebts(new Map([['a', 100]]))).toThrow(RangeError);
    expect(() =>
      simplifyDebts(
        new Map([
          ['a', 0.5],
          ['b', -0.5],
        ]),
      ),
    ).toThrow(TypeError);
  });
});

describe('balances · properties', () => {
  const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  const subset = fc.subarray(ids, { minLength: 1 });

  /** Random valid expense with 1–3 payers and an equal or weighted split. */
  const expenseArb: fc.Arbitrary<ExpenseInput> = fc
    .record({
      totalPaise: fc.integer({ min: 1, max: 5_000_000_00 }),
      participants: subset,
      payers: fc.subarray(ids, { minLength: 1, maxLength: 3 }),
      payerWeights: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 3, maxLength: 3 }),
      shareWeights: fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 8, maxLength: 8 }),
      weighted: fc.boolean(),
    })
    .map(({ totalPaise, participants, payers, payerWeights, shareWeights, weighted }) => {
      const payerWeightMap = Object.fromEntries(payers.map((id, i) => [id, payerWeights[i]!]));
      const paid = computeShares(
        totalPaise,
        payers,
        { kind: 'shares', weights: payerWeightMap },
        payers[0]!,
      );
      const weights = Object.fromEntries(participants.map((id, i) => [id, shareWeights[i]!]));
      return {
        totalPaise,
        currency: 'INR',
        payers: paid.map(({ personId, amountPaise }) => ({ personId, amountPaise })),
        shares: computeShares(
          totalPaise,
          participants,
          weighted ? { kind: 'shares', weights } : { kind: 'equal' },
          payers[0]!,
        ),
      };
    });

  it('pairwise balances add up to paid − share for every person', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 15 }), (expenses) => {
        const pairNets = netBalances(expenses, [], 'INR');
        expect([...pairNets.values()].every((v) => Number.isInteger(v) && v !== 0)).toBe(true);
        expect(personNets(pairNets)).toEqual(expectedNets(expenses));
      }),
    );
  });

  it('simplification uses ≤ n−1 transfers and settles everyone exactly', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 15 }), (expenses) => {
        const nets = personNets(netBalances(expenses, [], 'INR'));
        const transfers = simplifyDebts(nets);
        expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nets.size - 1));
        expect([...applyTransfers(nets, transfers).values()].every((v) => v === 0)).toBe(true);
      }),
    );
  });

  it('paying the simplified transfers as settlements clears every pairwise total', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 10 }), (expenses) => {
        const transfers = simplifyDebts(personNets(netBalances(expenses, [], 'INR')));
        const settlements = transfers.map((t) => settlement(t.from, t.to, t.amountPaise));
        expect(personNets(netBalances(expenses, settlements, 'INR')).size).toBe(0);
      }),
    );
  });
});
