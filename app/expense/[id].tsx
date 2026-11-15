import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { usePersonLookup } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { Avatar, Button, Card, EmptyState, Money, Screen, SectionTitle, T } from '@/ui/kit';
import { Pop, effectLabel, myEffect } from '@/ui/rows';
import { showToast } from '@/ui/Toast';

const SPLIT_NAMES = {
  equal: 'Split equally',
  exact: 'Split by exact amounts',
  percent: 'Split by percentage',
  shares: 'Split by shares',
  item: 'Split by item',
};

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const person = usePersonLookup();
  const expense = useStore((s) => s.expenses.find((e) => e.id === id));
  const group = useStore((s) => s.groups.find((g) => g.id === expense?.groupId));
  const setExpenseDeleted = useStore((s) => s.setExpenseDeleted);

  if (!expense || expense.deletedAt) {
    return (
      <Screen title="Expense" back>
        <EmptyState mood="sad" title="This expense was deleted" />
      </Screen>
    );
  }

  const effect = myEffect(expense);
  const label = effectLabel(effect);

  const remove = () => {
    setExpenseDeleted(expense.id, true);
    router.back();
    showToast(`Deleted ${expense.description}`, {
      label: 'Undo',
      onPress: () => setExpenseDeleted(expense.id, false),
    });
  };

  return (
    <Screen
      title="Expense"
      back
      footer={
        <View style={styles.row}>
          <Button
            style={styles.flex}
            label="Edit"
            icon="edit"
            variant="secondary"
            onPress={() => router.push({ pathname: '/add', params: { expenseId: expense.id } })}
          />
          <Button
            style={styles.flex}
            label="Delete"
            icon="trash"
            variant="danger"
            onPress={remove}
          />
        </View>
      }
    >
      <Pop style={styles.hero}>
        <Money paise={expense.totalPaise} v="display" />
        <T v="title" bold center>
          {expense.description}
        </T>
        <T tone="muted" center>
          {new Date(expense.occurredAt).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {group ? ` · ${group.emoji} ${group.name}` : ''}
        </T>
        {effect !== 0 ? (
          <T tone={label.tone} bold>
            {label.text} <Money paise={Math.abs(effect)} tone={label.tone} />
          </T>
        ) : null}
      </Pop>

      <SectionTitle>Paid by</SectionTitle>
      <Card>
        {expense.payers.map((payer) => (
          <View key={payer.personId} style={styles.line}>
            <Avatar id={payer.personId} emoji={person(payer.personId).emoji} size={36} />
            <T style={styles.flex}>{person(payer.personId).name}</T>
            <Money paise={payer.amountPaise} />
          </View>
        ))}
      </Card>

      <SectionTitle>{SPLIT_NAMES[expense.splitKind]}</SectionTitle>
      <Card>
        {expense.shares.map((share) => (
          <View key={share.personId} style={styles.line}>
            <Avatar id={share.personId} emoji={person(share.personId).emoji} size={36} />
            <T style={styles.flex}>{person(share.personId).name}</T>
            <Money paise={share.amountPaise} />
          </View>
        ))}
      </Card>

      <SectionTitle>History</SectionTitle>
      <Card>
        {[...(expense.history ?? [])].reverse().map((entry) => (
          <View key={entry.at} style={styles.history}>
            <T v="caption" tone="muted">
              {new Date(entry.at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </T>
            {entry.changes.map((change) => (
              <T key={change}>{change}</T>
            ))}
          </View>
        ))}
        <View style={styles.history}>
          <T v="caption" tone="muted">
            {new Date(expense.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </T>
          <T>{expense.source === 'inbox' ? 'Added from a captured payment' : 'Added'}</T>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  history: { gap: 2, paddingVertical: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
