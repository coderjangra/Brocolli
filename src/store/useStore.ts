import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

import { planIngest } from '@/capture/ingest';
import { payeeKey, type RawCapture } from '@/capture/parser';
import { describeChanges } from '@/domain/history';
import { validateExpense } from '@/domain/split';
import type { Paise, PersonId } from '@/domain/types';

import {
  ME,
  type AppData,
  type BankAccount,
  type Expense,
  type ExpenseDraft,
  type Group,
  type Payment,
  type PaymentStatus,
  type Person,
  type Profile,
  type Settings,
  type Settlement,
} from './types';

const STORAGE_KEY = 'brocolli.state.v1';

const PERSON_EMOJI = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐙', '🦄', '🐨', '🐵', '🐧', '🦁', '🐰'];

/** Time-ordered unique id (UUID v7 layout: 48-bit ms timestamp, then random). */
export function newId(): string {
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0');
  const rand = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const ts = hex(Date.now(), 12);
  return `${ts.slice(0, 8)}-${ts.slice(8)}-7${rand(3)}-${hex(8 + Math.floor(Math.random() * 4), 1)}${rand(3)}-${rand(12)}`;
}

const emptyData = (): AppData => ({
  profile: { name: '', upiId: '', onboarded: false },
  settings: { theme: 'system', haptics: true, mutedPayees: [], captureCardDismissed: false },
  people: [],
  groups: [],
  expenses: [],
  settlements: [],
  payments: [],
  accounts: [],
  recentCredits: [],
});

