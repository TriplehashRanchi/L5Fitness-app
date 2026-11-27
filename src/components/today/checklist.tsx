import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { CompleteProfileButton, DIET_AFTER_PROFILE_KEY } from '@/components/complete-profile-button';
import { WaterOrb } from '@/components/today/water-orb';
import { dayCounts } from '@/lib/day-plan';
import { MEAL_LABEL_KEY, type DayItem, type MealType, type MyDay } from '@/lib/fitness-api';
import { splitHighlight } from '@/lib/i18n';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { calorieSummary, nextTask } from '@/lib/today-tasks';
import { formatWater } from '@/lib/water';
import { SLOT_KEY, SLOT_ORDER } from '@/lib/wellness-api';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const WATER = '#38bdf8';
const STEPS = '#fbbf24';
const MEALS = '#fb923c';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const TRACK = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const PHOTO_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

type Part = 'workout' | 'meals' | 'photos' | 'water' | 'steps';

/** Which part of the day is open. One at a time, so the day stays a short list. */
const OpenPart = createContext<{ open: Part | null; setOpen: (part: Part | null) => void }>({ open: null, setOpen: () => {} });

/**
 * One part of the day as a row in the day's list: its icon, its name and where it stands. Tapping the row
 * opens it in place to show the detail and the things to do; opening one closes the one that was open.
 */
