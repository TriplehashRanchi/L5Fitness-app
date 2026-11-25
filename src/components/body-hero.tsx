import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { BodyAvatar } from '@/components/body-avatar';
import { DisplayText } from '@/components/display-text';
import { bmi, bmiCategory } from '@/lib/body';
import type { Home } from '@/lib/fitness-api';
import { playSound } from '@/lib/sounds';
import { formatWater, waterPercent } from '@/lib/water';
import { useProfile } from '@/providers/profile-provider';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.2 } as const;
const WATER = '#38e1f5';
const CAL = '#ffb347';
const BURN = '#ff7a59';
/** What a logged meal counts as when nobody has written its calories: an ordinary portion of each kind. */
const TYPICAL_KCAL: Record<string, number> = { breakfast: 350, lunch: 600, snack: 200, dinner: 600 };
const INK = '#050a07';

/** Width of the water and calories columns either side of the body. */
const SIDE = 94;

const ICON = {
  water: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
} as const;

/**
 * The top of a side column, kept small: how much is done so far and how much is left.
 * No bar or percent: the body itself shows the progress.
 */
function Stat({
  side,
  icon,
  title,
  value,
  unit,
  note,
  percent,
  color,
}: {
  side: 'left' | 'right';
  icon: keyof typeof ICON;
  title: string;
  /** done so far */
  value: string;
  unit?: string;
  /** what is left, or that the goal is met */
  note: string;
  percent: number;
  color: string;
}) {
  const right = side === 'right';
  return (
    <View
      accessible
      accessibilityLabel={`${title}: ${value}${unit ? ` ${unit}` : ''} done, ${note}`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{ alignItems: right ? 'flex-end' : 'flex-start' }}>
      <View className="flex-row items-center gap-1.5" style={{ flexDirection: right ? 'row-reverse' : 'row' }}>
        <SymbolView name={ICON[icon]} tintColor={color} size={13} />
        <Text {...COMPACT_TEXT} className="text-[10px] font-bold uppercase tracking-[1px] text-white/60">
          {title}
        </Text>
      </View>
      <View className="mt-1 flex-row items-baseline gap-1">
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 22, lineHeight: 26 }} className="text-white">
          {value}
        </DisplayText>
        {unit ? (
          <DisplayText {...COMPACT_TEXT} style={{ fontSize: 12, lineHeight: 16 }} className="text-white/70">
            {unit}
          </DisplayText>
        ) : null}
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[11px] font-bold" style={{ color }}>
        {note}
      </Text>
    </View>
  );
}

