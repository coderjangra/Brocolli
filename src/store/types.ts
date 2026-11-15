import type { HistoryEntry } from '@/domain/history';
import type { Paise, PersonAmount, PersonId, Share, SplitKind } from '@/domain/types';

/** The signed-in user's own person id. */
export const ME: PersonId = 'me';

export interface Person {
  id: PersonId;
  name: string;
  emoji: string;
  upiId?: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  /** Includes ME. */
  memberIds: PersonId[];
  createdAt: number;
}

export interface Expense {
  id: string;
  groupId?: string;
  description: string;
  totalPaise: Paise;
  currency: string;
  occurredAt: number;
  payers: PersonAmount[];
  shares: Share[];
  splitKind: SplitKind;
  source: 'manual' | 'inbox';
  paymentId?: string;
  createdAt: number;
  deletedAt?: number | null;
  /** Newest last. */
  history?: HistoryEntry[];
}

export type ExpenseDraft = Pick<
  Expense,
  'groupId' | 'description' | 'totalPaise' | 'payers' | 'shares' | 'splitKind' | 'paymentId'
> & { occurredAt?: number };

export interface Settlement {
  id: string;
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amountPaise: Paise;
  currency: string;
  method: 'upi' | 'cash';
  status: 'pending' | 'confirmed' | 'cancelled';
  groupId?: string;
  createdAt: number;
  deletedAt?: number | null;
}

export type PaymentStatus = 'inbox' | 'split' | 'personal' | 'ignored';

export type PaymentChannel = 'SMS' | 'GPay' | 'PhonePe' | 'Paytm' | 'BHIM' | 'CRED' | 'Bank app';

/** A captured (or sample) payment waiting in the Inbox. */
export interface Payment {
  id: string;
  amountPaise: Paise;
  payee: string;
  emoji: string;
  account: string;
  channel: PaymentChannel;
  occurredAt: number;
  status: PaymentStatus;
  expenseId?: string;
  /** Where it came from. Missing on data saved before capture existed (= sample). */
  source?: 'sample' | 'sms' | 'notification';
  txnRef?: string;
  payeeVpa?: string;
  /** BankAccount.key of the account the money left from, when known. */
  accountKey?: string;
  /** Auto-ignored: money moved between two of the user's own accounts. */
  selfTransfer?: boolean;
}

/** One of the user's own bank accounts, discovered from captured messages. */
export interface BankAccount {
  /** e.g. "indianbank-4821" */
  key: string;
  bank?: string;
  last4: string;
  nickname?: string;
  /** false = ignore payments from this account. */
  capture: boolean;
  firstSeenAt: number;
}

/** Recent money-in events, kept briefly only to spot self-transfers. */
export interface CreditEvent {
  amountPaise: Paise;
  occurredAt: number;
  accountKey?: string;
  txnRef?: string;
}

export interface Profile {
  name: string;
  upiId: string;
  onboarded: boolean;
}

export interface Settings {
  theme: 'system' | 'dark' | 'light';
  haptics: boolean;
  /** payeeKey()s the user chose to always ignore. */
  mutedPayees: string[];
  /** The Inbox "catch payments automatically" card was dismissed. */
  captureCardDismissed: boolean;
  /** Last time recent bank SMS were scanned (backfill). */
  smsScannedAt?: number;
  /** Capture filter version the last backfill ran with; a newer filter triggers a rescan. */
  captureFilterVersion?: number;
}

export interface AppData {
  profile: Profile;
  settings: Settings;
  people: Person[];
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  payments: Payment[];
  accounts: BankAccount[];
  recentCredits: CreditEvent[];
}
