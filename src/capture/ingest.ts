// Turn raw captures into Inbox payments: parse, keep debits, drop muted payees
// and paused accounts, dedupe against what is already in the Inbox (SPEC §5.1),
// discover the user's bank accounts and auto-ignore transfers between them.
// Pure TS.

import type { BankAccount, CreditEvent, Payment, PaymentChannel } from '@/store/types';

import { merchantEmoji } from './merchant';
import {
  findDuplicate,
  parseCapture,
  payeeDisplayName,
  payeeKey,
  type ParsedPayment,
  type RawCapture,
} from './parser';

export interface IngestContext {
  mutedPayees: readonly string[];
  accounts: readonly BankAccount[];
  recentCredits: readonly CreditEvent[];
  makeId: () => string;
  now: number;
}

export interface IngestResult {
  added: Payment[];
  /** Existing payments that changed: learned a ref/account, or turned out to be a self-transfer. */
  updated: Payment[];
  newAccounts: BankAccount[];
  /** The full credit memory to keep (old entries pruned, new ones added). */
  credits: CreditEvent[];
  /** How many payments were auto-ignored as transfers between own accounts. */
  selfTransfers: number;
}

const SELF_TRANSFER_WINDOW_MS = 10 * 60_000;
const CREDIT_MEMORY_MS = 3 * 86_400_000;

export function accountKeyOf(p: Pick<ParsedPayment, 'bank' | 'accountLast4'>): string | undefined {
  if (!p.accountLast4) return undefined;
  const bank = (p.bank ?? 'acct').toLowerCase().replace(/[^a-z]/g, '');
  return `${bank}-${p.accountLast4}`;
}

export function accountLabel(p: Pick<ParsedPayment, 'bank' | 'accountLast4' | 'app'>): string {
  if (p.bank && p.accountLast4) return `${p.bank} ··${p.accountLast4}`;
  if (p.accountLast4) return `A/c ··${p.accountLast4}`;
  if (p.bank) return `${p.bank} Bank`;
  if (p.app) return `via ${p.app}`;
  return 'UPI';
}

function isSelfTransfer(
  debit: { amountPaise: number; occurredAt: number; accountKey?: string },
  credit: CreditEvent,
): boolean {
  return (
    debit.amountPaise === credit.amountPaise &&
    !!debit.accountKey &&
    !!credit.accountKey &&
    debit.accountKey !== credit.accountKey &&
    Math.abs(debit.occurredAt - credit.occurredAt) <= SELF_TRANSFER_WINDOW_MS
  );
}

interface PoolEntry {
  direction: 'debit';
  amountPaise: number;
  occurredAt: number;
  txnRef?: string;
  payeeRaw?: string;
  payeeVpa?: string;
  payment: Payment;
}

function toPool(p: Payment): PoolEntry {
  return {
    direction: 'debit',
    amountPaise: p.amountPaise,
    occurredAt: p.occurredAt,
    txnRef: p.txnRef,
    payeeRaw: p.payee === 'Unknown payee' || p.payee === 'UPI payment' ? undefined : p.payee,
    payeeVpa: p.payeeVpa,
    payment: p,
  };
}

export function planIngest(
  existing: readonly Payment[],
  raws: readonly RawCapture[],
  ctx: IngestContext,
): IngestResult {
  const muted = new Set(ctx.mutedPayees);
  const accounts = new Map(ctx.accounts.map((a) => [a.key, a]));
  const newAccounts = new Map<string, BankAccount>();
  const credits = ctx.recentCredits.filter((c) => ctx.now - c.occurredAt <= CREDIT_MEMORY_MS);
  const pool = existing.map(toPool);
  const added = new Map<string, Payment>();
  const updated = new Map<string, Payment>();
  let selfTransfers = 0;

  const save = (entry: PoolEntry, next: Payment) => {
    entry.payment = next;
    entry.txnRef = next.txnRef;
    entry.payeeVpa = next.payeeVpa;
    (added.has(next.id) ? added : updated).set(next.id, next);
  };

  for (const raw of raws) {
    const parsed = parseCapture(raw);
    if (!parsed) continue;

    const accountKey = accountKeyOf(parsed);
    if (accountKey && !accounts.has(accountKey) && parsed.accountLast4) {
      const account: BankAccount = {
        key: accountKey,
        last4: parsed.accountLast4,
        capture: true,
        firstSeenAt: parsed.occurredAt,
      };
      if (parsed.bank) account.bank = parsed.bank;
      accounts.set(accountKey, account);
      newAccounts.set(accountKey, account);
    }
    if (accountKey && accounts.get(accountKey)?.capture === false) continue;

    if (parsed.direction === 'credit') {
      const credit: CreditEvent = { amountPaise: parsed.amountPaise, occurredAt: parsed.occurredAt };
      if (accountKey) credit.accountKey = accountKey;
      if (parsed.txnRef) credit.txnRef = parsed.txnRef;
      const known = credits.some(
        (c) =>
          (c.txnRef && c.txnRef === credit.txnRef) ||
          (c.amountPaise === credit.amountPaise &&
            c.accountKey === credit.accountKey &&
            Math.abs(c.occurredAt - credit.occurredAt) <= 3 * 60_000),
      );
      if (known) continue;
      credits.push(credit);
      // An Inbox debit from another own account for the same amount: a self-transfer.
      const match = pool.find(
        (e) => e.payment.status === 'inbox' && isSelfTransfer(e.payment, credit),
      );
      if (match) {
        save(match, { ...match.payment, status: 'ignored', selfTransfer: true });
        selfTransfers++;
      }
      continue;
    }

    const payee = payeeDisplayName(parsed);
    if (muted.has(payeeKey(payee))) continue;

    const dup = findDuplicate(pool, parsed);
    if (dup) {
      const before = dup.payment;
      const after: Payment = {
        ...before,
        txnRef: before.txnRef ?? parsed.txnRef,
        payeeVpa: before.payeeVpa ?? parsed.payeeVpa,
        accountKey: before.accountKey ?? accountKey,
        account:
          parsed.accountLast4 && !/··\d/.test(before.account) ? accountLabel(parsed) : before.account,
      };
      for (const k of ['txnRef', 'payeeVpa', 'accountKey'] as const) {
        if (after[k] === undefined) delete after[k];
      }
      if (JSON.stringify(after) !== JSON.stringify(before)) save(dup, after);
      continue;
    }

    const channel: PaymentChannel = parsed.app ?? 'SMS';
    const payment: Payment = {
      id: ctx.makeId(),
      amountPaise: parsed.amountPaise,
      payee,
      emoji: merchantEmoji(payee),
      account: accountLabel(parsed),
      channel,
      occurredAt: parsed.occurredAt,
      status: 'inbox',
      source: raw.source,
    };
    if (parsed.txnRef) payment.txnRef = parsed.txnRef;
    if (parsed.payeeVpa) payment.payeeVpa = parsed.payeeVpa;
    if (accountKey) payment.accountKey = accountKey;
    if (credits.some((c) => isSelfTransfer(payment, c))) {
      payment.status = 'ignored';
      payment.selfTransfer = true;
      selfTransfers++;
    }
    pool.push(toPool(payment));
    added.set(payment.id, payment);
  }

  return {
    added: [...added.values()],
    updated: [...updated.values()],
    newAccounts: [...newAccounts.values()],
    credits,
    selfTransfers,
  };
}
