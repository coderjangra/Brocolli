import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { formatMoney } from '@/domain/format';
import { qrColors, radius, spacing } from '@/theme/tokens';
import { Button, Card, T } from '@/ui/kit';
import { showToast } from '@/ui/Toast';

/**
 * SPEC §10 fallbacks for when a UPI app blocks the intent: a scannable QR of the
 * same `upi://pay` link, and copy-to-clipboard for the UPI ID.
 */
export function UpiFallback({
  upiUrl,
  vpa,
  amountPaise,
  title,
  hint,
}: {
  upiUrl: string | null;
  vpa: string;
  amountPaise: number | null;
  title: string;
  hint: string;
}) {
  const [showQr, setShowQr] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(vpa.trim());
    showToast(
      amountPaise
        ? `Copied ${vpa.trim()} · pay ${formatMoney(amountPaise)}`
        : `Copied ${vpa.trim()}`,
    );
  };

  return (
    <Card>
      <T bold>{title}</T>
      <T v="caption" tone="muted">
        {hint}
      </T>
      <View style={styles.row}>
        <Button
          style={styles.flex}
          label={showQr ? 'Hide QR' : 'Show QR'}
          icon="qr"
          variant="secondary"
          disabled={!upiUrl}
          onPress={() => setShowQr((v) => !v)}
        />
        <Button
          style={styles.flex}
          label="Copy UPI ID"
          icon="copy"
          variant="secondary"
          disabled={!vpa.trim()}
          onPress={copy}
        />
      </View>
      {showQr && upiUrl ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.qrWrap}>
          <View style={[styles.qr, { backgroundColor: qrColors.background }]}>
            <QRCode
              value={upiUrl}
              size={208}
              color={qrColors.modules}
              backgroundColor={qrColors.background}
              ecl="M"
            />
          </View>
          <T v="caption" tone="muted" center>
            Scan with any UPI app{amountPaise ? ` · ${formatMoney(amountPaise)}` : ''}
          </T>
        </Animated.View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  qrWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  qr: { padding: spacing.md, borderRadius: radius.input },
});
