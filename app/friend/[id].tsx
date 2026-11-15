import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { netBalances, netBetween } from '@/domain/balances';
import { useNets, usePersonLookup } from '@/store/hooks';
import { ME, type Expense, type Settlement } from '@/store/types';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { timeAgo } from '@/ui/haptics';
import { Icon } from '@/ui/Icon';
import { Avatar, Button, EmptyState, Money, Screen, SectionTitle, T } from '@/ui/kit';
import { Enter, ExpenseRow, Pop, rowStyles } from '@/ui/rows';

type Entry =
  | { kind: 'expense'; at: number; expense: Expense; effect: number }
  | { kind: 'settlement'; at: number; settlement: Settlement };

export default function FriendDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const person = usePersonLookup();
  const friend = person(id);
  const nets = useNets();
  const net = netBetween(nets, ME, id);
  const expenses = useStore((s) => s.expenses);
  const settlements = useStore((s) => s.settlements);

  // The "why" behind the number: every expense and settlement between us, newest first.
  const timeline = useMemo(() => {
    const entries: Entry[] = [];
    for (const expense of expenses) {
      if (expense.deletedAt) continue;
      const effect = netBetween(netBalances([expense], [], 'INR'), ME, id);
      if (effect !== 0) entries.push({ kind: 'expense', at: expense.occurredAt, expense, effect });
    }
    for (const settlement of settlements) {
      if (settlement.deletedAt || settlement.status !== 'confirmed') continue;
      const pair = [settlement.fromPersonId, settlement.toPersonId];
      if (pair.includes(ME) && pair.includes(id)) {
        entries.push({ kind: 'settlement', at: settlement.createdAt, settlement });
      }
    }
    return entries.sort((a, b) => b.at - a.at);
  }, [expenses, settlements, id]);

  return (
    <Screen title={friend.name} back>
      <Pop style={styles.hero}>
        <Avatar id={friend.id} emoji={friend.emoji} size={84} />
        <T tone="muted">
          {net > 0
            ? `${friend.name} owes you`
            : net < 0
              ? `You owe ${friend.name}`
              : 'All settled up'}
        </T>
        <Money
          paise={Math.abs(net)}
          v="display"
          tone={net > 0 ? 'owed' : net < 0 ? 'owe' : 'muted'}
          countUp
        />
      </Pop>

      <View style={styles.buttons}>
        <Button
          style={styles.flex}
          label="Settle up"
          icon="check"
          disabled={net === 0}
          onPress={() => router.push({ pathname: '/settle', params: { personId: id } })}
        />
        <Button
          style={styles.flex}
          label="Add expense"
          icon="plus"
          variant="secondary"
          onPress={() => router.push({ pathname: '/add', params: { personId: id } })}
        />
      </View>

      <SectionTitle>Why this number</SectionTitle>
      {timeline.length === 0 ? (
        <EmptyState
          mood="happy"
          title="Nothing between you two yet"
          body="Add an expense and it will show up here."
        />
      ) : (
        timeline.map((entry, index) => (
          <Enter
            key={entry.kind === 'expense' ? entry.expense.id : entry.settlement.id}
            index={index}
          >
            {entry.kind === 'expense' ? (
              <ExpenseRow
                expense={entry.expense}
                effect={entry.effect}
                payerName={entry.expense.payers.map((p) => person(p.personId).name).join(' + ')}
              />
            ) : (
              <View
                style={[
                  rowStyles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Icon name="check" color={colors.brand} />
                <View style={styles.flex}>
                  <T bold>
                    {entry.settlement.fromPersonId === ME
                      ? `You paid ${friend.name}`
                      : `${friend.name} paid you`}
                  </T>
                  <T v="caption" tone="muted">
                    {entry.settlement.method === 'upi' ? 'UPI' : 'Cash'} ·{' '}
                    {timeAgo(entry.settlement.createdAt)}
                  </T>
                </View>
                <Money paise={entry.settlement.amountPaise} />
              </View>
            )}
          </Enter>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm },
});
