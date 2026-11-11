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
  ACTIVITY_LABEL,
  ageOn,
  DIET_LABEL,
  fmtKg,
  GOAL_LABEL,
  parseDecimal,
  SEX_LABEL,
  toBirthDate,
  type Activity,
  type DietType,
  type Goal,
  type Sex,
} from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import type { BodyProfile } from '@/lib/wellness-api';
import { useProfile } from '@/providers/profile-provider';

// Same green look as login / onboarding.
const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Photos from the onboarding folder. `top` picks which part of the tall photo shows in the wide card.
const GOAL_CARDS: { goal: Goal; image: ImageSource; top: `${number}%`; hint: string }[] = [
  { goal: 'lose', image: require('@/assets/onboarding/slide-3.jpg'), top: '35%', hint: 'Burn fat and get lighter' },
  { goal: 'maintain', image: require('@/assets/onboarding/slide-2.jpg'), top: '60%', hint: 'Stay where I am and get fitter' },
  { goal: 'gain', image: require('@/assets/onboarding/slide-1.jpg'), top: '18%', hint: 'Build muscle and weight' },
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
};

/** The sections of the edit page (and the groups the answers are validated in). */
const STEPS = ['Your goal', 'About you', 'Your weight', 'Lifestyle', 'Health & privacy'] as const;

/** Setup asks one thing per screen: "About you" is split into sex, date of birth and height, and "Lifestyle" into activity and diet. */
const SETUP_STEPS = ['goal', 'sex', 'birth', 'height', 'weight', 'activity', 'diet'] as const;

/** `birthWheelYear`: setup only. The date-of-birth wheels start on 1 January of this year, so they always hold a valid date. */
function initialForm(p: BodyProfile | null, birthWheelYear?: number): Form {
  if (!p) {
    return { goal: null, sex: null, day: birthWheelYear ? '1' : '', month: birthWheelYear ? '1' : '', year: birthWheelYear ? String(birthWheelYear) : '', height: birthWheelYear ? '170' : '', weight: birthWheelYear ? '70' : '', target: birthWheelYear ? '70' : '', activity: null, diet: null, allergies: '', medical: '', share: false };
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
          placeholderTextColor="#7c8592"
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
      <Text {...COMPACT_TEXT} className={`text-sm font-medium ${selected ? 'text-white' : 'text-white/50'}`}>
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
      <Text {...COMPACT_TEXT} className="mt-2 text-center text-xs font-semibold uppercase tracking-[2px] text-white/45">
        {caption}
      </Text>
    </View>
  );
}

