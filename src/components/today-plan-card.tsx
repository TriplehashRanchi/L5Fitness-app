import { router } from 'expo-router';
import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CardHeader } from '@/components/today-card/card-header';
import { DietBlock } from '@/components/today-card/diet-block';
import { PhotosBlock } from '@/components/today-card/photos-block';
import { todayProgress } from '@/components/today-card/plan-progress';
import { StepsBlock, type StepsConnection } from '@/components/today-card/steps-block';
import { COMPACT_TEXT } from '@/components/today-card/ui';
import { useTodayCard } from '@/components/today-card/use-today-card';
import { WaterBlock } from '@/components/today-card/water-block';
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

/** The one card on Home: today's workout, diet, water, steps and meal photos, with a quick action for each. */
export function TodayPlanCard({
  data,
  setData,
  today,
  locale,
  deviceSteps,
  connection,
  workoutActive,
  waterBusy,
  onAddWater,
  onUndoWater,
  onStartWorkout,
}: {
  data: Home;
  setData: Dispatch<SetStateAction<Home | null>>;
  today: CalendarDay;
  locale: string;
  /** What the phone's pedometer counted today, or null. */
  deviceSteps: number | null;
  connection: StepsConnection;
  workoutActive: boolean;
  waterBusy: boolean;
  /** Each resolves to an error message, or null when saved. */
  onAddWater: (ml: number) => Promise<string | null>;
  onUndoWater: () => Promise<string | null>;
  onStartWorkout: () => void;
}) {
  const todayKey = toDayKey(today);
  const card = useTodayCard(setData, todayKey);
  const progress = todayProgress(data, deviceSteps);
  const dateLabel = dateLabelFor(today, locale);

  return (
    <View className="mx-5 mb-5 rounded-3xl border border-white/5 bg-card" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
      <CardHeader
        dateLabel={dateLabel}
        percent={progress.percent}
        done={progress.done}
        total={progress.total}
      />
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
        <WaterBlock water={data.water} busy={waterBusy} onAdd={onAddWater} onUndo={onUndoWater} />
        <StepsBlock
          steps={progress.steps}
          goal={progress.stepGoal}
          locale={locale}
          connection={connection}
          saving={card.savingSteps}
          error={card.stepsError}
          onSave={card.saveSteps}
          onClearError={card.clearStepsError}
          onHistory={() => router.push('/steps' as never)}
        />
        <PhotosBlock meals={data.meals} onAdd={() => router.push('/add-meal')} />
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
