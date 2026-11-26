import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { Checklist } from '@/components/today/checklist';
import { DaySummary } from '@/components/today/summary';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useMyDay } from '@/hooks/use-my-day';
import { useSteps } from '@/hooks/use-steps';
import { formatLongDate, getZonedParts, toDayKey } from '@/lib/datetime';
import { dayCounts } from '@/lib/day-plan';
import { withDeviceSteps } from '@/lib/today-tasks';
import { DAILY_STEP_GOAL } from '@/lib/steps/summary';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const BAR = 44;

/** Grey placeholder blocks, so nothing jumps when the plan loads. */
function TodaySkeleton() {
  const t = useT();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0.5, { duration: 800 })), -1);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={style} accessibilityLabel={t('hm.loadingPlan')} accessibilityRole="progressbar">
      {[220, 170, 280, 160, 250].map((h, i) => (
        <View key={i} className="mx-5 mb-4 rounded-2xl" style={{ height: h * 0.5, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      ))}
    </Animated.View>
  );
}

/** Today as a plain checklist, with water and meal photos under it. Starting the workout hands over to Home. */
export default function TodayPlanScreen() {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { now, format } = useDeviceClock();
  const parts = getZonedParts(now, format.timeZone);
  const todayKey = toDayKey(parts);
  const { data, error, notice, loading, refreshing, refresh, reload, toggleItem, pending, drink, undoDrink, waterBusy, lastDrinkMl } = useMyDay(todayKey);
  const { todaySteps } = useSteps(now, [parts], parts, data?.steps.goal || DAILY_STEP_GOAL);

  // The day with the larger of the server's and the phone's step count.
  const day = useMemo(() => (data ? withDeviceSteps(data, todaySteps) : null), [data, todaySteps]);
  const counts = day ? dayCounts(day) : null;
  const percent = day && counts ? Math.max(day.percent, counts.percent) : 0;

  const start = () => router.navigate({ pathname: '/', params: { start: '1' } } as never);
  const message = notice ?? error;
  const dietitian = data?.coaching.dietitianName;

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND} colors={[BRAND]} progressViewOffset={insets.top} />}
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 px-5" style={{ paddingBottom: 14 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="items-center justify-center rounded-full bg-card active:opacity-70"
            style={{ width: BAR, height: BAR }}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <View className="flex-1">
            <DisplayText {...COMPACT_TEXT} accessibilityRole="header" className="text-[24px] tracking-tight text-white" numberOfLines={1} adjustsFontSizeToFit={indic} style={indic ? { lineHeight: 34 } : undefined}>
              {t('hm.todayPlan')}
            </DisplayText>
            <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted" numberOfLines={indic ? 2 : 1}>
              {dietitian ? t('hm.dateSetBy', { date: formatLongDate(now, format), name: dietitian }) : formatLongDate(now, format)}
            </Text>
          </View>
        </View>

        {message ? (
          <View accessibilityRole="alert" className="mx-5 mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">
              {message}
            </Text>
            {error && !notice ? (
              <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted">
                {data ? t('hm.savedPlan') : t('hm.checkConnection')}
              </Text>
            ) : null}
            {error && !notice ? (
              <Pressable onPress={reload} accessibilityRole="button" accessibilityLabel={t('hm.retry')} className="mt-3 min-h-11 self-start justify-center rounded-full bg-brand px-5 active:opacity-80">
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
                  {t('hm.retry')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <TodaySkeleton />
        ) : day && counts ? (
          <>
            {/* Straight on the page, no card behind either part (the same look as the Activity tab). */}
            <DaySummary day={day} percent={percent} locale={format.locale} plain />

            <Checklist
              day={day}
              locale={format.locale}
              pending={pending}
              onToggle={toggleItem}
              onStart={start}
              onDrink={drink}
              onUndoDrink={undoDrink}
              waterBusy={waterBusy}
              lastDrinkMl={lastDrinkMl}
              onOpenSteps={() => router.push('/steps')}
              onAddPhoto={(type) => router.push({ pathname: '/add-meal', params: { type } })}
              plain
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
