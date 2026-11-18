import { DaySkeleton } from '@/components/day-plan/day-skeleton';
import { DaySummary } from '@/components/day-plan/day-summary';
import { DietSection } from '@/components/day-plan/diet-section';
import { ExerciseSection } from '@/components/day-plan/exercise-section';
import { MealsGrid } from '@/components/day-plan/meals-grid';
import { ProgressRows } from '@/components/day-plan/progress-rows';
import { SectionTitle } from '@/components/day-plan/section-title';
import { WeekPicker } from '@/components/day-plan/week-picker';
import { DisplayText } from '@/components/display-text';
import { useMyDay } from '@/hooks/use-my-day';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { type IconName } from '@/constants/icons';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { dayLabel, formatTime, getZonedParts, toDayKey, type CalendarDay } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { getHistory, type HistoryDay } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const INK = '#050a07';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Summary = NonNullable<Awaited<ReturnType<typeof getHistory>>['summary']>;
type FilterType = 'all' | 'week' | 'month';

function Stat({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label: string;
  icon: IconName;
  color: string;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-white/5 bg-card p-3.5">
      <View className="mb-2 h-7 w-7 items-center justify-center rounded-xl bg-card-2">
        <SymbolView name={icon} tintColor={color} size={15} />
      </View>
      <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-xl font-black text-white">
        {value}
      </Text>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="mt-0.5 text-[11px] font-semibold text-muted">
        {label}
      </Text>
    </View>
  );
}

