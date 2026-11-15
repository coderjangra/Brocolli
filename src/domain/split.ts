import { assertPaise, isPaise, sumPaise, toScaledInt } from './money';
import type {
  ExpenseInput,
  Paise,
  PersonAmount,
  PersonId,
  Result,
  Share,
  SplitSpec,
} from './types';

export type SplitErrorCode =
  | 'INVALID_TOTAL'
  | 'NO_PARTICIPANTS'
  | 'DUPLICATE_PARTICIPANT'
  | 'PARTICIPANT_MISMATCH'
  | 'INVALID_VALUE'
  | 'EXACT_SUM_MISMATCH'
  | 'PERCENT_SUM_MISMATCH'
  | 'ZERO_WEIGHT';

export class SplitError extends Error {
  readonly code: SplitErrorCode;
  constructor(code: SplitErrorCode, message: string) {
    super(message);
    this.name = 'SplitError';
    this.code = code;
  }
}

/**
 * Largest-remainder allocation of `total` paise across integer `weights`.
 * Each slot gets floor(total * w / W); leftover paise go one at a time to the
 * largest fractional remainders. Ties break by lower `tieRank`, then by index.
 * The result always sums to exactly `total`.
 */
export function allocate(
  total: Paise,
  weights: readonly number[],
  tieRank?: readonly number[],
): Paise[] {
  assertPaise(total, 'total');
  if (total < 0) throw new RangeError('total must not be negative');
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new RangeError('weights must be non-negative integers');
    }
  }
  const totalBig = BigInt(total);
  const weightSum = weights.reduce((sum, w) => sum + BigInt(w), BigInt(0));
  if (weightSum <= BigInt(0)) throw new RangeError('weights must sum to more than zero');

  const result: number[] = [];
  const remainders: bigint[] = [];
  let allocated = 0;
  for (const w of weights) {
    const product = totalBig * BigInt(w);
    const base = Number(product / weightSum);
    result.push(base);
    remainders.push(product % weightSum);
    allocated += base;
  }

  const order = weights
    .map((_, index) => index)
    .sort((a, b) => {
      if (remainders[a] !== remainders[b]) return remainders[a]! > remainders[b]! ? -1 : 1;
      const rankDiff = (tieRank?.[a] ?? 0) - (tieRank?.[b] ?? 0);
      return rankDiff !== 0 ? rankDiff : a - b;
    });

  // leftover < number of slots with a non-zero remainder, so this never over-gives.
  const leftover = total - allocated;
  for (let i = 0; i < leftover; i++) {
    result[order[i]!]! += 1;
  }
  return result;
}

function valuesFor(
  participants: readonly PersonId[],
  record: Readonly<Record<PersonId, number>>,
  label: string,
): number[] {
  const keys = Object.keys(record);
  const known = new Set(participants);
  if (keys.length !== participants.length || keys.some((key) => !known.has(key))) {
    throw new SplitError(
      'PARTICIPANT_MISMATCH',
      `${label} must have exactly one entry per participant`,
    );
  }
  return participants.map((id) => record[id]!);
}

/**
 * Split `total` between `participants`. Shares come back in participant order
 * and always sum to exactly `total`. On an odd paisa, the payer wins ties, then
 * earlier participants. Throws SplitError on invalid input.
 */