// ── Date of birth ──
// Android: a big tappable date that opens the system date dialog (perfectly smooth, native). Ages 12 to 100 only.
// Everywhere else, and in any build that does not contain the native picker yet, the screen shows typed Day / Month / Year fields.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  const picker = getPicker();
  if (!picker) return null;
  const { DateTimePickerAndroid } = picker;
  const now = new Date();
  const oldest = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
  const youngest = new Date(now.getFullYear() - 12, now.getMonth(), now.getDate());
  const value = new Date(year, month - 1, day);

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
      accessibilityLabel={`Date of birth ${day} ${MONTH_NAMES[month - 1]} ${year}. Tap to change.`}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      className="items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-8">
      <Text {...COMPACT_TEXT} className="text-xs font-semibold uppercase tracking-[2px] text-white/45">
        Date of birth
      </Text>
      <Text
        {...COMPACT_TEXT}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[{ fontSize: 32, marginTop: 12 }, fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' }]}
        className="uppercase text-white">
        {day} {MONTH_NAMES[month - 1]} {year}
      </Text>
      <View className="mt-4 flex-row items-center gap-2">
        <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} tintColor={BRAND} size={16} />
        <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-sm font-semibold">
          Tap to change
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
            accessibilityLabel={u === 'cm' ? 'Centimetres' : 'Feet and inches'}
            style={{ backgroundColor: unit === u ? BRAND : 'transparent' }}
            className="min-w-[64px] items-center rounded-full px-5 py-2">
            <Text {...COMPACT_TEXT} style={{ color: unit === u ? '#04210f' : 'rgba(255,255,255,0.75)' }} className="text-sm font-bold">
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: rulerHeight }} className="flex-row justify-end">
        <ScaleRuler
          key={unit}
          spec={RULER[unit]}
          accessibilityLabel="Height ruler"
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
              <Text {...COMPACT_TEXT} style={unitStyle}>ft</Text>
              <Text {...COMPACT_TEXT} style={numberStyle} className="text-white">{inches % 12}</Text>
              <Text {...COMPACT_TEXT} style={unitStyle}>in</Text>
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
            accessibilityLabel={`${f === 'weight' ? 'Current' : 'Target'} weight ${values[f]} kilograms`}
            style={{ backgroundColor: field === f ? BRAND : 'transparent' }}
            className="min-w-[64px] items-center rounded-full px-5 py-2">
            <Text {...COMPACT_TEXT} style={{ color: field === f ? '#04210f' : 'rgba(255,255,255,0.75)' }} className="text-sm font-bold">
              {f === 'weight' ? 'Current' : 'Target'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The big reading */}
      <View className="mt-10 items-center">
        <Text {...COMPACT_TEXT} className="text-xs font-semibold uppercase tracking-[2px] text-white/45">
          {field === 'weight' ? 'Current weight' : 'Target weight'}
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
          accessibilityLabel={`${field === 'weight' ? 'Current' : 'Target'} weight ruler`}
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
      className={`h-[68px] flex-row items-center gap-3 rounded-xl border px-3 ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
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
      <Text {...COMPACT_TEXT} className={`text-base font-semibold ${selected ? 'text-white' : 'text-white/60'}`}>{label}</Text>
    </Pressable>
  );
}

/** `roomy`: the larger gap under the headline used on the setup screens. */
function Title({ children, hint, roomy }: { children: ReactNode; hint?: string; roomy?: boolean }) {
  // Never blocks: shows right away, and the headline font swaps in once loaded.
  const [fontsLoaded] = useFonts({ Exo2_900Black });
  return (
    <View className={roomy ? 'mb-10' : 'mb-5'}>
      <Text
        {...COMPACT_TEXT}
        style={fontsLoaded ? { fontFamily: 'Exo2_900Black' } : { fontWeight: '900' }}
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
}: {
  mode: 'setup' | 'edit';
  onDone?: () => void;
  /** Setup only: shows "Skip" at the top right. */
  onSkip?: () => void;
  skipping?: boolean;
  skipError?: string | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const { profile, save } = useProfile();

  const [form, setForm] = useState<Form>(() => initialForm(profile, mode === 'setup' ? new Date().getFullYear() - 25 : undefined));
  const [step, setStep] = useState(0);
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
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
  const sexProblem = (): string | null => (!form.sex ? 'Choose your sex.' : null);
  const birthProblem = (): string | null => {
    const birth = toBirthDate(form.day, form.month, form.year);
    if (!birth) return 'Enter your date of birth as day, month and a 4-digit year.';
    const age = ageOn(birth, todayKey());
    if (age < 12 || age > 100) return 'Age must be between 12 and 100.';
    return null;
  };
  const heightProblem = (): string | null => {
    const height = parseDecimal(form.height);
    if (height == null || height < 100 || height > 250) return 'Enter your height in cm (100 to 250).';
    return null;
  };

  /** Returns a sentence for the first problem in a section, or null when it is fine. */
  const problemIn = (section: number): string | null => {
    if (section === 0 && !form.goal) return 'Choose what you want to achieve.';
    if (section === 1) return sexProblem() ?? birthProblem() ?? heightProblem();
    if (section === 2) {
      const weight = parseDecimal(form.weight);
      const target = parseDecimal(form.target);
      if (weight == null || weight < 25 || weight > 300) return 'Enter your current weight in kg (25 to 300).';
      if (target == null || target < 25 || target > 300) return 'Enter your target weight in kg (25 to 300).';
      if (form.goal === 'lose' && target >= weight) return 'To lose weight, your target must be lower than your current weight.';
      if (form.goal === 'gain' && target <= weight) return 'To gain weight, your target must be higher than your current weight.';
      if (form.goal === 'maintain' && Math.abs(target - weight) > 5) return 'To stay at your weight, keep your target within 5 kg of it.';
    }
    if (section === 3) {
      if (!form.activity) return 'Choose how active you are.';
      if (!form.diet) return 'Choose your food preference.';
    }
    return null;
  };

  /** The setup screen to show for a problem found in section `section` of the edit page. */
  const setupStepFor = (section: number): number => {
    if (section === 1) return sexProblem() ? 1 : birthProblem() ? 2 : 3;
    if (section === 3) return form.activity ? 6 : 5;
    return [0, 1, 4, 5, 6][section];
  };

  /** The problem with the answer on setup screen `index`, or null. */
  const setupProblem = (index: number): string | null => {
    switch (SETUP_STEPS[index]) {
      case 'goal': return problemIn(0);
      case 'sex': return sexProblem();
      case 'birth': return birthProblem();
      case 'height': return heightProblem();
      case 'weight': return problemIn(2);
      case 'activity': return form.activity ? null : 'Choose how active you are.';
      case 'diet': return form.diet ? null : 'Choose your food preference.';
      default: return null;
    }
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const problem = problemIn(i);
      if (problem) {
        setError(problem);
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
        day: todayKey(),
      });
      // Setup: the app switches to the main screens by itself. Edit: go back.
      onDone?.();
    } catch (e) {
      setError(messageFrom(e));
      setBusy(false);
    }
  };

  const next = () => {
    const problem = setupProblem(step);
    if (problem) return setError(problem);
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
        What do you want to <Text style={{ color: BRAND }}>achieve?</Text>
      </Title>
      <View className="gap-3">
        {GOAL_CARDS.map((c) => (
          <GoalCard
            key={c.goal}
            label={GOAL_LABEL[c.goal]}
            hint={c.hint}
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
      <Title hint="Your dietitian uses this to work out how much you need to eat.">Tell us about you</Title>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">Sex</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(SEX_LABEL) as Sex[]).map((s) => (
            <Chip key={s} label={SEX_LABEL[s]} selected={form.sex === s} onPress={() => set('sex', s)} />
          ))}
        </View>
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">Date of birth</Text>
        <View className="flex-row gap-3">
          <Field flex label="Day" value={form.day} onChangeText={(t) => set('day', t.replace(/\D/g, '').slice(0, 2))} placeholder="DD" keyboardType="number-pad" />
          <Field flex label="Month" value={form.month} onChangeText={(t) => set('month', t.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" />
          <Field flex label="Year" value={form.year} onChangeText={(t) => set('year', t.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" keyboardType="number-pad" />
        </View>
      </View>
      <Field label="Height" value={form.height} onChangeText={(t) => set('height', t)} placeholder="e.g. 172" keyboardType="decimal-pad" suffix="cm" />
    </View>,
    // 2 weight
    <View key="weight" className="gap-5">
      <Title roomy={mode === 'setup'} hint="Be honest: this is just between you and your dietitian.">Your weight</Title>
      <Field label="Current weight" value={form.weight} onChangeText={(t) => set('weight', t)} placeholder="e.g. 82.5" keyboardType="decimal-pad" suffix="kg" />
      <Field label="Target weight" value={form.target} onChangeText={(t) => set('target', t)} placeholder="e.g. 75" keyboardType="decimal-pad" suffix="kg" />
      {delta != null && delta > 0 && form.goal && form.goal !== 'maintain' ? (
        <View className="rounded-xl bg-white/5 p-4">
          <Text {...COMPACT_TEXT} className="text-sm text-white">
            You want to {form.goal === 'lose' ? 'lose' : 'gain'} <Text style={{ color: BRAND }} className="font-bold">{fmtKg(delta)}</Text>.
          </Text>
        </View>
      ) : null}
    </View>,
    // 3 lifestyle
    <View key="life" className="gap-5">
      <Title roomy={mode === 'setup'} hint="So the plan fits your day and your food.">Your lifestyle</Title>
      <View className="gap-2">
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">How active are you?</Text>
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => {
          const selected = form.activity === a;
          return (
            <Pressable
              key={a}
              onPress={() => set('activity', a)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-xl border-2 px-4 py-3 ${selected ? 'border-[#3ddc68] bg-[#3ddc68]/10' : 'border-transparent bg-white/5'}`}>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{ACTIVITY_LABEL[a].title}</Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted">{ACTIVITY_LABEL[a].hint}</Text>
              </View>
              {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={BRAND} size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">What do you eat?</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(DIET_LABEL) as DietType[]).map((d) => (
            <Chip key={d} label={DIET_LABEL[d]} selected={form.diet === d} onPress={() => set('diet', d)} />
          ))}
        </View>
      </View>
    </View>,
    // 4 health + consent
    <View key="health" className="gap-5">
      <Title roomy={mode === 'setup'} hint="Optional, but it helps your dietitian keep your plan safe.">Health and privacy</Title>
      <Field label="Food allergies or foods to avoid" value={form.allergies} onChangeText={(t) => set('allergies', t)} placeholder="e.g. peanuts, lactose" multiline maxLength={300} />
      <Field label="Medical conditions or medicines" value={form.medical} onChangeText={(t) => set('medical', t)} placeholder="e.g. diabetes, thyroid, BP" multiline maxLength={500} />
      <View className="flex-row items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">Share with my dietitian</Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-xs leading-4 text-muted">
            Your dietitian can see these answers, your weight and your workouts, and post a diet plan for you. You can switch this off any time in your profile.
          </Text>
        </View>
        <Switch
          value={form.share}
          onValueChange={(v) => set('share', v)}
          trackColor={{ false: '#3a3a42', true: BRAND }}
          thumbColor="#ffffff"
          accessibilityLabel="Share with my dietitian"
        />
      </View>
    </View>,
  ];

  // Setup screens: one question each. Goal, weight, lifestyle and health reuse the edit-page sections.
  const setupSteps: ReactNode[] = [
    sections[0],
    <View key="sex">
      <Title roomy>
        What is your <Text style={{ color: BRAND }}>gender?</Text>
      </Title>
      <View className="items-center gap-6">
        {SEX_CHOICES.map((s) => (
          <SexCircle key={s} label={SEX_LABEL[s]} icon={SEX_ICON[s]} selected={form.sex === s} onPress={() => set('sex', s)} />
        ))}
      </View>
    </View>,
    <View key="birth">
      <Title roomy>
        When were you <Text style={{ color: BRAND }}>born?</Text>
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
            caption="Day"
            placeholder="DD"
            maxLength={2}
            value={form.day}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 2);
              set('day', v);
              if (v.length === 2) monthRef.current?.focus();
            }}
          />
          <DateBox
            ref={monthRef}
            caption="Month"
            placeholder="MM"
            maxLength={2}
            value={form.month}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 2);
              set('month', v);
              if (v.length === 2) yearRef.current?.focus();
            }}
          />
          <DateBox
            ref={yearRef}
            wide
            caption="Year"
            placeholder="YYYY"
            maxLength={4}
            value={form.year}
            onChangeText={(t) => set('year', t.replace(/\D/g, '').slice(0, 4))}
          />
        </View>
      )}
    </View>,
    <View key="height">
      <Title roomy>
        How <Text style={{ color: BRAND }}>tall</Text> are you?
      </Title>
      <HeightPicker cm={Number(form.height) || 170} onChange={(c) => set('height', String(c))} />
    </View>,
    <View key="weightStep">
      <Title roomy>
        What is your <Text style={{ color: BRAND }}>weight?</Text>
      </Title>
      <WeightPicker
        weight={Number(form.weight) || 70}
        target={Number(form.target) || 70}
        onChange={(field, kg) => set(field, String(kg))}
      />
    </View>,
    <View key="activity">
      <Title roomy>
        How <Text style={{ color: BRAND }}>active</Text> are you?
      </Title>
      <View className="gap-2.5">
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
          <ActivityCard
            key={a}
            title={ACTIVITY_LABEL[a].title}
            hint={ACTIVITY_LABEL[a].hint}
            icon={ACTIVITY_ICON[a]}
            selected={form.activity === a}
            onPress={() => set('activity', a)}
          />
        ))}
      </View>
    </View>,
    <View key="diet">
      <Title roomy>
        What do you <Text style={{ color: BRAND }}>eat?</Text>
      </Title>
      <View className="gap-3">
        {[(['vegetarian', 'non_vegetarian'] as DietType[]), (['eggetarian', 'vegan'] as DietType[])].map((row) => (
          <View key={row[0]} className="flex-row gap-3">
            {row.map((d) => (
              <DietCard key={d} label={DIET_LABEL[d]} icon={DIET_ICON[d]} selected={form.diet === d} onPress={() => set('diet', d)} />
            ))}
          </View>
        ))}
      </View>
    </View>,
  ];

  const lastStep = step === SETUP_STEPS.length - 1;

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
                  accessibilityLabel="Back"
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                  <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
                </Pressable>
              ) : (
                <View className="h-10 w-10" />
              )}
              {onSkip ? (
                <Pressable
                  onPress={onSkip}
                  disabled={busy || skipping}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Skip for now"
                  className="min-w-12 items-end py-1 active:opacity-60">
                  {skipping ? (
                    <ActivityIndicator color={BRAND} size="small" />
                  ) : (
                    <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-sm font-bold">
                      Skip
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
          scrollEnabled={!(mode === 'setup' && (SETUP_STEPS[step] === 'height' || SETUP_STEPS[step] === 'weight'))}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: mode === 'setup' ? 16 : insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          {mode === 'setup' ? (
            <View className="mb-6">
              <View className="flex-row items-center justify-between">
                <Text {...COMPACT_TEXT} style={{ color: BRAND }} className="text-xs font-bold uppercase tracking-[1px]">
                  Step {step + 1} of {SETUP_STEPS.length}
                </Text>
              </View>
              <View className="mt-3 flex-row gap-1.5">
                {SETUP_STEPS.map((name, i) => (
                  <View key={name} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#3ddc68]' : 'bg-white/15'}`} />
                ))}
              </View>
            </View>
          ) : (
            <View className="mb-4 flex-row items-center gap-3">
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
              </Pressable>
              <Text className="text-[28px] font-bold tracking-tight text-white">Your fitness profile</Text>
            </View>
          )}

          {mode === 'setup' ? setupSteps[step] : <>
            <Text className="mb-6 text-sm leading-6 text-muted">Open a section to update your details. These help personalize your progress and diet plan.</Text>
            <View className="gap-3">
              {sections.map((section, i) => (
                <View key={STEPS[i]} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <Pressable onPress={() => setOpenSection((current) => current === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: openSection === i }} className="flex-row items-center justify-between gap-3 p-5">
                    <View className="flex-row items-center gap-3">
                      <View className={`h-8 w-8 items-center justify-center rounded-full ${openSection === i ? 'bg-[#3ddc68]/15' : 'bg-white/10'}`}>
                        <Text className={`text-xs font-semibold ${openSection === i ? 'text-[#3ddc68]' : 'text-white/60'}`}>{i + 1}</Text>
                      </View>
                      <Text className="text-base font-semibold text-white">{STEPS[i]}</Text>
                    </View>
                    <SymbolView name={openSection === i ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#9ba2ac" size={16} />
                  </Pressable>
                  {openSection === i ? <View className="border-t border-white/5 p-5">{section}</View> : null}
                </View>
              ))}
            </View>
          </>}

          {error ? (
            <View accessibilityRole="alert" className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{error}</Text>
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
              <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
                {mode === 'setup' ? (lastStep ? 'Save profile' : 'Continue') : 'Save changes'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
