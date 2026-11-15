import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import type { RawCapture } from '@/capture/parser';
import { useStore } from '@/store/useStore';
import { showToast } from '@/ui/Toast';

import {
  addCaptureListener,
  captureAvailable,
  drainQueue,
  hasSmsPermission,
  isNotificationAccessEnabled,
  openNotificationAccessSettings,
  scanRecentSms,
  type RawNativeCapture,
} from '../../../modules/payment-capture';

/** SPEC §5: SMS capture sits behind a build flag so a notification-only build can ship. */
export const SMS_CAPTURE_ENABLED = process.env.EXPO_PUBLIC_SMS_CAPTURE !== '0';

export { captureAvailable, openNotificationAccessSettings };

const DAY_MS = 86_400_000;

/** Bump when the native/JS filters change so missed messages get rescanned once. */
export const CAPTURE_FILTER_VERSION = 2;

type IngestCount = { added: number; selfTransfers: number };
const NONE: IngestCount = { added: 0, selfTransfers: 0 };

function toRaw(c: RawNativeCapture): RawCapture {
  return {
    source: c.source,
    sender: c.sender,
    text: c.text,
    receivedAt: c.receivedAt,
    packageName: c.packageName ?? undefined,
  };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function describeIngest({ added, selfTransfers }: IngestCount): string | null {
  const parts = [];
  if (added > 0) parts.push(`${plural(added, 'new payment')} caught`);
  if (selfTransfers > 0) parts.push(`${plural(selfTransfers, 'transfer')} between your accounts skipped`);
  return parts.length ? parts.join(' · ') : null;
}

function announce(count: IngestCount) {
  const message = describeIngest(count);
  if (message) showToast(message);
}

/** Move anything the native side queued into the Inbox. */
export function pullCaptures(): IngestCount {
  if (!captureAvailable) return NONE;
  try {
    const raws = drainQueue().map(toRaw);
    return raws.length ? useStore.getState().ingestCaptures(raws) : NONE;
  } catch {
    return NONE;
  }
}

/** After an app update with a better filter, rescan recent SMS once so nothing stays missed. */
async function rescanIfFilterChanged() {
  const { settings, updateSettings } = useStore.getState();
  if ((settings.captureFilterVersion ?? 1) >= CAPTURE_FILTER_VERSION) return;
  if (!SMS_CAPTURE_ENABLED || !hasSmsPermission()) {
    updateSettings({ captureFilterVersion: CAPTURE_FILTER_VERSION });
    return;
  }
  announce(await backfillSms(7));
}

/** Mounted once at the root: drains on launch, on resume and whenever a capture arrives. */
export function useCaptureSync() {
  useEffect(() => {
    if (!captureAvailable) return;
    announce(pullCaptures());
    rescanIfFilterChanged().catch(() => {});
    const sub = addCaptureListener(() => announce(pullCaptures()));
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') announce(pullCaptures());
    });
    return () => {
      sub?.remove();
      app.remove();
    };
  }, []);
}

export interface CaptureStatus {
  available: boolean;
  notifications: boolean;
  sms: boolean;
}

function readStatus(): CaptureStatus {
  return {
    available: captureAvailable,
    notifications: isNotificationAccessEnabled(),
    sms: SMS_CAPTURE_ENABLED && hasSmsPermission(),
  };
}

/** Live permission state; re-read when the user comes back from system settings. */
export function useCaptureStatus(): [CaptureStatus, () => void] {
  const [status, setStatus] = useState(readStatus);
  const refresh = useCallback(() => setStatus(readStatus()), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return [status, refresh];
}

/** Ask for SMS access, then backfill recent bank SMS. Returns what was found, or null if denied. */
export async function enableSmsCapture(days = 30): Promise<IngestCount | null> {
  if (Platform.OS !== 'android' || !SMS_CAPTURE_ENABLED) return null;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  ]);
  const granted = Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  if (!granted) return null;
  return backfillSms(days);
}

export async function backfillSms(days: number): Promise<IngestCount> {
  try {
    // Oldest first so self-transfer matching and dedupe see events in order.
    const raws = (await scanRecentSms(Date.now() - days * DAY_MS)).reverse();
    const store = useStore.getState();
    store.updateSettings({ smsScannedAt: Date.now(), captureFilterVersion: CAPTURE_FILTER_VERSION });
    return store.ingestCaptures(raws.map(toRaw));
  } catch {
    return NONE;
  }
}
