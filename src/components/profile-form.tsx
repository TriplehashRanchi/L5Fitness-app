import { Exo2_900Black, useFonts } from '@expo-google-fonts/exo-2';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TurboModuleRegistry,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardTypeOptions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputInstance,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { GREEN_BG, GreenBackground, greenBackgroundAt } from '@/components/green-background';
import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  ACTIVITY_KEY,
  ageOn,
  DIET_KEY,
  fmtKg,
  parseDecimal,
  SEX_KEY,
  toBirthDate,
  type Activity,
  type DietType,
  type Goal,
  type Sex,
} from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { splitHighlight, type Key } from '@/lib/i18n';
import { emergencyLine } from '@/lib/emergency';
import type { BodyProfile, Fasting, PregnancyStatus } from '@/lib/wellness-api';
import { DisplayText } from '@/components/display-text';
import { LanguagePicker } from '@/components/language-picker';
import { Rich } from '@/components/rich';
import { useLanguage, useT } from '@/providers/language-provider';
import { useProfile } from '@/providers/profile-provider';

// Same green look as login / onboarding.
const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Photos from the onboarding folder. `top` picks which part of the tall photo shows in the wide card.
const GOAL_CARDS: { goal: Goal; image: ImageSource; top: `${number}%` }[] = [
  { goal: 'lose', image: require('@/assets/onboarding/slide-3.jpg'), top: '35%' },
  { goal: 'maintain', image: require('@/assets/onboarding/slide-2.jpg'), top: '60%' },
  { goal: 'gain', image: require('@/assets/onboarding/slide-1.jpg'), top: '18%' },
];

type Form = {
  goal: Goal | null;
  sex: Sex | null;
  day: string;
  month: string;
  year: string;
  height: string;
  weight: string;
  target: string;
  activity: Activity | null;
  diet: DietType | null;
  allergies: string;
  medical: string;
  share: boolean;
  // Health screening: null = not answered (unknown, not "no").
  medication: boolean | null;
  fasting: Fasting | null;
  shiftWork: boolean | null;
  pregnancy: PregnancyStatus | null;
  injury: boolean | null;
  injuryNotes: string;
  restriction: boolean | null;
  restrictionNotes: string;
};

/** The sections of the edit page (and the groups the answers are validated in). */
const STEPS: readonly Key[] = ['prof.form.yourGoal', 'profile.about', 'prof.form.yourWeight', 'prof.form.lifestyle', 'prof.form.healthShort'];

/** Setup asks one thing per screen: "About you" is split into sex, date of birth and height, "Lifestyle" into activity and diet, and the health check comes last. */
const SETUP_STEPS = ['goal', 'sex', 'birth', 'height', 'weight', 'activity', 'diet', 'screening'] as const;

/** `birthWheelYear`: setup only. The date-of-birth wheels start on 1 January of this year, so they always hold a valid date. */
function initialForm(p: BodyProfile | null, birthWheelYear?: number): Form {
  if (!p) {
    return { goal: null, sex: null, day: birthWheelYear ? '1' : '', month: birthWheelYear ? '1' : '', year: birthWheelYear ? String(birthWheelYear) : '', height: birthWheelYear ? '170' : '', weight: birthWheelYear ? '70' : '', target: birthWheelYear ? '70' : '', activity: null, diet: null, allergies: '', medical: '', share: true, fasting: null, shiftWork: null, medication: null, pregnancy: null, injury: null, injuryNotes: '', restriction: null, restrictionNotes: '' };
  }
  const [year, month, day] = p.birthDate.split('-');
  return {
    goal: p.goal,
    sex: p.sex,
    day: String(Number(day)),
    month: String(Number(month)),
    year,
    height: String(p.heightCm),
    weight: String(p.weightKg),
    target: String(p.targetWeightKg),
    activity: p.activityLevel,
    diet: p.dietType,
    allergies: p.allergies ?? '',
    medical: p.medicalNotes ?? '',
    share: p.shareWithDietitian,
    fasting: p.fasting ?? null,
    shiftWork: p.shiftWork ?? null,
    medication: p.takesMedication,
    pregnancy: p.pregnancyStatus,
    injury: p.hasInjury,
    injuryNotes: p.injuryNotes ?? '',
    restriction: p.hasRestriction,
    restrictionNotes: p.restrictionNotes ?? '',
  };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  multiline,
  maxLength,
  flex,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  multiline?: boolean;
  maxLength?: number;
  flex?: boolean;
}) {
  return (
    <View className={flex ? 'flex-1' : ''}>
      <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">
        {label}
      </Text>
      <View className="flex-row items-center rounded-xl border border-white/10 bg-white/5 px-4">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#6f8577"
          selectionColor={BRAND}
          cursorColor={BRAND}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={label}
          style={{ minHeight: multiline ? 84 : 52, textAlignVertical: multiline ? 'top' : 'center', paddingVertical: multiline ? 12 : 0 }}
          className="flex-1 text-base text-white"
        />
        {suffix ? (
          <Text {...COMPACT_TEXT} className="ml-2 text-sm text-muted">
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-5 py-2.5 ${selected ? 'bg-[#1a8f40]' : 'bg-white/5'}`}>
      <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${selected ? 'text-white' : 'text-white/60'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A goal card: a photo where the emoji used to be, then the name and hint. The chosen one gets a green border and tint. */
function GoalCard({
  label,
  hint,
  image,
  top,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  image: ImageSource;
  top: `${number}%`;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-4 rounded-xl border p-[11px] ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
      {/* 76px photo + 10px padding = same 96px card height as the old 56px icon + 20px padding */}
      <Image
        source={image}
        contentFit="cover"
        contentPosition={{ top }}
        style={{ width: 76, height: 76, borderRadius: 8 }}
        accessibilityIgnoresInvertColors
      />
      <View className="flex-1">
        <Text {...COMPACT_TEXT} className="text-lg font-bold text-white">
          {label}
        </Text>
        <Text {...COMPACT_TEXT} className="text-sm text-muted">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

// Setup offers these two. (The server still accepts 'other', and the edit page still lists it.)
const SEX_CHOICES = ['male', 'female'] as const satisfies readonly Sex[];

// The ♂ / ♀ symbols (assets/avatars): white for the chosen circle, gray for the other. Replace the files to change them.
const SEX_ICON: Record<(typeof SEX_CHOICES)[number], { on: ImageSource; off: ImageSource }> = {
  male: { on: require('@/assets/avatars/male-on.svg'), off: require('@/assets/avatars/male-off.svg') },
  female: { on: require('@/assets/avatars/female-on.svg'), off: require('@/assets/avatars/female-off.svg') },
};

/** A big round button: symbol on top, label under it. Chosen = filled with the green gradient, white symbol. */
function SexCircle({ label, icon, selected, onPress }: { label: string; icon: { on: ImageSource; off: ImageSource }; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
      className={`h-[150px] w-[150px] items-center justify-center gap-2 overflow-hidden rounded-full ${selected ? '' : 'bg-white/5'}`}>
      {selected ? (
        <LinearGradient
          colors={['#2fcf5f', '#0d6527']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <Image source={selected ? icon.on : icon.off} contentFit="contain" style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
      <Text {...COMPACT_TEXT} className={`px-2 text-center text-sm font-medium ${selected ? 'text-white' : 'text-white/50'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One big date box: large number, caption underneath. The border turns green while you type in it. */
function DateBox({
  caption,
  value,
  onChangeText,
  placeholder,
  maxLength,
  wide,
  ref,
}: {
  caption: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  maxLength: number;
  wide?: boolean;
  ref?: Ref<TextInputInstance>;
}) {
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  const [focused, setFocused] = useState(false);
  const { language } = useLanguage();
  return (
    <View style={{ flex: wide ? 1.5 : 1 }}>
      <View
        style={{ height: 88, borderColor: focused ? BRAND : 'transparent' }}
        className="justify-center rounded-xl border bg-white/5 px-2">
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.22)"
          selectionColor={BRAND}
          cursorColor={BRAND}
          keyboardType="number-pad"
          maxLength={maxLength}
          selectTextOnFocus
          maxFontSizeMultiplier={1.2}
          accessibilityLabel={caption}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ textAlign: 'center', height: '100%', fontSize: 34, color: '#ffffff' }, fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' }]}
        />
      </View>
      <Text {...COMPACT_TEXT} className={`mt-2 text-center text-xs font-semibold uppercase text-white/45 ${language === 'en' ? 'tracking-[2px]' : ''}`}>
        {caption}
      </Text>
    </View>
  );
}

// ── Date of birth ──
// Android: a big tappable date that opens the system date dialog (perfectly smooth, native). Ages 12 to 100 only.
// Everywhere else, and in any build that does not contain the native picker yet, the screen shows typed Day / Month / Year fields.
type PickerModule = typeof import('@react-native-community/datetimepicker');
let pickerModule: PickerModule | null | undefined;

/**
 * The native date picker, or null when this build of the app does not contain it (or we are not on Android).
 *
 * The package must not even be loaded when its native part is missing: loading it throws while Metro is initializing the
 * module, and Metro reports that as a FATAL error instead of passing it to a try/catch, which would crash the app.
 * So we first ask React Native, with a lookup that returns null instead of throwing, whether the native module exists.
 */
function getPicker(): PickerModule | null {
  if (pickerModule === undefined) {
    const present = Platform.OS === 'android' && TurboModuleRegistry.get('RNCDatePicker') != null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pickerModule = present ? (require('@react-native-community/datetimepicker') as PickerModule) : null;
  }
  return pickerModule;
}

function DateWheel({ day, month, year, onChange }: { day: number; month: number; year: number; onChange: (day: number, month: number, year: number) => void }) {
  const { t, language } = useLanguage();
  const { format } = useDeviceClock();
  const picker = getPicker();
  if (!picker) return null;
  const { DateTimePickerAndroid } = picker;
  const now = new Date();
  const oldest = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const youngest = new Date(now.getFullYear() - 12, now.getMonth(), now.getDate());
  const value = new Date(year, month - 1, day);
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(format.locale, { month: 'long', timeZone: 'UTC' });

  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      display: 'default', // Android's standard date dialog
      minimumDate: oldest,
      maximumDate: youngest,
      onValueChange: (_, date) => onChange(date.getDate(), date.getMonth() + 1, date.getFullYear()),
    });

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t('prof.form.dateOfBirthValue', { date: `${day} ${monthName} ${year}` })}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      className="items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-8">
      <Text {...COMPACT_TEXT} className={`text-xs font-semibold uppercase text-white/45 ${language === 'en' ? 'tracking-[2px]' : ''}`}>
        {t('prof.form.dateOfBirth')}
      </Text>
      <DisplayText
        {...COMPACT_TEXT}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ fontSize: 32, marginTop: 12, fontWeight: '900' }}
        className="uppercase text-white">
        {day} {monthName} {year}
      </DisplayText>
      <View className="mt-4 flex-row items-center gap-2">
        <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} tintColor={BRAND} size={16} />
        <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-sm font-semibold">
          {t('prof.form.tapToChange')}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Height: a vertical ruler you scroll. The value is read off the green line in the middle. ──
