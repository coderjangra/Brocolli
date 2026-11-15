import { requireOptionalNativeModule, type EventSubscription } from 'expo';

export interface RawNativeCapture {
  source: 'sms' | 'notification';
  sender: string;
  text: string;
  receivedAt: number;
  packageName?: string | null;
}

interface PaymentCaptureNative {
  isNotificationAccessEnabled(): boolean;
  openNotificationAccessSettings(): void;
  hasSmsPermission(): boolean;
  drainQueue(): RawNativeCapture[];
  scanRecentSms(sinceMs: number): Promise<RawNativeCapture[]>;
  addListener(event: 'onCapture', listener: () => void): EventSubscription;
}

// Null on iOS/web or in a build without the module: capture is simply unavailable.
const native = requireOptionalNativeModule<PaymentCaptureNative>('PaymentCapture');

export const captureAvailable = native !== null;

export function isNotificationAccessEnabled(): boolean {
  return native?.isNotificationAccessEnabled() ?? false;
}

export function openNotificationAccessSettings(): void {
  native?.openNotificationAccessSettings();
}

export function hasSmsPermission(): boolean {
  return native?.hasSmsPermission() ?? false;
}

export function drainQueue(): RawNativeCapture[] {
  return native?.drainQueue() ?? [];
}

export function scanRecentSms(sinceMs: number): Promise<RawNativeCapture[]> {
  return native?.scanRecentSms(sinceMs) ?? Promise.resolve([]);
}

export function addCaptureListener(listener: () => void): EventSubscription | null {
  return native?.addListener('onCapture', listener) ?? null;
}
