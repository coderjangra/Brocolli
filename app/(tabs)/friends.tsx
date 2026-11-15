import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFriendBalances } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/Icon';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Money,
  PressableScale,
  Screen,
  T,
} from '@/ui/kit';
import { Enter, Pop, rowStyles } from '@/ui/rows';

export default function Friends() {
  const { colors } = useTheme();
  const router = useRouter();
  const addPerson = useStore((s) => s.addPerson);
  const { friends, owedToMe, iOwe } = useFriendBalances();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = (text: string = name) => {
    if (text.trim()) addPerson(text);
    setName('');
    setAdding(false);
  };

  return (
    <Screen
      title="Friends"
      right={
        <IconButton
          name={adding ? 'close' : 'plus'}
          label={adding ? 'Cancel adding a friend' : 'Add a friend'}
          filled
          onPress={() => setAdding(!adding)}
        />
      }
    >
      {adding ? (
        <Pop style={styles.addRow}>
          <Field
            style={styles.flex}
            placeholder="Friend's name"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            onSubmitEditing={(e) => submit(e.nativeEvent.text)}
          />
          <Button label="Add" onPress={() => submit()} disabled={!name.trim()} />
        </Pop>
      ) : null}

      <Pop>
        <Card style={styles.hero}>
          <View style={styles.heroCol}>
            <T v="caption" tone="muted">
              You&apos;re owed
            </T>
            <Money paise={owedToMe} v="title" tone="owed" countUp />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.heroCol}>
            <T v="caption" tone="muted">
              You owe
            </T>
            <Money paise={iOwe} v="title" tone={iOwe > 0 ? 'owe' : 'muted'} countUp />
          </View>
        </Card>
      </Pop>

      {friends.length === 0 ? (
        <EmptyState
          mood="wave"
          title="No friends here yet"
          body="Add the people you split with. Broc promises not to judge."
        >
          <Button label="Add a friend" icon="plus" onPress={() => setAdding(true)} />
        </EmptyState>
      ) : (
        friends.map(({ person, net }, index) => (
          <Enter key={person.id} index={index}>
            <PressableScale
              label={`${person.name}, open balance`}
              onPress={() => router.push({ pathname: '/friend/[id]', params: { id: person.id } })}
              style={[
                rowStyles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Avatar id={person.id} emoji={person.emoji} />
              <View style={styles.flex}>
                <T bold numberOfLines={1}>
                  {person.name}
                </T>
                <T v="caption" tone={net > 0 ? 'owed' : net < 0 ? 'owe' : 'muted'}>
                  {net > 0 ? 'owes you' : net < 0 ? 'you owe' : 'settled up'}
                </T>
              </View>
              {net !== 0 ? <Money paise={Math.abs(net)} tone={net > 0 ? 'owed' : 'owe'} /> : null}
              <Icon name="chevron" size={18} color={colors.textMuted} />
            </PressableScale>
          </Enter>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  hero: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  heroCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
