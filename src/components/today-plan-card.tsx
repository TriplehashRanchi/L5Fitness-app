import { router } from 'expo-router';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { DietBlock } from '@/components/today-card/diet-block';
import { todayProgress } from '@/components/today-card/plan-progress';
import { DisplayText } from '@/components/display-text';
import { COMPACT_TEXT } from '@/components/today-card/ui';
import { useTodayCard } from '@/components/today-card/use-today-card';
import { WorkoutBlock } from '@/components/today-card/workout-block';
import { toDayKey, type CalendarDay } from '@/lib/datetime';
import { SHOW_WORKOUT } from '@/lib/features';
import type { Home } from '@/lib/fitness-api';

export { SHOW_WORKOUT };

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
 * Today's plan on Home: the workout (or the running workout, once started) and the diet, each with its quick action.
 * Water, steps, calories and meal photos live in the body section at the top of Home, so they are not repeated here.
 */
export function TodayPlanCard({
  data,
  setData,
  today,
  locale,
  workoutActive,
  liveWorkout,
  onStartWorkout,
}: {
  data: Home;
  setData: Dispatch<SetStateAction<Home | null>>;
  today: CalendarDay;
  locale: string;
  workoutActive: boolean;
  /** The running workout, shown in place of the workout block. */
  liveWorkout?: ReactNode;
  onStartWorkout: () => void;
}) {
  const todayKey = toDayKey(today);
  const card = useTodayCard(setData, todayKey);
  const progress = todayProgress(data, null);
  const dateLabel = dateLabelFor(today, locale);
  const live = SHOW_WORKOUT ? liveWorkout : null;

  return (
    <View className="mx-5 mb-5" style={{ paddingTop: 8, paddingBottom: 4 }}>
      <View className="flex-row items-center gap-3">
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="flex-1 text-[22px] leading-7 tracking-tight text-white">
          Today’s plan
        </DisplayText>
        <Text {...COMPACT_TEXT} numberOfLines={1} className="text-sm text-muted">
          {dateLabel}
        </Text>
        {/* The whole day on its own screen. */}
        <Pressable
          onPress={() => router.push('/today-plan' as never)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel="See full plan"
          className="flex-row items-center rounded-full bg-brand active:opacity-80"
          style={{ gap: 4, minHeight: 34, paddingLeft: 12, paddingRight: 9 }}>
          <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[13px] font-black text-ink">
            Full plan
          </Text>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#050a07" size={11} />
        </Pressable>
      </View>
      <View className="mt-3">
        {live ?? (!SHOW_WORKOUT ? null : (
          <WorkoutBlock
            plan={data.plan}
            done={progress.workoutDone}
            active={workoutActive}
            dateLabel={dateLabel}
            coaching={data.coaching}
            onStart={onStartWorkout}
            onOpen={() => router.push('/today-plan' as never)}
          />
        ))}
        <DietBlock
          first={!SHOW_WORKOUT}
          diet={data.diet}
          coaching={data.coaching}
          pending={card.pending}
          error={card.dietError}
          onToggle={card.toggleItem}
          onOpen={() => router.push('/today-plan' as never)}
        />
      </View>
    </View>
  );
}
