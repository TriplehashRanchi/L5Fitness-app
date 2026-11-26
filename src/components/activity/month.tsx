import { SHOW_WORKOUT } from '@/lib/features';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { hoursMinutes } from '@/components/activity/history';
import { DisplayText } from '@/components/display-text';
import { useStepHistory } from '@/hooks/use-step-history';
import { dayLabel, toDayKey, type CalendarDay } from '@/lib/datetime';
import type { ActivityDay, ActivityRange } from '@/lib/fitness-api';
import type { Key, Translate } from '@/lib/i18n';
import { formatWater } from '@/lib/water';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const ICON_TINT = '#e8efe9';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const BAR = 96;

type MetricId = 'steps' | 'water' | 'meals' | 'workouts';

type Metric = {
  id: MetricId;
  labelKey: Key;
  icon: SymbolViewProps['name'];
  /** the day's number, or null when nothing is known for it */
  value: (d: ActivityDay) => number | null;
  /** what counts as a full day, when there is such a thing */
  goal: (d: ActivityDay, goals: ActivityRange['goals']) => number | null;
  format: (n: number, locale: string, t: Translate) => string;
  /** the headline number for the whole month and the words under it */
  headline: (days: ActivityDay[], goals: ActivityRange['goals'], locale: string, t: Translate) => { value: string; caption: string };
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const known = (days: ActivityDay[], f: (d: ActivityDay) => number | null) => days.map(f).filter((n): n is number => n != null);
const mealsOf = (d: ActivityDay) => (d.dietPlanned > 0 ? d.dietDone : d.meals);

const ALL_METRICS: Metric[] = [
  {
    id: 'steps',
    labelKey: 'act.steps',
    icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
    value: (d) => d.steps,
    goal: (_, g) => g.steps,
    format: (n, locale) => n.toLocaleString(locale),
    headline: (days, g, locale, t) => {
      const v = known(days, (d) => d.steps);
      const hit = v.filter((n) => n >= g.steps).length;
      return {
        value: v.length ? Math.round(sum(v) / v.length).toLocaleString(locale) : '–',
        caption: v.length ? t(hit === 1 ? 'act.stepsAverageOne' : 'act.stepsAverageMany', { n: hit }) : t('act.noStepsCounted'),
      };
    },
  },
  {
    id: 'water',
    labelKey: 'act.water',
    icon: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
    value: (d) => d.waterMl,
    goal: (_, g) => g.waterMl,
    format: (n) => formatWater(n),
    headline: (days, g, _, t) => {
      const drank = days.filter((d) => d.waterMl > 0);
      const hit = days.filter((d) => d.waterMl >= g.waterMl).length;
      return {
        value: drank.length ? formatWater(Math.round(sum(drank.map((d) => d.waterMl)) / drank.length / 50) * 50) : '–',
        caption: drank.length ? t(hit === 1 ? 'act.waterAverageOne' : 'act.waterAverageMany', { n: hit }) : t('act.noWaterLogged'),
      };
    },
  },
  {
    id: 'meals',
    labelKey: 'act.meals',
    icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
    value: mealsOf,
    goal: (d) => (d.dietPlanned > 0 ? d.dietPlanned : 4),
    format: (n, _, t) => t(n === 1 ? 'act.mealCountOne' : 'act.mealCountMany', { n }),
    headline: (days, _, __, t) => {
      const total = sum(days.map(mealsOf));
      const active = days.filter((d) => mealsOf(d) > 0).length;
      return { value: String(total), caption: total ? t(active === 1 ? 'act.mealsOnOne' : 'act.mealsOnMany', { n: active }) : t('act.noMealsLogged') };
    },
  },
  {
    id: 'workouts',
    labelKey: 'act.workouts',
    icon: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' },
    value: (d) => d.workoutMinutes,
    goal: () => null,
    format: (n, _, t) => hoursMinutes(t, n),
    headline: (days, _, locale, t) => {
      const count = sum(days.map((d) => d.workouts));
      const kcal = sum(days.map((d) => d.workoutCalories));
      return {
        value: hoursMinutes(t, sum(days.map((d) => d.workoutMinutes))),
        caption: count ? t(count === 1 ? 'act.workoutsSumOne' : 'act.workoutsSumMany', { n: count, kcal: kcal.toLocaleString(locale) }) : t('act.noWorkoutsLogged'),
      };
    },
  },
];

/** The charts on offer; workouts are left out while they are switched off. */
const METRICS = SHOW_WORKOUT ? ALL_METRICS : ALL_METRICS.filter((m) => m.id !== 'workouts');

const toCalendar = (key: string): CalendarDay => {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
};

/**
 * The last 30 days of one thing at a time: steps, water, meals or workouts. A bar per day, brighter on the
 * days the goal was reached. Tapping a bar shows that day's number and offers to open the day.
 */
export function MonthCard({
  data,
  todayKey,
  locale,
  onOpenDay,
}: {
  data: ActivityRange;
  todayKey: string;
  locale: string;
  onOpenDay: (day: CalendarDay) => void;
}) {
  const { t, language } = useLanguage();
  const english = language === 'en';
  const [metricId, setMetricId] = useState<MetricId>('steps');
  const [picked, setPicked] = useState<string | null>(null);
  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];
  const { days, goals } = data;
  const values = days.map((d) => metric.value(d));
  const dayGoals = days.map((d) => metric.goal(d, goals));
  const flatGoal = metric.id === 'steps' ? goals.steps : metric.id === 'water' ? goals.waterMl : null;
  const top = Math.max(1, flatGoal ?? 0, ...values.map((v) => v ?? 0));
  const head = metric.headline(days, goals, locale, t);
  const shownDay = picked ? days.find((d) => d.day === picked) : undefined;
  const shownValue = shownDay ? metric.value(shownDay) : null;

  return (
    <View className="mx-5" style={{ marginTop: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
      <Text {...COMPACT_TEXT} className="font-bold uppercase text-muted" style={{ fontSize: 11, letterSpacing: english ? 1.2 : 0 }}>
        {t('act.last30')}
      </Text>

      {/* which thing to look at */}
      <View className="flex-row" style={{ gap: 6, marginTop: 12 }} accessibilityRole="tablist">
        {METRICS.map((m) => {
          const on = m.id === metric.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                setMetricId(m.id);
                setPicked(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(m.labelKey)}
              className="flex-1 items-center justify-center rounded-2xl active:opacity-70"
              style={{
                minHeight: 52,
                gap: 4,
                borderWidth: 1,
                borderColor: on ? BRAND : 'rgba(255,255,255,0.1)',
                backgroundColor: on ? BRAND : 'transparent',
              }}>
              <SymbolView name={m.icon} tintColor={on ? INK : ICON_TINT} size={16} />
              <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="px-1 text-center font-bold" style={{ fontSize: 11, color: on ? INK : '#8fa396' }}>
                {t(m.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* the month in one number, or the tapped day */}
      <View style={{ marginTop: 16, minHeight: 62 }}>
        {shownDay ? (
          <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <View className="flex-1">
              <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-white" style={{ fontSize: 30, lineHeight: 36 }}>
                {shownValue == null ? '–' : metric.format(shownValue, locale, t)}
              </DisplayText>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                {dayLabel(shownDay.day, todayKey, locale)}
              </Text>
            </View>
            <Pressable
              onPress={() => onOpenDay(toCalendar(shownDay.day))}
              accessibilityRole="button"
              accessibilityLabel={t('act.openNamedDay', { day: dayLabel(shownDay.day, todayKey, locale) })}
              className="flex-row items-center rounded-full active:opacity-70"
              style={{ gap: 6, minHeight: 40, paddingHorizontal: 14, backgroundColor: 'rgba(61,220,104,0.15)' }}>
              <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
                {t('act.openDay')}
              </Text>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={BRAND} size={11} />
            </Pressable>
          </View>
        ) : (
          <>
            <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-white" style={{ fontSize: 30, lineHeight: 36 }}>
              {head.value}
            </DisplayText>
            <Text {...COMPACT_TEXT} numberOfLines={english ? 2 : 3} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {head.caption}
            </Text>
          </>
        )}
      </View>

      {/* a bar per day */}
      <View style={{ marginTop: 14 }}>
        {flatGoal ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: BAR - (flatGoal / top) * BAR, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.28)' }}
          />
        ) : null}
        <View className="flex-row items-end" style={{ height: BAR, gap: 2 }}>
          {days.map((d, i) => {
            const v = values[i];
            const g = dayGoals[i];
            const reached = v != null && g != null ? v >= g : (v ?? 0) > 0;
            const on = d.day === picked;
            return (
              <Pressable
                key={d.day}
                onPress={() => setPicked(on ? null : d.day)}
                hitSlop={{ top: 6, bottom: 10 }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={
                  v == null
                    ? t('act.barNothing', { day: dayLabel(d.day, todayKey, locale) })
                    : `${dayLabel(d.day, todayKey, locale)}: ${metric.format(v, locale, t)}`
                }
                className="flex-1 justify-end"
                style={{ height: BAR }}>
                <View
                  style={{
                    height: v ? Math.max(4, (v / top) * BAR) : 3,
                    borderRadius: 3,
                    backgroundColor: on ? '#ffffff' : v ? BRAND : 'rgba(255,255,255,0.1)',
                    opacity: on || !v ? 1 : reached ? 1 : 0.45,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row justify-between" style={{ marginTop: 8 }}>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11 }}>
            {days.length ? dayLabel(days[0].day, todayKey, locale) : ''}
          </Text>
          {flatGoal ? (
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11 }}>
              {t('act.goalValue', { value: metric.format(flatGoal, locale, t) })}
            </Text>
          ) : null}
          <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 11 }}>
            {t('common.today')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A day counts as active when a workout was logged or the step goal was reached. */
const isActive = (d: ActivityDay, stepGoal: number) => d.workouts > 0 || (d.steps != null && stepGoal > 0 && d.steps >= stepGoal);

function Tile({ icon, label, value, unit, a11y }: { icon: SymbolViewProps['name']; label: string; value: string; unit: string; a11y?: string }) {
  const { language } = useLanguage();
  const english = language === 'en';
  return (
    <View accessible accessibilityLabel={a11y ?? `${label}: ${value} ${unit}`} className="flex-1" style={{ paddingVertical: 4 }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <SymbolView name={icon} tintColor={ICON_TINT} size={14} />
        <Text {...COMPACT_TEXT} numberOfLines={english ? 1 : 2} className="font-bold uppercase text-muted" style={{ flexShrink: 1, fontSize: 11, letterSpacing: english ? 1.1 : 0 }}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline" style={{ gap: 5, marginTop: 10 }}>
        <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 36, lineHeight: 42 }}>
          {value}
        </DisplayText>
        <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

/**
 * The month on the History view: the current streak and active days, then the 30-day card.
 * This is where the phone's own step counts are read (they are newer than the server's for recent days),
 * so that work only happens when History is actually open.
 */
export function MonthSection({
  data,
  today,
  locale,
  onOpenDay,
}: {
  data: ActivityRange;
  today: CalendarDay;
  locale: string;
  onOpenDay: (day: CalendarDay) => void;
}) {
  const t = useT();
  const todayKey = toDayKey(today);
  const phone = useStepHistory(today, data.goals.steps);
  const merged = useMemo(() => {
    const steps = new Map((phone.days ?? []).map((d) => [d.key, d.steps]));
    return { ...data, days: data.days.map((d) => ({ ...d, steps: steps.get(d.day) ?? d.steps })) };
  }, [data, phone.days]);

  const { streak, active } = useMemo(() => {
    const flags = merged.days.map((d) => isActive(d, merged.goals.steps));
    // Count back from today; a today that is not active yet does not break a streak that ran up to yesterday.
    let i = flags.length - 1;
    if (i >= 0 && !flags[i]) i -= 1;
    let run = 0;
    while (i >= 0 && flags[i]) {
      run += 1;
      i -= 1;
    }
    return { streak: run, active: flags.filter(Boolean).length };
  }, [merged]);

  return (
    <View style={{ gap: 10 }}>
      <View className="mx-5 flex-row" style={{ gap: 10 }}>
        <Tile label={t('act.streak')} value={String(streak)} unit={t(streak === 1 ? 'act.dayUnitOne' : 'act.dayUnitMany')} icon={{ ios: 'bolt', android: 'bolt', web: 'bolt' }} />
        <Tile label={t('act.activeDays')} value={String(active)} unit={t('act.ofThirty')} a11y={t('act.activeDaysA11y', { n: active })} icon={{ ios: 'calendar', android: 'event_available', web: 'event_available' }} />
      </View>
      <MonthCard data={merged} todayKey={todayKey} locale={locale} onOpenDay={onOpenDay} />
    </View>
  );
}
