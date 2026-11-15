import type { Paise } from './types';

export const PAISE_PER_RUPEE = 100;

export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertPaise(value: unknown, label = 'amount'): asserts value is Paise {
  if (!isPaise(value)) {
    throw new TypeError(`${label} must be integer paise, got ${String(value)}`);
  }
}

export function sumPaise(amounts: Iterable<Paise>): Paise {
  let total = 0;
  for (const amount of amounts) {
    assertPaise(amount);
    total += amount;
  }
  assertPaise(total, 'sum');
  return total;
}

const RUPEE_INPUT = /^(\d{1,3}(?:,\d{2,3})+|\d+)?(?:\.(\d{1,2}))?$/;

/**
 * Parse user/bank rupee text ("480", "480.5", "1,23,456.00") into paise using
 * string digits only. Returns null for anything that isn't a plain non-negative
 * amount with at most 2 decimals.
 */
export function rupeesToPaise(input: string): Paise | null {
  const text = input.trim();
  const match = RUPEE_INPUT.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  const rupees = Number((match[1] ?? '0').replace(/,/g, ''));
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  const total = rupees * PAISE_PER_RUPEE + paise;
  return Number.isSafeInteger(total) ? total : null;
}

/** "480.50" — plain decimal rupees with 2 dp, e.g. for the UPI `am=` parameter. */
export function paiseToDecimalString(amount: Paise): string {
  assertPaise(amount);
  const abs = Math.abs(amount);
  const rupees = Math.trunc(abs / PAISE_PER_RUPEE);
  const paise = abs % PAISE_PER_RUPEE;
  return `${amount < 0 ? '-' : ''}${rupees}.${String(paise).padStart(2, '0')}`;
}

/**
 * Turn a decimal with at most `decimals` places (a percent like 33.33, a weight
 * like 1.5) into an exact integer. Returns null if it is negative, not finite,
 * or has more precision than allowed.
 */
export function toScaledInt(value: number, decimals = 2): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const scale = 10 ** decimals;
  const scaled = Math.round(value * scale);
  if (!Number.isSafeInteger(scaled) || Math.abs(value * scale - scaled) > 1e-6) return null;
  return scaled;
}
