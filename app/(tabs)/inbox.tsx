import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { CaptureCard } from '@/features/inbox/CaptureCard';
import { DeckCard, type DeckCardHandle, type SwipeDirection } from '@/features/inbox/DeckCard';
import { usePersonLookup } from '@/store/hooks';
import { ME, type Payment } from '@/store/types';
import { useStore } from '@/store/useStore';
import { minTapTarget, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, EmptyState, IconButton, PressableScale, Screen, T } from '@/ui/kit';
import { showToast } from '@/ui/Toast';

function ActionButton({
  icon,
  label,
  color,
  big,
  onPress,
  onLongPress,
  hint,
}: {
  icon: IconName;
  label: string;
  color: string;
  big?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  hint?: string;
}) {
  const { colors } = useTheme();
  const size = big ? 68 : 56;
  return (
    <View style={styles.action}>
      <PressableScale
        label={label}
        onPress={onPress}
        onLongPress={onLongPress}
        hint={hint}
        haptic={false}
        style={[
          styles.actionCircle,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
          { backgroundColor: colors.surface },
        ]}
      >
        <Icon name={icon} color={color} size={big ? 30 : 24} strokeWidth={2.4} />
      </PressableScale>
      <T v="caption" tone="muted">
        {label}
      </T>
    </View>
  );
}

export default function Inbox() {
  const { colors } = useTheme();
  const router = useRouter();
  const payments = useStore((s) => s.payments);
  const expenses = useStore((s) => s.expenses);
  const canRewind = useStore((s) => s.sortHistory.length > 0);
  const sortPayment = useStore((s) => s.sortPayment);
  const rewind = useStore((s) => s.rewind);
  const loadSamplePayments = useStore((s) => s.loadSamplePayments);
  const mutePayee = useStore((s) => s.mutePayee);
  const updateSettings = useStore((s) => s.updateSettings);
  const person = usePersonLookup();

  const topRef = useRef<DeckCardHandle>(null);
  // Bumped to remount a card at rest when a right-swipe is cancelled in the split sheet.
  const [resetNonce, setResetNonce] = useState(0);

  const queue = useMemo(
    () => payments.filter((p) => p.status === 'inbox').sort((a, b) => b.occurredAt - a.occurredAt),
    [payments],
  );
  const visible = queue.slice(0, 3);

  // "Learning": suggest whoever this payee was last split with.
  const suggestionFor = (payment: Payment): string | undefined => {
    const last = expenses.findLast(
      (e) => !e.deletedAt && e.description.toLowerCase() === payment.payee.toLowerCase(),
    );
    if (!last) return undefined;
    const names = last.shares.filter((s) => s.personId !== ME).map((s) => person(s.personId).name);
    return names.length ? `Usually with ${names.join(', ')}` : undefined;
  };

  const handleSwipe = (payment: Payment, direction: SwipeDirection) => {
    if (direction === 1) {
      router.push({ pathname: '/add', params: { paymentId: payment.id } });
      // If the sheet is dismissed without saving, the payment is still in the
      // inbox, so bring its card back to rest.
      setTimeout(() => setResetNonce((n) => n + 1), 450);
      return;
    }
    sortPayment(payment.id, direction === 2 ? 'personal' : 'ignored');
    showToast(direction === 2 ? `${payment.payee} marked personal` : `${payment.payee} ignored`, {
      label: 'Undo',
      onPress: () => rewind(),
    });
  };

  const muteTop = () => {
    const top = queue[0];
    if (!top) return;
    const before = useStore.getState().settings.mutedPayees;
    mutePayee(top.id);
    showToast(`Always ignoring ${top.payee}`, {
      label: 'Undo',
      onPress: () => {
        rewind();
        updateSettings({ mutedPayees: before });
      },
    });
  };

  return (
    <Screen
      title="Inbox"
      scroll={false}
      right={
        <>
          <T v="caption" tone="muted">
            {queue.length} to sort
          </T>
          <IconButton
            name="undo"
            label="Rewind last sort"
            filled
            disabled={!canRewind}
            onPress={() => {
              if (rewind()) showToast('Brought the last one back');
            }}
          />
        </>
      }
    >
      <CaptureCard />
      {queue.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.emptyWrap}>
          <EmptyState
            mood="zen"
            title="Inbox zero. You're thriving."
            body="New payments will show up here to sort."
          >
            <Button label="Add manually" icon="plus" onPress={() => router.push('/add')} />
            <Button label="Load sample payments" variant="secondary" onPress={loadSamplePayments} />
          </EmptyState>
        </Animated.View>
      ) : (
        <>
          <View style={styles.deck}>
            {visible
              .map((payment, index) => (
                <DeckCard
                  key={`${payment.id}-${resetNonce}`}
                  ref={index === 0 ? topRef : undefined}
                  payment={payment}
                  index={index}
                  suggestion={suggestionFor(payment)}
                  onSwipe={(direction) => handleSwipe(payment, direction)}
                />
              ))
              .reverse()}
          </View>
          <Animated.View entering={FadeInUp.springify().damping(14)} style={styles.actions}>
            <ActionButton
              icon="close"
              label="Personal"
              color={colors.neutral}
              onPress={() => topRef.current?.fling(2)}
            />
            <ActionButton
              icon="up"
              label="Ignore"
              color={colors.warn}
              onPress={() => topRef.current?.fling(3)}
              onLongPress={muteTop}
              hint="Long press to always ignore this payee"
            />
            <ActionButton
              icon="check"
              label="Split"
              color={colors.brand}
              big
              onPress={() => topRef.current?.fling(1)}
            />
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center' },
  deck: { flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xl },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  action: { alignItems: 'center', gap: spacing.xs, minWidth: minTapTarget },
  actionCircle: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
