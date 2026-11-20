import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { fmtKg } from '@/lib/body';
import { useProfile } from '@/providers/profile-provider';

const GOLD = '#ffd66b';
const INK = '#050a07';
const STUB = '#0f140f';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const RADIUS = 28;
/** Radius of the two bites in the sides, where the ticket would tear. */
const BITE = 13;
/** How far the trophy stands out above the card's top edge. */
const POP = 20;
const TROPHY_W = 132;
const TROPHY_H = 150;

/**
 * The offer at the end of Home. Change the words and numbers here.
 * The app does not know when a member's 90 days began, nor the rules: the card sends them to their dietitian for those.
 */
export const WEIGHT_LOSS_OFFER = {
  tag: '90-day challenge',
  lead: 'Lose 10 kg in 90 days. Win',
  prize: '₹50,000',
  line: 'Hit the goal inside 90 days and the prize is yours.',
  /** How many kilograms have to come off. */
  goalKg: 10,
  action: 'Ask your dietitian how to join',
} as const;

/** A ticket outline: rounded corners and a round bite out of each side at `cut`. */
function ticketPath(w: number, h: number, cut: number) {
  const r = RADIUS;
  const b = BITE;
  return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${cut - b} A ${b} ${b} 0 0 0 ${w} ${cut + b} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${cut + b} A ${b} ${b} 0 0 0 0 ${cut - b} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

/** A four-point sparkle centred at x, y. */
const sparkle = (x: number, y: number, s: number) => {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
};

/** The trophy, drawn flat in ink with a gold star. It floats gently (not when the phone asks for reduced motion). */
function Trophy() {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1);
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: '6deg' }] }));
  return (
    <Animated.View pointerEvents="none" accessible={false} style={[{ position: 'absolute', right: 8, top: 0, width: TROPHY_W, height: TROPHY_H }, style]}>
      <Svg width={TROPHY_W} height={TROPHY_H} viewBox="0 0 120 136">
        <Path d="M30 22 H16 C11 22 9 26 9 31 C9 50 21 61 36 63" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        <Path d="M90 22 H104 C109 22 111 26 111 31 C111 50 99 61 84 63" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        <Path d="M28 12 H92 V46 C92 70 78 86 60 86 C42 86 28 70 28 46 Z" fill={INK} />
        <Path d="M38 22 V46 C38 58 43 67 50 72" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={5} strokeLinecap="round" />
        <Rect x={54} y={84} width={12} height={20} fill={INK} />
        <Rect x={38} y={102} width={44} height={11} rx={3} fill={INK} />
        <Rect x={28} y={112} width={64} height={16} rx={5} fill={INK} />
        <Path d="M60 28 L64.7 39.5 L77 40.4 L67.6 48.4 L70.6 60.4 L60 53.9 L49.4 60.4 L52.4 48.4 L43 40.4 L55.3 39.5 Z" fill={GOLD} />
      </Svg>
    </Animated.View>
  );
}

/** Start to minus 10 kg: a track with a mark per kilogram, filled up to what has come off so far. */
function LossTrack({ share }: { share: number }) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const shown = useSharedValue(reduce ? share : 0);
  useEffect(() => {
    shown.value = reduce ? share : withDelay(250, withTiming(share, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [share, reduce, shown]);
  const fill = useAnimatedStyle(() => ({ width: shown.value * width }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: shown.value * width - 12 }] }));
  return (
    <View style={{ height: 24, marginTop: 8, marginRight: 26 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible={false}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
      <Animated.View style={[{ position: 'absolute', left: 0, top: 8, height: 8, borderRadius: 4, backgroundColor: GOLD }, fill]} />
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: `${(i + 1) * 10}%`, top: 9, width: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      ))}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: GOLD, borderWidth: 3, borderColor: STUB }, knob]} />
      {/* The prize waits at the end of the track. */}
      <View style={{ position: 'absolute', right: -26, top: 2 }}>
        <SymbolView name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }} tintColor={share >= 1 ? GOLD : 'rgba(255,214,107,0.55)'} size={19} />
      </View>
    </View>
  );
}

/**
 * The challenge as a prize ticket: the gold half is the offer, with the trophy standing out of the top edge;
 * the dark stub under the tear line is the member's own way there, from the start weight in their profile.
 */
