import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { minTapTarget, motion, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/Icon';
import { PressableScale, T } from '@/ui/kit';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  inbox: { label: 'Inbox', icon: 'inbox' },
  friends: { label: 'Friends', icon: 'users' },
  groups: { label: 'Groups', icon: 'home' },
  you: { label: 'You', icon: 'user' },
};

function TabButton({
  name,
  active,
  badge,
  onPress,
}: {
  name: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tab = TABS[name]!;
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(active ? 1 : 0, motion.bouncy));
  }, [active, on]);
  const pill = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: 0.4 + 0.6 * on.value }],
  }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * on.value }] }));

  return (
    <PressableScale label={tab.label} onPress={onPress} style={styles.tab} haptic={!active}>
      <Animated.View style={[styles.pill, { backgroundColor: colors.surfaceRaised }, pill]} />
      <Animated.View style={lift}>
        <Icon name={tab.icon} color={active ? colors.brand : colors.textMuted} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.owe }]}>
            <T v="caption" bold style={[styles.badgeText, { color: colors.bg }]}>
              {badge > 9 ? '9+' : badge}
            </T>
          </View>
        ) : null}
      </Animated.View>
      <T v="caption" bold={active} tone={active ? 'brand' : 'muted'}>
        {tab.label}
      </T>
    </PressableScale>
  );
}

function TabBar({ state, navigateToTab }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inboxCount = useStore((s) => s.payments.filter((p) => p.status === 'inbox').length);

  const buttons = state.routes.map((route, index) => (
    <TabButton
      key={route.key}
      name={route.name}
      active={state.index === index}
      badge={route.name === 'inbox' ? inboxCount : undefined}
      onPress={() => navigateToTab(route.key)}
    />
  ));

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + spacing.xs,
        },
      ]}
    >
      {buttons.slice(0, 2)}
      <View style={styles.fabSlot}>
        <PressableScale
          label="Add expense"
          onPress={() => router.push('/add')}
          style={[styles.fab, { backgroundColor: colors.brand, borderColor: colors.surface }]}
        >
          <Icon name="plus" color={colors.onBrand} size={28} strokeWidth={2.6} />
        </PressableScale>
      </View>
      {buttons.slice(2)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: minTapTarget + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: 0,
    width: 56,
    height: 30,
    borderRadius: radius.pill,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
  fabSlot: { width: 72, alignItems: 'center' },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    transform: [{ translateY: -14 }],
  },
});
