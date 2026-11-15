import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/Icon';
import { Button, Card, T } from '@/ui/kit';

import { useCaptureStatus } from './capture';

/** Permission explainer (SPEC §5): never a cold system prompt, always this card first. */
export function CaptureCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const [status] = useCaptureStatus();
  const dismissed = useStore((s) => s.settings.captureCardDismissed);
  const updateSettings = useStore((s) => s.updateSettings);

  if (!status.available || status.notifications || dismissed) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(15)}
      exiting={FadeOutUp}
      style={styles.wrap}
    >
      <Card>
        <View style={styles.head}>
          <Icon name="zap" color={colors.brand} />
          <T bold style={styles.flex}>
            Let Brocolli catch your payments
          </T>
        </View>
        <T v="caption" tone="muted">
          Brocolli reads only payment alerts from GPay, PhonePe, Paytm, BHIM, bank apps and bank
          SMS. Everything stays on this phone. Nothing is uploaded.
        </T>
        <View style={styles.row}>
          <Button
            style={styles.flex}
            label="Turn on"
            icon="check"
            onPress={() =>
              router.push({ pathname: '/capture-consent', params: { kind: 'notifications' } })
            }
          />
          <Button
            style={styles.flex}
            label="Not now"
            variant="secondary"
            onPress={() => updateSettings({ captureCardDismissed: true })}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
});
