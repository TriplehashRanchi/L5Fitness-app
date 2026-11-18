import type { Home } from '@/lib/fitness-api';
import { dayCounts } from '@/lib/day-plan';

/** The larger of what the phone counted and what the server has; null when neither knows. */
export function bestSteps(device: number | null, server: number | null | undefined) {
  if (device == null && server == null) return null;
  return Math.max(device ?? 0, server ?? 0);
}

/** Everything the card shows about progress, from the same data, so it moves the moment something changes. */
export function todayProgress(data: Home, deviceSteps: number | null) {
  const stepGoal = data.steps?.goal ?? data.settings.stepGoal;
  const steps = bestSteps(deviceSteps, data.steps?.value);
  const workoutDone = data.stats.workouts > 0;
  const counts = dayCounts({
    water: { totalMl: data.water.totalMl, goalMl: data.water.goalMl },
    steps: { value: steps, goal: stepGoal },
    diet: { total: data.diet?.total ?? 0, done: data.diet?.done ?? 0 },
    training: data.plan ? { done: workoutDone } : null,
  });
  return { ...counts, steps, stepGoal, workoutDone };
}