// The ticks are plain static views in a native scroll view, so scrolling stays smooth; only the number above the line changes.
/** The ruler fills the free space on the screen: screen height minus everything else, kept between these limits. */
const RULER_MIN_HEIGHT = 300;
const RULER_MAX_HEIGHT = 480;
const RULER_OTHER_CONTENT = 420;
const RULER_WIDTH = 120;
type HeightUnit = 'cm' | 'ft';
/** A ruler: values from `min` to `max`, `tick` px per value, a long tick + number every `major`, a medium tick every `mid`. */
type RulerSpec = { min: number; max: number; tick: number; major: number; mid: number; label: (v: number) => string | number };
const RULER = {
  /** Height in cm. Inside the 100 to 250 cm check. */
  cm: { min: 100, max: 250, tick: 10, major: 10, mid: 5, label: (v) => v },
  /** Height in inches: a number for every foot. */
  ft: { min: 40, max: 98, tick: 10, major: 12, mid: 6, label: (v) => v / 12 },
  /** Weight in tenths of a kilo (300 = 30.0 kg, 2000 = 200.0 kg): a long tick every 1 kg (major), a medium tick every 0.5 kg (mid). */
  kg: { min: 300, max: 2000, tick: 10, major: 10, mid: 5, label: (v) => v / 10 },
} satisfies Record<string, RulerSpec>;
const cmToInches = (cm: number) => Math.round(cm / 2.54);
const inchesToCm = (inches: number) => Math.round(inches * 2.54 * 10) / 10;
const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One tick of the ruler: a line from the right edge, longer every 5th/10th (6th/12th) value, labelled on the long ones. */
function RulerRow({ v, spec }: { v: number; spec: RulerSpec }) {
  const { tick, major, mid, label } = spec;
  const isMajor = v % major === 0;
  const length = isMajor ? 40 : v % mid === 0 ? 28 : 16;
  return (
    <View style={{ height: tick }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: tick / 2 - 1,
          width: length,
          height: isMajor ? 2 : 1.5,
          borderRadius: 1,
          backgroundColor: isMajor ? '#ffffff' : 'rgba(255,255,255,0.5)',
        }}
      />
      {isMajor ? (
        <Text style={{ position: 'absolute', right: length + 10, top: tick / 2 - 14, fontSize: 20, fontWeight: '700', color: '#ffffff' }}>
          {label(v)}
        </Text>
      ) : null}
    </View>
  );
}

