import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { monthRange, monthSpending } from '@/domain/spending';
import { accountName } from '@/features/accounts/accounts';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Card, IconButton, Money, T } from '@/ui/kit';

/** "Where did my money go": this month by default, step back through earlier months. */
export function SpendingCard() {
  const { colors } = useTheme();
  const payments = useStore((s) => s.payments);
  const expenses = useStore((s) => s.expenses);
  const accounts = useStore((s) => s.accounts);
  const [offset, setOffset] = useState(0);

  const ref = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - offset, 1);
  }, [offset]);
  const spend = useMemo(
    () => monthSpending(payments, expenses, ME, monthRange(ref)),
    [payments, expenses, ref],
  );
  const max = Math.max(1, ...spend.byAccount.map((a) => a.paidOut));
  const label = ref.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Card>
      <View style={styles.head}>
        <IconButton
          name="back"
          label="Previous month"
          size={36}
          onPress={() => setOffset((o) => o + 1)}
        />
        <T bold center style={styles.flex}>
          {offset === 0 ? 'Spent this month' : label}
        </T>
        <IconButton
          name="chevron"
          label="Next month"
          size={36}
          disabled={offset === 0}
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
        />
      </View>
      <View style={styles.total}>
        <Money paise={spend.total} v="display" countUp />
        <T v="caption" tone="muted" center>
          <Money paise={spend.personal} v="caption" /> on yourself ·{' '}
          <Money paise={spend.splitShare} v="caption" /> your share of splits
        </T>
      </View>
      {spend.byAccount.map((row, i) => {
        const account = accounts.find((a) => a.key === row.accountKey);
        const name = account ? accountName(account) : 'Other / manual';
        return (
          <Animated.View
            key={row.accountKey ?? 'none'}
            entering={FadeIn.delay(80 * i)}
            layout={LinearTransition.springify()}
            style={styles.account}
          >
            <View style={styles.accountHead}>
              <T style={styles.flex} numberOfLines={1}>
                {name}
              </T>
              <Money paise={row.paidOut} v="caption" />
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: colors.brand, width: `${(row.paidOut / max) * 100}%` },
                ]}
              />
            </View>
            <T v="caption" tone="muted">
              {row.count} payment{row.count === 1 ? '' : 's'} sorted
            </T>
          </Animated.View>
        );
      })}
      {spend.byAccount.length === 0 ? (
        <T v="caption" tone="muted" center>
          Sort payments in your Inbox to see where your money goes.
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  total: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  account: { gap: 4 },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: 8, borderRadius: radius.pill },
});
