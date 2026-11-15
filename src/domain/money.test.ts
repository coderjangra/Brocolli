import { describe, expect, it } from 'vitest';

import { formatMoney } from './format';
import { isPaise, paiseToDecimalString, rupeesToPaise, sumPaise, toScaledInt } from './money';

describe('rupeesToPaise', () => {
  it.each([
    ['480', 48000],
    ['480.5', 48050],
    ['480.50', 48050],
    ['0.01', 1],
    ['.5', 50],
    ['1,23,456.00', 12345600],
    ['1,234', 123400],
    [' 250 ', 25000],
    // 0.1 + 0.2 style traps: digits are read as strings, never as floats
    ['1.10', 110],
    ['19.99', 1999],
    ['4.35', 435],
  ])('%s → %i paise', (input, expected) => {
    expect(rupeesToPaise(input)).toBe(expected);
  });

  it.each(['', '.', 'abc', '-5', '1.234', '1e3', '12,34,5', '₹250', '1 000'])(
    'rejects %j',
    (input) => {
      expect(rupeesToPaise(input)).toBeNull();
    },
  );
});

describe('paise helpers', () => {
  it('isPaise accepts only safe integers', () => {
    expect(isPaise(48050)).toBe(true);
    expect(isPaise(-1)).toBe(true);
    expect(isPaise(480.5)).toBe(false);
    expect(isPaise(Number.NaN)).toBe(false);
    expect(isPaise('100')).toBe(false);
  });

  it('sumPaise refuses floats', () => {
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(() => sumPaise([1, 0.5])).toThrow(TypeError);
  });

  it('paiseToDecimalString always has 2 decimals', () => {
    expect(paiseToDecimalString(48050)).toBe('480.50');
    expect(paiseToDecimalString(5)).toBe('0.05');
    expect(paiseToDecimalString(100)).toBe('1.00');
    expect(paiseToDecimalString(-1205)).toBe('-12.05');
  });

  it('toScaledInt converts up to 2 decimals exactly', () => {
    expect(toScaledInt(33.33)).toBe(3333);
    expect(toScaledInt(0.07)).toBe(7);
    expect(toScaledInt(1.15)).toBe(115);
    expect(toScaledInt(50)).toBe(5000);
    expect(toScaledInt(33.333)).toBeNull();
    expect(toScaledInt(-1)).toBeNull();
    expect(toScaledInt(Number.NaN)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('uses Indian grouping and hides .00 on whole rupees', () => {
    expect(formatMoney(12345600)).toBe('₹1,23,456');
    expect(formatMoney(48000)).toBe('₹480');
    expect(formatMoney(0)).toBe('₹0');
  });

  it('shows paise when there are any', () => {
    expect(formatMoney(48050)).toBe('₹480.50');
    expect(formatMoney(5)).toBe('₹0.05');
    expect(formatMoney(12345678)).toBe('₹1,23,456.78');
  });

  it('can keep .00', () => {
    expect(formatMoney(12345600, { hideZeroPaise: false })).toBe('₹1,23,456.00');
  });

  it('handles signs', () => {
    expect(formatMoney(-12000)).toBe('-₹120');
    expect(formatMoney(34000, { showPlus: true })).toBe('+₹340');
    expect(formatMoney(0, { showPlus: true })).toBe('₹0');
  });

  it('rejects float amounts', () => {
    expect(() => formatMoney(480.5)).toThrow(TypeError);
  });
});
