/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  findDuplicate,
  mergeParsed,
  parseCapture,
  payeeDisplayName,
  payeeKey,
  type ParsedPayment,
  type RawCapture,
} from './parser';

const DIR = join(__dirname, '__fixtures__');

function loadFixture(name: string): RawCapture {
  const raw = readFileSync(join(DIR, `${name}.txt`), 'utf8');
  const [head, ...rest] = raw.split('\nText:\n');
  const fields = Object.fromEntries(
    head!.split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  return {
    source: fields.Source as RawCapture['source'],
    sender: fields.Sender ?? '',
    packageName: fields.Package,
    text: rest.join('\nText:\n').replace(/\n$/, ''),
    receivedAt: 1_762_770_000_000,
  };
}

const names = readdirSync(DIR)
  .filter((f) => f.endsWith('.txt'))
  .map((f) => f.replace(/\.txt$/, ''))
  .sort();

describe('parser fixtures', () => {
  it('has at least 30 fixtures', () => {
    expect(names.length).toBeGreaterThanOrEqual(30);
  });

  it.each(names)('%s', (name) => {
    const expected = JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')) as object | null;
    const parsed = parseCapture(loadFixture(name));
    if (expected === null) expect(parsed).toBeNull();
    else expect(parsed).toMatchObject(expected);
  });
});

describe('parseCapture robustness', () => {
  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), fc.string({ maxLength: 20 }), (text, sender) => {
        const result = parseCapture({ source: 'sms', sender, text, receivedAt: 0 });
        if (result) expect(Number.isSafeInteger(result.amountPaise)).toBe(true);
      }),
    );
  });

  it('never throws on amount-shaped noise', () => {
    const noisy = fc
      .array(
        fc.constantFrom('Rs.', 'INR', '₹', ' ', '1', '0', ',', '.', 'debited', 'to', 'Ref', '@'),
        { maxLength: 60 },
      )
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(noisy, (text) => {
        const result = parseCapture({ source: 'sms', sender: 'VM-HDFCBK', text, receivedAt: 0 });
        if (result) expect(result.amountPaise).toBeGreaterThan(0);
      }),
    );
  });

  it('survives huge input', () => {
    const text = `Sent Rs.10 to X ${'a'.repeat(100_000)}`;
    expect(() => parseCapture({ source: 'sms', sender: 'VM-HDFCBK', text, receivedAt: 0 })).not.toThrow();
  });
});

describe('payee names are never amounts', () => {
  it('does not take "by Rs300" as the payer', () => {
    const parsed = parseCapture({
      source: 'sms',
      sender: 'VM-SBIUPI',
      text: 'Dear SBI UPI User, ur A/cX4321 credited by Rs300 on 10Nov26 by (Ref no 431599988877)',
      receivedAt: 0,
    });
    expect(parsed?.payeeRaw).toBeUndefined();
  });
});

describe('payee helpers', () => {
  it('normalises keys across sources', () => {
    expect(payeeKey('CHAI POINT')).toBe(payeeKey('Chai Point'));
    expect(payeeKey('chai-point.')).toBe('chaipoint');
  });

  it('title-cases shouty names and derives names from VPAs', () => {
    expect(payeeDisplayName({ payeeRaw: 'CHAI POINT' })).toBe('Chai Point');
    expect(payeeDisplayName({ payeeRaw: 'Sharma Tea Stall' })).toBe('Sharma Tea Stall');
    expect(payeeDisplayName({ payeeVpa: 'zomato@hdfcbank' })).toBe('Zomato');
    expect(payeeDisplayName({ payeeVpa: 'paytmqr2810050501011abc@paytm' })).toBe('UPI payment');
    expect(payeeDisplayName({})).toBe('Unknown payee');
  });
});

describe('dedupe', () => {
  const base: ParsedPayment = {
    direction: 'debit',
    amountPaise: 48000,
    payeeRaw: 'CHAI POINT',
    occurredAt: 1_000_000,
    source: 'sms',
  };

  it('treats the same txn ref as the same payment', () => {
    const a = { ...base, txnRef: '431512345678' };
    const b = { ...base, txnRef: '431512345678', occurredAt: base.occurredAt + 3_600_000 };
    expect(findDuplicate([a], b)).toBe(a);
  });

  it('keeps different refs apart even with the same amount', () => {
    const a = { ...base, txnRef: '1111111111' };
    const b = { ...base, txnRef: '2222222222' };
    expect(findDuplicate([a], b)).toBeUndefined();
  });

  it('merges same amount + payee within 3 minutes when a ref is missing', () => {
    const sms = { ...base, txnRef: '431512345678' };
    const notif: ParsedPayment = {
      ...base,
      payeeRaw: 'Chai Point',
      source: 'notification',
      app: 'GPay',
      occurredAt: base.occurredAt + 90_000,
    };
    expect(findDuplicate([sms], notif)).toBe(sms);
    expect(findDuplicate([sms], { ...notif, occurredAt: base.occurredAt + 4 * 60_000 })).toBeUndefined();
    expect(findDuplicate([sms], { ...notif, amountPaise: 48001 })).toBeUndefined();
  });

  it('prefers the richer record when merging', () => {
    const notif: ParsedPayment = { ...base, payeeRaw: 'Chai Point', app: 'GPay', source: 'notification' };
    const sms: ParsedPayment = { ...base, txnRef: '431512345678', accountLast4: '1234', bank: 'HDFC' };
    const merged = mergeParsed(notif, sms);
    expect(merged).toMatchObject({
      txnRef: '431512345678',
      accountLast4: '1234',
      bank: 'HDFC',
      app: 'GPay',
      amountPaise: 48000,
    });
  });
});
