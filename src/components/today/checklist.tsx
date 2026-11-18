import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { CompleteProfileButton, DIET_AFTER_PROFILE } from '@/components/complete-profile-button';
import { dayCounts } from '@/lib/day-plan';
import { MEAL_LABEL, type DayItem, type MealType, type MyDay } from '@/lib/fitness-api';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { calorieSummary } from '@/lib/today-tasks';
import { formatWater } from '@/lib/water';
import { SLOT_LABEL, SLOT_ORDER } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const WATER = '#38bdf8';
const STEPS = '#fbbf24';
const MEALS = '#fb923c';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const TRACK = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const GLASS_ML = 250;
const MAX_GLASSES = 16;
const PHOTO_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** A card with a coloured icon, a title, and a short status on the right. */
function Section({
  icon,
  color,
  title,
  status,
  done,
  children,
}: {
  icon: SymbolViewProps['name'];
  color: string;
  title: string;
  status?: string | null;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="mx-5 mb-4 rounded-3xl border border-white/5 bg-card" style={{ padding: 16 }}>
      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 12 }}>
        <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${color}26` }}>
          <SymbolView name={icon} tintColor={color} size={18} />
        </View>
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold text-white" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {done ? (
          <View className="flex-row items-center rounded-full" style={{ gap: 5, paddingHorizontal: 10, height: 26, backgroundColor: `${color}26` }}>
            <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={color} size={11} />
            <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 12, color }}>
              Done
            </Text>
          </View>
        ) : status ? (
          <Text {...COMPACT_TEXT} className="font-bold text-muted" style={{ fontSize: 13 }}>
            {status}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A round tick box that pops a little when it gets ticked. */
function Tick({ done }: { done: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current && !reduced) scale.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 9 }));
    was.current = done;
  }, [done, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      className="items-center justify-center"
      style={[{ width: 30, height: 30, borderRadius: 15, borderWidth: done ? 0 : 2, borderColor: 'rgba(143,163,150,0.7)', backgroundColor: done ? BRAND : 'transparent' }, style]}>
      {done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={15} /> : null}
    </Animated.View>
  );
}

function WorkoutSection({ day, onStart }: { day: MyDay; onStart: () => void }) {
  const [open, setOpen] = useState(false);
  const t = day.training;
  const icon = { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' } as const;
  if (!t) {
    return (
      <Section icon={icon} color={BRAND} title="Workout">
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
          {day.coaching.status === 'accepted' ? 'No workout planned for today.' : emptyPlanCopy(day.coaching, false).line}
        </Text>
        <CompleteProfileButton coaching={day.coaching} />
      </Section>
    );
  }
  const lines = (t.instructions ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean);
  return (
    <Section icon={icon} color={BRAND} title="Workout" done={t.done}>
      <Text {...COMPACT_TEXT} className={`font-bold ${t.done ? 'text-muted' : 'text-white'}`} style={{ fontSize: 20, lineHeight: 26 }}>
        {t.title}
      </Text>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
        {t.durationMin} min · {t.kcal} kcal{lines.length ? ` · ${lines.length} steps` : ''}
      </Text>

      {lines.length ? (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Hide exercises' : 'Show exercises'}
          className="flex-row items-center self-start active:opacity-60"
          style={{ gap: 6, minHeight: 40 }}>
          <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
            {open ? 'Hide exercises' : 'Show exercises'}
          </Text>
          <SymbolView name={open ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor={BRAND} size={11} />
        </Pressable>
      ) : null}
      {open
        ? lines.map((l, i) => (
            <View key={i} className="flex-row" style={{ gap: 10, paddingVertical: 5 }}>
              <Text {...COMPACT_TEXT} className="font-bold text-muted" style={{ fontSize: 13, width: 18, lineHeight: 21 }}>
                {i + 1}
              </Text>
              <Text selectable {...COMPACT_TEXT} className="flex-1 text-white" style={{ fontSize: 14, lineHeight: 21 }}>
                {l}
              </Text>
            </View>
          ))
        : null}

      {!t.done ? (
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Start workout"
          className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
          style={{ gap: 8, minHeight: 52, marginTop: lines.length ? 6 : 14 }}>
          <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} tintColor={INK} size={15} />
          <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
            Start workout
          </Text>
        </Pressable>
      ) : null}
    </Section>
  );
}

function MealsSection({ day, locale, pending, onToggle }: { day: MyDay; locale: string; pending: Set<string>; onToggle: (i: DayItem) => void }) {
  const slots = SLOT_ORDER.map((slot) => ({ slot, items: day.diet.items.filter((i) => i.mealSlot === slot) })).filter((s) => s.items.length > 0);
  const { planned, ticked } = calorieSummary(day.diet.items);
  const icon = { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } as const;
  if (slots.length === 0) {
    return (
      <Section icon={icon} color={MEALS} title="Meals">
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
          {day.coaching.status === 'accepted'
            ? 'No diet plan has been added for today yet.'
            : day.coaching.status === 'not_shared'
              ? DIET_AFTER_PROFILE
              : emptyPlanCopy(day.coaching, false).line}
        </Text>
      </Section>
    );
  }
  const allDone = day.diet.done >= day.diet.total;
  return (
    <Section icon={icon} color={MEALS} title="Meals" status={`${day.diet.done} of ${day.diet.total}`} done={allDone}>
      {slots.map(({ slot, items }, s) => (
        <View key={slot} style={{ marginTop: s === 0 ? 0 : 10 }}>
          <Text {...COMPACT_TEXT} className="font-bold uppercase text-muted" style={{ fontSize: 11, letterSpacing: 1, marginBottom: 2 }}>
            {SLOT_LABEL[slot]}
          </Text>
          {items.map((item, i) => {
            const busy = pending.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => onToggle(item)}
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done, busy }}
                accessibilityLabel={`${SLOT_LABEL[slot]} ${item.title}${item.calories ? `, ${item.calories} calories` : ''}, ${item.done ? 'done' : 'not done'}`}
                className="flex-row items-center active:opacity-70"
                style={{ gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
                <Tick done={item.done} />
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} className={`font-semibold ${item.done ? 'text-muted line-through' : 'text-white'}`} style={{ fontSize: 16 }}>
                    {item.title}
                  </Text>
                  {item.details ? (
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 1 }}>
                      {item.details}
                    </Text>
                  ) : null}
                </View>
                {item.calories ? (
                  <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 12 }}>
                    {item.calories} kcal
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      {planned > 0 ? (
        <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
          <View className="overflow-hidden rounded-full" style={{ height: 6, backgroundColor: TRACK }}>
            <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (ticked / planned) * 100)}%`, backgroundColor: MEALS }} />
          </View>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
            <Text className="font-bold text-white">{ticked.toLocaleString(locale)}</Text> of {planned.toLocaleString(locale)} kcal eaten
          </Text>
        </View>
      ) : null}
    </Section>
  );
}

