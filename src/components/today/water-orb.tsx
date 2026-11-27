import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import type { Key } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { formatWater, waterPercent } from '@/lib/water';
import { useT } from '@/providers/language-provider';

const WATER = '#38bdf8';
const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const GLASS_ML = 250;

// The drawing's own measures: a glass orb inside a progress ring, in a square of 156.
const SIZE = 156;
const MID = SIZE / 2;
const RING = 73;
const AROUND = 2 * Math.PI * RING;
const ORB = 63;
/** Where the water's surface is when the orb is full, and when it is empty. */
const FULL = MID - ORB - 3;
const EMPTY = MID + ORB + 3;
/** Even an empty orb shows a little water. */
const FLOOR = 0.07;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One moving layer of water inside the orb: a wavy surface at the current level. */
function Water({ level, phase, shift, color, opacity = 1 }: { level: SharedValue<number>; phase: SharedValue<number>; shift: number; color: string; opacity?: number }) {
  const animated = useAnimatedProps(() => {
    const surface = EMPTY - Math.max(FLOOR, level.get()) * (EMPTY - FULL);
    let d = '';
    for (let x = 0; x <= SIZE; x += 6) d += `${x ? 'L' : 'M'}${x} ${surface + 3.5 * Math.sin(x / 17 + phase.get() + shift)} `;
    return { d: `${d}L${SIZE} ${SIZE} L0 ${SIZE} Z` };
  });
  return <AnimatedPath animatedProps={animated} fill={color} fillOpacity={opacity} />;
}

/** The ring around the orb: how far along the goal is. It turns green once the goal is reached. */
function Ring({ level, done }: { level: SharedValue<number>; done: boolean }) {
  const animated = useAnimatedProps(() => {
    const part = Math.min(1, Math.max(0, level.get()));
    // A rounded end would leave a dot at nothing, so nothing is drawn then.
    return { strokeDashoffset: AROUND * (1 - part), strokeOpacity: part > 0.005 ? 1 : 0 };
  });
  return <AnimatedCircle animatedProps={animated} cx={MID} cy={MID} r={RING} fill="none" stroke={done ? BRAND : 'url(#water-ring)'} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${AROUND} ${AROUND}`} transform={`rotate(-90 ${MID} ${MID})`} />;
}

/** "+250 ml" floating up from the orb. */
function Splash({ ml }: { ml: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - t.get() ** 3, transform: [{ translateY: -56 * t.get() }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 70, alignSelf: 'center' }, style]}>
      <DisplayText maxFontSizeMultiplier={1} style={{ fontSize: 19, color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 }}>
        +{ml} ml
      </DisplayText>
    </Animated.View>
  );
}

type Vessel = 'cup' | 'glass' | 'bottle' | 'large';

const VESSELS: { kind: Vessel; ml: number; name: Key }[] = [
  { kind: 'cup', ml: 150, name: 'hm.cup' },
  { kind: 'glass', ml: GLASS_ML, name: 'hm.glass' },
  { kind: 'bottle', ml: 500, name: 'hm.bottle' },
  { kind: 'large', ml: 750, name: 'hm.largeBottle' },
];

/** Each drink's outline, and the height its water comes up to (in a 32 × 40 box). */
const SHAPES: Record<Vessel, { path: string; fill: number; handle?: string }> = {
  cup: { path: 'M5 15 H23 V29 a6 6 0 0 1 -6 6 H11 a6 6 0 0 1 -6 -6 Z', handle: 'M23 19 h1.5 a4.5 4.5 0 0 1 0 9 H23', fill: 22 },
  glass: { path: 'M7 7 H25 L22.6 35 a2.2 2.2 0 0 1 -2.2 2 H11.6 a2.2 2.2 0 0 1 -2.2 -2 Z', fill: 18 },
  bottle: { path: 'M13 3 h6 v5 c0 2.5 5 4 5 9 v18 a3 3 0 0 1 -3 3 H11 a3 3 0 0 1 -3 -3 V17 c0 -5 5 -6.5 5 -9 Z', fill: 20 },
  large: { path: 'M12 2 h8 v4 c0 2.5 7 3.5 7 10 v20 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 V16 c0 -6.5 7 -7.5 7 -10 Z', fill: 17 },
};

function VesselIcon({ kind }: { kind: Vessel }) {
  const { path, handle, fill } = SHAPES[kind];
  return (
    <Svg width={22} height={28} viewBox="0 0 32 40">
      <Defs>
        <ClipPath id={`water-${kind}`}>
          <Path d={path} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#water-${kind})`}>
        <Rect x="0" y={fill} width="32" height={40 - fill} fill={WATER} />
      </G>
      <Path d={path} fill="none" stroke="#bae6fd" strokeWidth={2.2} strokeLinejoin="round" />
      {handle ? <Path d={handle} fill="none" stroke="#bae6fd" strokeWidth={2.2} strokeLinecap="round" /> : null}
    </Svg>
  );
}

/**
 * The day's water as a glass orb that fills toward the goal, inside a progress ring. The drinks to add sit under
 * it: a cup, a glass, a bottle, a large bottle. Without `onDrink` (another day) it only shows how the day went.
 */