export function computeShares(
  total: Paise,
  participants: readonly PersonId[],
  spec: SplitSpec,
  payerId: PersonId,
): Share[] {
  if (!isPaise(total) || total <= 0) {
    throw new SplitError('INVALID_TOTAL', 'total must be a positive integer number of paise');
  }
  if (participants.length === 0) {
    throw new SplitError('NO_PARTICIPANTS', 'a split needs at least one participant');
  }
  if (new Set(participants).size !== participants.length) {
    throw new SplitError('DUPLICATE_PARTICIPANT', 'participants must be unique');
  }

  const tieRank = participants.map((id) => (id === payerId ? 0 : 1));

  switch (spec.kind) {
    case 'equal': {
      const amounts = allocate(
        total,
        participants.map(() => 1),
        tieRank,
      );
      return participants.map((personId, i) => ({
        personId,
        amountPaise: amounts[i]!,
        splitKind: 'equal',
      }));
    }

    case 'exact': {
      const amounts = valuesFor(participants, spec.amounts, 'amounts');
      if (amounts.some((amount) => !isPaise(amount) || amount < 0)) {
        throw new SplitError('INVALID_VALUE', 'exact amounts must be non-negative integer paise');
      }
      if (sumPaise(amounts) !== total) {
        throw new SplitError('EXACT_SUM_MISMATCH', 'exact amounts must add up to the total');
      }
      return participants.map((personId, i) => ({
        personId,
        amountPaise: amounts[i]!,
        splitKind: 'exact',
      }));
    }

    case 'percent': {
      const pcts = valuesFor(participants, spec.pcts, 'pcts');
      const basisPoints = pcts.map((pct) => toScaledInt(pct));
      if (basisPoints.some((bp) => bp === null)) {
        throw new SplitError(
          'INVALID_VALUE',
          'percentages must be non-negative with at most 2 decimals',
        );
      }
      const bps = basisPoints as number[];
      if (bps.reduce((sum, bp) => sum + bp, 0) !== 10000) {
        throw new SplitError('PERCENT_SUM_MISMATCH', 'percentages must add up to exactly 100');
      }
      const amounts = allocate(total, bps, tieRank);
      return participants.map((personId, i) => ({
        personId,
        amountPaise: amounts[i]!,
        splitKind: 'percent',
        splitValue: pcts[i]!,
      }));
    }

    case 'shares': {
      const weights = valuesFor(participants, spec.weights, 'weights');
      const scaledOrNull = weights.map((weight) => toScaledInt(weight));
      if (scaledOrNull.some((weight) => weight === null)) {
        throw new SplitError(
          'INVALID_VALUE',
          'weights must be non-negative with at most 2 decimals',
        );
      }
      const scaled = scaledOrNull as number[];
      if (scaled.every((weight) => weight === 0)) {
        throw new SplitError('ZERO_WEIGHT', 'at least one weight must be more than zero');
      }
      const amounts = allocate(total, scaled, tieRank);
      return participants.map((personId, i) => ({
        personId,
        amountPaise: amounts[i]!,
        splitKind: 'shares',
        splitValue: weights[i]!,
      }));
    }
  }
}

export type ValidationErrorCode =
  | 'INVALID_TOTAL'
  | 'MISSING_CURRENCY'
  | 'NO_PAYERS'
  | 'NO_SHARES'
  | 'INVALID_PAYER_AMOUNT'
  | 'INVALID_SHARE_AMOUNT'
  | 'DUPLICATE_PAYER'
  | 'DUPLICATE_SHARE'
  | 'PAYERS_SUM_MISMATCH'
  | 'SHARES_SUM_MISMATCH';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
}

function checkSide(
  entries: readonly PersonAmount[],
  total: Paise,
  side: 'PAYER' | 'SHARE',
  errors: ValidationError[],
): void {
  const label = side === 'PAYER' ? 'payers' : 'shares';
  if (entries.length === 0) {
    errors.push({ code: side === 'PAYER' ? 'NO_PAYERS' : 'NO_SHARES', message: `no ${label}` });
    return;
  }
  if (new Set(entries.map((entry) => entry.personId)).size !== entries.length) {
    errors.push({ code: `DUPLICATE_${side}`, message: `a person appears twice in ${label}` });
  }
  if (entries.some((entry) => !isPaise(entry.amountPaise) || entry.amountPaise < 0)) {
    errors.push({
      code: `INVALID_${side}_AMOUNT`,
      message: `${label} amounts must be non-negative integer paise`,
    });
    return;
  }
  if (sumPaise(entries.map((entry) => entry.amountPaise)) !== total) {
    errors.push({ code: `${side}S_SUM_MISMATCH`, message: `${label} must add up to the total` });
  }
}

/** The money invariant: sum(payers) == total == sum(shares). Run before every write. */
export function validateExpense(expense: ExpenseInput): Result<true, ValidationError[]> {
  const errors: ValidationError[] = [];
  if (!isPaise(expense.totalPaise) || expense.totalPaise <= 0) {
    errors.push({ code: 'INVALID_TOTAL', message: 'total must be a positive integer of paise' });
  }
  if (!expense.currency) {
    errors.push({ code: 'MISSING_CURRENCY', message: 'currency is required' });
  }
  checkSide(expense.payers, expense.totalPaise, 'PAYER', errors);
  checkSide(expense.shares, expense.totalPaise, 'SHARE', errors);
  return errors.length === 0 ? { ok: true, value: true } : { ok: false, errors };
}
