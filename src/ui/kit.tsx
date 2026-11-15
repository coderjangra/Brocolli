import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney } from '@/domain/format';
import type { Paise } from '@/domain/types';
import {
  avatarColors,
  minTapTarget,
  motion,
  radius,
  spacing,
  tabularNums,
  typography,
  type ColorTokens,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { tap } from './haptics';
import { Icon, type IconName } from './Icon';
import { Mascot, type MascotMood } from './Mascot';

export type Tone = 'text' | 'muted' | 'brand' | 'owe' | 'owed' | 'warn' | 'onBrand';

function toneColor(colors: ColorTokens, tone: Tone): string {
  return tone === 'muted' ? colors.textMuted : colors[tone];
}

/** Themed text. Always use this instead of raw <Text> so sizes and colors come from tokens. */
export function T({
  v = 'body',
  tone = 'text',
  center,
  bold,
  style,
  ...rest
}: TextProps & {
  v?: keyof typeof typography;
  tone?: Tone;
  center?: boolean;
  bold?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[v],
        { color: toneColor(colors, tone) },
        center && styles.center,
        bold && styles.bold,
        style,
      ]}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that springs down on touch and gives a light haptic tap. */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  haptic = true,
  label,
  hint,
  hitSlop,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  label?: string;
  hitSlop?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.set(withSpring(0.94, motion.press));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, motion.press));
      }}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onLongPress={
        onLongPress
          ? () => {
              if (haptic) tap();
              onLongPress();
            }
          : undefined
      }
      style={[style, animated, disabled && styles.disabled]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.brand
      : variant === 'secondary'
        ? colors.surfaceRaised
        : 'transparent';
  const fg: Tone = variant === 'primary' ? 'onBrand' : variant === 'danger' ? 'owe' : 'text';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      label={label}
      style={[
        styles.button,
        { backgroundColor: bg },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.owe },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={toneColor(colors, fg)} /> : null}
      <T tone={fg} bold numberOfLines={1}>
        {label}
      </T>
    </PressableScale>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  tone = 'text',
  filled,
  size = minTapTarget,
  disabled,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  tone?: Tone;
  filled?: boolean;
  size?: number;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      label={label}
      disabled={disabled}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        filled && { backgroundColor: colors.surfaceRaised },
      ]}
    >
      <Icon name={name} color={toneColor(colors, tone)} size={Math.round(size * 0.46)} />
    </PressableScale>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  emoji,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      label={label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.brand : colors.surfaceRaised,
          borderColor: selected ? colors.brand : colors.border,
        },
      ]}
    >
      {emoji ? <T v="caption">{emoji}</T> : null}
      <T v="caption" bold tone={selected ? 'onBrand' : 'text'}>
        {label}
      </T>
    </PressableScale>
  );
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ id, emoji, size = 44 }: { id: string; emoji: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColors[hash(id) % avatarColors.length],
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}

export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? (
        <T v="caption" tone="muted">
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.brand}
        accessibilityLabel={label ?? rest.placeholder}
        {...rest}
        style={[
          typography.body,
          styles.field,
          { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceRaised }]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            label={option.label}
            onPress={() => onChange(option.key)}
            style={[styles.segment, active && { backgroundColor: colors.brand }]}
          >
            <T v="caption" bold tone={active ? 'onBrand' : 'muted'}>
              {option.label}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Eases a number toward its target so balances count up instead of jumping. */
export function useCountUp(target: number, duration = 600): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let from: number | null = null;
    const start = Date.now();
    const step = () => {
      setShown((current) => {
        from ??= current;
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        return Math.round(from + (target - from) * eased);
      });
      if (Date.now() - start < duration) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return reduced ? target : shown;
}

export function Money({
  paise,
  v = 'body',
  tone = 'text',
  countUp,
  showPlus,
  style,
}: {
  paise: Paise;
  v?: keyof typeof typography;
  tone?: Tone;
  countUp?: boolean;
  showPlus?: boolean;
  style?: TextProps['style'];
}) {
  const animated = useCountUp(paise);
  return (
    <T v={v} tone={tone} bold style={[tabularNums, style]}>
      {formatMoney(countUp ? animated : paise, { showPlus })}
    </T>
  );
}

/** Page frame: safe area, optional header with back button, optional scrolling. */
export function Screen({
  title,
  back,
  right,
  scroll = true,
  children,
  footer,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {title !== undefined || back ? (
        <View style={styles.header}>
          {back ? (
            <IconButton name="back" label="Go back" onPress={() => router.back()} filled />
          ) : null}
          <T v="title" bold style={styles.headerTitle} numberOfLines={1}>
            {title}
          </T>
          {right}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  mood = 'happy',
  title,
  body,
  children,
}: {
  mood?: MascotMood;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Mascot mood={mood} size={150} />
      <T v="title" bold center>
        {title}
      </T>
      {body ? (
        <T tone="muted" center>
          {body}
        </T>
      ) : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <T v="caption" tone="muted" bold style={styles.sectionTitle}>
      {children.toUpperCase()}
    </T>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  disabled: { opacity: 0.4 },
  fill: { flex: 1 },
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: minTapTarget + spacing.md,
  },
  headerTitle: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: minTapTarget + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  fieldWrap: { gap: spacing.xs },
  field: {
    minHeight: minTapTarget + 4,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.input, padding: spacing.xs },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.input - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  sectionTitle: { letterSpacing: 0.8, marginTop: spacing.sm },
});
