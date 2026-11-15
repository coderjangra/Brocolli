/** Integer paise. ₹480.50 === 48050. Never a float. */
export type Paise = number;

export type PersonId = string;

export type SplitKind = 'equal' | 'exact' | 'percent' | 'shares' | 'item';

export type SplitSpec =
  | { kind: 'equal' }
  | { kind: 'exact'; amounts: Readonly<Record<PersonId, Paise>> }
  /** Percentages with at most 2 decimals; must sum to exactly 100. */
  | { kind: 'percent'; pcts: Readonly<Record<PersonId, number>> }
  /** Non-negative weights with at most 2 decimals (1, 2, 0.5 ...). */
  | { kind: 'shares'; weights: Readonly<Record<PersonId, number>> };

export interface Share {
  personId: PersonId;
  amountPaise: Paise;
  splitKind: SplitKind;
  /** The percent or weight the user entered; absent for equal/exact. */
  splitValue?: number;
}

export interface PersonAmount {
  personId: PersonId;
  amountPaise: Paise;
}

export interface ExpenseInput {
  totalPaise: Paise;
  currency: string;
  payers: readonly PersonAmount[];
  shares: readonly PersonAmount[];
  deletedAt?: unknown;
}

export interface SettlementInput {
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountPaise: Paise;
  currency: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  deletedAt?: unknown;
}

export interface Transfer {
  from: PersonId;
  to: PersonId;
  amountPaise: Paise;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E };
