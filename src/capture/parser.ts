// Payment parser (SPEC §5.1). Pure TS: bank SMS / payment-app notification text
// in, structured payment out. Must never throw: real bank formats change and
// anything unrecognised returns null.

import { rupeesToPaise } from '@/domain/money';
import type { Paise } from '@/domain/types';

export interface RawCapture {
  source: 'sms' | 'notification';
  /** SMS sender ID ("VM-HDFCBK") or notification title. */
  sender: string;
  text: string;
  receivedAt: number;
  packageName?: string;
}

export type PaymentApp = 'GPay' | 'PhonePe' | 'Paytm' | 'BHIM' | 'CRED' | 'Bank app';

export interface ParsedPayment {
  direction: 'debit' | 'credit';
  amountPaise: Paise;
  payeeRaw?: string;
  payeeVpa?: string;
  accountLast4?: string;
  txnRef?: string;
  bank?: string;
  app?: PaymentApp;
  occurredAt: number;
  source: RawCapture['source'];
}

const MAX_TEXT = 2000;

const REJECT = [
  /\b(?:otp|one[- ]time password|verification code|cvv)\b/i,
  /\b(?:failed|declined|unsuccessful|rejected|could not be (?:processed|completed))\b/i,
  /\brequest(?:ed|s|ing)?\b/i,
  /\bwill be (?:debited|credited|deducted|charged)\b|\bis due\b|\bdue (?:on|date|by)\b/i,
  /\b(?:is|are) scheduled\b|\bensure sufficient\b|\bmandate (?:created|registered)\b/i,
  /\bcashback on\b|\bpre-?approved\b|\bapply now\b|\buse code\b|T&C|\boffer\b|\bcongrat/i,
];

const DEBIT = /\b(?:debited|debit|spent|paid|sent|withdrawn|purchase|transferred|deducted)\b/i;
const CREDIT = /\b(?:credited|received|refund(?:ed)?|deposited)\b|\bsent you\b/i;

const CURRENCY_AMOUNT = /(?:Rs\.?|INR|₹)\s?(\d[\d,]*(?:\.\d{1,2})?)/gi;
const BARE_AMOUNT = /\b(?:debited|credited)\s+(?:by|for|with)\s+(\d[\d,]*(?:\.\d{1,2})?)/i;
const BALANCE_CONTEXT = /(?:bal(?:ance)?|limit)[^\d]{0,12}$/i;

const VPA = /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}/;
const VPA_EXACT = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/;

const ACCOUNT = /\b(?:acct|account|a\/c|ac|card)[^\d\n]{0,12}?(?:\d{0,6}[xX*]+)?(\d{3,4})(?!\d)/i;

