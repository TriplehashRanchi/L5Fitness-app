import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { fmtKg } from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { getChallenge, startChallenge, type ChallengeState, type ClaimStatus } from '@/lib/challenge-api';
import { messageFrom } from '@/lib/http';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';

const GOLD = '#ffd66b';
const INK = '#050a07';
const MUTED = '#8fa396';
/** Fountain-pen blue, for everything "written" on the cheque. */
const PEN = '#1b2a6b';
const PRINT = 'rgba(5,10,7,0.55)';
const RULE = 'rgba(5,10,7,0.35)';
const STAMP_RED = '#c8372d';
const STAMP_GREEN = '#1f8a45';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DAY_MS = 86_400_000;

/**
 * The challenge at the end of Home. Change the numbers and words here.
 * The server keeps who started when and judges who reached the goal (GET /challenge); these are only the
 * words shown before that answer arrives.
 */
export const CHALLENGE = {
  days: 90,
  goalKg: 10,
  prize: '₹50,000',
  prizeInWords: 'Rupees fifty thousand only',
  name: '90-day challenge',
} as const;

const dayToMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "18 Feb 2027" for a day key, in the member's language. */
function shortDate(key: string, locale: string) {
  try {
    return new Date(dayToMs(key) + DAY_MS / 2).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return key;
  }
}

/** The rubber stamp across the cheque. It lands with a thump the first time it is shown. */
export const STAMP_COLORS = { red: STAMP_RED, green: STAMP_GREEN } as const;

function Stamp({ label, color, k }: { label: string; color: string; k: number }) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(reduce ? 1 : 1.9);
  const opacity = useSharedValue(reduce ? 0.9 : 0);
  useEffect(() => {
    if (reduce) return;
    scale.value = 1.9;
    opacity.value = 0;
    scale.value = withDelay(450, withTiming(1, { duration: 220, easing: Easing.in(Easing.cubic) }));
    opacity.value = withDelay(450, withTiming(0.9, { duration: 160 }));
    // a new stamp (LOCKED → DAY 1) lands again
  }, [label, reduce, scale, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ rotate: '-13deg' }, { scale: scale.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: '33%', top: '61%', borderWidth: 3 * k, borderColor: color, borderRadius: 8 * k, paddingHorizontal: 12 * k, paddingVertical: 2 * k, backgroundColor: 'rgba(255,248,220,0.35)' }, style]}>
      <Text maxFontSizeMultiplier={1} style={{ color, fontSize: 19 * k, fontWeight: '900', letterSpacing: 2 * k }}>
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * The prize cheque, made out to the member. Everything on it is drawn to the cheque's width, so it looks
 * the same on a small and a large phone. It sits a little crooked, and still.
 */
