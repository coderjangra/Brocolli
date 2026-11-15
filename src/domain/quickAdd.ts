import { rupeesToPaise } from './money';
import type { Paise, PersonId } from './types';

export interface QuickAddResult {
  amountPaise: Paise | null;
  description: string;
  personIds: PersonId[];
  /** Names after "w"/"with" that matched nobody (or more than one person). */
  unknownNames: string[];
}

const AMOUNT = /^(?:₹|rs\.?|inr)?([\d,]*\.?\d+)$/i;
const WITH = new Set(['w', 'w/', 'with']);
const FILLER = new Set(['and', '&', '+']);

/**
 * Parse one line like `250 zomato w rahul aman` into an amount, a description
 * and the people to split with. Never throws; anything it can't read is left
 * in the description.
 */
export function parseQuickAdd(
  text: string,
  people: readonly { id: PersonId; name: string }[],
): QuickAddResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let amountPaise: Paise | null = null;
  const words: string[] = [];
  const names: string[] = [];
  let inPeople = false;

  for (const token of tokens) {
    if (!inPeople && WITH.has(token.toLowerCase())) {
      inPeople = true;
      continue;
    }
    if (amountPaise === null) {
      const match = AMOUNT.exec(token);
      const paise = match ? rupeesToPaise(match[1]!) : null;
      if (paise !== null && paise > 0) {
        amountPaise = paise;
        continue;
      }
    }
    if (inPeople) {
      for (const part of token.split(',')) {
        if (part && !FILLER.has(part.toLowerCase())) names.push(part);
      }
    } else {
      words.push(token);
    }
  }

  const personIds: PersonId[] = [];
  const unknownNames: string[] = [];
  for (const name of names) {
    const needle = name.toLowerCase();
    const firstNames = people.map((p) => p.name.trim().toLowerCase().split(/\s+/)[0] ?? '');
    let hits = people.filter((_, i) => firstNames[i] === needle);
    if (hits.length === 0) hits = people.filter((_, i) => firstNames[i]!.startsWith(needle));
    if (hits.length === 1) {
      if (!personIds.includes(hits[0]!.id)) personIds.push(hits[0]!.id);
    } else if (!unknownNames.some((n) => n.toLowerCase() === needle)) {
      unknownNames.push(name);
    }
  }

  return { amountPaise, description: words.join(' '), personIds, unknownNames };
}
