import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { Paise } from '@/domain/types';
import { ME, type Expense } from '@/store/types';
import { motion, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { timeAgo } from './haptics';
import { Icon } from './Icon';
import { Money, PressableScale, T, type Tone } from './kit';

/** Springs a hero block in (fade + rise + slight scale) when the screen mounts. */
export function Pop({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withSpring(1, { ...motion.enter, overshootClamping: true }));
  }, [t]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.5),
    transform: [{ translateY: 16 * (1 - t.value) }, { scale: 0.92 + 0.08 * t.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Staggered spring entrance for list rows. */
export function Enter({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .springify()
        .damping(16)}
    >
      {children}
    </Animated.View>
  );
}

/** What this expense did to my balance: paid − my share. */
export function myEffect(expense: Expense): Paise {
  const paid = expense.payers.find((p) => p.personId === ME)?.amountPaise ?? 0;
  const share = expense.shares.find((s) => s.personId === ME)?.amountPaise ?? 0;
  return paid - share;
}

export function effectLabel(effect: Paise): { text: string; tone: Tone } {
  if (effect > 0) return { text: 'you lent', tone: 'owed' };
  if (effect < 0) return { text: 'you borrowed', tone: 'owe' };
  return { text: 'no balance', tone: 'muted' };
}

export function ExpenseRow({
  expense,
  payerName,
  effect = myEffect(expense),
}: {
  expense: Expense;
  payerName: string;
  /** Override when the row is shown from one friend's point of view. */
  effect?: Paise;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const label = effectLabel(effect);
  return (
    <PressableScale
      label={`${expense.description}, open details`}
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: expense.id } })}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name={expense.source === 'inbox' ? 'inbox' : 'edit'} size={18} color={colors.brand} />
      </View>
      <View style={styles.flex}>
        <T bold numberOfLines={1}>
          {expense.description}
        </T>
        <T v="caption" tone="muted" numberOfLines={1}>
          {payerName} paid · {timeAgo(expense.occurredAt)}
        </T>
      </View>
      <View style={styles.right}>
        <T v="caption" tone={label.tone}>
          {label.text}
        </T>
        {effect !== 0 ? <Money paise={Math.abs(effect)} tone={label.tone} /> : null}
      </View>
    </PressableScale>
  );
}

export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

const styles = StyleSheet.create({
  row: rowStyles.row,
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
