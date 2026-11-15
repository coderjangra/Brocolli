import { StyleSheet, View } from 'react-native';

import policy from '@/legal/privacy.json';
import { spacing } from '@/theme/tokens';
import { Card, Screen, SectionTitle, T } from '@/ui/kit';

export default function Privacy() {
  return (
    <Screen title="Privacy" back>
      <T tone="muted">Effective {policy.effective}</T>
      <T>{policy.intro}</T>
      {policy.sections.map((section) => (
        <View key={section.heading}>
          <SectionTitle>{section.heading}</SectionTitle>
          <Card>
            {section.points.map((point) => (
              <View key={point} style={styles.point}>
                <T tone="muted">•</T>
                <T style={styles.flex}>{point}</T>
              </View>
            ))}
          </Card>
        </View>
      ))}
      <T v="caption" tone="muted" center style={styles.contact}>
        {policy.contact}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  point: { flexDirection: 'row', gap: spacing.sm },
  contact: { marginTop: spacing.lg },
});
