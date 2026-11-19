import { router } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DietBlock } from '@/components/today-card/diet-block';
import { todayProgress } from '@/components/today-card/plan-progress';
import { DisplayText } from '@/components/display-text';
import { COMPACT_TEXT } from '@/components/today-card/ui';
import { useTodayCard } from '@/components/today-card/use-today-card';
import { WorkoutBlock } from '@/components/today-card/workout-block';
import { toDayKey, type CalendarDay } from '@/lib/datetime';
import type { Home } from '@/lib/fitness-api';

export { TodayCardSkeleton } from '@/components/today-card/skeleton';

/** "Mon, 17 Nov" for a calendar day, in the member's language. */
function dateLabelFor(day: CalendarDay, locale: string) {
  try {
    return new Date(Date.UTC(day.year, day.month - 1, day.day, 12)).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return toDayKey(day);
  }
}

/**
 * Today's plan on Home: the workout and the diet, each with its quick action.
 * Water, steps, calories and meal photos live in the body section at the top of Home, so they are not repeated here.
 */
export function TodayPlanCard({
  data,
  setData,
  today,
  locale,
  workoutActive,
  onStartWorkout,
}: {
  data: Home;
  setData: Dispatch<SetStateAction<Home | null>>;
  today: CalendarDay;
  locale: string;
  workoutActive: boolean;
  onStartWorkout: () => void;
}) {
  const todayKey = toDayKey(today);
  const card = useTodayCard(setData, todayKey);
  const progress = todayProgress(data, null);
  const dateLabel = dateLabelFor(today, locale);

  return (
    <View className="mx-5 mb-5 rounded-3xl border border-white/5 bg-card" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
      <View className="flex-row items-baseline justify-between gap-3">
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} className="text-[22px] leading-7 tracking-tight text-white">
          Today’s plan
        </DisplayText>
        <Text {...COMPACT_TEXT} numberOfLines={1} className="text-sm text-muted">
          {dateLabel}
        </Text>
      </View>
      <View className="mt-3">
        <WorkoutBlock
          plan={data.plan}
          done={progress.workoutDone}
          active={workoutActive}
          dateLabel={dateLabel}
          coaching={data.coaching}
          onStart={onStartWorkout}
          onOpen={() => router.push('/today-plan' as never)}
        />
        <DietBlock
          diet={data.diet}
          coaching={data.coaching}
          pending={card.pending}
          error={card.dietError}
          onToggle={card.toggleItem}
          onOpen={() => router.navigate('/diet')}
        />
      </View>
      <Pressable
        onPress={() => router.push('/today-plan' as never)}
        accessibilityRole="link"
        accessibilityLabel="See full plan"
        className="min-h-11 items-center justify-center border-t border-white/5 active:opacity-60">
        <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
          See full plan
        </Text>
      </Pressable>
    </View>
  );
}
