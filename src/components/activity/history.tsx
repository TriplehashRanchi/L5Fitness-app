import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { dayLabel, formatTime, type FormatOptions } from '@/lib/datetime';
import type { History, HistoryDay } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** 135 → "2h 15m", 45 → "45m". */
export const hoursMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

function Stat({ icon, color, value, label, first }: { icon: SymbolViewProps['name']; color: string; value: string; label: string; first?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 items-center"
      style={{ paddingVertical: 4, borderLeftWidth: first ? 0 : 1, borderLeftColor: HAIRLINE }}>
      <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${color}26` }}>
        <SymbolView name={icon} tintColor={color} size={17} />
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="font-black text-white" style={{ fontSize: 20, marginTop: 8 }}>
        {value}
      </Text>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="text-muted" style={{ fontSize: 12, marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}

/** All-time totals in one card: workouts, time, calories, active days. */
export function HistoryStats({ summary, locale }: { summary: NonNullable<History['summary']>; locale: string }) {
  return (
    <View className="mx-5 flex-row rounded-3xl border border-white/5 bg-card" style={{ paddingVertical: 16 }}>
      <Stat first value={String(summary.workouts)} label="Workouts" icon={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }} color={BRAND} />
      <Stat value={hoursMinutes(summary.minutes)} label="Time" icon={{ ios: 'timer', android: 'timer', web: 'timer' }} color="#38bdf8" />
      <Stat
        value={summary.calories.toLocaleString(locale)}
        label="kcal"
        icon={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
        color="#fb923c"
      />
      <Stat value={String(summary.activeDays)} label="Active days" icon={{ ios: 'calendar', android: 'event_available', web: 'event_available' }} color="#fbbf24" />
    </View>
  );
}

export type HistoryFilter = 'all' | 'week' | 'month';
const FILTERS: { id: HistoryFilter; label: string; a11y: string }[] = [
  { id: 'all', label: 'All', a11y: 'All workouts' },
  { id: 'week', label: '7 days', a11y: 'Past 7 days' },
  { id: 'month', label: '30 days', a11y: 'Past 30 days' },
];

/** One pill with three choices; the chosen one is filled. */
export function HistoryFilterBar({ value, onChange }: { value: HistoryFilter; onChange: (f: HistoryFilter) => void }) {
  return (
    <View className="mx-5 flex-row rounded-full bg-card" style={{ padding: 4, marginTop: 14 }} accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const on = f.id === value;
        return (
          <Pressable
            key={f.id}
            onPress={() => onChange(f.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={f.a11y}
            className={`flex-1 items-center justify-center rounded-full active:opacity-70 ${on ? 'bg-brand' : ''}`}
            style={{ minHeight: 40 }}>
            <Text {...COMPACT_TEXT} className={`font-bold ${on ? 'text-ink' : 'text-muted'}`} style={{ fontSize: 14 }}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One day of the logbook: the date with its totals, then each workout on a line. */
export function HistoryDayCard({ item, todayKey, format }: { item: HistoryDay; todayKey: string; format: FormatOptions }) {
  return (
    <View className="mx-5 mb-3 rounded-3xl border border-white/5 bg-card" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 12, marginBottom: 4 }}>
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold text-white" style={{ fontSize: 16 }} numberOfLines={1}>
          {dayLabel(item.day, todayKey, format.locale)}
        </Text>
        <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
          {hoursMinutes(item.totalMinutes)} · {item.totalCalories.toLocaleString(format.locale)} kcal
        </Text>
      </View>
      {item.workouts.map((w, i) => (
        <View
          key={w.id}
          accessible
          accessibilityLabel={`${w.title}, ${formatTime(new Date(w.startedAt), format)}, ${w.durationMin} minutes, ${w.calories} kilocalories`}
          className="flex-row items-center"
          style={{ gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
          <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(61,220,104,0.15)' }}>
            <SymbolView name={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }} tintColor={BRAND} size={18} />
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
              {w.durationMin} min
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
