import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { confettiColors } from '@/theme/tokens';

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  // deterministic pseudo-random spread so renders are stable
  x: ((i * 37) % 100) / 100,
  drift: (((i * 53) % 60) - 30) / 100,
  delay: (i * 23) % 260,
  spin: 360 + ((i * 97) % 540),
  size: 7 + (i % 4) * 2,
  color: confettiColors[i % confettiColors.length]!,
}));

function Piece({
  piece,
  width,
  height,
}: {
  piece: (typeof PIECES)[number];
  width: number;
  height: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      withDelay(piece.delay, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) })),
    );
  }, [t, piece.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.8 ? 1 : (1 - t.value) * 5,
    transform: [
      { translateX: piece.x * width + piece.drift * width * t.value },
      { translateY: -20 + height * 0.75 * t.value },
      { rotate: `${piece.spin * t.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.size * 1.6, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

/** A short burst for "balance reached zero". Skipped entirely under Reduce Motion. */
export function Confetti() {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PIECES.map((piece, i) => (
        <Piece key={i} piece={piece} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
