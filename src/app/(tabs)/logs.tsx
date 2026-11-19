import { HistoryDayCard, HistoryFilterBar, HistoryStats, type HistoryFilter } from '@/components/activity/history';
import { MonthSection } from '@/components/activity/month';
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
import { addDays, dayLabel, getZonedParts, toDayKey, type CalendarDay } from '@/lib/datetime';
import { dayCounts } from '@/lib/day-plan';
import { messageFrom } from '@/lib/http';
import { DAILY_STEP_GOAL } from '@/lib/steps/summary';
import { withDeviceSteps } from '@/lib/today-tasks';
import { getActivity, type ActivityRange } from '@/lib/fitness-api';
import { getHistory, type HistoryDay } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const INK = '#050a07';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Summary = NonNullable<Awaited<ReturnType<typeof getHistory>>['summary']>;

type Mode = 'day' | 'history';
const MODES: { id: Mode; label: string; icon: { ios: string; android: string; web: string } }[] = [
  { id: 'day', label: 'Day', icon: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' } },
  { id: 'history', label: 'History', icon: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' } },
];

/** Day or History: the two things this tab does, one at a time. */
function ModeSwitch({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <View className="flex-row rounded-full bg-card" style={{ padding: 3 }} accessibilityRole="tablist">
      {MODES.map((m) => {
        const on = m.id === value;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 6, bottom: 6 }}
            className={`flex-row items-center justify-center rounded-full active:opacity-70 ${on ? 'bg-brand' : ''}`}
            style={{ minHeight: 38, paddingHorizontal: 14, gap: 6 }}>
            <SymbolView name={m.icon as never} tintColor={on ? INK : '#8fa396'} size={14} />
            <Text {...COMPACT_TEXT} className={`font-bold ${on ? 'text-ink' : 'text-muted'}`} style={{ fontSize: 13 }}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The Activity tab, in two views.
 * Day: any day of any week, shown with the same ring and cards as Today's plan (today can be acted on;
 * other days are only shown, except that past meals can still be ticked).
 * History: the last seven days as a chart, the all-time totals, and the workout logbook.
 */
function SectionTitle({ children }: { children: string }) {
  return (
    <Text {...COMPACT_TEXT} accessibilityRole="header" className="mx-5 font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: 1.2, marginTop: 22, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

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
  const [mode, setMode] = useState<Mode>('day');
  const listRef = useRef<FlatList<HistoryDay>>(null);
  const openDay = (d: CalendarDay) => {
    setPicked(d);
    setMode('day');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const latest = useRef(0);

  // The last 30 days from the server: one light request. It marks the week strip and feeds the month card.
  // (The phone's own step counts are read only when History is opened, inside the month card: that is 30
  // reads of the health app, too heavy to do every time this tab is shown.)
  const [month, setMonth] = useState<ActivityRange | null>(null);
  const [monthError, setMonthError] = useState(false);
  const monthLatest = useRef(0);
  const loadMonth = useCallback(async () => {
    const id = ++monthLatest.current;
    try {
      const next = await getActivity(todayKey, 30);
      if (id !== monthLatest.current) return;
      setMonth(next);
      setMonthError(false);
    } catch {
      // keep showing the last month we had; say so only when there is nothing to show
      if (id === monthLatest.current) setMonthError(true);
    }
  }, [todayKey]);
  /** Days with a logged workout, for the dots under the week strip: the month's, plus older ones from the logbook. */
  const logged = useMemo(() => {
    const set = new Set((days ?? []).map((d) => d.day));
    for (const d of month?.days ?? []) if (d.workouts > 0) set.add(d.day);
    return set;
  }, [days, month]);

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
      loadMonth();
    }, [loadFirst, loadMonth])
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
    await Promise.all([loadFirst(), loadMonth(), day.reload()]);
    setRefreshing(false);
  };

  // Day keys are YYYY-MM-DD, so comparing them as text compares the dates. "7 days" is today and the six before it.
  const filteredDays = useMemo(() => {
    if (filter === 'all') return days ?? [];
    const from = toDayKey(addDays(today, filter === 'week' ? -6 : -29));
    return (days ?? []).filter((d) => d.day >= from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, filter, todayKey]);

  const isWeb = Platform.OS === 'web';
  const header = (
    <View className="pb-3">
      <View className="flex-row items-center justify-between px-5 pt-3" style={{ gap: 12 }}>
        <DisplayText accessibilityRole="header" className="flex-1 text-[32px] leading-10 tracking-tight text-white" numberOfLines={1}>
          Activity
        </DisplayText>
        <ModeSwitch value={mode} onChange={setMode} />
      </View>

      {mode === 'day' ? (
        <>
      <WeekPicker selected={selected} today={today} firstWeekday={firstWeekday} locale={format.locale} onSelect={setPicked} marked={logged} />

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

      {/* The way back to today is in the summary card; when that card cannot be shown, offer it here. */}
      {!isToday && !shown && !day.loading ? (
        <Pressable
          onPress={() => setPicked(null)}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
          className="mx-5 mb-3 self-start justify-center rounded-full active:opacity-70"
          style={{ minHeight: 36, paddingHorizontal: 14, backgroundColor: 'rgba(61,220,104,0.15)' }}>
          <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 13 }}>
            Today
          </Text>
        </Pressable>
      ) : null}

      {day.loading ? (
        <DaySkeleton />
      ) : shown ? (
        <>
          <DaySummary
            day={shown}
            percent={percent}
            locale={format.locale}
            slim
            title={dayLabel(selectedKey, todayKey, format.locale)}
            action={
              isToday ? null : (
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
              )
            }
          />
          <Checklist
            // a fresh checklist for each day, so one day's folded cards do not carry over to the next
            key={selectedKey}
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

        </>
      ) : (
        <>
          <View style={{ height: 16 }} />
          {month ? (
            <MonthSection data={month} today={today} locale={format.locale} onOpenDay={openDay} />
          ) : monthError ? (
            <View accessibilityRole="alert" className="mx-5 rounded-3xl border border-white/5 bg-card" style={{ padding: 18 }}>
              <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                The last 30 days could not be loaded
              </Text>
              <Pressable onPress={loadMonth} accessibilityRole="button" className="mt-3 min-h-11 self-start justify-center rounded-full bg-brand px-5 active:opacity-80">
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}
          <SectionTitle>All time</SectionTitle>
          {summary ? <HistoryStats summary={summary} locale={format.locale} /> : null}
          <SectionTitle>Workout log</SectionTitle>
          <HistoryFilterBar value={filter} onChange={setFilter} />
        </>
      )}

      {error && mode === 'history' ? (
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
        ref={listRef}
        data={mode === 'history' ? filteredDays : []}
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
        onEndReached={mode === 'history' ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <HistoryDayCard
            item={item}
            todayKey={todayKey}
            format={format}
            onOpen={() => {
              const [y, m, d] = item.day.split('-').map(Number);
              openDay({ year: y, month: m, day: d });
            }}
          />
        )}
        ListEmptyComponent={
          mode === 'day' ? undefined : days === null ? (
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
