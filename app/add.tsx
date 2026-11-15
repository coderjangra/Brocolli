import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { formatMoney } from '@/domain/format';
import { paiseToDecimalString, rupeesToPaise } from '@/domain/money';
import { parseQuickAdd } from '@/domain/quickAdd';
import { computeShares, SplitError } from '@/domain/split';
import type { PersonId, Share, SplitSpec } from '@/domain/types';
import { usePersonLookup } from '@/store/hooks';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { radius, spacing, tabularNums, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { success } from '@/ui/haptics';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Money,
  Screen,
  SectionTitle,
  Segmented,
  T,
} from '@/ui/kit';
import { Pop } from '@/ui/rows';
import { showToast } from '@/ui/Toast';

type Kind = 'equal' | 'exact' | 'percent' | 'shares';

const KINDS = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percent', label: '%' },
  { key: 'shares', label: 'Shares' },
] as const;

const rupeeText = (paise: number) => paiseToDecimalString(paise).replace(/\.00$/, '');

export default function AddExpense() {
  const params = useLocalSearchParams<{
    paymentId?: string;
    expenseId?: string;
    personId?: string;
    groupId?: string;
  }>();
  const { colors } = useTheme();
  const router = useRouter();
  const person = usePersonLookup();
  const people = useStore((s) => s.people);
  const groups = useStore((s) => s.groups);

  // Read once: the form owns its state after the first render.
  const [initial] = useState(() => {
    const s = useStore.getState();
    const editing = s.expenses.find((e) => e.id === params.expenseId);
    const payment = s.payments.find((p) => p.id === params.paymentId);
    if (editing) {
      const kind = (editing.splitKind === 'item' ? 'exact' : editing.splitKind) as Kind;
      return {
        editing,
        payment: undefined,
        amount: rupeeText(editing.totalPaise),
        description: editing.description,
        payerId: editing.payers[0]?.personId ?? ME,
        selected: editing.shares.map((share) => share.personId),
        kind,
        values: Object.fromEntries(
          editing.shares.map((share) => [
            share.personId,
            kind === 'exact' ? rupeeText(share.amountPaise) : String(share.splitValue ?? ''),
          ]),
        ) as Record<PersonId, string>,
        groupId: editing.groupId,
      };
    }
    // Learning: pre-select whoever this payee was last split with.
    const last = payment
      ? s.expenses.findLast(
          (e) => !e.deletedAt && e.description.toLowerCase() === payment.payee.toLowerCase(),
        )
      : undefined;
    const group = s.groups.find((g) => g.id === (params.groupId ?? last?.groupId));
    const selected = group
      ? group.memberIds
      : last
        ? last.shares.map((share) => share.personId)
        : params.personId
          ? [ME, params.personId]
          : [ME];
    return {
      editing: undefined,
      payment,
      amount: payment ? rupeeText(payment.amountPaise) : '',
      description: payment?.payee ?? '',
      payerId: ME,
      selected,
      kind: 'equal' as Kind,
      values: {} as Record<PersonId, string>,
      groupId: group?.id,
    };
  });

  const [quick, setQuick] = useState('');
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [payerId, setPayerId] = useState<PersonId>(initial.payerId);
  const [selected, setSelected] = useState<PersonId[]>(initial.selected);
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [values, setValues] = useState(initial.values);
  const [groupId, setGroupId] = useState<string | undefined>(initial.groupId);
  const [newName, setNewName] = useState('');
  const [unknown, setUnknown] = useState<string[]>([]);

  const everyone = useMemo(() => [ME, ...people.map((p) => p.id)], [people]);
  const participants = everyone.filter((id) => selected.includes(id));
  const total = rupeesToPaise(amount);

  const toggle = (id: PersonId) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const applyQuick = (text: string) => {
    setQuick(text);
    const parsed = parseQuickAdd(text, people);
    if (parsed.amountPaise !== null) setAmount(rupeeText(parsed.amountPaise));
    setDescription(parsed.description);
    setSelected([ME, ...parsed.personIds]);
    setUnknown(parsed.unknownNames);
  };

  const addNewPerson = (name: string) => {
    if (!name.trim()) return;
    const id = useStore.getState().addPerson(name);
    setSelected((current) => [...current, id]);
    setUnknown((current) => current.filter((n) => n !== name));
    setNewName('');
  };

  // Live preview straight from the split engine, so what you see is what is saved.
  let shares: Share[] | null = null;
  let problem: string | null = null;
  if (total === null || total <= 0) problem = 'Enter an amount';
  else if (participants.length === 0) problem = 'Pick at least one person';
  else {
    try {
      let spec: SplitSpec = { kind: 'equal' };
      if (kind === 'exact') {
        const amounts: Record<PersonId, number> = {};
        for (const id of participants) {
          const paise = rupeesToPaise(values[id] || '0');
          if (paise === null) throw new SplitError('INVALID_VALUE', 'Check the amounts');
          amounts[id] = paise;
        }
        const assigned = Object.values(amounts).reduce((a, b) => a + b, 0);
        if (assigned !== total) {
          throw new SplitError(
            'EXACT_SUM_MISMATCH',
            assigned < total
              ? `${formatMoney(total - assigned)} left to assign`
              : `${formatMoney(assigned - total)} over the total`,
          );
        }
        spec = { kind: 'exact', amounts };
      } else if (kind === 'percent') {
        const pcts = Object.fromEntries(participants.map((id) => [id, Number(values[id] || '0')]));
        const sum = Object.values(pcts).reduce((a, b) => a + b, 0);
        if (Math.round(sum * 100) !== 10000) {
          throw new SplitError(
            'PERCENT_SUM_MISMATCH',
            `Adds up to ${Number.isFinite(sum) ? Math.round(sum * 100) / 100 : '?'}%, needs 100%`,
          );
        }
        spec = { kind: 'percent', pcts };
      } else if (kind === 'shares') {
        spec = {
          kind: 'shares',
          weights: Object.fromEntries(participants.map((id) => [id, Number(values[id] || '1')])),
        };
      }
      shares = computeShares(total, participants, spec, payerId);
    } catch (error) {
      problem = error instanceof SplitError ? error.message : 'Check the split';
    }
  }
  if (!problem && !description.trim()) problem = 'Add a description';

  const others = participants.filter((id) => id !== payerId).length;

  const save = () => {
    if (!shares || total === null) return;
    const store = useStore.getState();
    const result = store.saveExpense(
      {
        groupId,
        description,
        totalPaise: total,
        payers: [{ personId: payerId, amountPaise: total }],
        shares,
        splitKind: kind,
        paymentId: initial.payment?.id ?? initial.editing?.paymentId,
        occurredAt: initial.payment?.occurredAt,
      },
      initial.editing?.id,
    );
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    if (initial.payment) store.sortPayment(initial.payment.id, 'split', result.id);
    success();
    router.back();
    if (initial.editing) showToast('Changes saved');
    else {
      showToast(`Split ${formatMoney(total)} · ${description.trim()}`, {
        label: 'Undo',
        onPress: () =>
          initial.payment ? store.rewind() : store.setExpenseDeleted(result.id, true),
      });
    }
  };

  return (
    <Screen
      title={initial.editing ? 'Edit expense' : 'New split'}
      right={<IconButton name="close" label="Close" filled onPress={() => router.back()} />}
      footer={
        <>
          {problem ? (
            <T v="caption" tone="muted" center>
              {problem}
            </T>
          ) : null}
          <Button
            label={
              initial.editing
                ? 'Save changes'
                : total && !problem
                  ? `Split ${formatMoney(total)} with ${others}`
                  : 'Split'
            }
            icon="check"
            disabled={!!problem}
            onPress={save}
          />
        </>
      }
    >
      {!initial.editing && !initial.payment ? (
        <Field
          label="Quick add"
          placeholder="250 zomato w rahul aman"
          value={quick}
          onChangeText={applyQuick}
          autoCapitalize="none"
          autoFocus
        />
      ) : null}
      {unknown.length > 0 ? (
        <View style={styles.wrap}>
          {unknown.map((name) => (
            <Chip key={name} label={`+ Add "${name}"`} onPress={() => addNewPerson(name)} />
          ))}
        </View>
      ) : null}

      <Pop>
        <Card style={styles.amountCard}>
          <View style={styles.amountRow}>
            <T v="display" tone={amount ? 'text' : 'muted'}>
              ₹
            </T>
            <TextInput
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              keyboardType="decimal-pad"
              accessibilityLabel="Amount in rupees"
              style={[typography.display, tabularNums, styles.amountInput, { color: colors.text }]}
            />
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was it for?"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.brand}
            accessibilityLabel="Description"
            style={[typography.body, styles.descInput, { color: colors.text }]}
          />
        </Card>
      </Pop>

      <SectionTitle>Paid by</SectionTitle>
      <View style={styles.wrap}>
        {everyone.map((id) => (
          <Chip
            key={id}
            label={person(id).name}
            emoji={person(id).emoji}
            selected={payerId === id}
            onPress={() => setPayerId(id)}
          />
        ))}
      </View>

      <SectionTitle>Split between</SectionTitle>
      <View style={styles.wrap}>
        {everyone.map((id) => (
          <Chip
            key={id}
            label={person(id).name}
            emoji={person(id).emoji}
            selected={selected.includes(id)}
            onPress={() => toggle(id)}
          />
        ))}
      </View>
      <View style={styles.newRow}>
        <Field
          style={styles.flex}
          placeholder="+ New person"
          value={newName}
          onChangeText={setNewName}
          autoCapitalize="words"
          submitBehavior="submit"
          onSubmitEditing={(e) => addNewPerson(e.nativeEvent.text)}
        />
        {newName.trim() ? (
          <Button label="Add" variant="secondary" onPress={() => addNewPerson(newName)} />
        ) : null}
      </View>

      {groups.length > 0 ? (
        <>
          <SectionTitle>Group</SectionTitle>
          <View style={styles.wrap}>
            <Chip label="No group" selected={!groupId} onPress={() => setGroupId(undefined)} />
            {groups.map((group) => (
              <Chip
                key={group.id}
                label={group.name}
                emoji={group.emoji}
                selected={groupId === group.id}
                onPress={() => {
                  setGroupId(group.id);
                  setSelected(group.memberIds);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle>How to split</SectionTitle>
      <Segmented options={KINDS} value={kind} onChange={setKind} />

      <Card>
        {participants.length === 0 ? (
          <T tone="muted" center>
            Pick who shares this.
          </T>
        ) : (
          participants.map((id, index) => {
            const share = shares?.find((s) => s.personId === id);
            return (
              <Animated.View
                key={id}
                entering={FadeInDown.delay(index * 30).springify()}
                layout={LinearTransition.springify().damping(18)}
                style={styles.shareRow}
              >
                <Avatar id={id} emoji={person(id).emoji} size={36} />
                <T style={styles.flex} numberOfLines={1}>
                  {person(id).name}
                </T>
                {kind !== 'equal' ? (
                  <TextInput
                    value={values[id] ?? ''}
                    onChangeText={(text) =>
                      setValues({ ...values, [id]: text.replace(/[^\d.]/g, '') })
                    }
                    placeholder={kind === 'exact' ? '₹0' : kind === 'percent' ? '0%' : '1'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${person(id).name} ${kind === 'exact' ? 'amount' : kind === 'percent' ? 'percent' : 'shares'}`}
                    style={[
                      typography.body,
                      tabularNums,
                      styles.valueInput,
                      { color: colors.text, backgroundColor: colors.surfaceRaised },
                    ]}
                  />
                ) : null}
                {share ? (
                  <Money paise={share.amountPaise} style={styles.shareAmount} />
                ) : (
                  <T tone="muted" style={styles.shareAmount}>
                    —
                  </T>
                )}
              </Animated.View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amountCard: { alignItems: 'center', paddingVertical: spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  amountInput: { minWidth: 80, padding: 0, textAlign: 'left', fontWeight: '700' },
  descInput: { alignSelf: 'stretch', textAlign: 'center', minHeight: 44 },
  newRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  valueInput: {
    width: 76,
    minHeight: 40,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    textAlign: 'right',
  },
  shareAmount: { minWidth: 84, textAlign: 'right' },
});
