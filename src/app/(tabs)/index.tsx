import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyHero } from '@/components/body-hero';
import { HomeHeader } from '@/components/home-header';
import { planCopy } from '@/lib/plan-copy';
import { GoalsTile, StepsTile } from '@/components/home-summary-card';
import { OfferCard } from '@/components/offer-card';
import { PlanHeroCard } from '@/components/plan-hero-card';
import { todayProgress } from '@/components/today-card/plan-progress';
import { ActiveWorkoutCard } from '@/components/active-workout/active-workout-card';
import { SHOW_WORKOUT, TodayCardSkeleton, TodayPlanCard } from '@/components/today-plan-card';
import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useHome } from '@/hooks/use-home';
import { useSteps } from '@/hooks/use-steps';
import { useNotifications } from '@/providers/notifications-provider';
import {
  formatTime,
  getWeekDays,
  getZonedParts,
  isSameDay,
  toDayKey,
  type CalendarDay,
} from '@/lib/datetime';
import {
  addWater,
  undoWater,
  logWorkout,
} from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import {
  clearActiveWorkout,
  loadActiveWorkout,
  saveActiveWorkout,
  type ActiveWorkout,
} from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';
import { DAILY_STEP_GOAL } from '@/lib/steps/summary';

const BRAND = '#3ddc68';

/** On web the tab bar sits at the top of the page instead of the bottom. */
const WEB_TOP_BAR = 72;

/** Keeps compact labels from overflowing when the user has very large system text. */

/** If "Finish" is pressed much later (the member forgot), count at most this long. */
const MAX_WORKOUT_MIN = 240;

/** Whole minutes from `start` until this moment. */
const minutesSince = (start: Date) => Math.round((Date.now() - start.getTime()) / 60_000);

