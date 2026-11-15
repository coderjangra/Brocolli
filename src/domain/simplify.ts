import { assertPaise } from './money';
import type { Paise, PersonId, Transfer } from './types';

/**
 * Minimal-ish set of transfers that settles a group.
 * `nets`: > 0 means the person is owed, < 0 means they owe; must sum to zero.
 * Greedy: the largest debtor pays the largest creditor until everyone is at
 * zero. Every transfer clears at least one person, so n people with a non-zero
 * net need at most n − 1 transfers. Ties break by person id, so the output is
 * deterministic.
 */
export function simplifyDebts(nets: ReadonlyMap<PersonId, Paise>): Transfer[] {
  const creditors: [PersonId, Paise][] = [];
  const debtors: [PersonId, Paise][] = [];
  let sum = 0;
  for (const [personId, amount] of nets) {
    assertPaise(amount, `net for ${personId}`);
    sum += amount;
    if (amount > 0) creditors.push([personId, amount]);
    else if (amount < 0) debtors.push([personId, -amount]);
  }
  if (sum !== 0) throw new RangeError('nets must sum to zero');

  const largestFirst = (a: [PersonId, Paise], b: [PersonId, Paise]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(largestFirst);
    debtors.sort(largestFirst);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amountPaise = Math.min(creditor[1], debtor[1]);
    transfers.push({ from: debtor[0], to: creditor[0], amountPaise });
    creditor[1] -= amountPaise;
    debtor[1] -= amountPaise;
    if (creditor[1] === 0) creditors.shift();
    if (debtor[1] === 0) debtors.shift();
  }
  return transfers;
}