/** One drinking glass, filled from the bottom by `fill` (0 to 1). */
function Glass({ fill, id }: { fill: number; id: string }) {
  const shape = 'M3 2 H21 L18.6 28 Q18.5 30 16.5 30 H7.5 Q5.5 30 5.4 28 Z';
  const top = 2 + 28 * (1 - fill);
  return (
    <Svg width={26} height={34} viewBox="0 0 24 32">
      <Defs>
        <ClipPath id={id}>
          <Path d={shape} />
        </ClipPath>
      </Defs>
      <Path d={shape} fill="rgba(56,189,248,0.08)" />
      {fill > 0 ? <Rect x={0} y={top} width={24} height={32 - top} fill={WATER} clipPath={`url(#${id})`} /> : null}
      <Path d={shape} fill="none" stroke={fill > 0 ? WATER : 'rgba(143,163,150,0.55)'} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

function WaterSection({
  day,
  busy,
  lastDrinkMl,
  onDrink,
  onUndo,
}: {
  day: MyDay;
  busy: boolean;
  lastDrinkMl: number | null;
  onDrink: (ml: number) => void;
  onUndo: () => void;
}) {
  const { totalMl, goalMl } = day.water;
  const hasGoal = goalMl > 0;
  const done = hasGoal && totalMl >= goalMl;
  const glasses = Math.min(MAX_GLASSES, Math.max(1, Math.ceil((hasGoal ? goalMl : 2000) / GLASS_ML)));
  const left = Math.max(0, goalMl - totalMl);
  return (
    <Section
      icon={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }}
      color={WATER}
      title="Water"
      status={hasGoal ? `${formatWater(left)} to go` : null}
      done={done}>
      <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 28, lineHeight: 34 }} accessibilityLabel={hasGoal ? `${formatWater(totalMl)} of ${formatWater(goalMl)}` : formatWater(totalMl)}>
        {formatWater(totalMl)}
        {hasGoal ? (
          <Text className="font-semibold text-muted" style={{ fontSize: 15 }}>
            {' '}
            of {formatWater(goalMl)}
          </Text>
        ) : null}
      </Text>

      <View className="flex-row flex-wrap" style={{ marginTop: 12, marginHorizontal: -4 }}>
        {Array.from({ length: glasses }, (_, i) => {
          const fill = Math.min(1, Math.max(0, (totalMl - i * GLASS_ML) / GLASS_ML));
          return (
            <Pressable
              key={i}
              onPress={() => onDrink(GLASS_ML)}
              disabled={busy || fill >= 1}
              accessibilityRole="button"
              accessibilityLabel={fill >= 1 ? `Glass ${i + 1}, drunk` : `Glass ${i + 1}, tap to add ${GLASS_ML} millilitres`}
              className="items-center justify-center active:opacity-60"
              style={{ width: '12.5%', height: 46 }}>
              <Glass fill={fill} id={`glass-${i}`} />
            </Pressable>
          );
        })}
      </View>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
        Tap a glass to add {GLASS_ML} ml
      </Text>

      <View className="flex-row items-center" style={{ gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => onDrink(GLASS_ML)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Add ${GLASS_ML} millilitres of water`}
          className="flex-1 flex-row items-center justify-center rounded-full active:opacity-80"
          style={{ gap: 6, minHeight: 48, backgroundColor: WATER, opacity: busy ? 0.6 : 1 }}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={INK} size={13} />
          <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 15 }}>
            1 glass
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDrink(500)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add 500 millilitres of water"
          className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
          style={{ minHeight: 48, paddingHorizontal: 18, opacity: busy ? 0.6 : 1 }}>
          <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 14, color: WATER }}>
            +500 ml
          </Text>
        </Pressable>
        {lastDrinkMl ? (
          <Pressable
            onPress={onUndo}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Undo last drink, ${lastDrinkMl} millilitres`}
            className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
            style={{ minHeight: 48, paddingHorizontal: 16, opacity: busy ? 0.6 : 1 }}>
            <Text {...COMPACT_TEXT} className="font-bold text-muted" style={{ fontSize: 14 }}>
              Undo
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Section>
  );
}

