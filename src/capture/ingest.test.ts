import { describe, expect, it } from 'vitest';

import type { BankAccount, Payment } from '@/store/types';

import { planIngest, type IngestContext } from './ingest';
import type { RawCapture } from './parser';

let n = 0;
const T0 = 1_762_770_000_000;
const ctx = (over: Partial<IngestContext> = {}): IngestContext => ({
  mutedPayees: [],
  accounts: [],
  recentCredits: [],
  makeId: () => `id-${++n}`,
  now: T0,
  ...over,
});

const hdfcSms: RawCapture = {
  source: 'sms',
  sender: 'VM-HDFCBK',
  text: 'Sent Rs.480.00 From HDFC Bank A/C *1234 To CHAI POINT On 10/11/26 Ref 431512345678',
  receivedAt: T0,
};
const gpayNotif: RawCapture = {
  source: 'notification',
  sender: 'Google Pay',
  packageName: 'com.google.android.apps.nbu.paisa.user',
  text: 'Paid ₹480 to Chai Point',
  receivedAt: T0 + 20_000,
};
const indianDebit = (amount: string, at: number, ref: string): RawCapture => ({
  source: 'sms',
  sender: 'BT-INDBNK-S',
  text: `Sent Rs.${amount} from A/c *4821 on 15-11-26 to ROHAN KUMAR.RRN ${ref}.Avl Bal Rs.201.83.Not you?SMS BLOCK to 9289592895-Indian Bank`,
  receivedAt: at,
});
const indusCredit = (amount: string, at: number, ref: string): RawCapture => ({
  source: 'sms',
  sender: 'AD-INDUSB-S',
  text: `Your IndusInd Bank A/C 2xxxxx7710 credited with Rs ${amount} on 16/11/26 by ROHAN KUMAR. RRN ${ref}`,
  receivedAt: at,
});

describe('planIngest', () => {
  it('turns a bank SMS into an inbox payment', () => {
    const { added } = planIngest([], [hdfcSms], ctx());
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      amountPaise: 48000,
      payee: 'Chai Point',
      emoji: '☕',
      account: 'HDFC ··1234',
      accountKey: 'hdfc-1234',
      channel: 'SMS',
      status: 'inbox',
      source: 'sms',
      txnRef: '431512345678',
    });
  });

  it('merges the SMS and the app notification for one payment', () => {
    const { added } = planIngest([], [gpayNotif, hdfcSms], ctx());
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ channel: 'GPay', txnRef: '431512345678', accountKey: 'hdfc-1234' });
  });

  it('updates an existing payment instead of duplicating it', () => {
    const first = planIngest([], [gpayNotif], ctx()).added;
    const second = planIngest(first, [hdfcSms], ctx());
    expect(second.added).toHaveLength(0);
    expect(second.updated).toHaveLength(1);
    expect(second.updated[0]).toMatchObject({ id: first[0]!.id, txnRef: '431512345678' });
  });

  it('ignores the same SMS delivered twice', () => {
    const first = planIngest([], [hdfcSms], ctx());
    const again = planIngest(first.added, [{ ...hdfcSms, receivedAt: T0 + 3_600_000 }], ctx({ accounts: first.newAccounts }));
    expect(again.added).toEqual([]);
    expect(again.updated).toEqual([]);
  });

  it('skips credits, muted payees and junk as inbox cards', () => {
    const junk: RawCapture = { ...hdfcSms, text: 'Your OTP is 123456' };
    expect(planIngest([], [indusCredit('500.00', T0, '220600000001'), junk], ctx()).added).toHaveLength(0);
    expect(planIngest([], [hdfcSms], ctx({ mutedPayees: ['chaipoint'] })).added).toHaveLength(0);
  });

  it('keeps two genuinely separate payments of the same amount', () => {
    const later = { ...hdfcSms, text: hdfcSms.text.replace('431512345678', '431512345999') };
    const existing: Payment[] = planIngest([], [hdfcSms], ctx()).added;
    expect(planIngest(existing, [later], ctx()).added).toHaveLength(1);
  });
});

describe('accounts', () => {
  it('discovers each bank account once', () => {
    const r = planIngest(
      [],
      [indianDebit('67.00', T0, '618200000001'), indianDebit('15.00', T0 + 1000, '618200000002'), hdfcSms],
      ctx(),
    );
    expect(r.newAccounts.map((a) => [a.key, a.bank, a.last4])).toEqual([
      ['indianbank-4821', 'Indian Bank', '4821'],
      ['hdfc-1234', 'HDFC', '1234'],
    ]);
    expect(r.newAccounts.every((a) => a.capture)).toBe(true);
  });

  it('labels payments with the account nickname source and skips paused accounts', () => {
    const paused: BankAccount = {
      key: 'indianbank-4821',
      bank: 'Indian Bank',
      last4: '4821',
      capture: false,
      firstSeenAt: T0,
    };
    const r = planIngest([], [indianDebit('67.00', T0, '618200000001'), hdfcSms], ctx({ accounts: [paused] }));
    expect(r.added.map((p) => p.payee)).toEqual(['Chai Point']);
  });
});

describe('self-transfers', () => {
  it('auto-ignores a debit matched by an equal credit into another own account', () => {
    const r = planIngest(
      [],
      [indianDebit('500.00', T0, '618200000009'), indusCredit('500.00', T0 + 60_000, '618200000010')],
      ctx(),
    );
    expect(r.added).toHaveLength(1);
    expect(r.added[0]).toMatchObject({ status: 'ignored', selfTransfer: true });
    expect(r.selfTransfers).toBe(1);
  });

  it('works when the credit arrived first (remembered from an earlier batch)', () => {
    const first = planIngest([], [indusCredit('500.00', T0, '618200000010')], ctx());
    expect(first.credits).toHaveLength(1);
    const second = planIngest([], [indianDebit('500.00', T0 + 30_000, '618200000009')], ctx({ recentCredits: first.credits }));
    expect(second.added[0]).toMatchObject({ status: 'ignored', selfTransfer: true });
  });

  it('flips an inbox debit when the matching credit arrives later', () => {
    const first = planIngest([], [indianDebit('500.00', T0, '618200000009')], ctx());
    const second = planIngest(first.added, [indusCredit('500.00', T0 + 120_000, '618200000010')], ctx());
    expect(second.updated[0]).toMatchObject({ id: first.added[0]!.id, status: 'ignored', selfTransfer: true });
  });

  it('does not treat a same-account refund or a late credit as a transfer', () => {
    const sameAccountCredit: RawCapture = {
      ...indianDebit('500.00', T0 + 60_000, '618200000010'),
      text: 'Your A/c *4821 is credited with Rs.500.00 on 15-11-26 by ROHAN KUMAR. RRN 618200000010 - Indian Bank',
    };
    const a = planIngest([], [indianDebit('500.00', T0, '618200000009'), sameAccountCredit], ctx());
    expect(a.added[0]).toMatchObject({ status: 'inbox' });
    const b = planIngest(
      [],
      [indianDebit('500.00', T0, '618200000009'), indusCredit('500.00', T0 + 30 * 60_000, '618200000010')],
      ctx(),
    );
    expect(b.added[0]).toMatchObject({ status: 'inbox' });
  });

  it('forgets credits older than three days', () => {
    const old = { amountPaise: 100, occurredAt: T0 - 4 * 86_400_000, accountKey: 'x-1' };
    const r = planIngest([], [], ctx({ recentCredits: [old] }));
    expect(r.credits).toEqual([]);
  });
});