export function Cheque({ payee, date, stamp, stampColor }: { payee: string; date: string | null; stamp: string; stampColor: string }) {
  const [w, setW] = useState(0);

  const k = w / 330; // every size below was drawn for a 330-wide cheque
  const h = Math.round(w * 0.535);
  const label = { color: PRINT, fontSize: 8 * k, fontWeight: '800', letterSpacing: 1.2 * k } as const;
  const written = { color: PEN, fontStyle: 'italic', fontWeight: '700' } as const;

  return (
    <View style={{ marginTop: 28, marginBottom: 30, marginHorizontal: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`A prize cheque from L5 Fitness. Pay ${payee}, ${CHALLENGE.prize}, for losing ${CHALLENGE.goalKg} kg in ${CHALLENGE.days} days. Stamped: ${stamp}.`}
          style={{ width: w, height: h, transform: [{ rotate: '-3deg' }] }}>
          {/* a soft gold glow under the paper */}
          <View style={{ position: 'absolute', left: -10, right: -10, top: -10, bottom: -10, borderRadius: 28, backgroundColor: 'rgba(255,214,107,0.10)' }} />
          <View style={{ flex: 1, borderRadius: 14 * k, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 12, backgroundColor: '#f6e7b0' }}>
            <View style={{ flex: 1, borderRadius: 14 * k, overflow: 'hidden' }}>
              <LinearGradient colors={['#fff8dc', '#f1dc9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              {/* the fine rings printed on the paper */}
              <Svg width={w} height={h} style={{ position: 'absolute' }}>
                {[30, 60, 90, 120, 150, 180].map((r, i) => (
                  <Circle key={r} cx={w * 0.91} cy={h * 0.85} r={r * k} fill="none" stroke={`rgba(122,84,20,${i % 2 === 0 ? 0.1 : 0.05})`} strokeWidth={14 * k} />
                ))}
              </Svg>
              <View style={{ position: 'absolute', left: 7 * k, right: 7 * k, top: 7 * k, bottom: 7 * k, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(122,84,20,0.35)', borderRadius: 9 * k }} />

              {/* who issues it, and the date it must be earned by */}
              <View style={{ position: 'absolute', left: 18 * k, top: 15 * k }}>
                <Text maxFontSizeMultiplier={1} style={{ color: INK, fontSize: 13 * k, fontWeight: '900', letterSpacing: 1.2 * k }}>
                  L5 FITNESS
                </Text>
                <Text maxFontSizeMultiplier={1} style={[label, { letterSpacing: 1.4 * k, marginTop: 1 }]}>
                  90-DAY CHALLENGE CHEQUE
                </Text>
              </View>
              <View style={{ position: 'absolute', right: 18 * k, top: 16 * k, alignItems: 'flex-end' }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  DATE
                </Text>
                <Text maxFontSizeMultiplier={1} style={[written, { fontSize: 12 * k, marginTop: 1 }]}>
                  {date ?? '—  —  —'}
                </Text>
              </View>

              {/* pay … */}
              <View style={{ position: 'absolute', left: 18 * k, right: 122 * k, top: 58 * k }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  PAY
                </Text>
                <View style={{ borderBottomWidth: 1, borderBottomColor: RULE, paddingLeft: 4 * k, paddingBottom: 2 * k }}>
                  <Text maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit style={[written, { fontSize: 19 * k, fontWeight: '800' }]}>
                    {payee}
                  </Text>
                </View>
              </View>
              <View style={{ position: 'absolute', right: 18 * k, top: 56 * k, width: 96 * k, height: 36 * k, borderWidth: 1.5, borderColor: INK, borderRadius: 6 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.4)' }}>
                <DisplayText maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: 19 * k, paddingHorizontal: 4 * k }}>
                  {CHALLENGE.prize}
                </DisplayText>
              </View>
              <View style={{ position: 'absolute', left: 18 * k, right: 18 * k, top: 101 * k, borderBottomWidth: 1, borderBottomColor: RULE, paddingLeft: 4 * k, paddingBottom: 2 * k }}>
                <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[written, { fontSize: 12.5 * k }]}>
                  {CHALLENGE.prizeInWords}
                </Text>
              </View>

              {/* for … and the signature */}
              <View style={{ position: 'absolute', left: 18 * k, bottom: 15 * k }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  FOR
                </Text>
                <Text maxFontSizeMultiplier={1} style={[written, { fontSize: 11.5 * k }]}>
                  Losing {CHALLENGE.goalKg} kg in {CHALLENGE.days} days
                </Text>
              </View>
              <View style={{ position: 'absolute', right: 20 * k, bottom: 12 * k, width: 88 * k, alignItems: 'center' }}>
                <Svg width={88 * k} height={30 * k} viewBox="0 0 90 34">
                  <Path d="M4 24 C12 4 18 4 20 18 C22 30 28 6 34 14 C38 20 40 24 46 16 C52 8 54 26 62 18 C68 12 74 22 86 14" fill="none" stroke={PEN} strokeWidth={2} strokeLinecap="round" />
                </Svg>
                <View style={{ alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: RULE, alignItems: 'center', paddingTop: 2 * k }}>
                  <Text maxFontSizeMultiplier={1} style={[label, { fontSize: 7.5 * k, letterSpacing: 1 * k }]}>
                    L5 FITNESS
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <Stamp label={stamp} color={stampColor} k={k} />
        </View>
      ) : (
        <View style={{ height: 180 }} />
      )}
    </View>
  );
}

const BRAND = '#3ddc68';
const SLIDE_H = 64;
const SLIDE_PAD = 6;
const KNOB = SLIDE_H - SLIDE_PAD * 2;

/**
 * Starts the challenge by dragging the runner from one end of the track to the other. While it is dragged
 * the label counts the days going by, 1 to 90, so the member feels the whole distance under their thumb.
 * Letting go before the end sends the runner back; nothing starts by accident.
 */
function SlideToStart({ onComplete }: { onComplete: () => void }) {
  const x = useSharedValue(0);
  const maxX = useSharedValue(1);
  const press = useSharedValue(0);
  const done = useSharedValue(false);
  /** The day shown while dragging; 0 = not being dragged. */
  const [day, setDay] = useState(0);

  const finish = () => {
    if (done.get()) return;
    done.set(true);
    onComplete();
  };

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The page behind scrolls up and down: once the runner is held, the drag is ours.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        press.set(withTiming(1, { duration: 120 }));
        setDay(1);
      },
      onPanResponderMove: (_, g) => {
        const at = Math.min(Math.max(g.dx, 0), maxX.get());
        x.set(at);
        setDay(Math.max(1, Math.round((at / maxX.get()) * CHALLENGE.days)));
      },
      onPanResponderRelease: (_, g) => {
        press.set(withTiming(0, { duration: 160 }));
        if (g.dx >= maxX.get() * 0.85) {
          x.set(withTiming(maxX.get(), { duration: 120 }));
          setDay(CHALLENGE.days);
          finish();
        } else {
          x.set(withSpring(0));
          setDay(0);
        }
      },
      onPanResponderTerminate: () => {
        press.set(withTiming(0, { duration: 160 }));
        x.set(withSpring(0));
        setDay(0);
      },
    })
  );

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scale: 1 + 0.06 * press.value }] }));
  const trail = useAnimatedStyle(() => ({ width: x.value + KNOB + SLIDE_PAD * 2 }));
  const hint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, Math.max(maxX.value * 0.25, 1)], [1, 0], Extrapolation.CLAMP) }));
  const count = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [Math.max(maxX.value * 0.1, 1), Math.max(maxX.value * 0.3, 2)], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Start my ${CHALLENGE.days} days`}
      accessibilityHint="Slide from left to right, or double tap"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={finish}
      onLayout={(e) => {
        maxX.set(Math.max(1, e.nativeEvent.layout.width - KNOB - SLIDE_PAD * 2));
      }}
      className="justify-center overflow-hidden rounded-full"
      style={{ height: SLIDE_H, padding: SLIDE_PAD }}>
      <LinearGradient colors={['#1f9a43', '#0c5a23']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none" />
      {/* the stretch already covered, in bright green */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: SLIDE_H / 2, backgroundColor: BRAND }, trail]} />

      {/* the finish flag at the far end */}
      <View pointerEvents="none" className="flex-row items-center justify-end" style={{ position: 'absolute', left: KNOB + SLIDE_PAD + 10, right: 18, top: 0, bottom: 0 }}>
        <SymbolView name={{ ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' }} tintColor="#ffffff" size={20} />
      </View>

      <Animated.View pointerEvents="none" className="items-center justify-center" style={[{ position: 'absolute', left: KNOB, right: 44, top: 0, bottom: 0 }, hint]}>
        {/* the words sit straight on the green track: nothing behind them */}
        <Text maxFontSizeMultiplier={1.15} numberOfLines={1} className="font-extrabold text-white" style={{ fontSize: 16 }}>
          Slide to start my {CHALLENGE.days} days
        </Text>
      </Animated.View>
      <Animated.View pointerEvents="none" className="items-center justify-center" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, count]}>
        <DisplayText maxFontSizeMultiplier={1.15} style={{ color: INK, fontSize: 22, lineHeight: 28 }}>
          DAY {day || 1}
        </DisplayText>
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        className="items-center justify-center"
        style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 }, knob]}>
        <SymbolView name={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }} tintColor="#0c5a23" size={26} />
      </Animated.View>
    </View>
  );
}

/**
 * The name of the challenge, as an emblem: a flame, a huge "90" and DAY CHALLENGE stacked beside it, over a
 * strip of racing chevrons. At the right, what is at stake or how long is left.
 */
function ChallengeTitle({ status, hot }: { status: string; hot: boolean }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${CHALLENGE.name}. ${status}`}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: GOLD, transform: [{ rotate: '-8deg' }] }}>
          <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} tintColor={INK} size={24} />
        </View>
        <DisplayText {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 56, lineHeight: 58, letterSpacing: -2 }}>
          {CHALLENGE.days}
        </DisplayText>
        <View className="flex-1">
          <DisplayText {...COMPACT_TEXT} style={{ color: '#ffffff', fontSize: 19, lineHeight: 21, letterSpacing: 1 }}>
            DAY
          </DisplayText>
          <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit style={{ color: '#ffffff', fontSize: 19, lineHeight: 21, letterSpacing: 1 }}>
            CHALLENGE
          </DisplayText>
        </View>
        <View className="rounded-full" style={{ flexShrink: 0, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: hot ? GOLD : 'transparent', borderWidth: 1.5, borderColor: GOLD }}>
          <Text {...COMPACT_TEXT} numberOfLines={1} className="font-black uppercase" style={{ color: hot ? INK : GOLD, fontSize: 11.5, letterSpacing: 0.8 }}>
            {status}
          </Text>
        </View>
      </View>
      {/* racing chevrons: the eye is pulled forward, towards the finish */}
      <View accessible={false} className="flex-row items-center overflow-hidden" style={{ gap: 3, marginTop: 12, height: 10 }}>
        {Array.from({ length: 40 }, (_, i) => (
          <View key={i} style={{ width: 7, height: 10, backgroundColor: GOLD, opacity: 0.12 + 0.88 * (i / 39) ** 2, transform: [{ skewX: '-24deg' }] }} />
        ))}
      </View>
    </View>
  );
}

