import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { netBalances, personNets } from '@/domain/balances';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/Icon';
import { Button, EmptyState, IconButton, Money, PressableScale, Screen, T } from '@/ui/kit';
import { Enter, rowStyles } from '@/ui/rows';

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const groups = useStore((s) => s.groups);
  const expenses = useStore((s) => s.expenses);
  const settlements = useStore((s) => s.settlements);

  return (
    <Screen
      title="Groups"
      right={
        <IconButton
          name="plus"
          label="New group"
          filled
          onPress={() => router.push('/group/new')}
        />
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          mood="happy"
          title="No groups yet"
          body="Make one for the flat, the trip or the canteen gang, and see who should pay whom."
        >
          <Button label="New group" icon="plus" onPress={() => router.push('/group/new')} />
        </EmptyState>
      ) : (
        groups.map((group, index) => {
          const mine =
            personNets(
              netBalances(
                expenses.filter((e) => e.groupId === group.id),
                settlements.filter((s) => s.groupId === group.id),
                'INR',
              ),
            ).get(ME) ?? 0;
          return (
            <Enter key={group.id} index={index}>
              <PressableScale
                label={`${group.name}, open group`}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                style={[
                  rowStyles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.emoji, { backgroundColor: colors.surfaceRaised }]}>
                  <T v="title">{group.emoji}</T>
                </View>
                <View style={styles.flex}>
                  <T bold numberOfLines={1}>
                    {group.name}
                  </T>
                  <T v="caption" tone={mine > 0 ? 'owed' : mine < 0 ? 'owe' : 'muted'}>
                    {group.memberIds.length} people ·{' '}
                    {mine > 0 ? 'you are owed' : mine < 0 ? 'you owe' : 'settled'}
                  </T>
                </View>
                {mine !== 0 ? (
                  <Money paise={Math.abs(mine)} tone={mine > 0 ? 'owed' : 'owe'} />
                ) : null}
                <Icon name="chevron" size={18} color={colors.textMuted} />
              </PressableScale>
            </Enter>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
