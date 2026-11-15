import { useEffect, useImperativeHandle, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Payment } from '@/store/types';
import { motion, radius, spacing } from '@/theme/tokens';
import { useAccountLabel } from '@/features/accounts/accounts';
import { useTheme } from '@/theme/useTheme';
import { tap, tick, timeAgo } from '@/ui/haptics';
import { Icon } from '@/ui/Icon';
import { Money, T } from '@/ui/kit';

/** 1 = right (split), 2 = left (personal), 3 = up (not an expense). */
export type SwipeDirection = 1 | 2 | 3;

export interface DeckCardHandle {
  fling(direction: SwipeDirection): void;
}

const X_COMMIT = 0.35;
const Y_COMMIT = 0.25;
const FLICK = 800;

export function DeckCard({
  payment,
  index,
  suggestion,
  onSwipe,
  ref,
}: {
  payment: Payment;
  /** 0 = top card (interactive). */
  index: number;
  suggestion?: string;
  onSwipe: (direction: SwipeDirection) => void;
  ref?: Ref<DeckCardHandle>;
}) {
  const accountLabel = useAccountLabel();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zone = useSharedValue(0);
  const depth = useSharedValue(index);

  useEffect(() => {
    depth.set(withSpring(index, motion.springBack));
  }, [index, depth]);

  const flyOut = (direction: SwipeDirection) => {
    'worklet';
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onSwipe, direction);
    };
    const config = { duration: 230, easing: Easing.out(Easing.cubic) };
    if (direction === 3) ty.set(withTiming(-height, config, done));
    else tx.set(withTiming((direction === 1 ? 1 : -1) * width * 1.4, config, done));
  };

  useImperativeHandle(ref, () => ({
    fling(direction) {
      tap();
      flyOut(direction);
    },
  }));

  // Everything in the gesture runs on the UI thread; JS is only told about
  // threshold crossings (haptic) and the final commit.
  const pan = Gesture.Pan()
    .enabled(index === 0)
    .onUpdate((e) => {
      tx.set(e.translationX);
      ty.set(e.translationY);
      let next = 0;
      if (e.translationY < -Y_COMMIT * height && Math.abs(e.translationX) < X_COMMIT * width) {
        next = 3;
      } else if (e.translationX > X_COMMIT * width) next = 1;
      else if (e.translationX < -X_COMMIT * width) next = 2;
      if (next !== zone.value) {
        zone.set(next);
        if (next !== 0) scheduleOnRN(tick);
      }
    })
    .onEnd((e) => {
      let committed = zone.value;
      if (committed === 0 && e.velocityX > FLICK) committed = 1;
      if (committed === 0 && e.velocityX < -FLICK) committed = 2;
      if (committed === 0) {
        tx.set(withSpring(0, motion.springBack));
        ty.set(withSpring(0, motion.springBack));
      } else {
        scheduleOnRN(tap);
        flyOut(committed as SwipeDirection);
      }
      zone.set(0);
    });

  const cardStyle = useAnimatedStyle(() => {
    const d = depth.value;
    return {
      opacity: interpolate(d, [0, 2, 3], [1, 1, 0], 'clamp'),
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + d * 30 },
        {
          rotate: `${interpolate(tx.value, [-width / 2, 0, width / 2], [-12, 0, 12], 'clamp')}deg`,
        },
        { scale: 1 - d * 0.04 },
      ],
    };
  });
  const splitTint = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, X_COMMIT * width], [0, 1], 'clamp'),
  }));
  const personalTint = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-X_COMMIT * width, 0], [1, 0], 'clamp'),
  }));
  const ignoreTint = useAnimatedStyle(() => ({
    opacity:
      Math.abs(tx.value) < X_COMMIT * width
        ? interpolate(ty.value, [-Y_COMMIT * height, 0], [1, 0], 'clamp')
        : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          cardStyle,
        ]}
        accessible
        accessibilityLabel={`${payment.payee}, paid ${timeAgo(payment.occurredAt)}. Use the buttons below to sort.`}
      >
        <View style={styles.topRow}>
          <View style={[styles.channel, { backgroundColor: colors.surfaceRaised }]}>
            <Icon
              name={payment.channel === 'SMS' ? 'message' : 'zap'}
              size={14}
              color={colors.textMuted}
            />
            <T v="caption" tone="muted" bold>
              {payment.channel}
            </T>
          </View>
          <T v="caption" tone="muted">
            {timeAgo(payment.occurredAt)}
          </T>
        </View>

        <View style={styles.middle}>
          <View style={[styles.logo, { backgroundColor: colors.surfaceRaised }]}>
            <T v="display">{payment.emoji}</T>
          </View>
          <Money paise={payment.amountPaise} v="display" />
          <T v="title" bold center numberOfLines={1}>
            {payment.payee}
          </T>
          <T tone="muted">{accountLabel(payment)}</T>
        </View>

        <View style={[styles.suggestion, { backgroundColor: colors.surfaceRaised }]}>
          <T v="caption" tone="muted" center numberOfLines={1}>
            {suggestion ?? 'Swipe right to split · left if it was just you'}
          </T>
        </View>

        <Animated.View style={[styles.tint, { backgroundColor: colors.owed }, splitTint]}>
          <T v="title" bold style={{ color: colors.bg }}>
            SPLIT
          </T>
        </Animated.View>
        <Animated.View style={[styles.tint, { backgroundColor: colors.neutral }, personalTint]}>
          <T v="title" bold style={{ color: colors.bg }}>
            PERSONAL
          </T>
        </Animated.View>
        <Animated.View style={[styles.tint, { backgroundColor: colors.warn }, ignoreTint]}>
          <T v="title" bold style={{ color: colors.bg }}>
            NOT AN EXPENSE
          </T>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  middle: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  suggestion: { padding: spacing.md, borderRadius: radius.input },
  tint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
