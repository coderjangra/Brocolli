import { useCallback } from 'react';

import type { BankAccount, Payment } from '@/store/types';
import { useStore } from '@/store/useStore';

export function accountName(account: BankAccount): string {
  return account.nickname?.trim() || `${account.bank ?? 'Account'} ··${account.last4}`;
}

/** Label for where a payment came from, using the account's nickname when there is one. */
export function useAccountLabel(): (payment: Pick<Payment, 'account' | 'accountKey'>) => string {
  const accounts = useStore((s) => s.accounts);
  return useCallback(
    (payment) => {
      const account = payment.accountKey
        ? accounts.find((a) => a.key === payment.accountKey)
        : undefined;
      return account?.nickname?.trim() ? `${account.nickname.trim()} ··${account.last4}` : payment.account;
    },
    [accounts],
  );
}
