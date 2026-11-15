import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { allocate, computeShares, SplitError, validateExpense } from './split';
import type { Share, SplitSpec } from './types';

const amounts = (shares: Share[]) => shares.map((share) => share.amountPaise);
const total = (shares: Share[]) => amounts(shares).reduce((a, b) => a + b, 0);

function expectSplitError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SplitError);
    expect((error as SplitError).code).toBe(code);
    return;
  }
  throw new Error(`expected SplitError ${code}, but nothing was thrown`);
}

describe('computeShares · equal', () => {
  it('₹100 three ways is 3334/3333/3333 with the extra paisa to the payer', () => {
    expect(amounts(computeShares(10000, ['a', 'b', 'c'], { kind: 'equal' }, 'a'))).toEqual([
      3334, 3333, 3333,
    ]);
    expect(amounts(computeShares(10000, ['a', 'b', 'c'], { kind: 'equal' }, 'c'))).toEqual([
      3333, 3333, 3334,
    ]);
  });

  it('after the payer, leftover paise follow member order', () => {
    // 10 paise over 4 people: 2 each, 2 left → payer (d) then first member (a)
    expect(amounts(computeShares(10, ['a', 'b', 'c', 'd'], { kind: 'equal' }, 'd'))).toEqual([
      3, 2, 2, 3,
    ]);
  });

  it('falls back to member order when the payer is not a participant', () => {
    expect(amounts(computeShares(10000, ['a', 'b', 'c'], { kind: 'equal' }, 'z'))).toEqual([
      3334, 3333, 3333,
    ]);
  });

  it('handles a total smaller than the head count', () => {
    expect(amounts(computeShares(2, ['a', 'b', 'c'], { kind: 'equal' }, 'b'))).toEqual([1, 1, 0]);
  });

  it('splits evenly when it divides', () => {
    const shares = computeShares(48000, ['a', 'b', 'c'], { kind: 'equal' }, 'a');
    expect(amounts(shares)).toEqual([16000, 16000, 16000]);
    expect(shares[0]).toEqual({ personId: 'a', amountPaise: 16000, splitKind: 'equal' });
  });
});

describe('computeShares · exact', () => {
  it('accepts amounts that sum to the total', () => {
    const spec: SplitSpec = { kind: 'exact', amounts: { a: 7000, b: 3000, c: 0 } };
    expect(amounts(computeShares(10000, ['a', 'b', 'c'], spec, 'a'))).toEqual([7000, 3000, 0]);
  });

  it('rejects amounts that do not sum to the total', () => {
    expectSplitError(
      () => computeShares(10000, ['a', 'b'], { kind: 'exact', amounts: { a: 7000, b: 2999 } }, 'a'),
      'EXACT_SUM_MISMATCH',
    );
    expectSplitError(
      () => computeShares(10000, ['a', 'b'], { kind: 'exact', amounts: { a: 7000, b: 3001 } }, 'a'),
      'EXACT_SUM_MISMATCH',
    );
  });

  it('rejects float or negative amounts', () => {
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'exact', amounts: { a: 50.5, b: 49.5 } }, 'a'),
      'INVALID_VALUE',
    );
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'exact', amounts: { a: 150, b: -50 } }, 'a'),
      'INVALID_VALUE',
    );
  });
});

describe('computeShares · percent', () => {
  it('splits by percentage', () => {
    const spec: SplitSpec = { kind: 'percent', pcts: { a: 50, b: 30, c: 20 } };
    const shares = computeShares(48000, ['a', 'b', 'c'], spec, 'a');
    expect(amounts(shares)).toEqual([24000, 14400, 9600]);
    expect(shares[1]).toMatchObject({ splitKind: 'percent', splitValue: 30 });
  });

  it('rejects percentages summing to 99.99', () => {
    expectSplitError(
      () =>
        computeShares(
          10000,
          ['a', 'b', 'c'],
          { kind: 'percent', pcts: { a: 33.33, b: 33.33, c: 33.33 } },
          'a',
        ),
      'PERCENT_SUM_MISMATCH',
    );
  });

  it('rejects percentages summing to 100.01', () => {
    expectSplitError(
      () => computeShares(10000, ['a', 'b'], { kind: 'percent', pcts: { a: 50, b: 50.01 } }, 'a'),
      'PERCENT_SUM_MISMATCH',
    );
  });

  it('accepts 33.33/33.33/33.34 and still sums to the total', () => {
    const spec: SplitSpec = { kind: 'percent', pcts: { a: 33.33, b: 33.33, c: 33.34 } };
    const shares = computeShares(10001, ['a', 'b', 'c'], spec, 'a');
    expect(total(shares)).toBe(10001);
    expect(amounts(shares)).toEqual([3333, 3333, 3335]);
  });

  it('rejects more than 2 decimals and negatives', () => {
    expectSplitError(
      () =>
        computeShares(100, ['a', 'b'], { kind: 'percent', pcts: { a: 33.333, b: 66.667 } }, 'a'),
      'INVALID_VALUE',
    );
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'percent', pcts: { a: 120, b: -20 } }, 'a'),
      'INVALID_VALUE',
    );
  });
});

