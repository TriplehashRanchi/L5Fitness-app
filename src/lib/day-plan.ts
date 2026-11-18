import type { MyDay } from '@/lib/fitness-api';

/** How many things the day asks for and how many are done: every diet item, the workout (if planned), water and steps. */
export function dayCounts(day: {
  water: MyDay['water'];
  steps: MyDay['steps'];
  diet: { total: number; done: number };
  training: { done: boolean } | null;
}) {
  const waterDone = day.water.goalMl > 0 && day.water.totalMl >= day.water.goalMl;
  const stepsDone = day.steps.value != null && day.steps.goal > 0 && day.steps.value >= day.steps.goal;
  const total = day.diet.total + (day.training ? 1 : 0) + 2;
  const done = day.diet.done + (day.training?.done ? 1 : 0) + (waterDone ? 1 : 0) + (stepsDone ? 1 : 0);
  // Same rule as the server's `percent`: water and steps count in part (half the water = half a point).
  const part = (value: number, goal: number) => (goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0);
  const points =
    day.diet.done + (day.training?.done ? 1 : 0) + part(day.water.totalMl, day.water.goalMl) + part(day.steps.value ?? 0, day.steps.goal);
  return { done, total, waterDone, stepsDone, percent: total > 0 ? Math.round((points / total) * 100) : 0 };
}
