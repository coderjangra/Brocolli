import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Text as SvgText } from 'react-native-svg';

import { mascotColors as c } from '@/theme/tokens';

export type MascotMood = 'happy' | 'wave' | 'zen' | 'rich' | 'sad';

const VB_W = 120;
const VB_H = 132;

/**
 * Broc, the Brocolli mascot: a broccoli floret with a face. Drawn as layered
 * SVGs so the body can bob, the eyes can blink and the arm can wave on the UI
 * thread. Honors Reduce Motion (renders a still pose).
 */
export function Mascot({ size = 140, mood = 'happy' }: { size?: number; mood?: MascotMood }) {
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const arm = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const ease = Easing.inOut(Easing.sin);
    bob.set(
      withRepeat(withTiming(1, { duration: mood === 'zen' ? 2200 : 1300, easing: ease }), -1, true),
    );
    blink.set(
      withRepeat(
        withDelay(
          2600,
          withSequence(withTiming(0.1, { duration: 80 }), withTiming(1, { duration: 120 })),
        ),
        -1,
      ),
    );
    if (mood === 'wave' || mood === 'rich') {
      arm.set(withRepeat(withTiming(1, { duration: 380, easing: ease }), -1, true));
    }
  }, [reduced, mood, bob, blink, arm]);

  const height = (size * VB_H) / VB_W;
  const k = size / VB_W;

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * k * bob.value }, { rotate: `${-2 + 4 * bob.value}deg` }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - 0.18 * bob.value }],
    opacity: 1 - 0.3 * bob.value,
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transformOrigin: [60 * k, 84 * k, 0],
    transform: [{ scaleY: blink.value }],
  }));
  const armStyle = useAnimatedStyle(() => ({
    transformOrigin: [79 * k, 88 * k, 0],
    transform: [{ rotate: `${-14 + 28 * arm.value}deg` }],
  }));

  const raised = mood === 'wave' || mood === 'rich';
  const closedEyes = mood === 'zen';
  const mouth =
    mood === 'sad'
      ? 'M54 99 Q60 93 66 99'
      : mood === 'zen'
        ? 'M55 96 Q60 99 65 96'
        : 'M53 94 Q60 103 67 94';

  const layer = { width: size, height };
  return (
    <View style={layer} accessibilityRole="image" accessibilityLabel="Broc the broccoli mascot">
      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        <Svg {...layer} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Ellipse cx={60} cy={126} rx={26} ry={5} fill={c.shadow} />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        {/* raised arm sits behind the body */}
        <Animated.View style={[StyleSheet.absoluteFill, armStyle]}>
          <Svg {...layer} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {raised ? (
              <>
                <Path
                  d="M79 88 Q92 82 97 68"
                  stroke={c.stalkShade}
                  strokeWidth={7}
                  strokeLinecap="round"
                  fill="none"
                />
                {mood === 'rich' ? (
                  <>
                    <Circle
                      cx={99}
                      cy={58}
                      r={12}
                      fill={c.coin}
                      stroke={c.coinEdge}
                      strokeWidth={2.5}
                    />
                    <SvgText
                      x={99}
                      y={63}
                      fontSize={14}
                      fontWeight="700"
                      fill={c.coinEdge}
                      textAnchor="middle"
                    >
                      ₹
                    </SvgText>
                  </>
                ) : (
                  <Circle cx={97} cy={66} r={5} fill={c.stalk} />
                )}
              </>
            ) : (
              <Path
                d="M79 90 Q90 94 92 104"
                stroke={c.stalkShade}
                strokeWidth={7}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </Svg>
        </Animated.View>

        <Svg {...layer} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          {/* left arm */}
          <Path
            d="M41 90 Q30 94 28 104"
            stroke={c.stalkShade}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          {/* feet */}
          <Ellipse cx={51} cy={121} rx={9} ry={5} fill={c.stalkShade} />
          <Ellipse cx={69} cy={121} rx={9} ry={5} fill={c.stalkShade} />
          {/* stalk body */}
          <Path d="M41 62 Q37 100 45 114 Q60 126 75 114 Q83 100 79 62 Z" fill={c.stalk} />
          <Path d="M70 64 Q76 98 70 116 Q79 108 79 62 Z" fill={c.stalkShade} opacity={0.7} />
          {/* florets */}
          <Circle cx={33} cy={50} r={19} fill={c.floretDark} />
          <Circle cx={87} cy={50} r={19} fill={c.floretDark} />
          <Circle cx={45} cy={30} r={19} fill={c.floret} />
          <Circle cx={75} cy={30} r={19} fill={c.floret} />
          <Circle cx={60} cy={46} r={25} fill={c.floret} />
          <Circle cx={60} cy={22} r={15} fill={c.floretLight} />
          <Circle cx={40} cy={42} r={9} fill={c.floretLight} opacity={0.55} />
          <Circle cx={80} cy={40} r={7} fill={c.floretLight} opacity={0.55} />
          {/* cheeks + mouth */}
          <Circle cx={47} cy={93} r={4} fill={c.cheek} opacity={0.65} />
          <Circle cx={73} cy={93} r={4} fill={c.cheek} opacity={0.65} />
          <Path d={mouth} stroke={c.face} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </Svg>

        <Animated.View style={[StyleSheet.absoluteFill, eyeStyle]}>
          <Svg {...layer} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            {closedEyes ? (
              <>
                <Path
                  d="M47 84 Q52 88 57 84"
                  stroke={c.face}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M63 84 Q68 88 73 84"
                  stroke={c.face}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              <>
                <Circle cx={52} cy={84} r={4.6} fill={c.face} />
                <Circle cx={68} cy={84} r={4.6} fill={c.face} />
                <Circle cx={53.4} cy={82.4} r={1.5} fill={c.eyeShine} />
                <Circle cx={69.4} cy={82.4} r={1.5} fill={c.eyeShine} />
              </>
            )}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