describe('computeShares · shares', () => {
  it('splits by weight', () => {
    const spec: SplitSpec = { kind: 'shares', weights: { a: 2, b: 1, c: 1 } };
    expect(amounts(computeShares(10000, ['a', 'b', 'c'], spec, 'a'))).toEqual([5000, 2500, 2500]);
  });

  it('supports fractional weights and gives tied leftovers to the payer', () => {
    const spec: SplitSpec = { kind: 'shares', weights: { a: 1.5, b: 1.5 } };
    expect(amounts(computeShares(101, ['a', 'b'], spec, 'b'))).toEqual([50, 51]);
  });

  it('gives leftover paise to the largest remainder before the payer', () => {
    // 100 paise at 1:2 → 33.33 / 66.67: b has the larger remainder even though a paid
    const spec: SplitSpec = { kind: 'shares', weights: { a: 1, b: 2 } };
    expect(amounts(computeShares(100, ['a', 'b'], spec, 'a'))).toEqual([33, 67]);
  });

  it('rejects all-zero weights', () => {
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'shares', weights: { a: 0, b: 0 } }, 'a'),
      'ZERO_WEIGHT',
    );
  });
});

describe('computeShares · input checks', () => {
  it('rejects bad totals', () => {
    for (const bad of [0, -100, 480.5, Number.NaN]) {
      expectSplitError(() => computeShares(bad, ['a'], { kind: 'equal' }, 'a'), 'INVALID_TOTAL');
    }
  });

  it('rejects empty and duplicate participants', () => {
    expectSplitError(() => computeShares(100, [], { kind: 'equal' }, 'a'), 'NO_PARTICIPANTS');
    expectSplitError(
      () => computeShares(100, ['a', 'a'], { kind: 'equal' }, 'a'),
      'DUPLICATE_PARTICIPANT',
    );
  });

  it('rejects specs whose people do not match the participants', () => {
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'exact', amounts: { a: 100 } }, 'a'),
      'PARTICIPANT_MISMATCH',
    );
    expectSplitError(
      () => computeShares(100, ['a', 'b'], { kind: 'percent', pcts: { a: 50, z: 50 } }, 'a'),
      'PARTICIPANT_MISMATCH',
    );
  });
});