export function OfferCard() {
  const router = useRouter();
  const { profile } = useProfile();
  const o = WEIGHT_LOSS_OFFER;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [cut, setCut] = useState(0);

  // What has come off since the start weight in the profile. A gain counts as nothing lost.
  const lost = profile ? Math.max(0, profile.startWeightKg - profile.weightKg) : null;
  const share = lost == null ? 0 : Math.min(1, lost / o.goalKg);
  const reached = lost != null && lost >= o.goalKg;
  const path = size && cut ? ticketPath(size.w, size.h, cut) : null;

  return (
    <View className="mx-5 mb-6" style={{ paddingTop: POP }}>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={path ? null : { backgroundColor: STUB, borderRadius: RADIUS, overflow: 'hidden' }}>
        {size && path ? (
          <Svg width={size.w} height={size.h} style={{ position: 'absolute' }} pointerEvents="none">
            <Defs>
              <ClipPath id="offerTop">
                <Path d={path} />
              </ClipPath>
              <ClipPath id="offerGold">
                <Rect x={0} y={0} width={size.w} height={cut} />
              </ClipPath>
              <LinearGradient id="offerShine" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffdc7a" />
                <Stop offset="1" stopColor="#f0b02c" />
              </LinearGradient>
            </Defs>
            <Path d={path} fill={STUB} />
            <G clipPath="url(#offerTop)">
              <G clipPath="url(#offerGold)">
                <Rect x={0} y={0} width={size.w} height={cut} fill="url(#offerShine)" />
                {[40, 80, 120, 160].map((r, i) => (
                  <Circle key={r} cx={size.w - 80} cy={cut * 0.5} r={r} fill="none" stroke={i % 2 === 0 ? 'rgba(5,10,7,0.07)' : 'rgba(255,255,255,0.22)'} strokeWidth={26} />
                ))}
                <Path d={sparkle(size.w - 158, 44, 7)} fill={INK} />
                <Path d={sparkle(size.w - 22, 112, 5)} fill="#ffffff" />
                <Path d={sparkle(size.w - 146, cut - 46, 4)} fill="#ffffff" />
              </G>
            </G>
            <Path d={path} fill="none" stroke="rgba(245,196,81,0.55)" strokeWidth={1.5} />
            {/* the tear line */}
            <Line x1={BITE + 8} y1={cut} x2={size.w - BITE - 8} y2={cut} stroke="rgba(5,10,7,0.55)" strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round" />
          </Svg>
        ) : null}

        {/* The offer */}
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${o.tag}. ${o.lead} ${o.prize}. ${o.line}`}
          onLayout={(e) => setCut(Math.round(e.nativeEvent.layout.height))}
          style={{ padding: 22, paddingBottom: 24, backgroundColor: path ? 'transparent' : GOLD }}>
          <View style={{ width: '60%' }}>
            <View className="self-start rounded-full" style={{ paddingHorizontal: 11, paddingVertical: 5, backgroundColor: INK }}>
              <Text {...COMPACT_TEXT} className="font-black uppercase" style={{ color: GOLD, fontSize: 10.5, letterSpacing: 1.5 }}>
                {o.tag}
              </Text>
            </View>
            <Text {...COMPACT_TEXT} className="font-extrabold uppercase" style={{ color: 'rgba(5,10,7,0.72)', fontSize: 13, letterSpacing: 1.4, marginTop: 14 }}>
              {o.lead}
            </Text>
          </View>
          <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: 52, lineHeight: 58, letterSpacing: -1.5, width: '62%' }}>
            {o.prize}
          </DisplayText>
          <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: 'rgba(5,10,7,0.78)', fontSize: 13.5, lineHeight: 19, marginTop: 4, width: '62%' }}>
            {o.line}
          </Text>
        </View>

        {/* The member's own way there */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 }}>
          {lost == null ? (
            <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
              Your progress will show here once your profile is complete.
            </Text>
          ) : (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={reached ? `You have lost ${fmtKg(lost)}. Goal reached.` : `You have lost ${fmtKg(lost)} of ${o.goalKg} kilograms`}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
              <View className="flex-row items-baseline justify-between">
                <Text {...COMPACT_TEXT}>
                  <DisplayText {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 26, lineHeight: 32 }}>
                    {fmtKg(lost)}
                  </DisplayText>
                  <Text className="font-bold text-white" style={{ fontSize: 14 }}>
                    {'  '}down
                  </Text>
                </Text>
                <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: reached ? GOLD : MUTED, fontSize: 13 }}>
                  {reached ? 'Goal reached' : `${fmtKg(o.goalKg - lost)} to go`}
                </Text>
              </View>
              <LossTrack share={share} />
              <View className="flex-row justify-between" style={{ marginTop: 3 }}>
                <Text {...COMPACT_TEXT} className="font-bold" style={{ color: MUTED, fontSize: 11 }}>
                  START
                </Text>
                <Text {...COMPACT_TEXT} className="font-bold" style={{ color: MUTED, fontSize: 11 }}>
                  −{o.goalKg} KG
                </Text>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => router.navigate('/diet')}
            accessibilityRole="button"
            accessibilityLabel={reached ? 'Tell your dietitian you reached the goal' : o.action}
            className="flex-row items-center justify-center rounded-full active:opacity-80"
            style={{ gap: 8, minHeight: 50, marginTop: 16, backgroundColor: GOLD }}>
            <Text {...COMPACT_TEXT} className="font-black" style={{ color: INK, fontSize: 15.5 }}>
              {reached ? 'Tell your dietitian' : o.action}
            </Text>
            <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={15} />
          </Pressable>
          {lost == null ? null : (
            <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 10 }}>
              Counted from the start weight in your profile.
            </Text>
          )}
        </View>
      </View>

      <Trophy />
    </View>
  );
}
