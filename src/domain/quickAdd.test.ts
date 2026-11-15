import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './quickAdd';
import { buildUpiUrl, isValidVpa } from './upi';

const people = [
  { id: 'p1', name: 'Rahul Verma' },
  { id: 'p2', name: 'Aman' },
  { id: 'p3', name: 'Amanda' },
  { id: 'p4', name: 'Zoya Khan' },
];

describe('parseQuickAdd', () => {
  it('reads the spec example', () => {
    expect(parseQuickAdd('250 zomato w rahul aman', people)).toEqual({
      amountPaise: 25000,
      description: 'zomato',
      personIds: ['p1', 'p2'],
      unknownNames: [],
    });
  });

  it('accepts the amount anywhere, with ₹ / rs and paise', () => {
    expect(parseQuickAdd('chai point ₹480.50 with zoya', people)).toMatchObject({
      amountPaise: 48050,
      description: 'chai point',
      personIds: ['p4'],
    });
    expect(parseQuickAdd('rs1,200 rent', people).amountPaise).toBe(120000);
  });

  it('matches unique prefixes, exact first names first', () => {
    expect(parseQuickAdd('90 auto w zo', people).personIds).toEqual(['p4']);
    // "aman" is an exact first name even though "amanda" also starts with it
    expect(parseQuickAdd('90 auto w aman', people).personIds).toEqual(['p2']);
  });

  it('reports ambiguous and unknown names instead of guessing', () => {
    const result = parseQuickAdd('90 auto w ama, neha and rahul', people);
    expect(result.personIds).toEqual(['p1']);
    expect(result.unknownNames).toEqual(['ama', 'neha']);
  });

  it('only the first number is the amount', () => {
    expect(parseQuickAdd('300 pizza 2 w rahul', people)).toMatchObject({
      amountPaise: 30000,
      description: 'pizza 2',
    });
  });

  it('never throws on junk', () => {
    expect(parseQuickAdd('', people)).toEqual({
      amountPaise: null,
      description: '',
      personIds: [],
      unknownNames: [],
    });
    expect(parseQuickAdd('   w   ', people).personIds).toEqual([]);
    expect(parseQuickAdd('0 nothing', people).amountPaise).toBeNull();
    expect(parseQuickAdd('1.234 odd', people).amountPaise).toBeNull();
  });

  it('does not repeat a person', () => {
    expect(parseQuickAdd('50 tea w rahul rahul', people).personIds).toEqual(['p1']);
  });
});

describe('buildUpiUrl', () => {
  it('builds the pay link with 2-decimal rupees', () => {
    expect(
      buildUpiUrl({ vpa: 'rahul@okhdfc', name: 'Rahul Verma', amountPaise: 48050, note: 'Chai' }),
    ).toBe('upi://pay?pa=rahul%40okhdfc&pn=Rahul%20Verma&am=480.50&cu=INR&tn=Chai');
  });

  it('caps the note at 50 characters and omits it when empty', () => {
    const url = buildUpiUrl({
      vpa: 'a.b-c@ybl',
      name: 'A',
      amountPaise: 100,
      note: 'x'.repeat(80),
    })!;
    expect(url.endsWith(`tn=${'x'.repeat(50)}`)).toBe(true);
    expect(buildUpiUrl({ vpa: 'ab@ybl', name: 'A', amountPaise: 100 })).toBe(
      'upi://pay?pa=ab%40ybl&pn=A&am=1.00&cu=INR',
    );
  });

  it('rejects bad VPAs and amounts', () => {
    expect(buildUpiUrl({ vpa: 'not a vpa', name: 'A', amountPaise: 100 })).toBeNull();
    expect(buildUpiUrl({ vpa: 'ab@ybl', name: 'A', amountPaise: 0 })).toBeNull();
    expect(buildUpiUrl({ vpa: 'ab@ybl', name: 'A', amountPaise: 10.5 })).toBeNull();
    expect(isValidVpa('chaipoint@ybl')).toBe(true);
    expect(isValidVpa('a@b')).toBe(false);
  });
});
