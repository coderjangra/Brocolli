import { describe, expect, it } from 'vitest';

import { merchantEmoji } from './merchant';

describe('merchantEmoji', () => {
  it.each([
    ['Zomato', '🍕'],
    ['CHAI POINT', '☕'],
    ['Uber India Systems', '🚕'],
    ['BLINKIT', '🛒'],
    ['PVR Cinemas', '🎬'],
    ['ATM withdrawal', '💵'],
    ['Rahul Sharma', '💸'],
    ['', '💸'],
  ])('%s → %s', (payee, emoji) => {
    expect(merchantEmoji(payee)).toBe(emoji);
  });
});