function Section({
  part,
  icon,
  color,
  title,
  status,
  done,
  first,
  children,
}: {
  part: Part;
  icon: SymbolViewProps['name'];
  color: string;
  title: string;
  status?: string | null;
  done?: boolean;
  /** the first row has no line above it */
  first?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const { open, setOpen } = useContext(OpenPart);
  const shown = open === part;
  return (
    <View style={first ? null : { borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <Pressable
        onPress={() => setOpen(shown ? null : part)}
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        accessibilityLabel={[title, done ? t('hm.doneLower') : null, status].filter(Boolean).join(', ')}
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
              {done ? (status ? t('hm.doneStatus', { status }) : t('hm.done')) : status}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const training = day.training;
  const icon = { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' } as const;
  if (!training) {
    return (
      <Section part="workout" first icon={icon} color={BRAND} title={t('hm.workout')}>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
          {day.coaching.status === 'accepted' ? t('hm.noWorkoutDay') : emptyPlanCopy(day.coaching, false, t).line}
        </Text>
        <CompleteProfileButton coaching={day.coaching} />
      </Section>
    );
  }
  const lines = (training.instructions ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean);
  return (
    <Section part="workout" first icon={icon} color={BRAND} title={t('hm.workout')} status={t('hm.titleMin', { title: training.title, min: training.durationMin })} done={training.done}>
      <Text {...COMPACT_TEXT} className={`font-bold ${training.done ? 'text-muted' : 'text-white'}`} style={{ fontSize: 20, lineHeight: 26 }}>
        {training.title}
      </Text>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
        {lines.length ? t('hm.minKcalSteps', { min: training.durationMin, kcal: training.kcal, n: lines.length }) : t('hm.minKcal', { min: training.durationMin, kcal: training.kcal })}
      </Text>

      {lines.length ? (
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? t('hm.hideExercises') : t('hm.showExercises')}
          className="flex-row items-center self-start active:opacity-60"
          style={{ gap: 6, minHeight: 40 }}>
          <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
            {open ? t('hm.hideExercises') : t('hm.showExercises')}
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

      {!training.done && onStart ? (
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={t('hm.startWorkout')}
          className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
          style={{ gap: 8, minHeight: 52, marginTop: lines.length ? 6 : 14 }}>
          <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} tintColor={INK} size={15} />
          <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
            {t('hm.startWorkout')}
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
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  const slots = SLOT_ORDER.map((slot) => ({ slot, items: day.diet.items.filter((i) => i.mealSlot === slot) })).filter((s) => s.items.length > 0);
  const { planned, ticked } = calorieSummary(day.diet.items);
  const icon = { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } as const;
  if (slots.length === 0) {
    return (
      <Section part="meals" first={first} icon={icon} color={MEALS} title={t('hm.meals')}>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
          {day.coaching.status === 'accepted'
            ? t('hm.noDietToday')
            : day.coaching.status === 'not_shared'
              ? t(DIET_AFTER_PROFILE_KEY)
              : emptyPlanCopy(day.coaching, false, t).line}
        </Text>
      </Section>
    );
  }
  const allDone = day.diet.done >= day.diet.total;
  return (
    <Section part="meals" first={first} icon={icon} color={MEALS} title={t('hm.meals')} status={t('hm.xOfY', { done: day.diet.done, total: day.diet.total })} done={allDone}>
      {slots.map(({ slot, items }, s) => (
        <View key={slot} style={{ marginTop: s === 0 ? 0 : 10 }}>
          <Text {...COMPACT_TEXT} className="font-bold uppercase text-muted" style={{ fontSize: 11, letterSpacing: indic ? 0 : 1, marginBottom: 2 }}>
            {t(SLOT_KEY[slot])}
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
                accessibilityLabel={[`${t(SLOT_KEY[slot])} ${item.title}`, item.calories ? t('hm.calories', { n: item.calories }) : null, t(item.done ? 'hm.doneLower' : 'hm.notDone')].filter(Boolean).join(', ')}
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
            {splitHighlight(t('hm.eatenOf', { eaten: ticked.toLocaleString(locale), planned: planned.toLocaleString(locale) })).map((p, i) =>
              p.highlight ? (
                <Text key={i} className="font-bold text-white">
                  {p.text}
                </Text>
              ) : (
                p.text
              )
            )}
          </Text>
        </View>
      ) : null}
    </Section>
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
  const t = useT();
  const { totalMl, goalMl } = day.water;
  const hasGoal = goalMl > 0;
  const done = hasGoal && totalMl >= goalMl;
  return (
    <Section
      part="water"
      icon={{ ios: 'drop', android: 'water_drop', web: 'water_drop' }}
      color={WATER}
      title={t('hm.water')}
      status={hasGoal ? t('hm.xOfY', { done: formatWater(totalMl), total: formatWater(goalMl) }) : formatWater(totalMl)}
      done={done}>
      <WaterOrb totalMl={totalMl} goalMl={goalMl} busy={busy} lastDrinkMl={lastDrinkMl} onDrink={onDrink} onUndo={onUndo} />
    </Section>
  );
}

function PhotosSection({ day, onAdd }: { day: MyDay; onAdd?: (type: MealType) => void }) {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  const count = day.meals.length;
  return (
    <Section part="photos" icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} color={BRAND} title={t('hm.mealPhotos')} status={count > 0 ? t('hm.photosAdded', { n: count }) : onAdd ? t('hm.forCoach') : t('hm.none')}>
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
              accessibilityLabel={t(mine.length ? (onAdd ? 'hm.photoA11yMore' : 'hm.photoA11yAdded') : onAdd ? 'hm.photoA11yAdd' : 'hm.photoA11yNone', { meal: t(MEAL_LABEL_KEY[type]), n: mine.length })}
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
              <Text {...COMPACT_TEXT} className={`text-center font-semibold ${shot ? 'text-white' : 'text-muted'}`} style={{ fontSize: indic ? 11 : 12, marginTop: 6 }} numberOfLines={indic && t(MEAL_LABEL_KEY[type]).includes(' ') ? 2 : 1} adjustsFontSizeToFit={indic}>
                {t(MEAL_LABEL_KEY[type])}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

function StepsSection({ day, locale, onOpen }: { day: MyDay; locale: string; onOpen?: () => void }) {
  const t = useT();
  const { stepsDone } = dayCounts(day);
  const { value, goal } = day.steps;
  const spokenCount = value == null ? t('hm.notCounted') : value.toLocaleString(locale);
  const spoken = goal > 0 ? t('hm.stepsA11yOf', { count: spokenCount, goal: goal.toLocaleString(locale) }) : t('hm.stepsA11y', { count: spokenCount });
  const count = value == null ? '–' : value.toLocaleString(locale);
  const ratio = value != null && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : 'text'}
      accessibilityLabel={onOpen ? `${spoken}. ${t('hm.opensSteps')}` : spoken}
      className="active:opacity-80">
      <Section
        part="steps"
        icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
        color={STEPS}
        title={t('hm.steps')}
        status={value == null ? t('hm.notCountedYet') : goal > 0 ? t('hm.xOfY', { done: value.toLocaleString(locale), total: goal.toLocaleString(locale) }) : value.toLocaleString(locale)}
        done={stepsDone}>
        <View className="flex-row items-end justify-between">
          <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 28, lineHeight: 34 }}>
            {goal > 0
              ? splitHighlight(t('hm.stepsBig', { count, goal: goal.toLocaleString(locale) })).map((p, i) =>
                  p.highlight ? (
                    p.text
                  ) : (
                    <Text key={i} className="font-semibold text-muted" style={{ fontSize: 15 }}>
                      {p.text}
                    </Text>
                  )
                )
              : count}
          </Text>
          {onOpen ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} /> : null}
        </View>
        <View className="overflow-hidden rounded-full" style={{ height: 8, marginTop: 10, backgroundColor: TRACK }}>
          <View style={{ height: 8, borderRadius: 4, width: `${ratio * 100}%`, backgroundColor: STEPS }} />
        </View>
        {onOpen ? (
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
            {value == null ? t('hm.notSynced') : t('hm.countedByPhone')}
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

const PART_OF = { workout: 'workout', meal: 'meals', water: 'water', steps: 'steps' } as const;

/**
 * The day as one list: workout, meals, meal photos, water, steps. Each is a row that opens in place.
 * The first thing still to do starts open; when everything is done, all rows start closed.
 */
export function Checklist({ day, locale, pending, onToggle, canTick = true, onStart, onDrink, onUndoDrink, waterBusy = false, lastDrinkMl = null, onOpenSteps, onAddPhoto, hideWorkout = false, plain = false }: ChecklistProps) {
  const [open, setOpen] = useState<Part | null>(() => {
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