/** The scrolling ruler. Higher values are at the top. `onLive` fires when the value under the line changes; `onSettle` when a scroll stops. */
const ScaleRuler = memo(function ScaleRuler({
  spec,
  initial,
  height,
  accessibilityLabel,
  onLive,
  onSettle,
}: {
  spec: RulerSpec;
  initial: number;
  height: number;
  accessibilityLabel: string;
  onLive: (v: number) => void;
  onSettle: (v: number) => void;
}) {
  const { min, max, tick } = spec;
  const last = useSharedValue(initial);
  const onScroll = useAnimatedScrollHandler((e) => {
    const v = Math.min(max, Math.max(min, max - Math.round(e.contentOffset.y / tick)));
    if (v !== last.value) {
      last.value = v;
      scheduleOnRN(onLive, v);
    }
  });
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onSettle(clampTo(max - Math.round(e.nativeEvent.contentOffset.y / tick), min, max));
  };
  const values = Array.from({ length: max - min + 1 }, (_, k) => max - k);

  return (
    <Animated.ScrollView
      accessibilityLabel={accessibilityLabel}
      style={{ width: RULER_WIDTH, height }}
      contentOffset={{ x: 0, y: (max - initial) * tick }}
      contentContainerStyle={{ paddingVertical: (height - tick) / 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={tick}
      decelerationRate="normal"
      overScrollMode="never"
      scrollEventThrottle={16}
      nestedScrollEnabled
      onScroll={onScroll}
      onMomentumScrollEnd={settle}>
      {values.map((v) => (
        <RulerRow key={v} v={v} spec={spec} />
      ))}
    </Animated.ScrollView>
  );
});

/** The ruler fills the free space on the screen. */
function useRulerHeight() {
  const { height: screenHeight } = useWindowDimensions();
  return clampTo(Math.round(screenHeight - RULER_OTHER_CONTENT), RULER_MIN_HEIGHT, RULER_MAX_HEIGHT);
}

/** The reading line across the middle of the ruler: fades in from the left, ends in a glowing dot. */
function ReadingLine({ rulerHeight }: { rulerHeight: number }) {
  return (
    <>
        {/* The reading line across the middle: fades in from the left, ends in a glowing dot on the ruler */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(61,220,104,0)', BRAND]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', left: 0, right: 0, top: rulerHeight / 2 - 1, height: 2 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 8,
            top: rulerHeight / 2 - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: BRAND,
            shadowColor: BRAND,
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        />
    </>
  );
}

/** cm / ft switch, the ruler on the right, a green line across the middle and the value above it on the left. */
function HeightPicker({ cm, onChange }: { cm: number; onChange: (cm: number) => void }) {
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  const rulerHeight = useRulerHeight();
  const [unit, setUnit] = useState<HeightUnit>('cm');
  /** The height (cm) the ruler was opened at. Only changes when the unit is switched, so the ruler never jumps while you scroll. */
  const [startCm, setStartCm] = useState(() => clampTo(cm, RULER.cm.min, RULER.cm.max));
  const [live, setLive] = useState(startCm);
  const t = useT();
  /** What is written for each unit. */
  const unitName: Record<HeightUnit | 'in', string> = { cm: 'cm', ft: t('prof.form.ft'), in: t('prof.form.in') };

  const initial = unit === 'cm' ? Math.round(startCm) : clampTo(cmToInches(startCm), RULER.ft.min, RULER.ft.max);
  const toCm = (v: number) => (unit === 'cm' ? v : inchesToCm(v));

  const switchUnit = (next: HeightUnit) => {
    if (next === unit) return;
    setStartCm(live);
    setUnit(next);
  };

  const inches = cmToInches(live);
  const numberStyle = [{ fontSize: 46, lineHeight: 52 }, fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' as const }];
  const unitStyle = { fontSize: 20, fontWeight: '600' as const, color: 'rgba(255,255,255,0.7)', marginBottom: 8 };

  return (
    <View>
      {/* cm | ft */}
      <View className="mb-4 flex-row self-start rounded-full bg-white/10 p-1">
        {(['cm', 'ft'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => switchUnit(u)}
            accessibilityRole="button"
            accessibilityState={{ selected: unit === u }}
            accessibilityLabel={t(u === 'cm' ? 'prof.form.centimetres' : 'prof.form.feetInches')}
            style={{ backgroundColor: unit === u ? BRAND : 'transparent' }}
            className="min-w-[64px] items-center rounded-full px-5 py-2">
            <Text {...COMPACT_TEXT} style={{ color: unit === u ? '#04210f' : 'rgba(255,255,255,0.75)' }} className="text-sm font-bold">
              {unitName[u]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: rulerHeight }} className="flex-row justify-end">
        <ScaleRuler
          key={unit}
          spec={RULER[unit]}
          accessibilityLabel={t('prof.form.heightRuler')}
          initial={initial}
          height={rulerHeight}
          onLive={(v) => setLive(toCm(v))}
          onSettle={(v) => {
            setLive(toCm(v));
            onChange(toCm(v));
          }}
        />

        <ReadingLine rulerHeight={rulerHeight} />
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 0, bottom: rulerHeight / 2 + 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {unit === 'cm' ? (
            <>
              <Text {...COMPACT_TEXT} style={numberStyle} className="text-white">{Math.round(live)}</Text>
              <Text {...COMPACT_TEXT} style={unitStyle}>cm</Text>
            </>
          ) : (
            <>
              <Text {...COMPACT_TEXT} style={numberStyle} className="text-white">{Math.floor(inches / 12)}</Text>
              <Text {...COMPACT_TEXT} style={unitStyle}>{unitName.ft}</Text>
              <Text {...COMPACT_TEXT} style={numberStyle} className="text-white">{inches % 12}</Text>
              <Text {...COMPACT_TEXT} style={unitStyle}>{unitName.in}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Weight: an arc ruler with a tick for every 0.1 kg. ──
// The ticks sit around the rim of a big circle and dragging turns the whole circle, so you only see the top of it: a curved ruler with
// a fixed pointer at the top centre. Turning ONE view is cheap, so it stays smooth. The ticks are drawn in chunks (only the ones near the
// top exist as views), because about 1,700 ticks would be too many to draw at once.
/** px of drag (= arc length along the rim) per tick, and the circle's radius. */
const ARC_TICK_PX = 10;
const ARC_R = 260;
/** Degrees the circle turns per tick. */
const ARC_STEP_DEG = (ARC_TICK_PX / ARC_R) * (180 / Math.PI);
/** Height of the visible strip, and how far below its top the rim of the circle starts. */
const ARC_HEIGHT = 170;
const ARC_RIM_TOP = 40;
/** Ticks per chunk, and how many chunks around the top are drawn on each side. */
const ARC_CHUNK = 10;
const ARC_CHUNKS_EACH_SIDE = 4;

/** A few ticks, placed on the rim by their angle. `from` is the index of the first one (0 = the first value of the ruler). */
const ArcChunk = memo(function ArcChunk({ from, count, spec }: { from: number; count: number; spec: RulerSpec }) {
  return (
    <>
      {Array.from({ length: count }, (_, k) => {
        const index = from + k;
        const v = spec.min + index;
        const whole = v % spec.major === 0;
        const half = v % spec.mid === 0;
        // the same lines as the height ruler: lengths 40 / 28 / 16, thickness 2 / 1.5 / 1.5
        const length = whole ? 40 : half ? 28 : 16;
        const thickness = whole ? 2 : 1.5;
        const theta = index * ARC_STEP_DEG;
        const rad = (theta * Math.PI) / 180;
        const centre = ARC_R - length / 2; // the tick hangs inward from the rim
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: ARC_R + centre * Math.sin(rad) - thickness / 2,
              top: ARC_R - centre * Math.cos(rad) - length / 2,
              width: thickness,
              height: length,
              borderRadius: 1,
              backgroundColor: whole ? '#ffffff' : 'rgba(255,255,255,0.5)',
              transform: [{ rotate: `${theta}deg` }],
            }}
          />
        );
      })}
    </>
  );
});

const ArcRuler = memo(function ArcRuler({
  spec,
  initial,
  width,
  accessibilityLabel,
  onLive,
  onSettle,
}: {
  spec: RulerSpec;
  initial: number;
  width: number;
  accessibilityLabel: string;
  onLive: (v: number) => void;
  onSettle: (v: number) => void;
}) {
  const { min, max } = spec;
  const total = max - min + 1;
  const chunkCount = Math.ceil(total / ARC_CHUNK);
  const startIndex = initial - min;
  /** How far the circle is turned, in ticks (can be a fraction while you drag). */
  const pos = useSharedValue(startIndex);
  const dragStart = useSharedValue(startIndex);
  const [active, setActive] = useState(() => Math.floor(startIndex / ARC_CHUNK));

  // The value under the pointer, and which chunk is at the top, follow the turning.
  useAnimatedReaction(
    () => Math.round(pos.value),
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(onLive, min + cur);
    }
  );
  useAnimatedReaction(
    () => Math.floor(Math.round(pos.value) / ARC_CHUNK),
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(setActive, cur);
    }
  );
  const dialStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-pos.value * ARC_STEP_DEG}deg` }] }));

  /** Settle on the nearest tick, then report the value. */
  const snap = () => {
    pos.set(
      withTiming(Math.round(pos.get()), { duration: 120 }, (done) => {
        if (done) scheduleOnRN(onSettle, min + Math.round(pos.value));
      })
    );
  };

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cancelAnimation(pos);
        dragStart.set(pos.get());
      },
      // Dragging left turns the ruler forward (higher values), like scrolling a straight ruler.
      onPanResponderMove: (_, g) => {
        pos.set(clampTo(dragStart.get() - g.dx / ARC_TICK_PX, 0, total - 1));
      },
      onPanResponderRelease: (_, g) => {
        const velocity = (-g.vx * 1000) / ARC_TICK_PX; // ticks per second
        if (Math.abs(velocity) < 3) {
          snap();
          return;
        }
        pos.set(
          withDecay({ velocity, deceleration: 0.997, clamp: [0, total - 1] }, (done) => {
            if (done) {
              pos.value = withTiming(Math.round(pos.value), { duration: 120 }, (settled) => {
                if (settled) scheduleOnRN(onSettle, min + Math.round(pos.value));
              });
            }
          })
        );
      },
      onPanResponderTerminate: () => snap(),
    })
  );

  /** For screen readers: increase / decrease by 0.1. */
  const bump = (delta: number) => {
    cancelAnimation(pos);
    const next = clampTo(Math.round(pos.get()) + delta, 0, total - 1);
    pos.set(next);
    onLive(min + next);
    onSettle(min + next);
  };

  const first = Math.max(0, active - ARC_CHUNKS_EACH_SIDE);
  const last = Math.min(chunkCount - 1, active + ARC_CHUNKS_EACH_SIDE);

  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => bump(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ width, height: ARC_HEIGHT, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', width: ARC_R * 2, height: ARC_R * 2, left: width / 2 - ARC_R, top: ARC_RIM_TOP }, dialStyle]}>
        {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((c) => (
          <ArcChunk key={c} from={c * ARC_CHUNK} count={Math.min(ARC_CHUNK, total - c * ARC_CHUNK)} spec={spec} />
        ))}
      </Animated.View>
    </View>
  );
});

/** Current weight and target weight share one ruler: two tabs choose which one it edits. Values are in kg, in steps of 0.1. */
type WeightField = 'weight' | 'target';
const kgToTenths = (kg: number) => clampTo(Math.round(kg * 10), RULER.kg.min, RULER.kg.max);

function WeightPicker({
  weight,
  target,
  onChange,
}: {
  weight: number;
  target: number;
  onChange: (field: WeightField, kg: number) => void;
}) {
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  /** The exact background colour at the ruler's height ("r,g,b"), so the side fades blend in with no visible edge. */
  const [fade, setFade] = useState('5,10,7');
  const rulerBox = useRef<ComponentRef<typeof View>>(null);
  /** The whole width of the form (it is at most 840 wide); the ruler breaks out of the form's 20px side padding to reach the screen edges. */
  const rulerWidth = Math.min(screenWidth, 840);
  const [field, setField] = useState<WeightField>('weight');
  /** Both values as they are right now (they move while you scroll). */
  const [values, setValues] = useState({ weight: kgToTenths(weight) / 10, target: kgToTenths(target) / 10 });
  /** The values the ruler was opened at. Only changes when you switch tab, so the ruler never jumps while you scroll. */
  const [start, setStart] = useState(values);
  const { t, language } = useLanguage();

  const switchField = (next: WeightField) => {
    if (next === field) return;
    setStart(values);
    setField(next);
  };

  const numberStyle = [{ fontSize: 72, lineHeight: 80 }, fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' as const }];

  return (
    <View>
      {/* Current | Target: the same switch as cm | ft on the height screen. The chosen one is what the ruler edits. */}
      <View className="flex-row self-start rounded-full bg-white/10 p-1">
        {(['weight', 'target'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => switchField(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: field === f }}
            accessibilityLabel={t(f === 'weight' ? 'prof.form.currentWeightValue' : 'prof.form.targetWeightValue', { value: values[f] })}
            style={{ backgroundColor: field === f ? BRAND : 'transparent' }}
            className="min-w-[64px] items-center rounded-full px-5 py-2">
            <Text {...COMPACT_TEXT} style={{ color: field === f ? '#04210f' : 'rgba(255,255,255,0.75)' }} className="text-sm font-bold">
              {t(f === 'weight' ? 'prof.form.current' : 'prof.form.target')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The big reading */}
      <View className="mt-10 items-center">
        <Text {...COMPACT_TEXT} className={`text-xs font-semibold uppercase text-white/45 ${language === 'en' ? 'tracking-[2px]' : ''}`}>
          {t(field === 'weight' ? 'prof.form.currentWeight' : 'prof.form.targetWeight')}
        </Text>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Text {...COMPACT_TEXT} style={numberStyle} className="text-white">{values[field]}</Text>
          <Text {...COMPACT_TEXT} style={{ fontSize: 22, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>kg</Text>
        </View>
      </View>

      {/* The arc ruler: ticks fade out at both sides, a tall pointer at the top centre */}
      <View
        ref={rulerBox}
        onLayout={() => rulerBox.current?.measureInWindow((_x, y, _w, h) => setFade(greenBackgroundAt(y + h / 2, screenHeight)))}
        style={{ width: rulerWidth, height: ARC_HEIGHT, marginHorizontal: -20 }}
        className="mt-6 self-center">
        <ArcRuler
          key={field}
          spec={RULER.kg}
          accessibilityLabel={t(field === 'weight' ? 'prof.form.currentRuler' : 'prof.form.targetRuler')}
          initial={kgToTenths(start[field])}
          width={rulerWidth}
          onLive={(v) => setValues((cur) => ({ ...cur, [field]: v / 10 }))}
          onSettle={(v) => {
            setValues((cur) => ({ ...cur, [field]: v / 10 }));
            onChange(field, v / 10);
          }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${fade},1)`, `rgba(${fade},0)`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 72 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${fade},0)`, `rgba(${fade},1)`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 72 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: rulerWidth / 2 - 1.5,
            top: ARC_RIM_TOP - 16,
            width: 3,
            height: 92,
            borderRadius: 2,
            backgroundColor: '#ffffff',
            shadowColor: '#ffffff',
            shadowOpacity: 0.8,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        />
      </View>
    </View>
  );
}

// ── Step 6: activity. Step 7: diet. ──
type SymbolName = { ios: string; android: string; web: string };
const ACTIVITY_ICON: Record<Activity, SymbolName> = {
  sedentary: { ios: 'chair.fill', android: 'chair', web: 'chair' },
  light: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  moderate: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  active: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  very_active: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
};
const DIET_ICON: Record<DietType, SymbolName> = {
  vegetarian: { ios: 'leaf.fill', android: 'eco', web: 'eco' },
  non_vegetarian: { ios: 'fork.knife', android: 'kebab_dining', web: 'kebab_dining' },
  eggetarian: { ios: 'oval.fill', android: 'egg', web: 'egg' },
  vegan: { ios: 'camera.macro', android: 'spa', web: 'spa' },
};

/** A row card: an icon square on the left, a title and a hint. The chosen one has a green border and tint, no check. */
function ActivityCard({ title, hint, icon, selected, onPress }: { title: string; hint: string; icon: SymbolName; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
      className={`min-h-[68px] flex-row items-center gap-3 rounded-xl border px-3 py-2 ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
      <View className={`h-12 w-12 items-center justify-center rounded-lg ${selected ? 'bg-[#3ddc68]/20' : 'bg-white/10'}`}>
        <SymbolView name={icon as never} size={24} tintColor={selected ? BRAND : 'rgba(255,255,255,0.6)'} />
      </View>
      <View className="flex-1">
        <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{title}</Text>
        <Text {...COMPACT_TEXT} className="text-xs text-white/55">{hint}</Text>
      </View>
    </Pressable>
  );
}

/** A square-ish card for the diet grid: icon in a circle, label under it. */
function DietCard({ label, icon, selected, onPress }: { label: string; icon: SymbolName; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`h-[140px] flex-1 items-center justify-center gap-3 rounded-2xl border ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
      <View className={`h-16 w-16 items-center justify-center rounded-full ${selected ? 'bg-[#3ddc68]/20' : 'bg-white/10'}`}>
        <SymbolView name={icon as never} size={30} tintColor={selected ? BRAND : 'rgba(255,255,255,0.6)'} />
      </View>
      <Text {...COMPACT_TEXT} className={`px-2 text-center text-base font-semibold ${selected ? 'text-white' : 'text-white/60'}`}>{label}</Text>
    </Pressable>
  );
}

/** `roomy`: the larger gap under the headline used on the setup screens. */
/** A question with Yes / No answers. Tapping the chosen answer again takes it back (unanswered is not "no"). */
function YesNo({ question, value, onChange, yes, no }: { question: string; value: boolean | null; onChange: (v: boolean | null) => void; yes: string; no: string }) {
  return (
    <View>
      <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{question}</Text>
      <View className="flex-row gap-2">
        <Chip label={yes} selected={value === true} onPress={() => onChange(value === true ? null : true)} />
        <Chip label={no} selected={value === false} onPress={() => onChange(value === false ? null : false)} />
      </View>
    </View>
  );
}

/**
 * The health check: medicines, pregnancy, injury and a doctor's restrictions. Every question can be left
 * blank. Anything marked "yes" is shown to the dietitian before they set exercise or calorie targets.
 */
function ScreeningQuestions({ form, set }: { form: Form; set: <K extends keyof Form>(key: K, value: Form[K]) => void }) {
  const t = useT();
  const line = emergencyLine();
  return (
    <View className="gap-5">
      <YesNo question={t('screening.medication')} yes={t('common.yes')} no={t('common.no')} value={form.medication} onChange={(v) => set('medication', v)} />
      {form.sex === 'female' ? (
        <View>
          <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{t('screening.pregnancy')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {([['no', t('common.no')], ['pregnant', t('screening.pregnant')], ['breastfeeding', t('screening.breastfeeding')]] as const).map(([value, label]) => (
              <Chip key={value} label={label} selected={form.pregnancy === value} onPress={() => set('pregnancy', form.pregnancy === value ? null : value)} />
            ))}
          </View>
        </View>
      ) : null}
      <YesNo question={t('screening.injury')} yes={t('common.yes')} no={t('common.no')} value={form.injury} onChange={(v) => set('injury', v)} />
      {form.injury ? <Field label={t('screening.injuryNotes')} value={form.injuryNotes} onChangeText={(v) => set('injuryNotes', v)} placeholder={t('prof.form.injuryEg')} multiline maxLength={300} /> : null}
      <YesNo question={t('screening.restriction')} yes={t('common.yes')} no={t('common.no')} value={form.restriction} onChange={(v) => set('restriction', v)} />
      {form.restriction ? <Field label={t('screening.restrictionNotes')} value={form.restrictionNotes} onChangeText={(v) => set('restrictionNotes', v)} placeholder={t('prof.form.restrictionEg')} multiline maxLength={300} /> : null}
      <View className="rounded-xl bg-white/5 p-4">
        <Text {...COMPACT_TEXT} className="text-xs leading-5 text-muted">
          {t('screening.notSure', { number: line.number })}
        </Text>
      </View>
    </View>
  );
}

function Title({ children, hint, roomy }: { children: ReactNode; hint?: string; roomy?: boolean }) {
  // Never blocks: shows right away, and the headline font swaps in once loaded.
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  const { language } = useLanguage();
  // The headline face has no Indian scripts: those use the phone's bold face, a little smaller and with more room.
  const face = language !== 'en' ? { fontWeight: '800' as const, fontSize: 24, lineHeight: 36 } : fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' as const };
  return (
    <View className={roomy ? 'mb-10' : 'mb-5'}>
      <Text
        {...COMPACT_TEXT}
        style={face}
        className="text-[28px] uppercase leading-8 text-white">
        {children}
      </Text>
      {hint ? (
        <Text {...COMPACT_TEXT} className="mt-2 text-sm leading-5 text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The questions a dietitian needs. `setup` asks them one screen at a time right after the first
 * login; `edit` shows them all on one page for changing later.
 */
export function ProfileForm({
  mode,
  onDone,
  onSkip,
  skipping,
  skipError,
  skipLabel,
  editing = false,
  startAt,
}: {
  mode: 'setup' | 'edit';
  onDone?: () => void;
  /** Setup only: shows "Skip" at the top right. */
  onSkip?: () => void;
  skipping?: boolean;
  skipError?: string | null;
  /** The word on that button ("Close" when the steps are opened again later). */
  skipLabel?: string;
  /**
   * Setup's one-question-at-a-time screens, used to change an existing profile: adds the health and privacy
   * screen, a Save button at the top right that saves from any screen, a close button on the first screen,
   * and lets the progress bar be tapped to jump to a screen.
   */
  editing?: boolean;
  /** Editing only: the name of the screen to open first, e.g. 'screening'. */
  startAt?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const { profile, save } = useProfile();
  const { t, language } = useLanguage();

  const [form, setForm] = useState<Form>(() => initialForm(profile, mode === 'setup' ? new Date().getFullYear() - 25 : undefined));
  const steps: readonly string[] = editing ? [...SETUP_STEPS, 'health'] : SETUP_STEPS;
  const [step, setStep] = useState(() => (editing && startAt ? Math.max(0, steps.indexOf(startAt)) : 0));
  const [openSection, setOpenSection] = useState<number | null>(0);
  /** What is wrong: one of the app's own sentences (a key, so it follows the language) or the server's message. */
  const [error, setError] = useState<{ key: Key } | { text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Date of birth boxes: the cursor moves from day to month to year by itself.
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);
  const set =<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const todayKey = () => toDayKey(getZonedParts(new Date(), format.timeZone));

  // The three parts of "About you", checked separately so setup can ask them on separate screens.
  const sexProblem = (): Key | null => (!form.sex ? 'prof.err.sex' : null);
  const birthProblem = (): Key | null => {
    const birth = toBirthDate(form.day, form.month, form.year);
    if (!birth) return 'prof.err.birth';
    const age = ageOn(birth, todayKey());
    if (age < 12 || age > 100) return 'prof.err.age';
    return null;
  };
  const heightProblem = (): Key | null => {
    const height = parseDecimal(form.height);
    if (height == null || height < 100 || height > 250) return 'prof.err.height';
    return null;
  };

  /** Returns the sentence for the first problem in a section, or null when it is fine. */
  const problemIn = (section: number): Key | null => {
    if (section === 0 && !form.goal) return 'prof.err.goal';
    if (section === 1) return sexProblem() ?? birthProblem() ?? heightProblem();
    if (section === 2) {
      const weight = parseDecimal(form.weight);
      const target = parseDecimal(form.target);
      if (weight == null || weight < 25 || weight > 300) return 'prof.err.weight';
      if (target == null || target < 25 || target > 300) return 'prof.err.target';
      if (form.goal === 'lose' && target >= weight) return 'prof.err.loseTarget';
      if (form.goal === 'gain' && target <= weight) return 'prof.err.gainTarget';
      if (form.goal === 'maintain' && Math.abs(target - weight) > 5) return 'prof.err.maintainTarget';
    }
    if (section === 3) {
      if (!form.activity) return 'prof.err.activity';
      if (!form.diet) return 'prof.err.diet';
    }
    return null;
  };

  /** The setup screen to show for a problem found in section `section` of the edit page. */
  const setupStepFor = (section: number): number => {
    if (section === 1) return sexProblem() ? 1 : birthProblem() ? 2 : 3;
    if (section === 3) return form.activity ? 6 : 5;
    return [0, 1, 4, 5, 6, 8][section];
  };

  /** The problem with the answer on setup screen `index`, or null. */
  const setupProblem = (index: number): Key | null => {
    switch (steps[index]) {
      case 'goal': return problemIn(0);
      case 'sex': return sexProblem();
      case 'birth': return birthProblem();
      case 'height': return heightProblem();
      case 'weight': return problemIn(2);
      case 'activity': return form.activity ? null : 'prof.err.activity';
      case 'diet': return form.diet ? null : 'prof.err.diet';
      default: return null;
    }
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const problem = problemIn(i);
      if (problem) {
        setError({ key: problem });
        if (mode === 'setup') setStep(setupStepFor(i));
        else setOpenSection(i);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        goal: form.goal!,
        sex: form.sex!,
        birthDate: toBirthDate(form.day, form.month, form.year)!,
        heightCm: parseDecimal(form.height)!,
        weightKg: parseDecimal(form.weight)!,
        targetWeightKg: parseDecimal(form.target)!,
        activityLevel: form.activity!,
        dietType: form.diet!,
        allergies: form.allergies.trim() || null,
        medicalNotes: form.medical.trim() || null,
        shareWithDietitian: form.share,
        fasting: form.fasting,
        shiftWork: form.shiftWork,
        takesMedication: form.medication,
        pregnancyStatus: form.sex === 'female' ? form.pregnancy : null,
        hasInjury: form.injury,
        injuryNotes: form.injury ? form.injuryNotes.trim() || null : null,
        hasRestriction: form.restriction,
        restrictionNotes: form.restriction ? form.restrictionNotes.trim() || null : null,
        day: todayKey(),
      });
      // Setup: the app switches to the main screens by itself. Edit: go back.
      onDone?.();
    } catch (e) {
      setError({ text: messageFrom(e) });
      setBusy(false);
    }
  };

  const next = () => {
    const problem = setupProblem(step);
    if (problem) return setError({ key: problem });
    setError(null);
    setStep((s) => s + 1);
  };

  const weight = parseDecimal(form.weight);
  const target = parseDecimal(form.target);
  const delta = weight != null && target != null ? Math.abs(weight - target) : null;

  const sections: ReactNode[] = [
    // 0 goal
    <View key="goal">
      <Title roomy={mode === 'setup'}>
        <Rich text={t('setup.goalTitle')} />
      </Title>
      <View className="gap-3">
        {GOAL_CARDS.map((c) => (
          <GoalCard
            key={c.goal}
            label={t(`goal.${c.goal}`)}
            hint={t(`goal.${c.goal}Hint`)}
            image={c.image}
            top={c.top}
            selected={form.goal === c.goal}
            onPress={() => set('goal', c.goal)}
          />
        ))}
      </View>
    </View>,
    // 1 about you
    <View key="about" className="gap-5">
      <Title hint={t('prof.form.aboutHint')}>{t('prof.form.aboutTitle')}</Title>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{t('prof.form.sex')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(SEX_KEY) as Sex[]).map((s) => (
            <Chip key={s} label={t(SEX_KEY[s])} selected={form.sex === s} onPress={() => set('sex', s)} />
          ))}
        </View>
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{t('prof.form.dateOfBirth')}</Text>
        <View className="flex-row gap-3">
          {/* DD, MM and YYYY are the same on every Indian form. */}
          <Field flex label={t('prof.form.day')} value={form.day} onChangeText={(v) => set('day', v.replace(/\D/g, '').slice(0, 2))} placeholder="DD" keyboardType="number-pad" /* i18n-ignore */ />
          <Field flex label={t('prof.form.month')} value={form.month} onChangeText={(v) => set('month', v.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" /* i18n-ignore */ />
          <Field flex label={t('prof.form.year')} value={form.year} onChangeText={(v) => set('year', v.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" keyboardType="number-pad" /* i18n-ignore */ />
        </View>
      </View>
      <Field label={t('prof.form.height')} value={form.height} onChangeText={(v) => set('height', v)} placeholder={t('prof.form.eg', { value: 172 })} keyboardType="decimal-pad" suffix="cm" />
    </View>,
    // 2 weight
    <View key="weight" className="gap-5">
      <Title roomy={mode === 'setup'} hint={t('prof.form.weightHint')}>{t('prof.form.yourWeight')}</Title>
      <Field label={t('prof.form.currentWeight')} value={form.weight} onChangeText={(v) => set('weight', v)} placeholder={t('prof.form.eg', { value: 82.5 })} keyboardType="decimal-pad" suffix="kg" />
      <Field label={t('prof.form.targetWeight')} value={form.target} onChangeText={(v) => set('target', v)} placeholder={t('prof.form.eg', { value: 75 })} keyboardType="decimal-pad" suffix="kg" />
      {delta != null && delta > 0 && form.goal && form.goal !== 'maintain' ? (
        <View className="rounded-xl bg-white/5 p-4">
          <Text {...COMPACT_TEXT} className="text-sm text-white">
            {splitHighlight(t(form.goal === 'lose' ? 'prof.form.wantLose' : 'prof.form.wantGain', { kg: fmtKg(delta) })).map((part, i) =>
              part.highlight ? <Text key={i} style={{ color: BRAND }} className="font-bold">{part.text}</Text> : part.text
            )}
          </Text>
        </View>
      ) : null}
    </View>,
    // 3 lifestyle
    <View key="life" className="gap-5">
      <Title roomy={mode === 'setup'} hint={t('prof.form.lifeHint')}>{t('prof.form.lifeTitle')}</Title>
      <View className="gap-2">
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">{t('prof.form.activeQ')}</Text>
        {(Object.keys(ACTIVITY_KEY) as Activity[]).map((a) => {
          const selected = form.activity === a;
          return (
            <Pressable
              key={a}
              onPress={() => set('activity', a)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-xl border-2 px-4 py-3 ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{t(ACTIVITY_KEY[a].title)}</Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted">{t(ACTIVITY_KEY[a].hint)}</Text>
              </View>
              {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={BRAND} size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{t('prof.form.eatQ')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(DIET_KEY) as DietType[]).map((d) => (
            <Chip key={d} label={t(DIET_KEY[d])} selected={form.diet === d} onPress={() => set('diet', d)} />
          ))}
        </View>
      </View>
    </View>,
    // 4 health + consent
    <View key="health" className="gap-5">
      <Title roomy={mode === 'setup'} hint={t('prof.form.healthHint')}>{t('prof.form.healthTitle')}</Title>
      <Field label={t('prof.form.allergies')} value={form.allergies} onChangeText={(v) => set('allergies', v)} placeholder={t('prof.form.allergiesEg')} multiline maxLength={300} />
      <Field label={t('prof.form.medical')} value={form.medical} onChangeText={(v) => set('medical', v)} placeholder={t('prof.form.medicalEg')} multiline maxLength={500} />
      <View className="flex-row items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{t('prof.form.share')}</Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-xs leading-4 text-muted">
            {t('prof.form.shareDetail')}
          </Text>
        </View>
        <Switch
          value={form.share}
          onValueChange={(v) => set('share', v)}
          trackColor={{ false: '#3a3a42', true: BRAND }}
          thumbColor="#ffffff"
          accessibilityLabel={t('prof.form.share')}
        />
      </View>
    </View>,
  ];

  // Setup screens: one question each. Goal, weight, lifestyle and health reuse the edit-page sections.
  const setupSteps: ReactNode[] = [
    sections[0],
    <View key="sex">
      <Title roomy>
        <Rich text={t('setup.sexTitle')} />
      </Title>
      <View className="items-center gap-6">
        {SEX_CHOICES.map((s) => (
          <SexCircle key={s} label={t(`sex.${s}`)} icon={SEX_ICON[s]} selected={form.sex === s} onPress={() => set('sex', s)} />
        ))}
      </View>
    </View>,
    <View key="birth">
      <Title roomy>
        <Rich text={t('setup.birthTitle')} />
      </Title>
      {getPicker() ? (
        <DateWheel
          day={Number(form.day) || 1}
          month={Number(form.month) || 1}
          year={Number(form.year) || new Date().getFullYear() - 25}
          onChange={(d, m, y) => {
            setForm((f) => ({ ...f, day: String(d), month: String(m), year: String(y) }));
            setError(null);
          }}
        />
      ) : (
        // No native date picker in this build (or not Android): big typed boxes. The cursor moves on once a box is full.
        <View className="flex-row gap-3">
          <DateBox
            caption={t('prof.form.day')}
            placeholder="DD" // i18n-ignore
            maxLength={2}
            value={form.day}
            onChangeText={(text) => {
              const v = text.replace(/\D/g, '').slice(0, 2);
              set('day', v);
              if (v.length === 2) monthRef.current?.focus();
            }}
          />
          <DateBox
            ref={monthRef}
            caption={t('prof.form.month')}
            placeholder="MM" // i18n-ignore
            maxLength={2}
            value={form.month}
            onChangeText={(text) => {
              const v = text.replace(/\D/g, '').slice(0, 2);
              set('month', v);
              if (v.length === 2) yearRef.current?.focus();
            }}
          />
          <DateBox
            ref={yearRef}
            wide
            caption={t('prof.form.year')}
            placeholder="YYYY" // i18n-ignore
            maxLength={4}
            value={form.year}
            onChangeText={(text) => set('year', text.replace(/\D/g, '').slice(0, 4))}
          />
        </View>
      )}
    </View>,
    <View key="height">
      <Title roomy>
        <Rich text={t('setup.heightTitle')} />
      </Title>
      <HeightPicker cm={Number(form.height) || 170} onChange={(c) => set('height', String(c))} />
    </View>,
    <View key="weightStep">
      <Title roomy>
        <Rich text={t('setup.weightTitle')} />
      </Title>
      <WeightPicker
        weight={Number(form.weight) || 70}
        target={Number(form.target) || 70}
        onChange={(field, kg) => set(field, String(kg))}
      />
    </View>,
    <View key="activity">
      <Title roomy>
        <Rich text={t('setup.activityTitle')} />
      </Title>
      <View className="gap-2.5">
        {(Object.keys(ACTIVITY_KEY) as Activity[]).map((a) => (
          <ActivityCard
            key={a}
            title={t(`activity.${a}`)}
            hint={t(`activity.${a}Hint`)}
            icon={ACTIVITY_ICON[a]}
            selected={form.activity === a}
            onPress={() => set('activity', a)}
          />
        ))}
      </View>
    </View>,
    <View key="diet">
      <Title roomy>
        <Rich text={t('setup.dietTitle')} />
      </Title>
      <View className="gap-3">
        {[(['vegetarian', 'non_vegetarian'] as DietType[]), (['eggetarian', 'vegan'] as DietType[])].map((row) => (
          <View key={row[0]} className="flex-row gap-3">
            {row.map((d) => (
              <DietCard key={d} label={t(`diet.${d}`)} icon={DIET_ICON[d]} selected={form.diet === d} onPress={() => set('diet', d)} />
            ))}
          </View>
        ))}
      </View>
      <View className="mt-8 gap-5">
        <View>
          <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">{t('eating.fastingQ')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['none', 'ekadashi', 'ramadan', 'weekly', 'intermittent', 'other'] as Fasting[]).map((f) => (
              <Chip key={f} label={t(`eating.${f}`)} selected={form.fasting === f} onPress={() => set('fasting', form.fasting === f ? null : f)} />
            ))}
          </View>
        </View>
        <YesNo question={t('eating.shiftQ')} yes={t('common.yes')} no={t('common.no')} value={form.shiftWork} onChange={(v) => set('shiftWork', v)} />
      </View>
    </View>,
    <View key="screening">
      <Title roomy hint={t('setup.healthHint')}>
        <Rich text={t('setup.healthTitle')} />
      </Title>
      <ScreeningQuestions form={form} set={set} />
    </View>,
  ];

  // Changing a profile also covers health and privacy, which first-time setup leaves for later.
  if (editing) setupSteps.push(sections[4]);
  const lastStep = step === steps.length - 1;

  return (
    // Setup draws on the green background its screen provides; edit has to bring its own.
    <View className="flex-1" style={mode === 'setup' ? undefined : { backgroundColor: GREEN_BG }}>
      {mode === 'setup' ? null : <GreenBackground />}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Setup top row: back arrow on the left (from step 2), Skip on the right */}
        {mode === 'setup' ? (
          <View className="w-full max-w-[840px] self-center px-5">
            <View className="flex-row items-center justify-between py-2">
              {step > 0 ? (
                <Pressable
                  onPress={() => { setError(null); setStep((s) => s - 1); }}
                  disabled={busy || skipping}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                  <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
                </Pressable>
              ) : editing ? (
                <Pressable
                  onPress={onDone}
                  disabled={busy}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('prof.form.closeNoSave')}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={14} />
                </Pressable>
              ) : (
                <View className="h-10 w-10" />
              )}
              {editing ? (
                <Pressable
                  onPress={submit}
                  disabled={busy}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('prof.form.saveChanges')}
                  className="min-w-12 items-end py-1 active:opacity-60">
                  {busy ? (
                    <ActivityIndicator color={BRAND} size="small" />
                  ) : (
                    <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-sm font-bold">
                      {t('common.save')}
                    </Text>
                  )}
                </Pressable>
              ) : onSkip ? (
                <Pressable
                  onPress={onSkip}
                  disabled={busy || skipping}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={skipLabel ?? t('common.skip')}
                  className="min-w-12 items-end py-1 active:opacity-60">
                  {skipping ? (
                    <ActivityIndicator color={BRAND} size="small" />
                  ) : (
                    <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-sm font-bold">
                      {skipLabel ?? t('common.skip')}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            {skipError ? (
              <Text accessibilityRole="alert" className="pb-1 text-sm text-accent">
                {skipError}
              </Text>
            ) : null}
          </View>
        ) : null}
        <ScrollView
          // The height and weight screens hold a scrolling ruler: the page itself must not scroll there, or it fights the ruler for your finger.
          scrollEnabled={!(mode === 'setup' && (steps[step] === 'height' || steps[step] === 'weight'))}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: mode === 'setup' ? 16 : insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          {mode === 'setup' ? (
            <View className="mb-6">
              <View className="flex-row items-center justify-between">
                <Text {...COMPACT_TEXT} style={{ color: BRAND }} className={`text-xs font-bold uppercase ${language === 'en' ? 'tracking-[1px]' : ''}`}>
                  {t('setup.step', { n: step + 1, total: steps.length })}
                </Text>
              </View>
              <View className="mt-3 flex-row gap-1.5">
                {steps.map((name, i) =>
                  editing ? (
                    // When changing a profile, any screen can be opened straight from the bar.
                    <Pressable
                      key={name}
                      onPress={() => {
                        setError(null);
                        setStep(i);
                      }}
                      hitSlop={{ top: 14, bottom: 14 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('prof.form.goToStep', { n: i + 1 })}
                      accessibilityState={{ selected: i === step }}
                      className={`h-1.5 flex-1 rounded-full ${i === step ? 'bg-[#3ddc68]' : 'bg-white/20'}`}
                    />
                  ) : (
                    <View key={name} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#3ddc68]' : 'bg-white/15'}`} />
                  )
                )}
              </View>
            </View>
          ) : (
            <View className="mb-4 flex-row items-center gap-3">
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
              </Pressable>
              <Text className={`flex-1 text-[28px] font-bold text-white ${language === 'en' ? 'tracking-tight' : ''}`}>{t('prof.form.title')}</Text>
            </View>
          )}

          {/* First screen of first-time setup: the language comes first, so every question after it is in it. */}
          {mode === 'setup' && !editing && step === 0 ? (
            <View className="mb-8">
              <Text {...COMPACT_TEXT} className="mb-2 text-xs font-bold uppercase text-muted" style={{ letterSpacing: language === 'en' ? 1.4 : 0 }}>
                {t('lang.title')}
              </Text>
              <LanguagePicker compact />
            </View>
          ) : null}
          {mode === 'setup' ? setupSteps[step] : <>
            <Text className="mb-6 text-sm leading-6 text-muted">{t('prof.form.openSection')}</Text>
            <View className="gap-3">
              {sections.map((section, i) => (
                <View key={STEPS[i]} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <Pressable onPress={() => setOpenSection((current) => current === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: openSection === i }} className="flex-row items-center justify-between gap-3 p-5">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className={`h-8 w-8 items-center justify-center rounded-full ${openSection === i ? 'bg-[#3ddc68]/15' : 'bg-white/10'}`}>
                        <Text className={`text-xs font-semibold ${openSection === i ? 'text-[#3ddc68]' : 'text-white/60'}`}>{i + 1}</Text>
                      </View>
                      <Text className="flex-1 text-base font-semibold text-white">{t(STEPS[i])}</Text>
                    </View>
                    <SymbolView name={openSection === i ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#8fa396" size={16} />
                  </Pressable>
                  {openSection === i ? <View className="border-t border-white/5 p-5">{section}</View> : null}
                </View>
              ))}
            </View>
          </>}

          {error ? (
            <View accessibilityRole="alert" className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{'key' in error ? t(error.key) : error.text}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="w-full max-w-[840px] self-center flex-row gap-3 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
          {/* Deep green gradient pill, same as the other main buttons */}
          <Pressable
            onPress={mode === 'setup' && !lastStep ? next : submit}
            disabled={busy}
            accessibilityRole="button"
            className="h-14 flex-1 items-center justify-center overflow-hidden rounded-full active:opacity-80">
            <LinearGradient
              colors={['#24b24c', '#0d6527']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text {...COMPACT_TEXT} className="px-4 text-center text-base font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
                {mode === 'setup' ? (lastStep ? (editing ? t('common.save') : t('setup.saveProfile')) : t('common.continue')) : t('common.save')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