/** One number in the calories column: a small glass tile with its name and value. */
function Figure({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value} kilocalories`}
      className="items-end justify-center rounded-xl border px-2.5"
      style={{
        height: 44,
        borderColor: strong ? `${color}8c` : 'rgba(255,255,255,0.12)',
        backgroundColor: strong ? `${color}1f` : 'rgba(255,255,255,0.04)',
      }}>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[9px] font-bold uppercase tracking-[1px] text-white/55">
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[13px] font-black" style={{ color, lineHeight: 16 }}>
          {value}
        </Text>
        <Text {...COMPACT_TEXT} className="text-[9px] font-semibold text-white/50">
          kcal
        </Text>
      </View>
    </View>
  );
}

/**
 * Takes back the last drink. Always in the same place, so the column does not jump: dim until there is
 * something to undo, then a clear outlined pill with the undo arrow.
 */
function UndoPill({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Undo the last drink"
      accessibilityState={{ disabled: !enabled }}
      className="flex-row items-center justify-center gap-1.5 rounded-xl border active:opacity-60"
      style={{
        height: 30,
        borderStyle: 'dashed',
        borderColor: enabled ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)',
        backgroundColor: enabled ? 'rgba(255,255,255,0.08)' : 'transparent',
        opacity: enabled ? 1 : 0.45,
      }}>
      <SymbolView name={ICON.undo} tintColor="#ffffff" size={12} />
      <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[11px] font-bold text-white">
        Undo
      </Text>
    </Pressable>
  );
}

/** Amounts on the water wheel: 50 ml steps from a sip to a litre. */
const AMOUNTS_ML = Array.from({ length: 20 }, (_, i) => 50 * (i + 1));
const ROW = 32;

/**
 * Pick how much to add by scrolling: a small wheel with the chosen amount in the lit band in the middle.
 * It snaps to each amount; tapping an amount above or below moves the wheel to it.
 */
function AmountWheel({ value, onChange }: { value: number; onChange: (ml: number) => void }) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const start = Math.max(0, AMOUNTS_ML.indexOf(value));
  const pick = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(AMOUNTS_ML.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ROW)));
    if (AMOUNTS_ML[i] !== value) onChange(AMOUNTS_ML[i]);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Amount of water to add"
      accessibilityValue={{ text: `${value} millilitres` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const i = AMOUNTS_ML.indexOf(value) + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
        if (i < 0 || i >= AMOUNTS_ML.length) return;
        onChange(AMOUNTS_ML[i]);
        ref.current?.scrollTo({ y: i * ROW, animated: true });
      }}
      style={{ height: ROW * 3 }}>
      {/* the lit band that marks the chosen amount */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: ROW,
          height: ROW,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: WATER,
          backgroundColor: 'rgba(56,225,245,0.14)',
        }}
      />
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: start * ROW }}
        contentContainerStyle={{ paddingVertical: ROW }}
        onScroll={pick}
        onMomentumScrollEnd={pick}>
        {AMOUNTS_ML.map((ml, i) => {
          const on = ml === value;
          return (
            <Pressable
              key={ml}
              onPress={() => ref.current?.scrollTo({ y: i * ROW, animated: true })}
              accessible={false}
              style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                {...COMPACT_TEXT}
                numberOfLines={1}
                className="font-bold"
                style={{ fontSize: on ? 14 : 12, color: on ? WATER : 'rgba(255,255,255,0.45)' }}>
                {ml} ml
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* amounts fade out above and below the band */}
      <LinearGradient pointerEvents="none" colors={['#000000', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW * 0.7 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000000']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ROW * 0.7 }} />
    </View>
  );
}

function AddButton({
  color,
  icon,
  label,
  a11y,
  busy,
  disabled,
  onPress,
}: {
  color: string;
  icon: keyof typeof ICON;
  label: string;
  a11y: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  // A glass pill with a solid round badge: the badge is the thing to press, the text says what it adds.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      className="flex-row items-center rounded-full border"
      style={({ pressed }) => ({
        height: 44,
        paddingLeft: 4,
        paddingRight: 8,
        gap: 6,
        borderColor: `${color}8c`,
        backgroundColor: pressed ? `${color}47` : `${color}1f`,
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 34, height: 34, backgroundColor: color, boxShadow: `0px 0px 12px ${color}99` }}>
        {busy ? <ActivityIndicator color={INK} size="small" /> : <SymbolView name={ICON[icon]} tintColor={INK} size={16} weight="bold" />}
      </View>
      <View className="flex-1">
        <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[9px] font-bold uppercase tracking-[1px] text-white/55">
          Add
        </Text>
        <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-[12px] font-black" style={{ color, lineHeight: 15 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function Column({ side, top, children }: { side: 'left' | 'right'; top: ReactNode; children: ReactNode }) {
  return (
    <View
      style={{ position: 'absolute', top: 16, bottom: 16, width: SIDE, [side]: 0, justifyContent: 'space-between' }}>
      {top}
      <View className="gap-1.5">{children}</View>
    </View>
  );
}

/**
 * Top of Home: a body avatar shaped by the member's BMI in the middle, water on its left and calories
 * on its right. The body fills with water as they drink. No card behind it: it stands on the page.
 */
export function BodyHero({
  data,
  steps,
  waterBusy,
  onAddWater,
  onUndoWater,
}: {
  data: Home | null;
  /** today's steps from the phone, or null when not known */
  steps: number | null;
  waterBusy: boolean;
  onAddWater: (ml: number) => void;
  onUndoWater: () => void;
}) {
  const router = useRouter();
  const { profile } = useProfile();
  const { width: screen } = useWindowDimensions();
  const [glass, setGlass] = useState<number>(250);

  // As tall as the space between the two columns allows; the figure is about 0.36 as wide as it is tall.
  const card = Math.min(screen, 840) - 40;
  const avatarHeight = Math.round(Math.min(440, Math.max(330, (card - SIDE * 2 + 20) / 0.33)));

  const bmiValue = profile?.weightKg && profile?.heightCm ? bmi(profile.weightKg, profile.heightCm) : null;

  const water = data?.water ?? null;
  const waterPct = water ? waterPercent(water.totalMl, water.goalMl) : 0;

  // A chime as the water in the body rises. Not on first load, and not when the level goes down (undo).
  const lastLevel = useRef<number | null>(null);
  const loaded = !!water;
  useEffect(() => {
    if (!loaded) return;
    const before = lastLevel.current;
    lastLevel.current = waterPct;
    // Not cancelled if the screen re-renders: the server's confirmation arrives within this short wait.
    if (before !== null && waterPct > before) setTimeout(() => playSound('waterFill', 0.7), 320);
  }, [loaded, waterPct]);
  const [amount, unit] = water ? formatWater(water.totalMl).split(' ') : ['–', undefined];

  // Calories are worked out from what the member did today, not from a target.
  // Eaten: each meal counts once. A meal's ticked-off plan items give its calories when the dietitian wrote
  // them; otherwise a logged meal counts as a typical meal of its kind.
  const items = data?.diet?.items;
  const meals = data?.meals;
  const eaten = useMemo(() => {
    const fromPlan: Record<string, number> = {};
    for (const it of items ?? []) if (it.done && it.calories) fromPlan[it.mealSlot] = (fromPlan[it.mealSlot] ?? 0) + it.calories;
    let total = Object.values(fromPlan).reduce((a, b) => a + b, 0);
    for (const m of meals ?? []) if (!fromPlan[m.mealType]) total += TYPICAL_KCAL[m.mealType] ?? 0;
    return total;
  }, [items, meals]);
  // Walking: about 0.0005 kcal per step per kg, so 10,000 steps at 70 kg is 350 kcal.
  const fromSteps = (steps ?? 0) * 0.0005 * (profile?.weightKg ?? 70);
  const burned = fromSteps;
  // One figure for the day: meals and steps added together (workouts are not shown on Home).
  const totalKcal = eaten + fromSteps;
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  return (
    <View className="mt-3">

      {/* Middle: the body */}
      <View className="items-center pb-3 pt-4">
        <BodyAvatar
          bmi={bmiValue}
          maxWidth={card - SIDE * 2 + 24}
          sex={profile?.sex}
          fill={waterPct / 100}
          color={WATER}
          height={avatarHeight}
          label={`Your body avatar. Water ${waterPct}%${bmiValue ? `, BMI ${bmiValue}` : ''}`}
        />
        {bmiValue ? (
          <Text {...COMPACT_TEXT} className="mt-1 text-[11px] font-semibold text-white/60">
            BMI {bmiValue} · {bmiCategory(bmiValue).label}
          </Text>
        ) : null}
      </View>

      {/* Left: water */}
      <Column
        side="left"
        top={
          <Stat
            side="left"
            icon="water"
            title="Water"
            value={amount}
            unit={unit}
            note={!water ? '–' : water.totalMl >= water.goalMl ? 'Goal reached' : `${formatWater(water.goalMl - water.totalMl)} left`}
            percent={waterPct}
            color={WATER}
          />
        }>
        <UndoPill enabled={!!water?.lastId && !waterBusy} onPress={onUndoWater} />
        <AmountWheel value={glass} onChange={setGlass} />
        <AddButton
          color={WATER}
          icon="water"
          label={`${glass} ml`}
          a11y={`Add ${glass} millilitres of water`}
          busy={waterBusy}
          disabled={!water}
          onPress={() => {
            playSound('waterAdd');
            onAddWater(glass);
          }}
        />
      </Column>

      {/* Right: calories */}
      <Column
        side="right"
        top={
          <View className="gap-2.5">
            <Stat
              side="right"
              icon="flame"
              title="Calories"
              value={fmt(eaten)}
              unit="kcal"
              note={`${fmt(burned)} kcal burned`}
              percent={0}
              color={CAL}
            />
            <AddButton
              color={CAL}
              icon="camera"
              label="Meal"
              a11y="Add a meal"
              // Opens the Add meal page, where the member picks: take a photo, or choose one.
              onPress={() => router.push('/add-meal')}
            />
          </View>
        }>
        <Figure label="Meals" value={fmt(eaten)} color={CAL} />
        <Figure label="Steps" value={fmt(fromSteps)} color={BURN} />
        <Figure label="Total" value={fmt(totalKcal)} color="#ffffff" strong />
      </Column>
    </View>
  );
}
