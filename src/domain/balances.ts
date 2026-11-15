import { allocate, validateExpense } from './split';
import type { ExpenseInput, Paise, PersonId, SettlementInput } from './types';

/** Two person ids joined as "a|b" with a < b. Build with pairKey(), never by hand. */
export type PersonPair = string;

const SEPARATOR = '|';

export function pairKey(a: PersonId, b: PersonId): PersonPair {
  if (a.includes(SEPARATOR) || b.includes(SEPARATOR)) {
    throw new Error(`person ids must not contain "${SEPARATOR}"`);
  }
  return a < b ? `${a}${SEPARATOR}${b}` : `${b}${SEPARATOR}${a}`;
}

export function splitPairKey(key: PersonPair): [PersonId, PersonId] {
  const at = key.indexOf(SEPARATOR);
  return [key.slice(0, at), key.slice(at + 1)];
}

/** Record that `debtor` owes `creditor` `amount` more paise. */
function addDebt(
  nets: Map<PersonPair, Paise>,
  creditor: PersonId,
  debtor: PersonId,
  amount: Paise,
): void {
  if (amount === 0 || creditor === debtor) return;
  const key = pairKey(creditor, debtor);
  const signed = creditor < debtor ? amount : -amount;
  const next = (nets.get(key) ?? 0) + signed;
  if (next === 0) nets.delete(key);
  else nets.set(key, next);
}

/**
 * Who owes whom inside one expense. Each person's net is paid − share. With one
 * payer every other person simply owes the payer their share. With several
 * payers, each debtor's debt is spread across the creditors in proportion to
 * what the creditors are still owed (largest remainder), so every person's net
 * is preserved to the paisa.
 */
function applyExpense(nets: Map<PersonPair, Paise>, expense: ExpenseInput): void {
  const net = new Map<PersonId, Paise>();
  for (const payer of expense.payers) {
    net.set(payer.personId, (net.get(payer.personId) ?? 0) + payer.amountPaise);
  }
  for (const share of expense.shares) {
    net.set(share.personId, (net.get(share.personId) ?? 0) - share.amountPaise);
  }

  const creditors: PersonId[] = [];
  const owed: Paise[] = [];
  const debtors: [PersonId, Paise][] = [];
  for (const [personId, amount] of net) {
    if (amount > 0) {
      creditors.push(personId);
      owed.push(amount);
    } else if (amount < 0) {
      debtors.push([personId, -amount]);
    }
  }

  for (const [debtor, debt] of debtors) {
    const parts = allocate(debt, owed);
    parts.forEach((part, i) => {
      owed[i]! -= part;
      addDebt(nets, creditors[i]!, debtor, part);
    });
  }
}

/**
 * Net balance for every pair of people in one currency.
 * Key = pairKey(a, b); value > 0 means the second id owes the first, value < 0
 * the reverse. Settled pairs are omitted. Read it with netBetween().
 *
 * Deleted rows and other currencies are skipped. Only `confirmed` settlements
 * count. Throws if an expense breaks sum(payers) == total == sum(shares).
 */
export function netBalances(
  expenses: readonly ExpenseInput[],
  settlements: readonly SettlementInput[],
  currency: string,
): Map<PersonPair, Paise> {
  const nets = new Map<PersonPair, Paise>();

  for (const expense of expenses) {
    if (expense.deletedAt != null || expense.currency !== currency) continue;
    const check = validateExpense(expense);
    if (!check.ok) {
      throw new Error(`invalid expense: ${check.errors.map((e) => e.code).join(', ')}`);
    }
    applyExpense(nets, expense);
  }

  for (const settlement of settlements) {
    if (settlement.deletedAt != null || settlement.currency !== currency) continue;
    if (settlement.status !== 'confirmed') continue;
    if (!Number.isSafeInteger(settlement.amountPaise) || settlement.amountPaise <= 0) {
      throw new Error('settlement amount must be a positive integer of paise');
    }
    // `from` paid `to`, which cancels that much of what `from` owed.
    addDebt(nets, settlement.fromPersonId, settlement.toPersonId, settlement.amountPaise);
  }

  return nets;
}

/** How much `other` owes `me` (negative: I owe them). */
export function netBetween(
  nets: ReadonlyMap<PersonPair, Paise>,
  me: PersonId,
  other: PersonId,
): Paise {
  if (me === other) return 0;
  const value = nets.get(pairKey(me, other)) ?? 0;
  return me < other || value === 0 ? value : -value;
}

/**
 * One net number per person across all their pairs: > 0 is owed money, < 0 owes.
 * People who are fully settled are omitted. This is the input to simplifyDebts().
 */
export function personNets(nets: ReadonlyMap<PersonPair, Paise>): Map<PersonId, Paise> {
  const totals = new Map<PersonId, Paise>();
  for (const [key, value] of nets) {
    const [first, second] = splitPairKey(key);
    totals.set(first, (totals.get(first) ?? 0) + value);
    totals.set(second, (totals.get(second) ?? 0) - value);
  }
  for (const [personId, total] of totals) {
    if (total === 0) totals.delete(personId);
  }
  return totals;
}
