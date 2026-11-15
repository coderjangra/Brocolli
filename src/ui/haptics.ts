import * as Haptics from 'expo-haptics';

import { useStore } from '@/store/useStore';

const enabled = () => useStore.getState().settings.haptics;

/** Light tap for buttons and commits. */
export function tap(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick, e.g. crossing a swipe threshold. */
export function tick(): void {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

export function success(): void {
  if (enabled()) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

export function timeAgo(then: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