const TXN_REF = [
  /UPI\/P2[AM]\/(\d{10,16})(?!\d)/i,
  /UPI\/[^/\n]+\/(\d{10,16})(?!\d)/i,
  /(?:UPI\s?Ref(?:erence)?(?:\s?No)?|Ref(?:erence)?\s?No|RRN|UTR|Ref|UPI)[:\s.#-]*(\d{10,16})(?!\d)/i,
];

const END = String.raw`(?=\s+(?:on|ref\w*|upi|from|has|is|was|in|via|using|for|avl|not)\b|[.;,()\n]|$)`;
const DEBIT_PAYEE = [
  /UPI\/P2[AM]\/\d+\/([^/\n]+)/i,
  /\bUPI\/([^/\n]+)\/\d{6,}/i,
  /;\s*([A-Za-z][^;.\n]{1,40}?)\s+credited\b/i,
  /\bon\s+\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+on\s+([^.\n]+)/i,
  /\bInfo:\s*(?:UPI[-/])?([^.\n]+)/i,
  new RegExp(String.raw`\b(?:trf to|to|at|towards)\s+(.+?)${END}`, 'gi'),
];
const CREDIT_PAYEE = [
  /^(.+?)\s+sent you\b/i,
  /UPI\/P2[AM]\/\d+\/([^/\n]+)/i,
  new RegExp(String.raw`\b(?:from|by)\s+(.+?)${END}`, 'gi'),
];

const NOT_A_NAME =
  /^(?:(?:ref|upi|rs|inr|your|a\/c|ac|acct|account|bank|card|date|the)\b|(?:rs|inr)\.?\s?\d)/i;

const APPS: Record<string, PaymentApp> = {
  'com.google.android.apps.nbu.paisa.user': 'GPay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'com.dreamplug.androidapp': 'CRED',
};

const MESSAGING_APPS = new Set([
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.android.mms',
]);

const BANKS: [RegExp, string][] = [
  [/HDFC/, 'HDFC'],
  [/ICICI/, 'ICICI'],
  [/SBI/, 'SBI'],
  [/AXIS/, 'Axis'],
  [/KOTAK/, 'Kotak'],
  [/PAYTM/, 'Paytm'],
  [/YES/, 'Yes'],
  [/IDFC/, 'IDFC'],
  [/PNB/, 'PNB'],
  [/BOB|BARODA/, 'BOB'],
  [/CANBNK|CANARA/, 'Canara'],
  [/INDBNK|INDIANB/, 'Indian Bank'],
  [/INDUS/, 'IndusInd'],
  [/CENTBK|CBOI/, 'Central Bank'],
  [/BOIIND|BOISMS/, 'Bank of India'],
  [/MAHABK|MAHB/, 'Bank of Maharashtra'],
  [/IOBCHN|IOBBNK/, 'IOB'],
  [/UCOBNK/, 'UCO'],
  [/PSBANK/, 'Punjab & Sind'],
  [/BANDHN/, 'Bandhan'],
  [/RBLBNK/, 'RBL'],
  [/DBSBNK/, 'DBS'],
  [/SCBANK/, 'Standard Chartered'],
  [/CITIBK|CITI/, 'Citi'],
  [/HSBC/, 'HSBC'],
  [/KARBNK/, 'Karnataka Bank'],
  [/KVBANK|KVB/, 'KVB'],
  [/SIBSMS/, 'South Indian Bank'],
  [/TMBANK|TMBL/, 'TMB'],
  [/CSBBNK/, 'CSB'],
  [/DCBBNK/, 'DCB'],
  [/EQUTAS/, 'Equitas'],
  [/UJJIVN/, 'Ujjivan'],
  [/JKBANK/, 'J&K Bank'],
  [/AUBANK|AUSFB/, 'AU'],
  [/FEDBNK|FEDERAL/, 'Federal'],
  [/UNION|UBOI/, 'Union'],
  [/IDBI/, 'IDBI'],
  [/AIRBNK|AIRTEL/, 'Airtel'],
  [/JUPITR|JUPITER/, 'Jupiter'],
  [/FIMONY|FIBANK/, 'Fi'],
];

function bankFromSender(sender: string): string | undefined {
  const id = sender
    .toUpperCase()
    .replace(/^[A-Z]{2}-/, '')
    .replace(/-[A-Z]$/, '');
  return BANKS.find(([re]) => re.test(id))?.[1];
}

function amountFrom(text: string): Paise | null {
  for (const match of text.matchAll(CURRENCY_AMOUNT)) {
    if (BALANCE_CONTEXT.test(text.slice(Math.max(0, match.index - 20), match.index))) continue;
    const paise = rupeesToPaise(match[1]!.replace(/,/g, ''));
    if (paise !== null && paise > 0) return paise;
  }
  const bare = BARE_AMOUNT.exec(text);
  const paise = bare ? rupeesToPaise(bare[1]!.replace(/,/g, '')) : null;
  return paise !== null && paise > 0 ? paise : null;
}

function directionOf(text: string): ParsedPayment['direction'] | null {
  const d = DEBIT.exec(text)?.index ?? Infinity;
  const c = CREDIT.exec(text)?.index ?? Infinity;
  if (d === Infinity && c === Infinity) return null;
  return c <= d ? 'credit' : 'debit';
}

function cleanName(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const name = candidate
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '')
    .trim()
    .slice(0, 40)
    .trim();
  const letters = name.match(/[A-Za-z]/g)?.length ?? 0;
  const digits = name.match(/\d/g)?.length ?? 0;
  if (letters < 2 || digits > 4 || NOT_A_NAME.test(name)) return undefined;
  return name;
}

function payeeFrom(text: string, direction: ParsedPayment['direction']): string | undefined {
  for (const pattern of direction === 'debit' ? DEBIT_PAYEE : CREDIT_PAYEE) {
    const matches = pattern.global ? [...text.matchAll(pattern)] : [pattern.exec(text)];
    for (const match of matches) {
      const name = cleanName(match?.[1]);
      if (name) return name;
      // A VPA where the name should be: the VPA field covers it.
      if (match?.[1] && VPA.test(match[1].trim().split(/\s/)[0] ?? '')) return undefined;
    }
  }
  return undefined;
}