function PhotosSection({ day, onAdd }: { day: MyDay; onAdd: (type: MealType) => void }) {
  const count = day.meals.length;
  return (
    <Section icon={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} color={BRAND} title="Meal photos" status={count > 0 ? `${count} added` : 'For your coach'}>
      <View className="flex-row" style={{ gap: 10 }}>
        {PHOTO_TYPES.map((type) => {
          const mine = day.meals.filter((m) => m.mealType === type);
          const shot = mine.find((m) => m.photoUrl) ?? mine[0];
          return (
            <Pressable
              key={type}
              onPress={() => onAdd(type)}
              accessibilityRole="button"
              accessibilityLabel={`${MEAL_LABEL[type]}: ${mine.length ? `${mine.length} added, add another` : 'add a photo'}`}
              className="flex-1 active:opacity-70">
              <View
                className="items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: 1,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: shot ? 0 : 1.5,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(143,163,150,0.45)',
                }}>
                {shot?.photoUrl ? (
                  <Image
                    source={{ uri: shot.photoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                    recyclingKey={shot.id}
                    accessibilityIgnoresInvertColors
                  />
                ) : shot ? (
                  <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={BRAND} size={20} />
                ) : (
                  <SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} tintColor={MUTED} size={20} />
                )}
                {shot ? (
                  <View className="absolute items-center justify-center" style={{ right: 5, top: 5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: BRAND }}>
                    {mine.length > 1 ? (
                      <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 11 }}>
                        {mine.length}
                      </Text>
                    ) : (
                      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={10} />
                    )}
                  </View>
                ) : null}
              </View>
              <Text {...COMPACT_TEXT} className={`text-center font-semibold ${shot ? 'text-white' : 'text-muted'}`} style={{ fontSize: 12, marginTop: 6 }} numberOfLines={1}>
                {MEAL_LABEL[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

function StepsSection({ day, locale, onOpen }: { day: MyDay; locale: string; onOpen: () => void }) {
  const { stepsDone } = dayCounts(day);
  const { value, goal } = day.steps;
  const ratio = value != null && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Steps, ${value == null ? 'not synced yet' : value.toLocaleString(locale)}${goal > 0 ? ` of ${goal.toLocaleString(locale)}` : ''}. Opens steps`}
      className="active:opacity-80">
      <Section
        icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
        color={STEPS}
        title="Steps"
        status={goal > 0 && value != null ? `${Math.max(0, goal - value).toLocaleString(locale)} to go` : null}
        done={stepsDone}>
        <View className="flex-row items-end justify-between">
          <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 28, lineHeight: 34 }}>
            {value == null ? '–' : value.toLocaleString(locale)}
            {goal > 0 ? (
              <Text className="font-semibold text-muted" style={{ fontSize: 15 }}>
                {' '}
                of {goal.toLocaleString(locale)}
              </Text>
            ) : null}
          </Text>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
        </View>
        <View className="overflow-hidden rounded-full" style={{ height: 8, marginTop: 10, backgroundColor: TRACK }}>
          <View style={{ height: 8, borderRadius: 4, width: `${ratio * 100}%`, backgroundColor: STEPS }} />
        </View>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          {value == null ? 'Not synced yet. Tap to open.' : 'Counted by your phone. Tap for history.'}
        </Text>
      </Section>
    </Pressable>
  );
}

export type ChecklistProps = {
  day: MyDay;
  locale: string;
  pending: Set<string>;
  onToggle: (item: DayItem) => void;
  onStart: () => void;
  onDrink: (ml: number) => void;
  onUndoDrink: () => void;
  waterBusy: boolean;
  lastDrinkMl: number | null;
  onOpenSteps: () => void;
  onAddPhoto: (type: MealType) => void;
};

/** The day, one card per thing: workout, meals to tick, meal photos, water glasses, steps. */
export function Checklist({ day, locale, pending, onToggle, onStart, onDrink, onUndoDrink, waterBusy, lastDrinkMl, onOpenSteps, onAddPhoto }: ChecklistProps) {
  return (
    <>
      <WorkoutSection day={day} onStart={onStart} />
      <MealsSection day={day} locale={locale} pending={pending} onToggle={onToggle} />
      <PhotosSection day={day} onAdd={onAddPhoto} />
      <WaterSection day={day} busy={waterBusy} lastDrinkMl={lastDrinkMl} onDrink={onDrink} onUndo={onUndoDrink} />
      <StepsSection day={day} locale={locale} onOpen={onOpenSteps} />
    </>
  );
}
