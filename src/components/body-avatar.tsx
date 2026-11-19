import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { BODY_ART } from '@/components/body-avatar-outline';
import type { Sex } from '@/lib/body';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type BodyType = 'thin' | 'normal' | 'heavy' | 'obese';

/**
 * Which body to show for a BMI, using the standard adult bands: under 18.5 thin, under 25 normal,
 * under 30 overweight, 30 and over obese. Without a BMI the normal body is shown.
 */
export function bodyType(bmi?: number | null): BodyType {
  if (!bmi || !Number.isFinite(bmi)) return 'normal';
  if (bmi < 18.5) return 'thin';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'heavy';
  return 'obese';
}

/** Each body is a pair of pictures of the same figure: empty, and full of water. */
const PICTURES = {
  male: {
    thin: [require('@/assets/images/body-male-thin-empty.webp'), require('@/assets/images/body-male-thin-water.webp')],
    normal: [require('@/assets/images/body-male-normal-empty.webp'), require('@/assets/images/body-male-normal-water.webp')],
    heavy: [require('@/assets/images/body-male-heavy-empty.webp'), require('@/assets/images/body-male-heavy-water.webp')],
    obese: [require('@/assets/images/body-male-obese-empty.webp'), require('@/assets/images/body-male-obese-water.webp')],
  },
  female: {
    thin: [require('@/assets/images/body-female-thin-empty.webp'), require('@/assets/images/body-female-thin-water.webp')],
    normal: [require('@/assets/images/body-female-normal-empty.webp'), require('@/assets/images/body-female-normal-water.webp')],
    heavy: [require('@/assets/images/body-female-heavy-empty.webp'), require('@/assets/images/body-female-heavy-water.webp')],
    obese: [require('@/assets/images/body-female-obese-empty.webp'), require('@/assets/images/body-female-obese-water.webp')],
  },
} as const;

/**
 * Sizes are worked out on a reference canvas 1012 tall on which a body measures 926 from head to sole.
 * The pictures have more pixels than that (and the female ones more than the male), so each is scaled by
 * its own head-to-sole distance: every body comes out the same height on screen.
 */
const BASE_H = 1012;
const BASE_BODY = 926;

/** How far the wave rises and falls, in reference-canvas pixels. */
const WAVE = 3;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The water surface: a gentle wave at `level`, as an open line or closed down to `depth` below it. */
function surface(level: number, phase: number, depth: number | null, artW: number, unit: number) {
  'worklet';
  let d = '';
  const step = 12 * unit;
  for (let x = -step; x <= artW + step; x += step) {
    d += `${x === -step ? 'M' : 'L'}${x},${level + Math.sin(x / (22 * unit) + phase) * WAVE * unit}`;
  }
  return depth === null ? d : `${d}L${artW + step},${level + depth * unit}L${-step},${level + depth * unit}Z`;
}

/**
 * The hologram body from the artwork. It fills with water from the feet up as the day's goal fills
 * (`fill`, 0 to 1). Its build follows the member's BMI (thin, normal, overweight or obese). Women see the
 * female figure; everyone else sees the male one.
 *
 * Two pictures of the same body sit on top of each other, one empty and one full of water. The full
 * one is only shown below the water level, so raising the level is what fills the body.
 */
export function BodyAvatar({
  bmi,
  sex,
  fill,
  color,
  height = 400,
  maxWidth,
  label,
}: {
  bmi?: number | null;
  sex?: Sex | null;
  fill: number;
  color: string;
  height?: number;
  /** the widest the body itself (arms included) may be on screen; a broad body is drawn a little smaller to fit */
  maxWidth?: number;
  label: string;
}) {
  const reduced = useReducedMotion();
  const who = sex === 'female' ? 'female' : 'male';
  const type = bodyType(bmi);
  const figure = BODY_ART[who][type];
  const [emptyPicture, waterPicture] = PICTURES[who][type];
  const { width: ART_W, height: ART_H } = figure;
  /** this picture's pixels per pixel of the reference canvas */
  const unit = (figure.feet - figure.top) / BASE_BODY;
  const scale = Math.min(height / BASE_H / unit, maxWidth ? maxWidth / figure.span : Infinity);
  const width = ART_W * scale;
  const tall = ART_H * scale;

  const share = clamp01(fill);
  const target = share <= 0 ? ART_H + 12 * unit : figure.feet - (figure.feet - figure.top) * share;
  const level = useSharedValue(ART_H + 40);
  const phase = useSharedValue(0);

  useEffect(() => {
    level.value = reduced ? target : withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, level]);

  useEffect(() => {
    if (reduced) return;
    phase.value = 0;
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2600, easing: Easing.linear }), -1);
  }, [reduced, phase]);

  // The water picture starts just under the wave, which covers its straight top edge.
  const waterStyle = useAnimatedStyle(() => ({
    height: Math.max(0, (ART_H - (level.value + (WAVE + 1) * unit)) * scale),
  }));
  const capProps = useAnimatedProps(() => ({ d: surface(level.value, phase.value, WAVE + 4, ART_W, unit) }));
  const shineProps = useAnimatedProps(() => ({ d: surface(level.value, phase.value + 1.3, 26, ART_W, unit) }));
  const lineProps = useAnimatedProps(() => ({ d: surface(level.value, phase.value, null, ART_W, unit) }));

  const picture = { position: 'absolute', left: 0, bottom: 0, width, height: tall } as const;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, height: tall }}>
      <View style={{ width, height: tall }}>
        <Image source={emptyPicture} style={picture} contentFit="fill" />
        <Animated.View style={[{ position: 'absolute', left: 0, bottom: 0, width, overflow: 'hidden' }, waterStyle]}>
          <Image source={waterPicture} style={picture} contentFit="fill" />
        </Animated.View>

        <Svg width={width} height={tall} viewBox={`0 0 ${ART_W} ${ART_H}`} style={{ position: 'absolute' }}>
          <Defs>
            <ClipPath id="body">
              <Path d={figure.outline} />
            </ClipPath>
            <LinearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#c9fbff" />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
            <LinearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <G clipPath="url(#body)">
            {/* The moving surface of the water */}
            {share > 0 ? (
              <>
                <AnimatedPath animatedProps={shineProps} fill="url(#shine)" />
                <AnimatedPath animatedProps={capProps} fill="url(#cap)" />
                <AnimatedPath animatedProps={lineProps} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2.2 * unit} />
              </>
            ) : null}
          </G>
        </Svg>
      </View>
    </View>
  );
}
