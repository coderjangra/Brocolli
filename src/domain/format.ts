import { assertPaise, PAISE_PER_RUPEE } from './money';
import type { Paise } from './types';

export interface FormatMoneyOptions {
  currency?: string;
  /** Hide ".00" on whole rupees (default true, per SPEC §3). */
  hideZeroPaise?: boolean;
  /** Prefix positive amounts with "+". */
  showPlus?: boolean;
}

const formatters = new Map<string, Intl.NumberFormat>();

function wholeUnitFormatter(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/**
 * 12345600 → "₹1,23,456" · 48050 → "₹480.50" · -12000 → "-₹120".
 * Intl only ever sees the integer rupee part, so no float touches the amount;
 * the paise digits are appended from the integer remainder.
 */
export function formatMoney(amount: Paise, options: FormatMoneyOptions = {}): string {
  assertPaise(amount);
  const { currency = 'INR', hideZeroPaise = true, showPlus = false } = options;
  const abs = Math.abs(amount);
  const rupees = Math.trunc(abs / PAISE_PER_RUPEE);
  const paise = abs % PAISE_PER_RUPEE;

  let text = wholeUnitFormatter(currency).format(rupees);
  if (paise !== 0 || !hideZeroPaise) {
    text += `.${String(paise).padStart(2, '0')}`;
  }
  if (amount < 0) return `-${text}`;
  return showPlus && amount > 0 ? `+${text}` : text;
}
