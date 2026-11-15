import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import type { BankAccount } from '@/store/types';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/Icon';
import { Card, Field, T } from '@/ui/kit';

import { accountName } from './accounts';

function AccountRow({ account }: { account: BankAccount }) {
  const { colors } = useTheme();
  const updateAccount = useStore((s) => s.updateAccount);
  const count = useStore(
    (s) => s.payments.filter((p) => p.accountKey === account.key && !p.selfTransfer).length,
  );
  const [nickname, setNickname] = useState(account.nickname ?? '');

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name="card" color={account.capture ? colors.brand : colors.textMuted} />
        <View style={styles.flex}>
          <T bold numberOfLines={1}>
            {accountName(account)}
          </T>
          <T v="caption" tone="muted">
            {account.bank ?? 'Bank'} ··{account.last4} · {count} payment{count === 1 ? '' : 's'}
          </T>
        </View>
        <Switch
          value={account.capture}
          onValueChange={(capture) => updateAccount(account.key, { capture })}
          trackColor={{ true: colors.brand, false: colors.border }}
          accessibilityLabel={`Catch payments from ${accountName(account)}`}
        />
      </View>
      <Field
        placeholder="Nickname, e.g. Main or Savings"
        value={nickname}
        onChangeText={setNickname}
        onEndEditing={() => updateAccount(account.key, { nickname: nickname.trim() || undefined })}
        maxLength={24}
        returnKeyType="done"
      />
    </View>
  );
}

/** "Your accounts": discovered from bank messages; each can be renamed or paused. */
export function AccountsCard() {
  const accounts = useStore((s) => s.accounts);
  return (
    <Card>
      {accounts.length === 0 ? (
        <T v="caption" tone="muted">
          Your bank accounts appear here after Brocolli catches a payment from each one.
        </T>
      ) : (
        <>
          {accounts.map((account) => (
            <AccountRow key={account.key} account={account} />
          ))}
          <T v="caption" tone="muted">
            Money moved between your own accounts is skipped automatically. Switch an account off to
            stop catching its payments.
          </T>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
