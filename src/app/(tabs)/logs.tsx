import { HistoryDayCard, HistoryFilterBar, HistoryStats, type HistoryFilter } from '@/components/activity/history';
import { DaySkeleton } from '@/components/day-plan/day-skeleton';
import { WeekPicker } from '@/components/day-plan/week-picker';
import { DisplayText } from '@/components/display-text';
import { Checklist } from '@/components/today/checklist';
import { DaySummary } from '@/components/today/summary';
import { useMyDay } from '@/hooks/use-my-day';
import { useSteps } from '@/hooks/use-steps';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { dayLabel, getZonedParts, toDayKey, type CalendarDay } from '@/lib/datetime';
import { dayCounts } from '@/lib/day-plan';
import { messageFrom } from '@/lib/http';
import { DAILY_STEP_GOAL } from '@/lib/steps/summary';
import { withDeviceSteps } from '@/lib/today-tasks';
import { getHistory, type HistoryDay } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const INK = '#050a07';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Summary = NonNullable<Awaited<ReturnType<typeof getHistory>>['summary']>;

/**
 * The Activity tab. Top: any day of any week, shown with the same ring and cards as Today's plan
 * (today can be acted on; other days are only shown, except that past meals can still be ticked).
 * Below: the workout logbook.
 */
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
  // Today also counts what the phone's pedometer has, like Home and Today's plan do.
  const { todaySteps } = useSteps(now, [today], today, day.data?.steps.goal || DAILY_STEP_GOAL);
  const shown = useMemo(() => (day.data && isToday ? withDeviceSteps(day.data, todaySteps) : day.data), [day.data, isToday, todaySteps]);
  const percent = shown ? Math.max(shown.percent, dayCounts(shown).percent) : 0;
  const dayMessage = day.notice ?? day.error;

  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('all');
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
    <View className="pb-3">
      <View className="px-5 pt-3">
        <DisplayText accessibilityRole="header" className="text-[32px] leading-10 tracking-tight text-white" numberOfLines={1}>
          Activity
        </DisplayText>
      </View>
      <WeekPicker selected={selected} today={today} firstWeekday={firstWeekday} locale={format.locale} onSelect={setPicked} />

      {/* Which day the cards below are about, and the way back to today. */}
      <View className="mx-5 mb-3 flex-row items-center justify-between" style={{ minHeight: 36 }}>
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-bold text-white" style={{ fontSize: 18 }}>
          {dayLabel(selectedKey, todayKey, format.locale)}
        </Text>
        {isToday ? null : (
          <Pressable
            onPress={() => setPicked(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            className="items-center justify-center rounded-full active:opacity-70"
            style={{ minHeight: 36, paddingHorizontal: 14, backgroundColor: 'rgba(61,220,104,0.15)' }}>
            <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
              Today
            </Text>
          </Pressable>
        )}
      </View>

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
      ) : shown ? (
        <>
          <DaySummary day={shown} percent={percent} locale={format.locale} />
          <Checklist
            day={shown}
            locale={format.locale}
            pending={day.pending}
            onToggle={day.toggleItem}
            canTick={selectedKey <= todayKey}
            // Only today can be acted on from here; every other day is just shown.
            onStart={isToday ? () => router.navigate({ pathname: '/', params: { start: '1' } } as never) : undefined}
            onDrink={isToday ? day.drink : undefined}
            onUndoDrink={isToday ? day.undoDrink : undefined}
            waterBusy={day.waterBusy}
            lastDrinkMl={day.lastDrinkMl}
            onOpenSteps={isToday ? () => router.push('/steps') : undefined}
            onAddPhoto={isToday ? (type) => router.push({ pathname: '/add-meal', params: { type } }) : undefined}
          />
        </>
      ) : null}

      <View className="px-5" style={{ marginTop: 14, marginBottom: 12 }}>
        <DisplayText {...COMPACT_TEXT} accessibilityRole="header" className="tracking-tight text-white" style={{ fontSize: 24, lineHeight: 30 }}>
          History
        </DisplayText>
      </View>
      {summary ? <HistoryStats summary={summary} locale={format.locale} /> : null}
      <HistoryFilterBar value={filter} onChange={setFilter} />

      {error ? (
        <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
          <Text className="text-sm font-semibold text-white">{error}</Text>
          <Text className="mt-0.5 text-xs text-muted">Pull down to refresh and try again.</Text>
        </View>
      ) : null}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND} colors={[BRAND]} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <HistoryDayCard item={item} todayKey={todayKey} format={format} />}
        ListEmptyComponent={
          days === null ? (
            error ? undefined : (
              <View className="items-center py-14">
                <ActivityIndicator color={BRAND} size="large" />
              </View>
            )
          ) : (
            <View className="mx-5 items-center rounded-3xl border border-white/5 bg-card" style={{ paddingHorizontal: 24, paddingVertical: 32 }}>
              <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(61,220,104,0.12)' }}>
                <SymbolView name={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }} tintColor={BRAND} size={28} />
              </View>
              <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 18, marginTop: 14 }}>
                {filter === 'all' ? 'No workouts yet' : 'Nothing in this period'}
              </Text>
              {filter === 'all' ? (
                <Pressable
                  onPress={() => router.navigate('/')}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
                  style={{ gap: 8, minHeight: 48, paddingHorizontal: 24, marginTop: 16 }}>
                  <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} tintColor={INK} size={14} />
                  <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 15 }}>
                    Start today’s workout
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setFilter('all')} accessibilityRole="button" className="justify-center active:opacity-60" style={{ minHeight: 44, marginTop: 6 }}>
                  <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 14 }}>
                    Show all
                  </Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={BRAND} className="py-5" /> : undefined}
      />
    </View>
  );
}
