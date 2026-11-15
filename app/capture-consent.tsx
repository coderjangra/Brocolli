import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  describeIngest,
  enableSmsCapture,
  openNotificationAccessSettings,
} from '@/features/inbox/capture';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Card, IconButton, Screen, T } from '@/ui/kit';
import { Mascot } from '@/ui/Mascot';
import { showToast } from '@/ui/Toast';

const COPY = {
  notifications: {
    title: 'Catch payments from notifications',
    reads:
      'Notifications from UPI and bank apps (Google Pay, PhonePe, Paytm, BHIM, bank apps) and bank alerts shown by your Messages app.',
    allow: 'Continue to Android settings',
  },
  sms: {
    title: 'Catch payments from bank SMS',
    reads:
      'Incoming SMS, and the last 30 days of SMS once now, to find bank transaction alerts like “Sent Rs.250 from A/c *1234”.',
    allow: 'Allow SMS access',
  },
} as const;

function Point({ icon, children }: { icon: IconName; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point}>
      <Icon name={icon} color={colors.brand} size={20} />
      <T style={styles.flex}>{children}</T>
    </View>
  );
}

/**
 * Prominent disclosure (Google Play User Data policy): shown in-app, before the
 * system permission prompt, and only an explicit tap on "Allow" continues.
 */
export default function CaptureConsent() {
  const { kind = 'notifications' } = useLocalSearchParams<{ kind?: 'notifications' | 'sms' }>();
  const router = useRouter();
  const copy = COPY[kind] ?? COPY.notifications;
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    if (kind === 'sms') {
      setBusy(true);
      const result = await enableSmsCapture(30);
      setBusy(false);
      router.back();
      showToast(
        result === null
          ? 'SMS access not given. Notifications still work.'
          : (describeIngest(result) ?? 'SMS capture is on. New bank alerts will appear here.'),
      );
      return;
    }
    router.back();
    openNotificationAccessSettings();
  };

  return (
    <Screen
      title=""
      right={<IconButton name="close" label="Close" filled onPress={() => router.back()} />}
      footer={
        <View style={styles.buttons}>
          <Button label={copy.allow} icon="check" disabled={busy} onPress={allow} />
          <Button label="Not now" variant="secondary" onPress={() => router.back()} />
        </View>
      }
    >
      <View style={styles.hero}>
        <Mascot mood="wave" size={120} />
        <T v="title" bold center>
          {copy.title}
        </T>
        <T tone="muted" center>
          Brocolli turns your payments into cards you can split with a swipe. Here is exactly what
          that means.
        </T>
      </View>
      <Card>
        <T bold>What Brocolli reads</T>
        <Point icon="message">{copy.reads}</Point>
      </Card>
      <Card>
        <T bold>What it keeps</T>
        <Point icon="check">
          Only payment details: amount, payee, bank, last 4 digits of the account, reference and
          time.
        </Point>
        <Point icon="close">
          Everything else, including personal messages and OTPs, is discarded instantly on your
          phone.
        </Point>
      </Card>
      <Card>
        <T bold>Where it goes</T>
        <Point icon="shield">
          Nowhere. It stays on this phone. No servers, no ads, no analytics. Turn it off any time in
          Settings.
        </Point>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  buttons: { gap: spacing.sm },
});
