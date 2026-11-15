import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Share, StyleSheet, Switch, View } from 'react-native';

import { ledgerToCsv } from '@/domain/csv';
import { AccountsCard } from '@/features/accounts/AccountsCard';
import {
  backfillSms,
  describeIngest,
  openNotificationAccessSettings,
  SMS_CAPTURE_ENABLED,
  useCaptureStatus,
} from '@/features/inbox/capture';
import { ME } from '@/store/types';
import type { Settings as SettingsData } from '@/store/types';
import { exportData, useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { tap } from '@/ui/haptics';
import { Button, Card, Screen, SectionTitle, Segmented, T } from '@/ui/kit';
import { Mascot } from '@/ui/Mascot';
import { showToast } from '@/ui/Toast';

const THEMES: readonly { key: SettingsData['theme']; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
];

function ToggleRow({
  title,
  body,
  value,
  onChange,
  disabled,
}: {
  title: string;
  body: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggle, disabled && styles.dim]}>
      <View style={styles.flex}>
        <T bold>{title}</T>
        <T v="caption" tone="muted">
          {body}
        </T>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.brand, false: colors.border }}
        accessibilityLabel={title}
      />
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const loadSamplePayments = useStore((s) => s.loadSamplePayments);
  const [capture] = useCaptureStatus();

  const found = (result: { added: number; selfTransfers: number }) =>
    showToast(describeIngest(result) ?? 'No new payments found');

  const toggleSms = (on: boolean) => {
    if (!on) {
      // Android only lets the user revoke a permission from system settings.
      Linking.openSettings().catch(() => {});
      return;
    }
    router.push({ pathname: '/capture-consent', params: { kind: 'sms' } });
  };

  const exportAll = () => {
    Share.share({ title: 'Brocolli export', message: exportData() }).catch(() => {});
  };

  const exportCsv = () => {
    const s = useStore.getState();
    const nameOf = (id: string) =>
      id === ME ? s.profile.name || 'You' : (s.people.find((p) => p.id === id)?.name ?? 'Someone');
    const groupName = (id: string | undefined) =>
      id ? (s.groups.find((g) => g.id === id)?.name ?? '') : '';
    const csv = ledgerToCsv(s.expenses, s.settlements, ME, nameOf, groupName);
    Share.share({ title: 'Brocolli expenses.csv', message: csv }).catch(() => {});
  };

  // No confirmation dialog: wipe immediately and offer Undo.
  const reset = () => {
    const snapshot = useStore.getState().resetAll();
    router.replace('/onboarding');
    showToast('All data erased', {
      label: 'Undo',
      onPress: () => {
        useStore.getState().restore(snapshot);
        router.replace('/inbox');
      },
    });
  };

  return (
    <Screen title="Settings" back>
      <SectionTitle>Appearance</SectionTitle>
      <Segmented
        options={THEMES}
        value={settings.theme}
        onChange={(theme) => updateSettings({ theme })}
      />

      <SectionTitle>Feel</SectionTitle>
      <Card>
        <ToggleRow
          title="Haptics"
          body="Little taps when you swipe, split and settle."
          value={settings.haptics}
          onChange={(haptics) => {
            updateSettings({ haptics });
            if (haptics) tap();
          }}
        />
      </Card>

      <SectionTitle>Payment capture</SectionTitle>
      <Card>
        <ToggleRow
          title="Read payment notifications"
          body={
            capture.available
              ? 'GPay, PhonePe, Paytm, BHIM, bank apps, and bank SMS shown by your Messages app. Opens Android settings.'
              : 'Not available on this device.'
          }
          value={capture.notifications}
          onChange={(on) =>
            on
              ? router.push({ pathname: '/capture-consent', params: { kind: 'notifications' } })
              : openNotificationAccessSettings()
          }
          disabled={!capture.available}
        />
        {SMS_CAPTURE_ENABLED ? (
          <ToggleRow
            title="Read bank SMS"
            body="Catches bank alerts even when notifications are hidden, and finds the last 30 days of payments."
            value={capture.sms}
            onChange={toggleSms}
            disabled={!capture.available}
          />
        ) : null}
        <T v="caption" tone="muted">
          Only payment messages are read. Everything else is dropped before it reaches the app, and
          nothing ever leaves this phone.
        </T>
        {capture.sms ? (
          <Button
            label="Scan last 30 days of SMS"
            icon="download"
            variant="secondary"
            onPress={() => backfillSms(30).then(found)}
          />
        ) : null}
        {settings.mutedPayees.length > 0 ? (
          <Button
            label={`Unmute ${settings.mutedPayees.length} ignored payee${settings.mutedPayees.length === 1 ? '' : 's'}`}
            variant="ghost"
            onPress={() => {
              const before = settings.mutedPayees;
              updateSettings({ mutedPayees: [] });
              showToast('Payees unmuted', {
                label: 'Undo',
                onPress: () => updateSettings({ mutedPayees: before }),
              });
            }}
          />
        ) : null}
        <Button
          label="Add sample payments to Inbox"
          variant="secondary"
          onPress={() => {
            loadSamplePayments();
            showToast('8 sample payments added');
          }}
        />
      </Card>

      <SectionTitle>Your accounts</SectionTitle>
      <AccountsCard />

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <T v="caption" tone="muted">
          Everything is stored on this phone only. There is no account or cloud sync yet.
        </T>
        <Button label="Export expenses (CSV)" icon="file" variant="secondary" onPress={exportCsv} />
        <Button label="Export everything (JSON)" icon="share" variant="secondary" onPress={exportAll} />
        <Button
          label="Privacy policy"
          icon="shield"
          variant="ghost"
          onPress={() => router.push('/privacy')}
        />
        <Button label="Erase everything" icon="trash" variant="danger" onPress={reset} />
      </Card>

      <View style={styles.about}>
        <Mascot mood="zen" size={90} />
        <T bold center>
          Brocolli
        </T>
        <T v="caption" tone="muted" center>
          Broke College Living · v{Constants.expoConfig?.version ?? '0.1.0'}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  about: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
});
