import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { PressableScale, T } from './kit';

interface ToastState {
  toast: { id: number; message: string; actionLabel?: string; onAction?: () => void } | null;
  show(message: string, action?: { label: string; onPress: () => void }): void;
  hide(): void;
}

const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (message, action) =>
    set({
      toast: { id: Date.now(), message, actionLabel: action?.label, onAction: action?.onPress },
    }),
  hide: () => set({ toast: null }),
}));

/** Undo toasts replace confirmation dialogs everywhere (CONTRIBUTING.md hard rule). */
export function showToast(message: string, action?: { label: string; onPress: () => void }) {
  useToast.getState().show(message, action);
}

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, 5000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.springify().damping(16)}
        exiting={FadeOutDown}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.text }]}
      >
        <T style={[styles.message, { color: colors.bg }]} numberOfLines={2}>
          {toast.message}
        </T>
        {toast.actionLabel ? (
          <PressableScale
            label={toast.actionLabel}
            hitSlop={12}
            onPress={() => {
              toast.onAction?.();
              hide();
            }}
          >
            <T bold style={{ color: colors.brand }}>
              {toast.actionLabel}
            </T>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.input,
    maxWidth: 480,
  },
  message: { flexShrink: 1 },
});