function load(): AppData {
  const base = emptyData();
  try {
    const raw = Storage.getItemSync(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AppData>;
    return {
      ...base,
      ...saved,
      profile: { ...base.profile, ...saved.profile },
      settings: { ...base.settings, ...saved.settings },
    };
  } catch {
    return base;
  }
}

const SAMPLE: [string, string, Paise, string, Payment['channel'], number][] = [
  ['Chai Point', '☕', 48000, 'HDFC ··1234', 'SMS', 12],
  ['Zomato', '🍕', 61250, 'HDFC ··1234', 'GPay', 95],
  ['Uber', '🚕', 23800, 'ICICI ··8841', 'PhonePe', 180],
  ['BigBasket', '🛒', 184500, 'HDFC ··1234', 'SMS', 26 * 60],
  ['PVR Cinemas', '🎬', 96000, 'ICICI ··8841', 'GPay', 30 * 60],
  ['Jio Recharge', '📱', 29900, 'HDFC ··1234', 'PhonePe', 49 * 60],
  ['Blinkit', '🥛', 43100, 'HDFC ··1234', 'GPay', 52 * 60],
  ['Rapido', '🛵', 7400, 'ICICI ··8841', 'SMS', 75 * 60],
];

export function samplePayments(now = Date.now()): Payment[] {
  return SAMPLE.map(([payee, emoji, amountPaise, account, channel, minutesAgo]) => ({
    id: newId(),
    payee,
    emoji,
    amountPaise,
    account,
    channel,
    occurredAt: now - minutesAgo * 60_000,
    status: 'inbox',
    source: 'sample',
  }));
}

type SaveResult = { ok: true; id: string } | { ok: false; message: string };

interface Actions {
  completeOnboarding(input: {
    name: string;
    upiId: string;
    people: string[];
    withSamples: boolean;
  }): void;
  updateProfile(patch: Partial<Profile>): void;
  updateSettings(patch: Partial<Settings>): void;
  addPerson(name: string): PersonId;
  updatePerson(id: PersonId, patch: Partial<Pick<Person, 'name' | 'upiId'>>): void;
  addGroup(input: Pick<Group, 'name' | 'emoji' | 'memberIds'>): string;
  saveExpense(draft: ExpenseDraft, id?: string): SaveResult;
  setExpenseDeleted(id: string, deleted: boolean): void;
  addSettlement(input: Omit<Settlement, 'id' | 'createdAt' | 'currency' | 'status'>): string;
  setSettlementDeleted(id: string, deleted: boolean): void;
  sortPayment(id: string, status: PaymentStatus, expenseId?: string): void;
  /** Undo the most recent sort this session. Returns false if there is nothing to undo. */
  rewind(): boolean;
  loadSamplePayments(): void;
  /** Parse + dedupe captured messages into the Inbox. */
  ingestCaptures(raws: RawCapture[]): { added: number; selfTransfers: number };
  updateAccount(key: string, patch: Partial<Pick<BankAccount, 'nickname' | 'capture'>>): void;
  /** "Always ignore this payee": ignores this payment and future ones from the same payee. */
  mutePayee(paymentId: string): void;
  resetAll(): AppData;
  restore(data: AppData): void;
}

interface Session {
  /** Sorts made this session, newest last. Not persisted. */
  sortHistory: { paymentId: string; expenseId?: string }[];
}

export type Store = AppData & Session & Actions;

export const useStore = create<Store>()((set, get) => ({
  ...load(),
  sortHistory: [],

  completeOnboarding({ name, upiId, people, withSamples }) {
    const now = Date.now();
    set((s) => ({
      profile: { name: name.trim(), upiId: upiId.trim(), onboarded: true },
      people: [
        ...s.people,
        ...people.map((personName, i) => ({
          id: newId(),
          name: personName,
          emoji: PERSON_EMOJI[(s.people.length + i) % PERSON_EMOJI.length]!,
          createdAt: now + i,
        })),
      ],
      payments: withSamples ? [...s.payments, ...samplePayments(now)] : s.payments,
    }));
  },

  updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  addPerson(name) {
    const id = newId();
    set((s) => ({
      people: [
        ...s.people,
        {
          id,
          name: name.trim(),
          emoji: PERSON_EMOJI[s.people.length % PERSON_EMOJI.length]!,
          createdAt: Date.now(),
        },
      ],
    }));
    return id;
  },

  updatePerson: (id, patch) =>
    set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  addGroup(input) {
    const id = newId();
    const memberIds = input.memberIds.includes(ME) ? input.memberIds : [ME, ...input.memberIds];
    set((s) => ({
      groups: [...s.groups, { ...input, memberIds, id, createdAt: Date.now() }],
    }));
    return id;
  },

  saveExpense(draft, id) {
    // Hard rule: sum(payers) == total == sum(shares), checked before every write.
    const check = validateExpense({ ...draft, currency: 'INR' });
    if (!check.ok) return { ok: false, message: check.errors.map((e) => e.message).join('; ') };
    if (!draft.description.trim()) return { ok: false, message: 'Add a description' };

    const now = Date.now();
    const state = get();
    const existing = id ? state.expenses.find((e) => e.id === id) : undefined;
    const expense: Expense = {
      id: existing?.id ?? newId(),
      currency: 'INR',
      source: draft.paymentId ? 'inbox' : 'manual',
      createdAt: existing?.createdAt ?? now,
      ...draft,
      description: draft.description.trim(),
      occurredAt: draft.occurredAt ?? existing?.occurredAt ?? now,
      deletedAt: null,
    };
    if (existing) {
      const nameOf = (pid: PersonId) =>
        pid === ME ? 'You' : (state.people.find((p) => p.id === pid)?.name ?? 'Someone');
      const groupName = (gid: string | undefined) =>
        gid ? (state.groups.find((g) => g.id === gid)?.name ?? 'a group') : 'no group';
      const changes = describeChanges(existing, expense, nameOf, groupName);
      expense.history = changes.length
        ? [...(existing.history ?? []), { at: now, changes }]
        : existing.history;
      if (!expense.history) delete expense.history;
    }
    set((s) => ({
      expenses: existing
        ? s.expenses.map((e) => (e.id === expense.id ? expense : e))
        : [...s.expenses, expense],
    }));
    return { ok: true, id: expense.id };
  },

  setExpenseDeleted: (id, deleted) =>
    set((s) => ({
      expenses: s.expenses.map((e) =>
        e.id === id ? { ...e, deletedAt: deleted ? Date.now() : null } : e,
      ),
    })),

  addSettlement(input) {
    const id = newId();
    set((s) => ({
      settlements: [
        ...s.settlements,
        { ...input, id, currency: 'INR', status: 'confirmed', createdAt: Date.now() },
      ],
    }));
    return id;
  },

  setSettlementDeleted: (id, deleted) =>
    set((s) => ({
      settlements: s.settlements.map((x) =>
        x.id === id ? { ...x, deletedAt: deleted ? Date.now() : null } : x,
      ),
    })),

  sortPayment: (id, status, expenseId) =>
    set((s) => ({
      payments: s.payments.map((p) => (p.id === id ? { ...p, status, expenseId } : p)),
      sortHistory: [...s.sortHistory, { paymentId: id, expenseId }],
    })),

  rewind() {
    const last = get().sortHistory.at(-1);
    if (!last) return false;
    set((s) => ({
      sortHistory: s.sortHistory.slice(0, -1),
      payments: s.payments.map((p) =>
        p.id === last.paymentId ? { ...p, status: 'inbox', expenseId: undefined } : p,
      ),
      expenses: last.expenseId
        ? s.expenses.map((e) => (e.id === last.expenseId ? { ...e, deletedAt: Date.now() } : e))
        : s.expenses,
    }));
    return true;
  },

  loadSamplePayments: () => set((s) => ({ payments: [...s.payments, ...samplePayments()] })),

  ingestCaptures(raws) {
    const { payments, settings, accounts, recentCredits } = get();
    const result = planIngest(payments, raws, {
      mutedPayees: settings.mutedPayees,
      accounts,
      recentCredits,
      makeId: newId,
      now: Date.now(),
    });
    const patch = new Map(result.updated.map((p) => [p.id, p]));
    set((s) => ({
      payments: [...s.payments.map((p) => patch.get(p.id) ?? p), ...result.added],
      accounts: [...s.accounts, ...result.newAccounts],
      recentCredits: result.credits,
    }));
    return {
      added: result.added.filter((p) => p.status === 'inbox').length,
      selfTransfers: result.selfTransfers,
    };
  },

  updateAccount: (key, patch) =>
    set((s) => ({ accounts: s.accounts.map((a) => (a.key === key ? { ...a, ...patch } : a)) })),

  mutePayee(paymentId) {
    const payment = get().payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const key = payeeKey(payment.payee);
    set((s) => ({
      settings: {
        ...s.settings,
        mutedPayees: s.settings.mutedPayees.includes(key)
          ? s.settings.mutedPayees
          : [...s.settings.mutedPayees, key],
      },
      payments: s.payments.map((p) => (p.id === paymentId ? { ...p, status: 'ignored' } : p)),
      sortHistory: [...s.sortHistory, { paymentId }],
    }));
  },

  resetAll() {
    const snapshot = pickData(get());
    set({ ...emptyData(), sortHistory: [] });
    return snapshot;
  },

  restore: (data) => set({ ...data }),
}));

function pickData(s: Store): AppData {
  const { profile, settings, people, groups, expenses, settlements, payments } = s;
  const { accounts, recentCredits } = s;
  return {
    profile,
    settings,
    people,
    groups,
    expenses,
    settlements,
    payments,
    accounts,
    recentCredits,
  };
}

export function exportData(): string {
  return JSON.stringify(pickData(useStore.getState()), null, 2);
}

// Local-first: every change is written to on-device SQLite right away.
useStore.subscribe((state) => {
  Storage.setItem(STORAGE_KEY, JSON.stringify(pickData(state))).catch(() => {});
});