describe('computeShares · properties', () => {
  const people = fc
    .uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 12 })
    .filter((ids) => ids.every((id) => !['__proto__', 'constructor'].includes(id)));
  const totalArb = fc.integer({ min: 1, max: 100_000_000_00 });

  it('equal shares always sum to the total and differ by at most 1 paisa', () => {
    fc.assert(
      fc.property(totalArb, people, fc.nat(), (t, ids, payerIndex) => {
        const payer = ids[payerIndex % ids.length]!;
        const shares = computeShares(t, ids, { kind: 'equal' }, payer);
        const values = amounts(shares);
        expect(total(shares)).toBe(t);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        expect(shares.find((s) => s.personId === payer)!.amountPaise).toBe(Math.max(...values));
      }),
    );
  });

  it('weighted shares always sum to the total and stay within 1 paisa of exact', () => {
    fc.assert(
      fc.property(
        totalArb,
        people.chain((ids) =>
          fc.tuple(
            fc.constant(ids),
            fc.array(fc.integer({ min: 0, max: 10_000 }), {
              minLength: ids.length,
              maxLength: ids.length,
            }),
          ),
        ),
        (t, [ids, hundredths]) => {
          fc.pre(hundredths.some((h) => h > 0));
          const weights = Object.fromEntries(ids.map((id, i) => [id, hundredths[i]! / 100]));
          const shares = computeShares(t, ids, { kind: 'shares', weights }, ids[0]!);
          expect(total(shares)).toBe(t);
          const weightSum = hundredths.reduce((a, b) => a + b, 0);
          shares.forEach((share, i) => {
            expect(Number.isInteger(share.amountPaise)).toBe(true);
            expect(share.amountPaise).toBeGreaterThanOrEqual(0);
            const exact = (t * hundredths[i]!) / weightSum;
            expect(Math.abs(share.amountPaise - exact)).toBeLessThan(1 + 1e-6);
          });
        },
      ),
    );
  });

  it('percent shares always sum to the total', () => {
    // Build random basis points that sum to exactly 10000.
    const bpsArb = fc
      .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 11 })
      .map((cuts) => {
        const sorted = [0, ...cuts.sort((a, b) => a - b), 10_000];
        return sorted.slice(1).map((cut, i) => cut - sorted[i]!);
      });
    fc.assert(
      fc.property(totalArb, bpsArb, (t, bps) => {
        const ids = bps.map((_, i) => `p${i}`);
        const pcts = Object.fromEntries(ids.map((id, i) => [id, bps[i]! / 100]));
        const shares = computeShares(t, ids, { kind: 'percent', pcts }, ids[0]!);
        expect(total(shares)).toBe(t);
        expect(amounts(shares).every((a) => Number.isInteger(a) && a >= 0)).toBe(true);
      }),
    );
  });

  it('allocate never loses or invents a paisa', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 20 }),
        (t, weights) => {
          fc.pre(weights.some((w) => w > 0));
          const parts = allocate(t, weights);
          expect(parts.reduce((a, b) => a + BigInt(b), BigInt(0))).toBe(BigInt(t));
          parts.forEach((part, i) => {
            if (weights[i] === 0) expect(part).toBe(0);
          });
        },
      ),
    );
  });
});

describe('validateExpense', () => {
  const valid = {
    totalPaise: 10000,
    currency: 'INR',
    payers: [{ personId: 'a', amountPaise: 10000 }],
    shares: [
      { personId: 'a', amountPaise: 3334 },
      { personId: 'b', amountPaise: 3333 },
      { personId: 'c', amountPaise: 3333 },
    ],
  };
  const codes = (expense: Parameters<typeof validateExpense>[0]) => {
    const result = validateExpense(expense);
    return result.ok ? [] : result.errors.map((error) => error.code);
  };

  it('accepts sum(payers) == total == sum(shares)', () => {
    expect(validateExpense(valid)).toEqual({ ok: true, value: true });
  });

  it('accepts multiple payers', () => {
    expect(
      validateExpense({
        ...valid,
        payers: [
          { personId: 'a', amountPaise: 6000 },
          { personId: 'b', amountPaise: 4000 },
        ],
      }).ok,
    ).toBe(true);
  });

  it('flags payers that do not sum to the total', () => {
    expect(codes({ ...valid, payers: [{ personId: 'a', amountPaise: 9999 }] })).toEqual([
      'PAYERS_SUM_MISMATCH',
    ]);
  });

  it('flags shares that do not sum to the total', () => {
    expect(codes({ ...valid, shares: valid.shares.slice(0, 2) })).toEqual(['SHARES_SUM_MISMATCH']);
  });

  it('reports every problem at once', () => {
    expect(
      codes({
        totalPaise: 100.5,
        currency: '',
        payers: [],
        shares: [
          { personId: 'a', amountPaise: 50 },
          { personId: 'a', amountPaise: -1 },
        ],
      }),
    ).toEqual([
      'INVALID_TOTAL',
      'MISSING_CURRENCY',
      'NO_PAYERS',
      'DUPLICATE_SHARE',
      'INVALID_SHARE_AMOUNT',
    ]);
  });

  it('accepts whatever computeShares produces', () => {
    const shares = computeShares(99999, ['a', 'b', 'c', 'd'], { kind: 'equal' }, 'b');
    expect(
      validateExpense({
        totalPaise: 99999,
        currency: 'INR',
        payers: [{ personId: 'b', amountPaise: 99999 }],
        shares,
      }).ok,
    ).toBe(true);
  });
});