export function parseCapture(raw: RawCapture): ParsedPayment | null {
  try {
    const text = String(raw.text ?? '').slice(0, MAX_TEXT);
    if (!text.trim() || REJECT.some((re) => re.test(text))) return null;

    const direction = directionOf(text);
    if (!direction) return null;
    const amountPaise = amountFrom(text);
    if (amountPaise === null) return null;

    const app = raw.packageName ? APPS[raw.packageName] : undefined;
    const fromBankSender =
      raw.source === 'sms' || (raw.packageName !== undefined && MESSAGING_APPS.has(raw.packageName));

    const payeeName = payeeFrom(text, direction);
    const payeeVpa = VPA.exec(text)?.[0];
    const txnRef = TXN_REF.map((re) => re.exec(text)?.[1]).find(Boolean);

    const parsed: ParsedPayment = {
      direction,
      amountPaise,
      occurredAt: raw.receivedAt,
      source: raw.source,
    };
    if (payeeName && !VPA_EXACT.test(payeeName)) parsed.payeeRaw = payeeName;
    else if (direction === 'debit' && /\bATM\b/i.test(text) && /\bwithdrawn\b/i.test(text)) {
      parsed.payeeRaw = 'ATM withdrawal';
    }
    if (payeeVpa) parsed.payeeVpa = payeeVpa;
    const account = ACCOUNT.exec(text)?.[1];
    if (account) parsed.accountLast4 = account;
    if (txnRef) parsed.txnRef = txnRef;
    const bank = fromBankSender ? bankFromSender(raw.sender) : undefined;
    if (bank) parsed.bank = bank;
    if (app) parsed.app = app;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- payee names

function titleCase(words: string): string {
  return words.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

export function payeeDisplayName(p: Pick<ParsedPayment, 'payeeRaw' | 'payeeVpa'>): string {
  if (p.payeeRaw) return /[a-z]/.test(p.payeeRaw) ? p.payeeRaw : titleCase(p.payeeRaw);
  const local = p.payeeVpa?.split('@')[0];
  if (local && (local.match(/\d/g)?.length ?? 0) < 4 && local.length <= 20) {
    const words = local.replace(/[\d]+/g, ' ').replace(/[._-]+/g, ' ').trim();
    if (words.length >= 2) return titleCase(words);
  }
  return local ? 'UPI payment' : 'Unknown payee';
}

/** Stable key for matching the same payee across SMS, apps and history. */
export function payeeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------- dedupe

const DEDUPE_WINDOW_MS = 3 * 60_000;

type Dedupable = Pick<
  ParsedPayment,
  'direction' | 'amountPaise' | 'occurredAt' | 'txnRef' | 'payeeRaw' | 'payeeVpa'
>;

function keyOf(p: Dedupable): string {
  return payeeKey(p.payeeRaw ?? p.payeeVpa?.split('@')[0] ?? '');
}

/** SPEC §5.1: same ref → same payment; else same amount + payee within 3 min. */
export function findDuplicate<T extends Dedupable>(existing: readonly T[], incoming: Dedupable): T | undefined {
  return existing.find((p) => {
    if (p.direction !== incoming.direction) return false;
    if (p.txnRef && incoming.txnRef) return p.txnRef === incoming.txnRef;
    if (p.amountPaise !== incoming.amountPaise) return false;
    if (Math.abs(p.occurredAt - incoming.occurredAt) > DEDUPE_WINDOW_MS) return false;
    const a = keyOf(p);
    const b = keyOf(incoming);
    return a === b || !a || !b;
  });
}

const RICH_FIELDS = ['payeeRaw', 'payeeVpa', 'accountLast4', 'txnRef', 'bank', 'app'] as const;

function richness(p: ParsedPayment): number {
  return RICH_FIELDS.filter((k) => p[k] !== undefined).length;
}

/** Merge two captures of one payment, preferring the richer record's fields. */
export function mergeParsed(a: ParsedPayment, b: ParsedPayment): ParsedPayment {
  const [rich, poor] = richness(b) > richness(a) ? [b, a] : [a, b];
  const merged: ParsedPayment = { ...rich, occurredAt: Math.min(a.occurredAt, b.occurredAt) };
  for (const k of RICH_FIELDS) {
    if (merged[k] === undefined && poor[k] !== undefined) {
      (merged as unknown as Record<string, unknown>)[k] = poor[k];
    }
  }
  return merged;
}
