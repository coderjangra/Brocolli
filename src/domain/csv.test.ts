import { describe, expect, it } from 'vitest';

import { csvCell, ledgerToCsv } from './csv';

const names: Record<string, string> = { me: 'You', a: 'Aman, Jr' };
const nameOf = (id: string) => names[id] ?? id;
const groupName = (id: string | undefined) => (id ? 'Flat 302' : '');

describe('csvCell', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-120.00')).toBe('-120.00');
  });
});

describe('ledgerToCsv', () => {
  it('writes expenses and settlements oldest first with my balance effect', () => {
    const csv = ledgerToCsv(
      [
        {
          occurredAt: new Date(2026, 10, 10).getTime(),
          description: 'Dinner',
          groupId: 'g',
          totalPaise: 48000,
          payers: [{ personId: 'me', amountPaise: 48000 }],
          shares: [
            { personId: 'me', amountPaise: 24000 },
            { personId: 'a', amountPaise: 24000 },
          ],
        },
        {
          occurredAt: 0,
          description: 'deleted',
          totalPaise: 100,
          payers: [],
          shares: [],
          deletedAt: 1,
        },
      ],
      [
        {
          createdAt: new Date(2026, 10, 11).getTime(),
          fromPersonId: 'a',
          toPersonId: 'me',
          amountPaise: 24000,
          method: 'upi',
        },
      ],
      'me',
      nameOf,
      groupName,
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      '2026-11-10,Expense,Dinner,Flat 302,480.00,You (480.00),"You (240.00); Aman, Jr (240.00)",240.00,240.00',
    );
    expect(lines[2]).toBe('2026-11-11,Settlement (upi),"Aman, Jr paid You",,240.00,"Aman, Jr",You,0.00,-240.00');
  });
});