/** Straight to the chat with the dietitian. */
/** The way to the claim form, or to how the claim is doing once it is sent. Same shape as the chat button, in gold. */
function ClaimButton({ status, onPress }: { status: ClaimStatus | null; onPress: () => void }) {
  const label =
    status === 'paid' ? 'Prize paid · See details' : status === 'approved' ? 'Claim approved · See details' : status === 'rejected' ? 'Fix and resend your claim' : status === 'pending' ? 'Claim sent · In review' : 'Claim your prize';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center rounded-full active:opacity-80"
      style={{ minHeight: 56, marginTop: 12, paddingLeft: 6, paddingRight: 18, gap: 12, backgroundColor: GOLD }}>
      <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK }}>
        <SymbolView name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }} tintColor={GOLD} size={20} />
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="flex-1 font-black" style={{ color: INK, fontSize: 16 }}>
        {label}
      </Text>
      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={16} />
    </Pressable>
  );
}

function ChatButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens your chat with your dietitian"
      className="flex-row items-center rounded-full active:opacity-80"
      style={{ minHeight: 56, marginTop: 16, paddingLeft: 6, paddingRight: 18, gap: 12, backgroundColor: BRAND }}>
      <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK }}>
        <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} tintColor={BRAND} size={20} />
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="flex-1 font-black" style={{ color: INK, fontSize: 16 }}>
        {label}
      </Text>
      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={16} />
    </Pressable>
  );
}