export default function HomeScreen() {
  const { role } = useProfile();
  const insets = useSafeAreaInsets();
  const { now, format, firstWeekday } = useDeviceClock();
  const [weekOffset, setWeekOffset] = useState(0);
  const router = useRouter();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const userName = session?.user.name ?? 'Athlete';
  const { unread, openInbox } = useNotifications();
  const onAvatarPress = () => router.navigate('/profile');

  // Everything "today" is computed in the phone's time zone.
  const nowParts = getZonedParts(now, format.timeZone);
  const today: CalendarDay = nowParts;
  const week = getWeekDays(today, firstWeekday);

  // Everything below comes from the API: the member's own numbers and the gym's catalog.
  const { data, error, loading, refreshing, refresh, reload, setData } = useHome(
    toDayKey(today),
    toDayKey(week[0])
  );
  const stepGoal = data?.settings.stepGoal ?? DAILY_STEP_GOAL;
  const steps = useSteps(now, week, today, stepGoal);
  const onRefresh = async () => {
    await Promise.all([refresh(), steps.reload()]);
  };
  const plan = data?.plan ?? null;
  const { title: heroTitle } = planCopy(data, loading);
  const planPercent = data ? todayProgress(data, steps.todaySteps).percent : null;
  const todayIndex = week.findIndex((d) => isSameDay(d, today));
  /** Which button is waiting on the server: 'workout' or a class id. */
  const [busy, setBusy] = useState<string | null>(null);
  /** A problem with the last action, shown at the top of the screen. */
  const [notice, setNotice] = useState<string | null>(null);

  // The workout in progress, if any. Kept on the device so it survives closing the app.
  const [active, setActive] = useState<ActiveWorkout | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadActiveWorkout(userId).then((saved) => {
      if (!cancelled) setActive(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeStart = useMemo(
    () => (active?.startedAt ? new Date(active.startedAt) : null),
    [active]
  );

  const [nowTick, setNowTick] = useState(() => Date.now());

  // Live ticking clock for active workout
  useEffect(() => {
    if (!activeStart) return;
    const id = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [activeStart]);

  const activeSeconds = activeStart ? Math.max(0, Math.floor((nowTick - activeStart.getTime()) / 1000)) : 0;

  const elapsedMin = Math.floor(activeSeconds / 60);
  const elapsedSec = activeSeconds % 60;
  const activeTimeDisplay = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;
  // Live burn estimation: approx 7.5 to 9 kcal per minute while working out
  const liveBurnKcal = Math.round(activeSeconds * 0.14);

  const startWorkout = async () => {
    if (!plan || !userId) return;
    const next: ActiveWorkout = {
      userId,
      workoutId: plan.id,
      title: plan.title,
      instructions: plan.instructions,
      startedAt: new Date().toISOString(),
    };
    setNotice(null);
    setActive(next);
    await saveActiveWorkout(next);
  };

  // "Start workout" on the Today's plan screen comes back here with ?start=1: start once the plan is loaded.
  useEffect(() => {
    if (start !== '1') return;
    // The workout section is off Home for now, so there is nowhere to show a running workout.
    if (!SHOW_WORKOUT) {
      router.setParams({ start: undefined });
      return;
    }
    if (!plan || !userId) return;
    router.setParams({ start: undefined });
    if (!active) queueMicrotask(() => void startWorkout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, plan, userId]);

  const finishWorkout = async () => {
    if (!active || !activeStart) return;
    setBusy('workout');
    setNotice(null);
    const minutes = minutesSince(activeStart);
    try {
      await logWorkout({
        workoutId: active.workoutId,
        startedAt: active.startedAt,
        durationMin: Math.min(MAX_WORKOUT_MIN, Math.max(1, minutes)),
        day: toDayKey(getZonedParts(activeStart, format.timeZone)),
      });
      setActive(null);
      await clearActiveWorkout();
      await reload();
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setBusy(null);
    }
  };

  const discardWorkout = async () => {
    setNotice(null);
    setActive(null);
    await clearActiveWorkout();
  };

  // Water: the total moves at once and is then confirmed by the server's own number.
  const today_key = toDayKey(today);
  /** Resolves to an error message, or null when saved. */
  const changeWater = async (run: () => Promise<NonNullable<typeof data>['water']>, optimisticMl: number) => {
    setBusy('water');
    setData((prev) =>
      prev ? { ...prev, water: { ...prev.water, totalMl: Math.max(0, prev.water.totalMl + optimisticMl) } } : prev
    );
    try {
      const next = await run();
      setData((prev) => (prev ? { ...prev, water: next } : prev));
      return null;
    } catch (e) {
      // Take back the amount that was shown but not saved.
      setData((prev) =>
        prev
          ? { ...prev, water: { ...prev.water, totalMl: Math.max(0, prev.water.totalMl - optimisticMl) } }
          : prev
      );
      return messageFrom(e);
    } finally {
      setBusy(null);
    }
  };
  const onAddWater = (ml: number) => changeWater(() => addWater(ml, today_key), ml);
  const onUndoWater = async () => {
    const last = data?.water.lastId;
    return last ? changeWater(() => undoWater(last, today_key), 0) : null;
  };

  const message = notice ?? error;

  const isWeb = Platform.OS === 'web';
  const topPadding = insets.top + (isWeb ? WEB_TOP_BAR : 8);
  const bottomPadding = insets.bottom + (isWeb ? 0 : BottomTabInset) + 28;

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topPadding,
          width: '100%',
          maxWidth: 840,
          alignSelf: 'center',
          paddingBottom: bottomPadding,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        scrollIndicatorInsets={{ top: insets.top, bottom: bottomPadding - 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
            colors={[BRAND]}
            progressViewOffset={topPadding}
          />
        }
        showsVerticalScrollIndicator={false}>
        <HomeHeader
          userName={userName}
          image={session?.user.image}
          unread={unread}
          today={today}
          firstWeekday={firstWeekday}
          locale={format.locale}
          offset={weekOffset}
          onOffsetChange={setWeekOffset}
          onNotifications={() => openInbox(true)}
          onProfile={onAvatarPress}
          hero={
            <BodyHero
              data={data}
              steps={steps.todaySteps}
              waterBusy={busy === 'water'}
              onAddWater={async (ml) => {
                const problem = await onAddWater(ml);
                if (problem) setNotice(problem);
              }}
              onUndoWater={async () => {
                const problem = await onUndoWater();
                if (problem) setNotice(problem);
              }}
            />
          }
        />

        {/* Global Error/Notice banner */}
        {message ? (
          <View
            accessibilityRole="alert"
            className="mx-5 mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm font-semibold text-white">{message}</Text>
            {error && !notice ? (
              <Text className="mt-0.5 text-xs text-muted">Pull down to refresh and try again.</Text>
            ) : null}
            {error && !data ? (
              <Pressable
                onPress={refresh}
                accessibilityRole="button"
                className="mt-3 self-start rounded-full bg-brand px-5 py-2 active:opacity-80">
                <Text className="text-sm font-bold text-ink">Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 10 }} />
        {/* Hero: today's workout plan. A running workout shows further down, in Today's plan, where it was started. */}
        <PlanHeroCard
          title={heroTitle}
          subtitle={
            plan
              ? plan.title
              : loading
                ? ' '
                : data?.coaching.status === 'not_shared'
                  ? 'Turn on sharing to get plans'
                  : data?.coaching.status === 'pending'
                    ? 'Your plan is on the way'
                    : 'No plan added yet'
          }
          notchX={weekOffset === 0 && todayIndex >= 0 ? (todayIndex + 0.5) / 7 : null}
          onPress={() => router.push('/today-plan' as never)}
        />

        {/* Steps + goals tiles */}
        <View className="mx-5 mb-5 flex-row gap-3">
          <StepsTile steps={steps.todaySteps} goal={stepGoal} locale={format.locale} onPress={() => router.push('/steps' as never)} />
          <GoalsTile percent={planPercent} />
        </View>

        {/* Today's plan: the one card on Home, each part with its own quick action. */}
        {data ? (
          <TodayPlanCard
            data={data}
            setData={setData}
            today={today}
            locale={format.locale}
            workoutActive={!!active}
            liveWorkout={
              active ? (
                <ActiveWorkoutCard
                  title={active.title}
                  instructions={active.instructions}
                  startedLabel={formatTime(activeStart ?? now, format)}
                  timeDisplay={activeTimeDisplay}
                  kcal={liveBurnKcal}
                  busy={busy === 'workout'}
                  onFinish={finishWorkout}
                  onCancel={discardWorkout}
                />
              ) : null
            }
            onStartWorkout={startWorkout}
          />
        ) : loading ? (
          <TodayCardSkeleton />
        ) : null}

        {/* The challenge offer closes the page. It is for members: it sends them to their dietitian. */}
        {role === 'member' ? <OfferCard /> : null}

      </ScrollView>

      {/* Solid strip behind status bar on mobile */}
      {!isWeb ? (
        <View
          className="absolute left-0 right-0 top-0"
          style={{ height: insets.top, pointerEvents: 'none', backgroundColor: 'rgba(0,0,0,0.95)' }}
        />
      ) : null}
    </View>
  );
}
