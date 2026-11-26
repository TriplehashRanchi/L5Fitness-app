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
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { getChallenge, startChallenge, type ChallengeState, type Habit } from '@/lib/challenge-api';
import { messageFrom } from '@/lib/http';
import { splitHighlight, type Key } from '@/lib/i18n';
import { useAuth } from '@/providers/auth-provider';
import { useLanguage, useT } from '@/providers/language-provider';
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
 * The 90-day habit challenge at the end of Home: it rewards showing up, never losing weight, and there is no
 * money in it. The server keeps who started when and counts the habit days (GET /challenge); the rules are
 * set there, and these are the words that go with them.
 */
const CHALLENGE = {
  days: 90,
  goalDays: 75,
} as const;

/** The four daily habits, in the order shown under the certificate. */
const HABITS: { id: Habit; label: Key }[] = [
  { id: 'meal', label: 'hm.habitMeal' },
  { id: 'water', label: 'hm.water' },
  { id: 'move', label: 'hm.habitMove' },
  { id: 'checkin', label: 'hm.habitCheckin' },
];

const dayToMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "18 Feb 2027" for a day key. Other languages' month names are too long for the certificate: "18/02/2027". */
function shortDate(key: string, locale: string) {
  try {
    const month = locale.startsWith('en') ? 'short' : '2-digit';
    return new Date(dayToMs(key) + DAY_MS / 2).toLocaleDateString(locale, { day: month === 'short' ? 'numeric' : '2-digit', month, year: 'numeric', timeZone: 'UTC' });
  } catch {
    return key;
  }
}

