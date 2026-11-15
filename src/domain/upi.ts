import { isPaise, paiseToDecimalString } from './money';
import type { Paise } from './types';

const VPA = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA.test(vpa.trim());
}

export interface UpiPayRequest {
  vpa: string;
  name: string;
  amountPaise: Paise;
  note?: string;
}

/** `upi://pay?...` deep link (SPEC §10). Returns null if the VPA or amount is unusable. */
export function buildUpiUrl({ vpa, name, amountPaise, note = '' }: UpiPayRequest): string | null {
  if (!isValidVpa(vpa) || !isPaise(amountPaise) || amountPaise <= 0) return null;
  const params = [
    `pa=${encodeURIComponent(vpa.trim())}`,
    `pn=${encodeURIComponent(name.trim())}`,
    `am=${paiseToDecimalString(amountPaise)}`,
    'cu=INR',
  ];
  const trimmed = note.trim().slice(0, 50);
  if (trimmed) params.push(`tn=${encodeURIComponent(trimmed)}`);
  return `upi://pay?${params.join('&')}`;
}