/**
 * The 90-day challenge, told with one object: a prize cheque already made out to the member. A stamp says
 * where they stand (LOCKED, then DAY 12 / 90, then EARNED), and under it are the kilograms lost so far.
 * The server keeps the start day and decides who has reached the goal.
 */
export function OfferCard() {
  const router = useRouter();
  const user = useAuth().session?.user ?? null;
  const { profile } = useProfile();
  const { now, format } = useDeviceClock();
  const todayKey = toDayKey(getZonedParts(now, format.timeZone));

  const [state, setState] = useState<ChallengeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Counts tries that did not go through, so the slider comes back to its start for another go. */
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    try {
      setState(await getChallenge(todayKey));
    } catch {
      // The card simply stays as it was (or hidden, the first time): Home has its own way to say the app is offline.
    }
  }, [todayKey]);

  // Each time Home comes back into view: a weight logged in Profile moves the bar at once.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user || !state) return null;

  const begin = async () => {
    setAsking(false);
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      setState(await startChallenge(todayKey));
    } catch (e) {
      setError(messageFrom(e));
      setAttempt((n) => n + 1);
      void load();
    } finally {
      setStarting(false);
    }
  };
  const toChat = () => router.navigate('/diet');

  const { rules, totals, entry, claim } = state;
  const reached = !!entry?.reached;
  const over = !!entry?.over && !reached;
  const left = entry ? rules.days - entry.day : rules.days;
  const lost = entry?.lostKg ?? 0;
  const share = Math.min(1, lost / rules.goalKg);

  const stamp = !entry ? 'LOCKED' : claim?.status === 'paid' ? 'PAID' : reached ? 'EARNED' : over ? 'TIME UP' : `DAY ${entry.day} / ${rules.days}`;
  const status = !entry ? `Win ${rules.prize}` : reached ? 'Goal reached' : over ? 'Time up' : left === 0 ? 'Last day' : `${left} ${left === 1 ? 'day' : 'days'} left`;
  const finishers =
    totals.completed === 0 ? 'Nobody has finished it yet. Be the first.' : `${totals.completed} ${totals.completed === 1 ? 'member has' : 'members have'} completed the challenge so far.`;

  return (
    <View className="mx-5 mb-6" style={{ paddingTop: 8 }}>
      <ChallengeTitle status={status} hot={!!entry && !over} />
      <DisplayText {...COMPACT_TEXT} accessibilityRole="header" style={{ color: '#ffffff', fontSize: 31, lineHeight: 37, letterSpacing: -0.8, marginTop: 18 }}>
        {reached ? 'You earned it.\nGo and claim it.' : 'This cheque has\nyour name on it.'}
      </DisplayText>
      <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
        Lose{' '}
        <Text className="font-bold text-white">
          {rules.goalKg} kg in {rules.days} days
        </Text>{' '}
        and it is yours.
      </Text>

      <Cheque payee={user.name} date={entry ? shortDate(entry.endsOn, format.locale) : null} stamp={stamp} stampColor={reached ? STAMP_GREEN : STAMP_RED} />

      {error ? (
        <Text {...COMPACT_TEXT} accessibilityRole="alert" className="mb-3 text-center text-sm font-semibold" style={{ color: '#ff7a7a' }}>
          {error}
        </Text>
      ) : null}

      {!entry || over ? (
        <>
          {over ? (
            <Text {...COMPACT_TEXT} className="mb-3 text-center font-semibold" style={{ color: MUTED, fontSize: 13 }}>
              Your {rules.days} days ended with {fmtKg(lost)} down. You can go again.
            </Text>
          ) : null}
          {profile ? (
            // Sliding the whole way is the "are you sure": no second question (a new try after time ran out asks once).
            <SlideToStart key={`${entry?.id ?? 'first'}-${attempt}`} onComplete={over ? () => setAsking(true) : begin} />
          ) : (
            <Pressable onPress={() => router.push('/complete-profile' as never)} accessibilityRole="button" className="items-center justify-center rounded-full active:opacity-80" style={{ minHeight: 56, backgroundColor: BRAND }}>
              <Text {...COMPACT_TEXT} className="font-black" style={{ color: INK, fontSize: 16 }}>
                Complete your profile to start
              </Text>
            </Pressable>
          )}
          <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 10 }}>
            {finishers}
          </Text>
        </>
      ) : (
        <>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${fmtKg(lost)} lost of ${rules.goalKg} kilograms. ${reached ? 'Goal reached' : `${left} days left`}`}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
            <View className="flex-row items-baseline justify-between">
              <Text {...COMPACT_TEXT}>
                <DisplayText {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 24, lineHeight: 30 }}>
                  {fmtKg(lost)}
                </DisplayText>
                <Text className="font-bold text-white" style={{ fontSize: 14 }}>
                  {'  '}down
                </Text>
              </Text>
              <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: reached ? GOLD : MUTED, fontSize: 13 }}>
                {reached ? 'Goal reached' : `${fmtKg(Math.max(0, rules.goalKg - lost))} to go · ${left === 0 ? 'last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}`}
              </Text>
            </View>
            <View className="overflow-hidden" style={{ height: 8, borderRadius: 4, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ height: 8, borderRadius: 4, width: `${share * 100}%`, backgroundColor: GOLD }} />
            </View>
          </View>

          <ChatButton label="Message your dietitian" onPress={toChat} />
          {reached ? <ClaimButton status={claim?.status ?? null} onPress={() => router.push('/claim-prize' as never)} /> : null}

          {reached ? (
            <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 12 }}>
              {finishers}
            </Text>
          ) : (
            <Pressable
              onPress={() => router.navigate({ pathname: '/profile', params: { log: 'weight' } } as never)}
              accessibilityRole="link"
              accessibilityLabel="Log your weight in Profile to move the bar"
              accessibilityHint="Opens Profile with the weight box ready"
              hitSlop={6}
              className="items-center justify-center active:opacity-60"
              style={{ minHeight: 44, marginTop: 2 }}>
              <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
                <Text style={{ color: BRAND, fontWeight: '700', textDecorationLine: 'underline' }}>Log your weight in Profile</Text> to move the bar.
              </Text>
            </Pressable>
          )}
        </>
      )}

      <ConfirmSheet
        visible={asking}
        title={`Start a new ${rules.days} days?`}
        message={`Today becomes day 1 and your weight now${profile ? ` (${fmtKg(profile.weightKg)})` : ''} is your new starting point.`}
        confirmLabel="Start"
        onConfirm={begin}
        onCancel={() => {
          setAsking(false);
          setAttempt((n) => n + 1);
        }}
      />
    </View>
  );
}
