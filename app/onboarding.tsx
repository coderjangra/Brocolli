import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';

import { isValidVpa } from '@/domain/upi';
import { useStore } from '@/store/useStore';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { success } from '@/ui/haptics';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Chip, Field, Screen, T } from '@/ui/kit';
import { Mascot } from '@/ui/Mascot';

const STEPS = 4;

const PITCH: [IconName, string, string][] = [
  ['zap', 'Log it in a swipe', 'Sort each payment the moment you make it.'],
  ['users', 'One number per friend', 'Always know who owes whom, and why.'],
  ['send', 'Settle on UPI', 'Pay back in a tap. We never hold your money.'],
];

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [personName, setPersonName] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [withSamples, setWithSamples] = useState(true);
  const [adult, setAdult] = useState(false);

  const upiOk = upiId.trim() === '' || isValidVpa(upiId);
  const canContinue =
    step === 1 ? name.trim().length > 0 && adult : step === 2 ? upiOk : true;

  const addPerson = (text: string = personName) => {
    const clean = text.trim();
    if (clean && !people.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      setPeople([...people, clean]);
    }
    setPersonName('');
  };

  const next = () => {
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    const pending = personName.trim();
    completeOnboarding({
      name,
      upiId: upiOk ? upiId : '',
      people: pending && !people.includes(pending) ? [...people, pending] : people,
      withSamples,
    });
    Keyboard.dismiss();
    success();
    router.replace('/inbox');
  };

  return (
    <Screen
      footer={
        <>
          <View style={styles.dots}>
            {Array.from({ length: STEPS }, (_, i) => (
              <Animated.View
                key={i}
                layout={LinearTransition.springify().damping(16)}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? colors.brand : colors.border },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <Button
            label={step === 0 ? 'Get started' : step === STEPS - 1 ? "Let's go" : 'Continue'}
            onPress={next}
            disabled={!canContinue}
          />
          {step > 0 ? (
            <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />
          ) : null}
        </>
      }
    >
      <Animated.View
        key={step}
        entering={FadeInRight.springify().damping(18)}
        exiting={FadeOutLeft.duration(120)}
        style={styles.step}
      >
        {step === 0 ? (
          <>
            <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.hero}>
              <Mascot mood="wave" size={190} />
            </Animated.View>
            <T v="display" center tone="brand">
              Brocolli
            </T>
            <T v="title" center>
              Broke College Living
            </T>
            <T tone="muted" center>
              Split the bill before the awkwardness sets in.
            </T>
            <View style={styles.pitch}>
              {PITCH.map(([icon, title, body], i) => (
                <Animated.View
                  key={title}
                  entering={FadeInDown.delay(250 + i * 110).springify()}
                  style={[styles.pitchRow, { backgroundColor: colors.surface }]}
                >
                  <View style={[styles.pitchIcon, { backgroundColor: colors.surfaceRaised }]}>
                    <Icon name={icon} color={colors.brand} />
                  </View>
                  <View style={styles.flex}>
                    <T bold>{title}</T>
                    <T v="caption" tone="muted">
                      {body}
                    </T>
                  </View>
                </Animated.View>
              ))}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.hero}>
              <Mascot mood="happy" size={130} />
            </View>
            <T v="title" bold>
              What do your friends call you?
            </T>
            <T tone="muted">This is the name they will see on splits.</T>
            <Field
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => canContinue && next()}
            />
            <View style={styles.ageRow}>
              <View style={styles.flexFill}>
                <T bold>I am 18 or older</T>
                <T v="caption" tone="muted">
                  Brocolli is for adults.
                </T>
              </View>
              <Switch
                value={adult}
                onValueChange={setAdult}
                trackColor={{ true: colors.brand, false: colors.border }}
                accessibilityLabel="I am 18 or older"
              />
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.hero}>
              <Mascot mood="rich" size={130} />
            </View>
            <T v="title" bold>
              Your UPI ID
            </T>
            <T tone="muted">
              Optional. It goes into payment requests so friends can pay you back. Stored only on
              this phone.
            </T>
            <Field
              placeholder="name@bank"
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={() => canContinue && next()}
            />
            {!upiOk ? (
              <T v="caption" tone="owe">
                That does not look like a UPI ID (for example rahul@okhdfc).
              </T>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.hero}>
              <Mascot mood="wave" size={130} />
            </View>
            <T v="title" bold>
              Add your people
            </T>
            <T tone="muted">Flatmates, canteen crew, trip gang. You can add more later.</T>
            <View style={styles.addRow}>
              <Field
                style={styles.flex}
                placeholder="Friend's name"
                value={personName}
                onChangeText={setPersonName}
                autoCapitalize="words"
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={(e) => addPerson(e.nativeEvent.text)}
              />
              <Button label="Add" variant="secondary" icon="plus" onPress={() => addPerson()} />
            </View>
            <View style={styles.chips}>
              {people.map((person) => (
                <Animated.View
                  key={person}
                  entering={ZoomIn.springify().damping(12)}
                  layout={LinearTransition.springify()}
                >
                  <Chip
                    label={`${person}  ✕`}
                    selected
                    onPress={() => setPeople(people.filter((p) => p !== person))}
                  />
                </Animated.View>
              ))}
            </View>
            <View style={[styles.sampleRow, { backgroundColor: colors.surface }]}>
              <View style={styles.flex}>
                <T bold>Start with sample payments</T>
                <T v="caption" tone="muted">
                  Automatic capture from SMS is not built yet, so this fills your Inbox with a few
                  made-up payments to try swiping.
                </T>
              </View>
              <Switch
                value={withSamples}
                onValueChange={setWithSamples}
                trackColor={{ true: colors.brand, false: colors.border }}
                accessibilityLabel="Start with sample payments"
              />
            </View>
          </>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  flexFill: { flex: 1 },
  flex: { flex: 1 },
  step: { gap: spacing.md, paddingTop: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.md },
  pitch: { gap: spacing.sm, marginTop: spacing.md },
  pitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
  },
  pitchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    marginTop: spacing.md,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  dotActive: { width: 24 },
});
