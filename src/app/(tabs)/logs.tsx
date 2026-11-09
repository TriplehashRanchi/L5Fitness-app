import { PageHeading } from '@/components/page-heading';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { dayLabel, formatTime, getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { getHistory, type HistoryDay } from '@/lib/wellness-api';

const BRAND = '#c6f432';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Summary = NonNullable<Awaited<ReturnType<typeof getHistory>>['summary']>;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-card p-3">
      <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-xl font-bold text-white">
        {value}
      </Text>
      <Text {...COMPACT_TEXT} numberOfLines={1} className="mt-0.5 text-[11px] text-muted">
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
  const { format } = useDeviceClock();
  const todayKey = toDayKey(getZonedParts(new Date(), format.timeZone));

  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
    await loadFirst();
    setRefreshing(false);
  };

  const isWeb = Platform.OS === 'web';
  const header = (
    <View className="px-5 pb-4">
      <View className="-mx-5"><PageHeading title="Your workouts" subtitle="Every session, a little stronger." /></View>
      {summary ? (
        <View className="mt-5 flex-row gap-2">
          <Stat value={String(summary.workouts)} label="Workouts" />
          <Stat value={hoursMinutes(summary.minutes)} label="Time" />
          <Stat value={summary.calories.toLocaleString(format.locale)} label="Kcal" />
          <Stat value={String(summary.activeDays)} label="Days" />
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
          <Text className="text-sm text-white">{error}</Text>
          <Text className="mt-0.5 text-xs text-muted">Pull down to try again.</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <FlatList
        data={days ?? []}
        keyExtractor={(d) => d.day}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 20),
          width: '100%', maxWidth: 840, alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND} colors={[BRAND]} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className="mx-5 mb-3 rounded-3xl border border-white/5 bg-card p-5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-base font-bold text-white">{dayLabel(item.day, todayKey, format.locale)}</Text>
              <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                {hoursMinutes(item.totalMinutes)} · {item.totalCalories} kcal
              </Text>
            </View>
            <View className="mt-3 gap-3">
              {item.workouts.map((w) => (
                <View key={w.id} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-card-2">
                    <SymbolView name={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }} tintColor={BRAND} size={18} />
                  </View>
                  <View className="flex-1">
                    <Text {...COMPACT_TEXT} numberOfLines={1} className="text-sm font-bold text-white">
                      {w.title}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-xs text-muted">
                      {formatTime(new Date(w.startedAt), format)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text {...COMPACT_TEXT} className="text-sm font-bold text-white">{w.durationMin} min</Text>
                    <Text {...COMPACT_TEXT} className="text-xs text-muted">{w.calories} kcal</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          days === null ? (
            error ? undefined : (
              <View className="items-center py-16">
                <ActivityIndicator color={BRAND} />
              </View>
            )
          ) : (
            <View className="mx-5 items-center rounded-3xl border border-white/10 bg-card px-6 py-12">
              <SymbolView name={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }} tintColor={BRAND} size={32} />
              <Text className="mt-4 text-lg font-bold text-white">No workouts yet</Text>
              <Text className="mt-1 text-center text-sm text-muted">Finish a workout on Home and it will show up here, day by day.</Text>
              <Pressable onPress={() => router.navigate('/')} accessibilityRole="button" className="mt-5 rounded-full bg-brand px-6 py-3 active:opacity-80">
                <Text className="font-bold text-ink">Go to Home</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={BRAND} className="py-4" /> : undefined}
      />
    </View>
  );
}
