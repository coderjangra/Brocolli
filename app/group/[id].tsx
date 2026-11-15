import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { netBalances, personNets } from '@/domain/balances';
import { simplifyDebts } from '@/domain/simplify';
import { usePersonLookup } from '@/store/hooks';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/Icon';
import { Avatar, Button, Card, EmptyState, Money, Screen, SectionTitle, T } from '@/ui/kit';
import { Enter, ExpenseRow, Pop, rowStyles } from '@/ui/rows';

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const person = usePersonLookup();
  const group = useStore((s) => s.groups.find((g) => g.id === id));
  const allExpenses = useStore((s) => s.expenses);
  const allSettlements = useStore((s) => s.settlements);

  const { feed, nets, transfers } = useMemo(() => {
    const expenses = allExpenses.filter((e) => e.groupId === id);
    const groupNets = personNets(
      netBalances(
        expenses,
        allSettlements.filter((s) => s.groupId === id),
        'INR',
      ),
    );
    return {
      feed: expenses.filter((e) => !e.deletedAt).sort((a, b) => b.occurredAt - a.occurredAt),
      nets: groupNets,
      transfers: simplifyDebts(groupNets),
    };
  }, [allExpenses, allSettlements, id]);

  if (!group) {
    return (
      <Screen title="Group" back>
        <EmptyState mood="sad" title="This group is gone" />
      </Screen>
    );
  }

  return (
    <Screen
      title={`${group.emoji}  ${group.name}`}
      back
      footer={
        <Button
          label="Add group expense"
          icon="plus"
          onPress={() => router.push({ pathname: '/add', params: { groupId: id } })}
        />
      }
    >
      <Pop>
        <Card>
          {group.memberIds.map((memberId) => {
            const net = nets.get(memberId) ?? 0;
            return (
              <View key={memberId} style={styles.member}>
                <Avatar id={memberId} emoji={person(memberId).emoji} size={36} />
                <T style={styles.flex} numberOfLines={1}>
                  {person(memberId).name}
                </T>
                {net === 0 ? (
                  <T v="caption" tone="muted">
                    settled
                  </T>
                ) : (
                  <Money paise={net} tone={net > 0 ? 'owed' : 'owe'} showPlus />
                )}
              </View>
            );
          })}
        </Card>
      </Pop>

      <SectionTitle>Simplified debts</SectionTitle>
      {transfers.length === 0 ? (
        <T tone="muted">Everyone is square. Nobody needs to pay anybody.</T>
      ) : (
        transfers.map((transfer, index) => {
          const mine = transfer.from === ME || transfer.to === ME;
          return (
            <Enter key={`${transfer.from}-${transfer.to}`} index={index}>
              <View
                style={[
                  rowStyles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Avatar id={transfer.from} emoji={person(transfer.from).emoji} size={32} />
                <Icon name="send" size={16} color={colors.textMuted} />
                <Avatar id={transfer.to} emoji={person(transfer.to).emoji} size={32} />
                <View style={styles.flex}>
                  <T v="caption" numberOfLines={2}>
                    {person(transfer.from).name} {transfer.from === ME ? 'pay' : 'pays'}{' '}
                    {person(transfer.to).name.replace(/^You$/, 'you')}
                  </T>
                  <Money paise={transfer.amountPaise} />
                </View>
                {mine ? (
                  <Button
                    label="Settle"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/settle',
                        params: {
                          personId: transfer.from === ME ? transfer.to : transfer.from,
                          groupId: id,
                          amount: String(transfer.amountPaise),
                          from: transfer.from === ME ? 'me' : 'them',
                        },
                      })
                    }
                  />
                ) : null}
              </View>
            </Enter>
          );
        })
      )}

      <SectionTitle>Expenses</SectionTitle>
      {feed.length === 0 ? (
        <EmptyState mood="wave" title="No expenses yet" body="Add the first one below." />
      ) : (
        feed.map((expense, index) => (
          <Enter key={expense.id} index={index}>
            <ExpenseRow
              expense={expense}
              payerName={expense.payers.map((p) => person(p.personId).name).join(' + ')}
            />
          </Enter>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
