import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { dayLabel, formatTime, type FormatOptions } from '@/lib/datetime';
import type { Key, Translate } from '@/lib/i18n';
import type { History, HistoryDay } from '@/lib/wellness-api';
import { useLanguage, useT } from '@/providers/language-provider';

const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** 135 → "2h 15m", 45 → "45m". */
export const hoursMinutes = (t: Translate, min: number) =>
  min >= 60 ? t('act.hoursMin', { h: Math.floor(min / 60), m: min % 60 }) : t('act.minutesOnly', { m: min });

const ICON_TINT = '#e8efe9';

/** One all-time number: its name and a line icon above, the number large below. */
function Stat({ icon, value, unit, label }: { icon: SymbolViewProps['name']; value: string; unit?: string; label: string }) {
  const { language } = useLanguage();
  const english = language === 'en';
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      className="flex-1 rounded-3xl border border-white/5 bg-card"
      style={{ padding: 16 }}>
      <View className="flex-row items-center justify-between">
        <Text {...COMPACT_TEXT} numberOfLines={english ? 1 : 2} className="font-bold uppercase text-muted" style={{ flexShrink: 1, fontSize: 11, letterSpacing: english ? 1.1 : 0 }}>
          {label}
        </Text>
        <SymbolView name={icon} tintColor={ICON_TINT} size={16} />
      </View>
      <View className="flex-row items-baseline" style={{ gap: 5, marginTop: 10 }}>
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-white" style={{ fontSize: 28, lineHeight: 34 }}>
          {value}
        </DisplayText>
        {unit ? (
          <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** All-time totals as four tiles: workouts, time, calories, active days. */
export function HistoryStats({ summary, locale }: { summary: NonNullable<History['summary']>; locale: string }) {
  const t = useT();
  return (
    <View className="mx-5" style={{ gap: 10 }}>
      <View className="flex-row" style={{ gap: 10 }}>
        <Stat label={t('act.workouts')} value={String(summary.workouts)} icon={{ ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }} />
        <Stat label={t('act.time')} value={hoursMinutes(t, summary.minutes)} icon={{ ios: 'timer', android: 'timer', web: 'timer' }} />
      </View>
      <View className="flex-row" style={{ gap: 10 }}>
        <Stat label={t('act.burned')} value={summary.calories.toLocaleString(locale)} unit="kcal" icon={{ ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' }} />
        <Stat label={t('act.activeDays')} value={String(summary.activeDays)} icon={{ ios: 'calendar', android: 'event_available', web: 'event_available' }} />
      </View>
    </View>
  );
}

export type HistoryFilter = 'all' | 'week' | 'month';
const FILTERS: { id: HistoryFilter; labelKey: Key; a11yKey: Key }[] = [
  { id: 'all', labelKey: 'act.filterAll', a11yKey: 'act.filterAllA11y' },
  { id: 'week', labelKey: 'act.filterWeek', a11yKey: 'act.filterWeekA11y' },
  { id: 'month', labelKey: 'act.filterMonth', a11yKey: 'act.filterMonthA11y' },
];

/** One pill with three choices; the chosen one is filled. */
export function HistoryFilterBar({ value, onChange }: { value: HistoryFilter; onChange: (f: HistoryFilter) => void }) {
  const t = useT();
  return (
    <View className="mx-5 flex-row rounded-full bg-card" style={{ padding: 4 }} accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const on = f.id === value;
        return (
          <Pressable
            key={f.id}
            onPress={() => onChange(f.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(f.a11yKey)}
            className={`flex-1 items-center justify-center rounded-full active:opacity-70 ${on ? 'bg-brand' : ''}`}
            style={{ minHeight: 40 }}>
            <Text {...COMPACT_TEXT} numberOfLines={2} className={`text-center font-bold ${on ? 'text-ink' : 'text-muted'}`} style={{ fontSize: 14 }}>
              {t(f.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One day of the logbook: the date with its totals, then each workout on a line. */
export function HistoryDayCard({
  item,
  todayKey,
  format,
  onOpen,
}: {
  item: HistoryDay;
  todayKey: string;
  format: FormatOptions;
  /** Opens this day's full picture (workout, meals, water, steps). */
  onOpen?: () => void;
}) {
  const t = useT();
  return (
    <View className="mx-5 mb-3 rounded-3xl border border-white/5 bg-card" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : 'header'}
        accessibilityLabel={t(onOpen ? 'act.historyDayOpenA11y' : 'act.historyDayA11y', {
          day: dayLabel(item.day, todayKey, format.locale),
          time: hoursMinutes(t, item.totalMinutes),
          kcal: item.totalCalories,
        })}
        className="flex-row items-center justify-between active:opacity-60"
        style={{ gap: 12, minHeight: 36, marginBottom: 2 }}>
        <Text {...COMPACT_TEXT} className="flex-1 font-bold text-white" style={{ fontSize: 16 }} numberOfLines={1}>
          {dayLabel(item.day, todayKey, format.locale)}
        </Text>
        <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
          {hoursMinutes(t, item.totalMinutes)} · {item.totalCalories.toLocaleString(format.locale)} kcal
        </Text>
        {onOpen ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#8fa396" size={12} /> : null}
      </Pressable>
      {item.workouts.map((w, i) => (
        <View
          key={w.id}
          accessible
          accessibilityLabel={t('act.workoutRowA11y', { title: w.title, time: formatTime(new Date(w.startedAt), format), minutes: w.durationMin, kcal: w.calories })}
          className="flex-row items-center"
          style={{ gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
          <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <SymbolView name={{ ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }} tintColor={ICON_TINT} size={18} />
          </View>
          <View className="flex-1">
            <Text {...COMPACT_TEXT} numberOfLines={1} className="font-semibold text-white" style={{ fontSize: 15 }}>
              {w.title}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 1 }}>
              {formatTime(new Date(w.startedAt), format)}
            </Text>
          </View>
          <View className="items-end">
            <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
              {t('act.minutesShort', { n: w.durationMin })}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 1 }}>
              {w.calories.toLocaleString(format.locale)} kcal
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
