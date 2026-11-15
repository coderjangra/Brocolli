import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { isValidVpa } from '@/domain/upi';
import { SpendingCard } from '@/features/spending/SpendingCard';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/Icon';
import { Card, Field, IconButton, Money, PressableScale, Screen, SectionTitle, T } from '@/ui/kit';
import { Mascot } from '@/ui/Mascot';
import { Pop, rowStyles } from '@/ui/rows';
import { showToast } from '@/ui/Toast';

function Stat({
  label,
  children,
  index,
}: {
  label: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 80)
        .springify()
        .damping(14)}
      style={styles.flex}
    >
      <Card style={styles.stat}>
        {children}
        <T v="caption" tone="muted" center>
          {label}
        </T>
      </Card>
    </Animated.View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      label={label}
      onPress={onPress}
      style={[rowStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Icon name={icon} color={colors.brand} />
      <T style={styles.flex}>{label}</T>
      <Icon name="chevron" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

export default function You() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const friendCount = useStore((s) => s.people.length);
  const expenseCount = useStore((s) => s.expenses.filter((e) => !e.deletedAt).length);
  const settled = useStore((s) =>
    s.settlements
      .filter((x) => !x.deletedAt && x.status === 'confirmed')
      .filter((x) => x.fromPersonId === ME || x.toPersonId === ME)
      .reduce((sum, x) => sum + x.amountPaise, 0),
  );

  const [name, setName] = useState(profile.name);
  const [upiId, setUpiId] = useState(profile.upiId);

  const saveName = () => {
    if (name.trim() && name.trim() !== profile.name) {
      updateProfile({ name: name.trim() });
      showToast('Name updated');
    } else setName(profile.name);
  };
  const saveUpi = () => {
    const clean = upiId.trim();
    if (clean === profile.upiId) return;
    if (clean !== '' && !isValidVpa(clean)) {
      showToast('That does not look like a UPI ID');
      setUpiId(profile.upiId);
      return;
    }
    updateProfile({ upiId: clean });
    showToast(clean ? 'UPI ID saved' : 'UPI ID removed');
  };

  return (
    <Screen
      title="You"
      right={
        <IconButton
          name="settings"
          label="Settings"
          filled
          onPress={() => router.push('/settings')}
        />
      }
    >
      <Pop style={styles.hero}>
        <View
          style={[
            styles.mascotRing,
            { backgroundColor: colors.surface, borderColor: colors.brand },
          ]}
        >
          <Mascot mood="happy" size={104} />
        </View>
        <T v="title" bold center>
          {profile.name || 'You'}
        </T>
        <T v="caption" tone="muted" center>
          {profile.upiId || 'No UPI ID yet'}
        </T>
      </Pop>

      <View style={styles.stats}>
        <Stat label="rupees settled" index={0}>
          <Money paise={settled} v="title" tone="brand" countUp />
        </Stat>
        <Stat label="expenses" index={1}>
          <T v="title" bold>
            {expenseCount}
          </T>
        </Stat>
        <Stat label="friends" index={2}>
          <T v="title" bold>
            {friendCount}
          </T>
        </Stat>
      </View>

      <SectionTitle>Spending</SectionTitle>
      <SpendingCard />

      <SectionTitle>Profile</SectionTitle>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        onSubmitEditing={saveName}
        autoCapitalize="words"
      />
      <Field
        label="UPI ID (so friends can pay you)"
        placeholder="name@bank"
        value={upiId}
        onChangeText={setUpiId}
        onBlur={saveUpi}
        onSubmitEditing={saveUpi}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <SectionTitle>More</SectionTitle>
      <MenuRow icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      <MenuRow icon="users" label="Friends and balances" onPress={() => router.push('/friends')} />

      <T v="caption" tone="muted" center style={styles.footer}>
        Brocolli · Broke College Living{'\n'}Your data stays on this phone.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  mascotRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { alignItems: 'center', borderRadius: radius.card, paddingVertical: spacing.md },
  footer: { marginTop: spacing.lg },
});