/** The rubber stamp across the cheque. It lands with a thump the first time it is shown. */
function Stamp({ label, color, k }: { label: string; color: string; k: number }) {
  // Indian scripts: no letter spacing (it pulls joined letters apart), a little smaller, with room for vowel signs.
  const indic = useLanguage().language !== 'en';
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
      style={[{ position: 'absolute', left: '33%', top: '61%', ...(indic ? { maxWidth: '64%' } : null), borderWidth: 3 * k, borderColor: color, borderRadius: 8 * k, paddingHorizontal: 12 * k, paddingVertical: 2 * k, backgroundColor: 'rgba(255,248,220,0.35)' }, style]}>
      <Text maxFontSizeMultiplier={1} numberOfLines={indic ? 1 : undefined} adjustsFontSizeToFit={indic} style={{ color, fontSize: (indic ? 16 : 19) * k, fontWeight: '900', letterSpacing: indic ? 0 : 2 * k, ...(indic ? { lineHeight: 25 * k } : null) }}>
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * The certificate, drawn like a cheque and made out to the member. Everything on it is drawn to its width, so
 * it looks the same on a small and a large phone. It sits a little crooked, and still.
 */
function Cheque({ payee, date, stamp, stampColor }: { payee: string; date: string | null; stamp: string; stampColor: string }) {
  const [w, setW] = useState(0);
  const { t, language } = useLanguage();
  // In the other languages the printed words lose their letter spacing, get a set line height, and each line is
  // held to its own part of the paper, shrinking if it has to.
  const indic = language !== 'en';

  const k = w / 330; // every size below was drawn for a 330-wide cheque
  const h = Math.round(w * 0.535);
  const label = { color: PRINT, fontSize: (indic ? 8.5 : 8) * k, fontWeight: '800', letterSpacing: indic ? 0 : 1.2 * k, ...(indic ? { lineHeight: 12.5 * k } : null) } as const;
  // The slant of the "pen" needs a little room at the end of a line in Indian scripts.
  const written = { color: PEN, fontStyle: 'italic', fontWeight: '700', ...(indic ? { paddingRight: 3 * k } : null) } as const;
  const fit = indic ? ({ numberOfLines: 1, adjustsFontSizeToFit: true } as const) : null;

  return (
    <View style={{ marginTop: 28, marginBottom: 30, marginHorizontal: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('hm.certA11y', { name: payee, goal: CHALLENGE.goalDays, days: CHALLENGE.days, stamp })}
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
              <View style={{ position: 'absolute', left: 18 * k, top: 15 * k, ...(indic ? { right: 108 * k } : null) }}>
                <Text maxFontSizeMultiplier={1} style={{ color: INK, fontSize: 13 * k, fontWeight: '900', letterSpacing: 1.2 * k }}>
                  L5 FITNESS
                </Text>
                <Text maxFontSizeMultiplier={1} {...fit} style={[label, { letterSpacing: indic ? 0 : 1.4 * k, marginTop: 1 }]}>
                  {t('hm.certKind')}
                </Text>
              </View>
              <View style={{ position: 'absolute', right: 18 * k, top: 16 * k, alignItems: 'flex-end', ...(indic ? { width: 86 * k } : null) }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  {t('hm.certDate')}
                </Text>
                <Text maxFontSizeMultiplier={1} {...fit} style={[written, { fontSize: 12 * k, marginTop: 1 }]}>
                  {date ?? '—  —  —'}
                </Text>
              </View>

              {/* pay … */}
              <View style={{ position: 'absolute', left: 18 * k, right: 122 * k, top: 58 * k }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  {t('hm.certAwarded')}
                </Text>
                <View style={{ borderBottomWidth: 1, borderBottomColor: RULE, paddingLeft: 4 * k, paddingBottom: 2 * k }}>
                  <Text maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit style={[written, { fontSize: 19 * k, fontWeight: '800' }]}>
                    {payee}
                  </Text>
                </View>
              </View>
              <View style={{ position: 'absolute', right: 18 * k, top: 56 * k, width: 96 * k, height: 36 * k, borderWidth: 1.5, borderColor: INK, borderRadius: 6 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.4)' }}>
                <DisplayText maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: (indic ? 15 : 19) * k, paddingHorizontal: 4 * k }}>
                  {t('hm.certDays', { n: CHALLENGE.goalDays })}
                </DisplayText>
              </View>
              <View style={{ position: 'absolute', left: 18 * k, right: 18 * k, top: 101 * k, borderBottomWidth: 1, borderBottomColor: RULE, paddingLeft: 4 * k, paddingBottom: 2 * k }}>
                <Text maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit={indic} style={[written, { fontSize: (indic ? 11.5 : 12.5) * k }, indic ? { lineHeight: 17 * k } : null]}>
                  {t('hm.certGoal')}
                </Text>
              </View>

              {/* for … and the signature */}
              <View style={{ position: 'absolute', left: 18 * k, bottom: (indic ? 13 : 15) * k, ...(indic ? { right: 114 * k } : null) }}>
                <Text maxFontSizeMultiplier={1} style={label}>
                  {t('hm.certFor')}
                </Text>
                <Text maxFontSizeMultiplier={1} {...fit} style={[written, { fontSize: (indic ? 10.5 : 11.5) * k }, indic ? { lineHeight: 16 * k } : null]}>
                  {t('hm.certShowingUp')}
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
  const { t, language } = useLanguage();
  const indic = language !== 'en';
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
      accessibilityLabel={t('hm.startDays', { days: CHALLENGE.days })}
      accessibilityHint={t('hm.slideHint')}
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
        <Text maxFontSizeMultiplier={1.15} numberOfLines={indic ? 2 : 1} adjustsFontSizeToFit={indic} className={`font-extrabold text-white ${indic ? 'text-center' : ''}`} style={{ fontSize: indic ? 13.5 : 16 }}>
          {t('hm.slideToStart', { days: CHALLENGE.days })}
        </Text>
      </Animated.View>
      <Animated.View pointerEvents="none" className="items-center justify-center" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, count]}>
        <DisplayText maxFontSizeMultiplier={1.15} style={{ color: INK, fontSize: 22, lineHeight: 28 }}>
          {t('hm.dayN', { n: day || 1 })}
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
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${t('hm.chName')}. ${status}`}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: GOLD, transform: [{ rotate: '-8deg' }] }}>
          <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} tintColor={INK} size={24} />
        </View>
        <DisplayText {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 56, lineHeight: 58, letterSpacing: -2 }}>
          {CHALLENGE.days}
        </DisplayText>
        <View className="flex-1">
          <DisplayText {...COMPACT_TEXT} numberOfLines={indic ? 1 : undefined} adjustsFontSizeToFit={indic} style={{ color: '#ffffff', fontSize: 19, lineHeight: 21, letterSpacing: indic ? 0 : 1 }}>
            {t('hm.chDay')}
          </DisplayText>
          <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit style={{ color: '#ffffff', fontSize: 19, lineHeight: 21, letterSpacing: indic ? 0 : 1 }}>
            {t('hm.chChallenge')}
          </DisplayText>
        </View>
        <View className="rounded-full" style={{ flexShrink: 0, ...(indic ? { maxWidth: '40%' } : null), paddingHorizontal: 12, paddingVertical: 6, backgroundColor: hot ? GOLD : 'transparent', borderWidth: 1.5, borderColor: GOLD }}>
          <Text {...COMPACT_TEXT} numberOfLines={indic ? 2 : 1} className={`font-black uppercase ${indic ? 'text-center' : ''}`} style={{ color: hot ? INK : GOLD, fontSize: indic ? 11 : 11.5, letterSpacing: indic ? 0 : 0.8 }}>
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
function ChatButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('hm.openChatHint')}
      className="flex-row items-center rounded-full active:opacity-80"
      style={{ minHeight: 56, marginTop: 16, paddingLeft: 6, paddingRight: 18, gap: 12, backgroundColor: BRAND }}>
      <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK }}>
        <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} tintColor={BRAND} size={20} />
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={indic ? 2 : 1} className="flex-1 font-black" style={{ color: INK, fontSize: indic ? 14.5 : 16 }}>
        {label}
      </Text>
      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={16} />
    </Pressable>
  );
}

/** The four habits with a tick on the ones done today. */
function TodayHabits({ done, needed }: { done: Habit[]; needed: number }) {
  const t = useT();
  const counted = done.length >= needed;
  const list = HABITS.map((h) => t(done.includes(h.id) ? 'hm.habitDone' : 'hm.habitNotDone', { habit: t(h.label) })).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={t('hm.habitsA11y', { done: done.length, total: HABITS.length, list })}
      style={{ marginTop: 14 }}>
      <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: counted ? BRAND : MUTED, fontSize: 13 }}>
        {counted ? t('hm.todayCounts') : t('hm.todayNeeded', { done: done.length, needed })}
      </Text>
      <View className="flex-row" style={{ gap: 6, marginTop: 8 }}>
        {HABITS.map((h) => {
          const on = done.includes(h.id);
          return (
            <View key={h.id} className="flex-1 items-center rounded-2xl" style={{ paddingVertical: 8, gap: 4, borderWidth: 1.5, borderColor: on ? BRAND : 'rgba(255,255,255,0.14)' }}>
              <SymbolView
                name={on ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                tintColor={on ? BRAND : MUTED}
                size={18}
              />
              <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="font-bold" style={{ color: on ? '#ffffff' : MUTED, fontSize: 11.5 }}>
                {t(h.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The 90-day challenge, told with one object: a certificate already made out to the member. A stamp says
 * where they stand (LOCKED, then DAY 12 / 90, then EARNED), and under it are their habit days so far.
 * `refreshKey` changes when something is logged on Home, so today's ticks keep up.
 */
export function OfferCard({ refreshKey }: { refreshKey?: string }) {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
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

  // Each time Home comes back into view (a meal or check-in added elsewhere), and after logging on Home.
  useFocusEffect(
    useCallback(() => {
      load();
      // refreshKey is not used inside: a change in it is the signal to ask again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, refreshKey])
  );

  // `rules.goalDays` is missing while an older server is still answering: show nothing rather than half a card.
  if (!user || !state?.rules.goalDays) return null;

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

  const { rules, totals, entry, paused } = state;
  const reached = !!entry?.reached;
  const over = !!entry?.over && !reached;
  const left = entry?.daysLeft ?? rules.days;
  const active = entry?.activeDays ?? 0;
  const share = Math.min(1, active / rules.goalDays);
  const daysLeft = t(left === 1 ? 'hm.dayLeft' : 'hm.daysLeft', { n: left });
  const leftWords = left === 0 ? t('hm.leftLastDay') : daysLeft;

  const stamp = !entry ? t('hm.stampLocked') : reached ? t('hm.stampEarned') : over ? t('hm.stampTimeUp') : paused ? t('hm.stampPaused') : t('hm.stampDay', { n: entry.day, total: rules.days });
  const status = !entry ? t('hm.stHabits') : reached ? t('hm.stCompleted') : over ? t('hm.stTimeUp') : paused ? t('hm.stPaused') : left === 0 ? t('hm.stLastDay') : daysLeft;
  const others = totals.joined === 0 ? t('hm.beFirst') : t(totals.joined === 1 ? 'hm.joinedOne' : 'hm.joinedMany', { n: totals.joined });

  return (
    <View className="mx-5 mb-6" style={{ paddingTop: 8 }}>
      <ChallengeTitle status={status} hot={!!entry && !over && !paused} />
      <DisplayText {...COMPACT_TEXT} accessibilityRole="header" style={{ color: '#ffffff', fontSize: indic ? 25 : 31, lineHeight: 37, letterSpacing: indic ? 0 : -0.8, marginTop: 18 }}>
        {reached ? t('hm.headEarned') : t('hm.headYours')}
      </DisplayText>
      <Text {...COMPACT_TEXT} style={{ color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
        {splitHighlight(t('hm.chRules', { n: rules.habitsNeeded, goal: rules.goalDays, days: rules.days, litres: rules.waterMl / 1000, steps: rules.steps.toLocaleString(format.locale) })).map((p, i) =>
          p.highlight ? (
            <Text key={i} className="font-bold text-white">
              {p.text}
            </Text>
          ) : (
            p.text
          )
        )}
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
              {t(active === 1 ? 'hm.endedOne' : 'hm.endedMany', { days: rules.days, n: active })}
            </Text>
          ) : null}
          {paused ? (
            <Text {...COMPACT_TEXT} className="text-center font-semibold" style={{ color: MUTED, fontSize: 13 }}>
              {t('hm.pausedStart')}
            </Text>
          ) : profile ? (
            // Sliding the whole way is the "are you sure": no second question (a new try after time ran out asks once).
            <SlideToStart key={`${entry?.id ?? 'first'}-${attempt}`} onComplete={over ? () => setAsking(true) : begin} />
          ) : (
            <Pressable onPress={() => router.push('/complete-profile' as never)} accessibilityRole="button" className="items-center justify-center rounded-full active:opacity-80" style={{ minHeight: 56, backgroundColor: BRAND, ...(indic ? { paddingHorizontal: 18, paddingVertical: 8 } : null) }}>
              <Text {...COMPACT_TEXT} className={`font-black ${indic ? 'text-center' : ''}`} style={{ color: INK, fontSize: indic ? 14.5 : 16 }}>
                {t('hm.completeToStart')}
              </Text>
            </Pressable>
          )}
          <Text {...COMPACT_TEXT} className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 10 }}>
            {others}
          </Text>
        </>
      ) : (
        <>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('hm.progressA11y', { done: active, goal: rules.goalDays, state: reached ? t('hm.stCompleted') : leftWords })}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
            <View className={`flex-row items-baseline justify-between ${indic ? 'flex-wrap gap-x-3' : ''}`}>
              <Text {...COMPACT_TEXT}>
                {splitHighlight(t(active === 1 ? 'hm.habitDaysOne' : 'hm.habitDaysMany', { n: active })).map((p, i) =>
                  p.highlight ? (
                    <DisplayText key={i} {...COMPACT_TEXT} style={{ color: GOLD, fontSize: 24, lineHeight: 30 }}>
                      {p.text}
                    </DisplayText>
                  ) : (
                    <Text key={i} className="font-bold text-white" style={{ fontSize: 14 }}>
                      {p.text}
                    </Text>
                  )
                )}
              </Text>
              <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: reached ? GOLD : MUTED, fontSize: 13 }}>
                {reached ? t('hm.stCompleted') : t('hm.toGo', { n: rules.goalDays - active, left: leftWords })}
              </Text>
            </View>
            <View className="overflow-hidden" style={{ height: 8, borderRadius: 4, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ height: 8, borderRadius: 4, width: `${share * 100}%`, backgroundColor: GOLD }} />
            </View>
          </View>

          {paused ? (
            <Text {...COMPACT_TEXT} className="font-semibold" style={{ color: MUTED, fontSize: 13, marginTop: 14 }}>
              {t('hm.pausedRest')}
            </Text>
          ) : !reached ? (
            <TodayHabits done={entry.todayHabits} needed={rules.habitsNeeded} />
          ) : null}

          <ChatButton label={reached ? t('hm.planNext') : t('hm.messageDietitian')} onPress={toChat} />
        </>
      )}

      <ConfirmSheet
        visible={asking}
        title={t('hm.startNewTitle', { days: rules.days })}
        message={t('hm.startNewBody')}
        confirmLabel={t('home.start')}
        onConfirm={begin}
        onCancel={() => {
          setAsking(false);
          setAttempt((n) => n + 1);
        }}
      />
    </View>
  );
}
