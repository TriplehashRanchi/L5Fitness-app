import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { BodyAvatar } from '@/components/body-avatar';
import { CompleteProfileButton, DIET_AFTER_PROFILE } from '@/components/complete-profile-button';
import { bmi } from '@/lib/body';
import { dayCounts } from '@/lib/day-plan';
import { MEAL_LABEL, type DayItem, type MealType, type MyDay } from '@/lib/fitness-api';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { calorieSummary, nextTask } from '@/lib/today-tasks';
import { formatWater } from '@/lib/water';
import { SLOT_LABEL, SLOT_ORDER } from '@/lib/wellness-api';
import { useProfile } from '@/providers/profile-provider';

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
const PHOTO_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Which part of the day is open. One at a time, so the day stays a short list. */
const OpenPart = createContext<{ open: string | null; setOpen: (title: string | null) => void }>({ open: null, setOpen: () => {} });

/**
 * One part of the day as a row in the day's list: its icon, its name and where it stands. Tapping the row
 * opens it in place to show the detail and the things to do; opening one closes the one that was open.
 */
function Section({
  icon,
  color,
  title,
  status,
  done,
  first,
  children,
}: {
  icon: SymbolViewProps['name'];
  color: string;
  title: string;
  status?: string | null;
  done?: boolean;
  /** the first row has no line above it */
  first?: boolean;
  children: ReactNode;
}) {
  const { open, setOpen } = useContext(OpenPart);
  const shown = open === title;
  return (
    <View style={first ? null : { borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <Pressable
        onPress={() => setOpen(shown ? null : title)}
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        accessibilityLabel={`${title}${done ? ', done' : ''}${status ? `, ${status}` : ''}`}
        className="flex-row items-center active:opacity-60"
        style={{ gap: 12, minHeight: 66, paddingHorizontal: 16 }}>
        <View
          className="items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            borderWidth: done ? 0 : 1,
            borderColor: 'rgba(255,255,255,0.14)',
            backgroundColor: done ? BRAND : 'rgba(255,255,255,0.04)',
          }}>
          <SymbolView name={done ? { ios: 'checkmark', android: 'check', web: 'check' } : icon} tintColor={done ? INK : '#e8efe9'} size={done ? 16 : 18} />
        </View>
        <View className="flex-1">
          <Text {...COMPACT_TEXT} accessibilityRole="header" className={`font-bold ${done ? 'text-muted' : 'text-white'}`} style={{ fontSize: 16 }}>
            {title}
          </Text>
          {/* the number is always on the row, so nothing has to be opened to see how the day stands */}
          {done || status ? (
            <Text {...COMPACT_TEXT} numberOfLines={1} className="font-semibold" style={{ fontSize: 13, marginTop: 1, color: done ? color : MUTED }}>
              {done ? (status ? `Done · ${status}` : 'Done') : status}
            </Text>
          ) : null}
        </View>
        <SymbolView
          name={shown ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
          tintColor={MUTED}
          size={12}
        />
      </Pressable>
      {shown ? <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>{children}</View> : null}
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

function WorkoutSection({ day, onStart }: { day: MyDay; onStart?: () => void }) {
  const [open, setOpen] = useState(false);
  const t = day.training;
  const icon = { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' } as const;
  if (!t) {
    return (
      <Section first icon={icon} color={BRAND} title="Workout">
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
    <Section first icon={icon} color={BRAND} title="Workout" status={`${t.title} · ${t.durationMin} min`} done={t.done}>
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

      {!t.done && onStart ? (
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

function MealsSection({
  day,
  locale,
  pending,
  canTick,
  onToggle,
  first,
}: {
  /** nothing sits above it */
  first?: boolean;
  day: MyDay;
  locale: string;
  pending: Set<string>;
  canTick: boolean;
  onToggle: (i: DayItem) => void;
}) {
  const slots = SLOT_ORDER.map((slot) => ({ slot, items: day.diet.items.filter((i) => i.mealSlot === slot) })).filter((s) => s.items.length > 0);
  const { planned, ticked } = calorieSummary(day.diet.items);
  const icon = { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } as const;
  if (slots.length === 0) {
    return (
      <Section first={first} icon={icon} color={MEALS} title="Meals">
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
    <Section first={first} icon={icon} color={MEALS} title="Meals" status={`${day.diet.done} of ${day.diet.total}`} done={allDone}>
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
                disabled={busy || !canTick}
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

/** One line of the water explanation: what the number is, then the number. */
function WaterFact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text {...COMPACT_TEXT} className="font-bold uppercase text-muted" style={{ fontSize: 10, letterSpacing: 1.1 }}>
        {label}
      </Text>
      <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="font-bold" style={{ fontSize: strong ? 28 : 17, lineHeight: strong ? 34 : 23, color: strong ? WATER : '#ffffff' }}>
        {value}
      </Text>
    </View>
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
  onDrink?: (ml: number) => void;
  onUndo?: () => void;
}) {
  const { totalMl, goalMl } = day.water;
  const hasGoal = goalMl > 0;
  const done = hasGoal && totalMl >= goalMl;
  const left = Math.max(0, goalMl - totalMl);
  const glassesLeft = Math.ceil(left / GLASS_ML);
  const percent = hasGoal ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  const { profile } = useProfile();
  const bmiValue = profile?.weightKg && profile?.heightCm ? bmi(profile.weightKg, profile.heightCm) : null;
  return (
    <Section
      icon={{ ios: 'drop', android: 'water_drop', web: 'water_drop' }}
      color={WATER}
      title="Water"
      status={hasGoal ? `${formatWater(totalMl)} of ${formatWater(goalMl)}` : formatWater(totalMl)}
      done={done}>
      {/* The same body as on Home: it fills from the feet up as the day's water goal fills. */}
      <View className="flex-row items-center" style={{ gap: 16 }}>
        <BodyAvatar
          bmi={bmiValue}
          sex={profile?.sex}
          fill={hasGoal ? Math.min(1, totalMl / goalMl) : 0}
          color="#38e1f5"
          height={230}
          maxWidth={130}
          label={`Body filled ${percent} percent with water`}
        />
        <View className="flex-1" style={{ gap: 12 }}>
          <WaterFact strong label="Drunk so far" value={formatWater(totalMl)} />
          {hasGoal ? (
            <>
              <WaterFact label="Goal for the day" value={formatWater(goalMl)} />
              <WaterFact label={done ? 'Goal reached' : 'Still to drink'} value={done ? `${percent}%` : `${formatWater(left)} · about ${glassesLeft} ${glassesLeft === 1 ? 'glass' : 'glasses'}`} />
            </>
          ) : null}
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
            {done ? 'The body is full: you drank everything planned for this day.' : 'The body fills as you drink. A full body means the goal is reached.'}
          </Text>
        </View>
      </View>
      {onDrink ? (
        <>
      <View className="flex-row items-center" style={{ gap: 8, marginTop: 16 }}>
        <Pressable
          onPress={() => onDrink?.(GLASS_ML)}
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
          onPress={() => onDrink?.(500)}
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
        </>
      ) : null}
    </Section>
  );
}

function PhotosSection({ day, onAdd }: { day: MyDay; onAdd?: (type: MealType) => void }) {
  const count = day.meals.length;
  return (
    <Section icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} color={BRAND} title="Meal photos" status={count > 0 ? `${count} added` : onAdd ? 'For your coach' : 'None'}>
      <View className="flex-row" style={{ gap: 10 }}>
        {PHOTO_TYPES.map((type) => {
          const mine = day.meals.filter((m) => m.mealType === type);
          const shot = mine.find((m) => m.photoUrl) ?? mine[0];
          return (
            <Pressable
              key={type}
              onPress={() => onAdd?.(type)}
              disabled={!onAdd}
              accessibilityRole={onAdd ? 'button' : 'image'}
              accessibilityLabel={`${MEAL_LABEL[type]}: ${mine.length ? `${mine.length} added${onAdd ? ', add another' : ''}` : onAdd ? 'add a photo' : 'no photo'}`}
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
                  <SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} tintColor={onAdd ? MUTED : 'rgba(143,163,150,0.35)'} size={20} />
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

function StepsSection({ day, locale, onOpen }: { day: MyDay; locale: string; onOpen?: () => void }) {
  const { stepsDone } = dayCounts(day);
  const { value, goal } = day.steps;
  const ratio = value != null && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : 'text'}
      accessibilityLabel={`Steps, ${value == null ? 'not counted' : value.toLocaleString(locale)}${goal > 0 ? ` of ${goal.toLocaleString(locale)}` : ''}${onOpen ? '. Opens steps' : ''}`}
      className="active:opacity-80">
      <Section
        icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
        color={STEPS}
        title="Steps"
        status={value == null ? 'Not counted yet' : goal > 0 ? `${value.toLocaleString(locale)} of ${goal.toLocaleString(locale)}` : value.toLocaleString(locale)}
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
          {onOpen ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} /> : null}
        </View>
        <View className="overflow-hidden rounded-full" style={{ height: 8, marginTop: 10, backgroundColor: TRACK }}>
          <View style={{ height: 8, borderRadius: 4, width: `${ratio * 100}%`, backgroundColor: STEPS }} />
        </View>
        {onOpen ? (
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
            {value == null ? 'Not synced yet. Tap to open.' : 'Counted by your phone. Tap for history.'}
          </Text>
        ) : null}
      </Section>
    </Pressable>
  );
}

export type ChecklistProps = {
  day: MyDay;
  locale: string;
  pending: Set<string>;
  onToggle: (item: DayItem) => void;
  /** false = the meals are shown but cannot be ticked (a day that has not come yet). Default true. */
  canTick?: boolean;
  // Each of these is optional: leave one out and that card only shows the day (used for past days in Activity).
  onStart?: () => void;
  onDrink?: (ml: number) => void;
  onUndoDrink?: () => void;
  waterBusy?: boolean;
  lastDrinkMl?: number | null;
  onOpenSteps?: () => void;
  onAddPhoto?: (type: MealType) => void;
  /** Leave the workout row out. */
  hideWorkout?: boolean;
  /** No card around it: the rows sit straight on the page, lined up with the page's own margin. */
  plain?: boolean;
};

const PART_OF = { workout: 'Workout', meal: 'Meals', water: 'Water', steps: 'Steps' } as const;

/**
 * The day as one list: workout, meals, meal photos, water, steps. Each is a row that opens in place.
 * The first thing still to do starts open; when everything is done, all rows start closed.
 */
export function Checklist({ day, locale, pending, onToggle, canTick = true, onStart, onDrink, onUndoDrink, waterBusy = false, lastDrinkMl = null, onOpenSteps, onAddPhoto, hideWorkout = false, plain = false }: ChecklistProps) {
  const [open, setOpen] = useState<string | null>(() => {
    const next = nextTask(day);
    return next && !(hideWorkout && next.kind === 'workout') ? PART_OF[next.kind] : null;
  });
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <OpenPart.Provider value={value}>
      <View
        className={plain ? 'mb-4' : 'mx-5 mb-4 overflow-hidden rounded-3xl border border-white/5 bg-card'}
        // the rows carry 16 of their own side padding, so 4 more lines them up with the page's 20
        style={plain ? { marginHorizontal: 4, borderTopWidth: 1, borderTopColor: HAIRLINE } : undefined}>
        {hideWorkout ? null : <WorkoutSection day={day} onStart={onStart} />}
        <MealsSection first={hideWorkout} day={day} locale={locale} pending={pending} canTick={canTick} onToggle={onToggle} />
        <PhotosSection day={day} onAdd={onAddPhoto} />
        <WaterSection day={day} busy={waterBusy} lastDrinkMl={lastDrinkMl} onDrink={onDrink} onUndo={onUndoDrink} />
        <StepsSection day={day} locale={locale} onOpen={onOpenSteps} />
      </View>
    </OpenPart.Provider>
  );
}
