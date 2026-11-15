import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { netBalances, netBetween } from '@/domain/balances';
import { formatMoney } from '@/domain/format';
import { paiseToDecimalString, rupeesToPaise } from '@/domain/money';
import { buildUpiUrl, isValidVpa } from '@/domain/upi';
import { UpiFallback } from '@/features/settle/UpiFallback';
import { useNets, usePersonLookup } from '@/store/hooks';
import { ME } from '@/store/types';
import { useStore } from '@/store/useStore';
import { spacing } from '@/theme/tokens';
import { Confetti } from '@/ui/Confetti';
import { success } from '@/ui/haptics';
import { Avatar, Button, Card, Field, IconButton, Screen, Segmented, T } from '@/ui/kit';
import { Mascot } from '@/ui/Mascot';
import { Pop } from '@/ui/rows';
import { showToast } from '@/ui/Toast';

const METHODS = [
  { key: 'upi', label: 'UPI' },
  { key: 'cash', label: 'Cash' },
] as const;

export default function Settle() {
  const params = useLocalSearchParams<{
    personId: string;
    groupId?: string;
    /** paise; defaults to the full balance */
    amount?: string;
    /** who pays; defaults to whoever owes */
    from?: 'me' | 'them';
  }>();
  const router = useRouter();
  const person = usePersonLookup();
  const friend = person(params.personId);
  const myUpi = useStore((s) => s.profile.upiId);
  const myName = useStore((s) => s.profile.name);
  const nets = useNets();
  const net = netBetween(nets, ME, friend.id);

  const iPay = params.from ? params.from === 'me' : net < 0;
  const suggested = params.amount ? Number(params.amount) : Math.abs(net);

  const [amount, setAmount] = useState(
    suggested > 0 ? paiseToDecimalString(suggested).replace(/\.00$/, '') : '',
  );
  const [method, setMethod] = useState<'upi' | 'cash'>('upi');
  const [friendUpi, setFriendUpi] = useState(friend.upiId ?? '');
  const [phase, setPhase] = useState<'edit' | 'confirm' | 'done'>('edit');
  const [cleared, setCleared] = useState(false);

  const paise = rupeesToPaise(amount);
  const valid = paise !== null && paise > 0;
  const note = `Brocolli: settling up with ${myName || 'a friend'}`;
  const payUrl = valid
    ? buildUpiUrl({ vpa: friendUpi, name: friend.name, amountPaise: paise, note })
    : null;
  const receiveUrl =
    valid && myUpi
      ? buildUpiUrl({ vpa: myUpi, name: myName || 'Brocolli user', amountPaise: paise, note: 'Brocolli' })
      : null;

  const record = () => {
    if (!valid) return;
    const store = useStore.getState();
    const id = store.addSettlement({
      fromPersonId: iPay ? ME : friend.id,
      toPersonId: iPay ? friend.id : ME,
      amountPaise: paise,
      method,
      groupId: params.groupId,
    });
    const after = useStore.getState();
    setCleared(
      netBetween(netBalances(after.expenses, after.settlements, 'INR'), ME, friend.id) === 0,
    );
    success();
    setPhase('done');
    showToast(`Settled ${formatMoney(paise)} with ${friend.name}`, {
      label: 'Undo',
      onPress: () => {
        useStore.getState().setSettlementDeleted(id, true);
        router.back();
      },
    });
  };

  const payWithUpi = async () => {
    if (!valid) return;
    const url = payUrl;
    if (!url) return;
    if (friendUpi.trim() !== friend.upiId) {
      useStore.getState().updatePerson(friend.id, { upiId: friendUpi.trim() });
    }
    try {
      await Linking.openURL(url);
    } catch {
      showToast('No UPI app opened. Pay any way you like, then confirm here.');
    }
    // We are not a payment provider and cannot see the result, so we ask.
    setPhase('confirm');
  };

  const request = () => {
    if (!valid) return;
    const upiLine = myUpi ? ` You can pay me on UPI: ${myUpi}` : '';
    Share.share({
      message: `Hey ${friend.name}, you owe me ${formatMoney(paise)} from our splits on Brocolli.${upiLine}`,
    }).catch(() => {});
  };

  if (phase === 'done') {
    return (
      <Screen scroll={false}>
        <View style={styles.done}>
          <Pop>
            <Mascot mood="rich" size={200} />
          </Pop>
          <T v="title" bold center>
            {cleared ? `You and ${friend.name} are square!` : 'Payment recorded'}
          </T>
          <T tone="muted" center>
            {cleared ? 'Nothing owed either way. Broc approves.' : 'The balance has been updated.'}
          </T>
          <Button label="Done" onPress={() => router.back()} style={styles.doneButton} />
        </View>
        {cleared ? <Confetti /> : null}
      </Screen>
    );
  }

  return (
    <Screen
      title="Settle up"
      right={<IconButton name="close" label="Close" filled onPress={() => router.back()} />}
    >
      <Pop style={styles.hero}>
        <Avatar id={friend.id} emoji={friend.emoji} size={72} />
        <T tone="muted">{iPay ? `You pay ${friend.name}` : `${friend.name} pays you`}</T>
      </Pop>

      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
      />

      <Segmented options={METHODS} value={method} onChange={setMethod} />

      {phase === 'confirm' ? (
        <Animated.View entering={FadeInDown.springify().damping(15)}>
          <Card>
            <T bold>Did it go through?</T>
            <T v="caption" tone="muted">
              Brocolli never touches your money, so it cannot see whether the payment worked.
            </T>
            <View style={styles.row}>
              <Button style={styles.flex} label="Yes, paid" icon="check" onPress={record} />
              <Button
                style={styles.flex}
                label="Not yet"
                variant="secondary"
                onPress={() => setPhase('edit')}
              />
            </View>
          </Card>
        </Animated.View>
      ) : iPay ? (
        method === 'upi' ? (
          <>
            <Field
              label={`${friend.name}'s UPI ID`}
              placeholder="name@bank"
              value={friendUpi}
              onChangeText={setFriendUpi}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label="Pay with UPI"
              icon="send"
              disabled={!valid || !isValidVpa(friendUpi)}
              onPress={payWithUpi}
            />
            <Button label="I already paid" variant="secondary" disabled={!valid} onPress={record} />
            {isValidVpa(friendUpi) ? (
              <UpiFallback
                upiUrl={payUrl}
                vpa={friendUpi}
                amountPaise={valid ? paise : null}
                title="UPI app not opening?"
                hint="Some apps block payment links. Copy the UPI ID, or save this QR and scan it from your gallery in any UPI app."
              />
            ) : null}
          </>
        ) : (
          <Button label="Mark as paid in cash" icon="check" disabled={!valid} onPress={record} />
        )
      ) : (
        <>
          <Button
            label={`Record ${valid ? formatMoney(paise) : ''} received`}
            icon="check"
            disabled={!valid}
            onPress={record}
          />
          <Button
            label="Send a request"
            icon="share"
            variant="secondary"
            disabled={!valid}
            onPress={request}
          />
          {myUpi ? (
            <UpiFallback
              upiUrl={receiveUrl}
              vpa={myUpi}
              amountPaise={valid ? paise : null}
              title="Paying you in person?"
              hint={`Show ${friend.name} this QR to scan, or copy your UPI ID.`}
            />
          ) : (
            <T v="caption" tone="muted" center>
              Add your UPI ID in the You tab so requests include where to pay.
            </T>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  doneButton: { alignSelf: 'stretch', marginTop: spacing.lg },
});
