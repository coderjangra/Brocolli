import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PersonId } from '@/domain/types';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { success } from '@/ui/haptics';
import { Button, Chip, Field, Screen, SectionTitle, T } from '@/ui/kit';

const EMOJI = ['🏠', '✈️', '🍕', '🎉', '🎓', '🏏', '🚗', '🛒'];

export default function NewGroup() {
  const router = useRouter();
  const people = useStore((s) => s.people);
  const addGroup = useStore((s) => s.addGroup);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI[0]!);
  const [members, setMembers] = useState<PersonId[]>([]);

  const create = () => {
    const id = addGroup({ name: name.trim(), emoji, memberIds: members });
    success();
    router.replace({ pathname: '/group/[id]', params: { id } });
  };

  return (
    <Screen
      title="New group"
      back
      footer={
        <Button
          label="Create group"
          icon="check"
          disabled={!name.trim() || members.length === 0}
          onPress={create}
        />
      }
    >
      <Field
        label="Name"
        placeholder="Flat 302"
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
      />
      <SectionTitle>Icon</SectionTitle>
      <View style={styles.wrap}>
        {EMOJI.map((e) => (
          <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <SectionTitle>Members</SectionTitle>
      {people.length === 0 ? (
        <T tone="muted">Add friends in the Friends tab first, then come back.</T>
      ) : (
        <View style={styles.wrap}>
          <Chip label="You" emoji="🥦" selected />
          {people.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              emoji={p.emoji}
              selected={members.includes(p.id)}
              onPress={() =>
                setMembers(
                  members.includes(p.id) ? members.filter((id) => id !== p.id) : [...members, p.id],
                )
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