export function WaterOrb({
  totalMl,
  goalMl,
  busy,
  lastDrinkMl,
  onDrink,
  onUndo,
}: {
  totalMl: number;
  goalMl: number;
  busy: boolean;
  lastDrinkMl: number | null;
  onDrink?: (ml: number) => void;
  onUndo?: () => void;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const [splash, setSplash] = useState<{ ml: number; n: number } | null>(null);
  const hasGoal = goalMl > 0;
  const done = hasGoal && totalMl >= goalMl;
  const left = Math.max(0, goalMl - totalMl);
  const glasses = Math.ceil(left / GLASS_ML);
  const percent = waterPercent(totalMl, goalMl);
  const fill = hasGoal ? Math.min(1, totalMl / goalMl) : 0;

  // The water rises to its mark, then moves with each drink; its surface keeps rippling.
  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  useEffect(() => {
    level.set(reduced ? fill : withSpring(fill, { damping: 13, stiffness: 60 }));
  }, [fill, level, reduced]);
  useEffect(() => {
    if (!reduced) phase.set(withRepeat(withTiming(Math.PI * 2, { duration: 2600, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [phase, reduced]);

  const drink = (ml: number) => {
    playSound('waterAdd', 0.8);
    setSplash((s) => ({ ml, n: (s?.n ?? 0) + 1 }));
    onDrink?.(ml);
  };

  return (
    <View>
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={hasGoal ? `${t('hm.water')}, ${t('hm.xOfY', { done: formatWater(totalMl), total: formatWater(goalMl) })}` : `${t('hm.water')}, ${formatWater(totalMl)}`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <ClipPath id="water-orb">
                <Circle cx={MID} cy={MID} r={ORB} />
              </ClipPath>
              <LinearGradient id="water-deep" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#22b8f0" />
                <Stop offset="1" stopColor="#1d4ed8" />
              </LinearGradient>
              <LinearGradient id="water-ring" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#7dd3fc" />
                <Stop offset="1" stopColor="#2563eb" />
              </LinearGradient>
            </Defs>
            <Circle cx={MID} cy={MID} r={RING} fill="none" stroke={WATER} strokeOpacity={0.14} strokeWidth={6} />
            <Ring level={level} done={done} />
            <Circle cx={MID} cy={MID} r={ORB} fill="#07141f" />
            <G clipPath="url(#water-orb)">
              <Water level={level} phase={phase} shift={2.6} color="#7dd3fc" opacity={0.4} />
              <Water level={level} phase={phase} shift={0} color="url(#water-deep)" />
            </G>
            {/* The light on the glass. */}
            <Path d="M33 62 A48 48 0 0 1 62 33" fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={5} strokeLinecap="round" />
          </Svg>
          {hasGoal ? (
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <DisplayText maxFontSizeMultiplier={1} style={{ fontSize: 32, lineHeight: 40, color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>
                {percent}
                <Text style={{ fontSize: 17 }}>%</Text>
              </DisplayText>
            </View>
          ) : null}
          {splash ? <Splash key={splash.n} ml={splash.ml} /> : null}
        </View>

        <View className="flex-1">
          <DisplayText maxFontSizeMultiplier={1.1} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 42, color: '#ffffff' }}>
            {formatWater(totalMl)}
          </DisplayText>
          {hasGoal ? (
            <>
              <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
                {t('hm.ofGoal', { goal: formatWater(goalMl) })}
              </Text>
              <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 13, lineHeight: 19, marginTop: 10, color: done ? BRAND : WATER }}>
                {done ? `🎉 ${t('hm.goalReached')}` : t(glasses === 1 ? 'hm.leftGlassOne' : 'hm.leftGlassMany', { water: formatWater(left), n: glasses })}
              </Text>
              {done ? null : (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11 }}>
                  {t('hm.stillToDrink')}
                </Text>
              )}
            </>
          ) : null}
          {onUndo && lastDrinkMl ? (
            <Pressable
              onPress={onUndo}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('hm.undoLastMl', { ml: lastDrinkMl })}
              className="flex-row items-center self-start rounded-full bg-card-2 active:opacity-70"
              style={{ gap: 5, minHeight: 34, paddingHorizontal: 12, marginTop: 10, opacity: busy ? 0.6 : 1 }}>
              <SymbolView name={{ ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }} tintColor="#8fa396" size={13} />
              <Text {...COMPACT_TEXT} className="font-bold text-muted" style={{ fontSize: 12 }}>
                {t('hm.undo')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {onDrink ? (
        <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
          {VESSELS.map((v) => (
            <Pressable
              key={v.kind}
              onPress={() => drink(v.ml)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${t(v.name)}, ${t('hm.addWaterA11y', { ml: v.ml })}`}
              className="flex-1 active:opacity-70"
              style={{ opacity: busy ? 0.6 : 1 }}>
              <View className="items-center" style={{ borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: 'rgba(56,189,248,0.1)' }}>
                <VesselIcon kind={v.kind} />
                <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="font-black text-white" style={{ fontSize: 13, marginTop: 4 }}>
                  +{v.ml}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