/** 135 → "2h 15m", 45 → "45m". */
const hoursMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { now, format, firstWeekday } = useDeviceClock();
  const today = getZonedParts(now, format.timeZone);
  const todayKey = toDayKey(today);
  const [picked, setPicked] = useState<CalendarDay | null>(null);
  const selected: CalendarDay = picked ?? today;
  const selectedKey = toDayKey(selected);
  const day = useMyDay(selectedKey);
  const isToday = selectedKey === todayKey;
  const canStart = isToday && !!day.data?.training && !day.data.training.done;
  const dayMessage = day.notice ?? day.error;

  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const latest = useRef(0);

  const loadFirst = useCallback(async () => {
    const id = ++latest.current;
    try {
      const page = await getHistory();
      if (id !== latest.current) return;
      setDays(page.days);
      setSummary(page.summary);
      setNext(page.nextBefore);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError(messageFrom(e));
    }
  }, []);

  // Reload each time the tab comes into view, so a workout finished on Home shows up here.
  useFocusEffect(
    useCallback(() => {
      loadFirst();
    }, [loadFirst])
  );

  const loadMore = async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getHistory(next);
      setDays((prev) => [...(prev ?? []), ...page.days]);
      setNext(page.nextBefore);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFirst(), day.reload()]);
    setRefreshing(false);
  };

  const filteredDays = (days ?? []).filter((d) => {
    if (filter === 'all') return true;
    const dayDate = new Date(d.day);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - dayDate.getTime()) / 86_400_000);
    if (filter === 'week') return diffDays <= 7;
    if (filter === 'month') return diffDays <= 30;
    return true;
  });

  const isWeb = Platform.OS === 'web';
  const header = (
    <View className="pb-4">
      <View className="px-5 pt-3">
        <DisplayText accessibilityRole="header" className="text-[32px] leading-10 tracking-tight text-white" numberOfLines={1}>
          Activity
        </DisplayText>
      </View>
      <WeekPicker selected={selected} today={today} firstWeekday={firstWeekday} locale={format.locale} onSelect={setPicked} />

      {dayMessage ? (
        <View accessibilityRole="alert" className="mx-5 mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
          <Text className="text-sm font-semibold text-white">{dayMessage}</Text>
          {day.error && !day.notice ? <Text className="mt-0.5 text-xs text-muted">Pull down to refresh and try again.</Text> : null}
          {day.error && !day.data ? (
            <Pressable onPress={day.reload} accessibilityRole="button" className="mt-3 min-h-11 self-start justify-center rounded-full bg-brand px-5 active:opacity-80">
              <Text className="text-sm font-bold text-ink">Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {day.loading ? (
        <DaySkeleton />
      ) : day.data ? (
        <>
          <DaySummary day={day.data} label={`Progress for ${dayLabel(selectedKey, todayKey, format.locale)}`} />
          <ExerciseSection
            training={day.data.training}
            coaching={day.data.coaching}
            loading={false}
            onStart={canStart ? () => router.navigate({ pathname: '/', params: { start: '1' } } as never) : undefined}
          />
          <DietSection
            diet={day.data.diet}
            coaching={day.data.coaching}
            canTick={selectedKey <= todayKey}
            pending={day.pending}
            onToggle={day.toggleItem}
          />
          <ProgressRows water={day.data.water} steps={day.data.steps} locale={format.locale} />
          <MealsGrid meals={day.data.meals} format={format} />
        </>
      ) : null}

      <View className="mt-3">
        <SectionTitle title="History" />
      </View>
    <View className="px-5">
      {/* Summary Cards */}
      {summary ? (
        <View className="mt-4 flex-row gap-2">
          <Stat
            value={String(summary.workouts)}
            label="Workouts"
            icon={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }}
            color={BRAND}
          />
          <Stat
            value={hoursMinutes(summary.minutes)}
            label="Duration"
            icon={{ ios: 'timer', android: 'timer', web: 'timer' }}
            color="#38bdf8"
          />
          <Stat
            value={summary.calories.toLocaleString(format.locale)}
            label="Calories"
            icon={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }}
            color="#ff6b35"
          />
          <Stat
            value={String(summary.activeDays)}
            label="Active Days"
            icon={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
            color="#eab308"
          />
        </View>
      ) : null}

      {/* Filter Tabs */}
      <View className="mt-5 flex-row gap-2">
        {(
          [
            { id: 'all', label: 'All Sessions' },
            { id: 'week', label: 'Past 7 Days' },
            { id: 'month', label: 'Past 30 Days' },
          ] as const
        ).map((f) => {
          const selected = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 ${
                selected ? 'bg-brand' : 'border border-white/10 bg-card'
              } active:opacity-70`}>
              <Text
                {...COMPACT_TEXT}
                className={`text-xs font-bold ${selected ? 'text-ink' : 'text-muted'}`}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View
          accessibilityRole="alert"
          className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
          <Text className="text-sm font-semibold text-white">{error}</Text>
          <Text className="mt-0.5 text-xs text-muted">Pull down to refresh and try again.</Text>
        </View>
      ) : null}
    </View>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <FlatList
        data={filteredDays}
        keyExtractor={(d) => d.day}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 8),
          width: '100%',
          maxWidth: 840,
          alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className="mx-5 mb-4 overflow-hidden rounded-3xl border border-white/5 bg-card p-5">
            {/* Day Header & Daily Totals */}
            <View className="flex-row items-center justify-between border-b border-white/5 pb-3">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-brand" />
                <Text className="text-base font-bold text-white">
                  {dayLabel(item.day, todayKey, format.locale)}
                </Text>
              </View>
              <View className="rounded-full bg-card-2 px-3 py-1">
                <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                  {hoursMinutes(item.totalMinutes)} · {item.totalCalories} kcal
                </Text>
              </View>
            </View>

            {/* Individual Workouts for the Day */}
            <View className="mt-3.5 gap-3">
              {item.workouts.map((w) => {
                const burnRate = Math.round(w.calories / Math.max(1, w.durationMin));
                return (
                  <View
                    key={w.id}
                    className="flex-row items-center gap-3.5 rounded-2xl bg-card-2 p-3.5 border border-white/5">
                    <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand/10 border border-brand/20">
                      <SymbolView
                        name={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }}
                        tintColor={BRAND}
                        size={20}
                      />
                    </View>

                    <View className="flex-1">
                      <Text {...COMPACT_TEXT} numberOfLines={1} className="text-sm font-bold text-white">
                        {w.title}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-2">
                        <Text {...COMPACT_TEXT} className="text-xs text-muted">
                          {formatTime(new Date(w.startedAt), format)}
                        </Text>
                        <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
                          ·
                        </Text>
                        <Text {...COMPACT_TEXT} className="text-xs text-muted">
                          ~{burnRate} kcal/min
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <View className="rounded-full bg-brand/15 px-2.5 py-0.5">
                        <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                          {w.durationMin} min
                        </Text>
                      </View>
                      <Text {...COMPACT_TEXT} className="mt-1 text-xs font-semibold text-muted">
                        {w.calories} kcal
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          days === null ? (
            error ? undefined : (
              <View className="items-center py-20">
                <ActivityIndicator color={BRAND} size="large" />
                <Text className="mt-3 text-sm text-muted">Loading your logbook…</Text>
              </View>
            )
          ) : (
            <View className="mx-5 items-center rounded-3xl border border-white/10 bg-card px-6 py-14">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-card-2 border border-white/5">
                <SymbolView
                  name={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }}
                  tintColor={BRAND}
                  size={32}
                />
              </View>
              <Text className="mt-4 text-xl font-bold text-white">No Workouts Yet</Text>
              <Text className="mt-2 text-center text-sm leading-6 text-muted max-w-[280px]">
                {filter === 'all'
                  ? 'Finish a workout on the Home screen to track your duration, calories, and history here.'
                  : 'No workout logs match this timeframe. Switch back to "All Sessions" to view your full history.'}
              </Text>
              <Pressable
                onPress={() => router.navigate('/')}
                accessibilityRole="button"
                className="mt-6 flex-row items-center gap-2 rounded-full bg-brand px-7 py-3.5 active:opacity-80">
                <SymbolView
                  name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                  tintColor={INK}
                  size={14}
                />
                <Text className="text-sm font-black text-ink">Start Today&apos;s Workout</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={BRAND} className="py-5" /> : undefined}
      />
    </View>
  );
}
