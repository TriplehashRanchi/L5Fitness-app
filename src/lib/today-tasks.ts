import { dayCounts } from '@/lib/day-plan';
import type { DayItem, MyDay } from '@/lib/fitness-api';
import type { Key } from '@/lib/i18n';
import { SLOT_ORDER } from '@/lib/wellness-api';

/** The day with the larger of the server's and the phone's step count (both are real; the bigger one is the newer). */
export function withDeviceSteps(day: MyDay, deviceSteps: number | null): MyDay {
  const server = day.steps.value;
  const value = deviceSteps == null ? server : server == null ? deviceSteps : Math.max(server, deviceSteps);
  return value === server ? day : { ...day, steps: { ...day.steps, value } };
}

/** Diet items in day order: breakfast, lunch, snack, dinner, supplement (the plan's own order within a slot). */
export function orderedItems(items: DayItem[]): DayItem[] {
  return SLOT_ORDER.flatMap((slot) => items.filter((i) => i.mealSlot === slot));
}

export type NextTask =
  | { kind: 'workout' }
  | { kind: 'meal'; item: DayItem }
  | { kind: 'water'; remainingMl: number }
  | { kind: 'steps'; remaining: number };

/** The first thing not done yet: workout, then meals in order, then water, then steps. Null when nothing is left. */
export function nextTask(day: MyDay): NextTask | null {
  if (day.training && !day.training.done) return { kind: 'workout' };
  const meal = orderedItems(day.diet.items).find((i) => !i.done);
  if (meal) return { kind: 'meal', item: meal };
  const { waterDone, stepsDone } = dayCounts(day);
  if (!waterDone && day.water.goalMl > 0) return { kind: 'water', remainingMl: day.water.goalMl - day.water.totalMl };
  if (!stepsDone && day.steps.goal > 0) return { kind: 'steps', remaining: day.steps.goal - (day.steps.value ?? 0) };
  return null;
}

/** Calories of the planned meals, and of those ticked (items without calories are left out of both). */
export function calorieSummary(items: DayItem[]) {
  let planned = 0;
  let ticked = 0;
  for (const i of items) {
    if (!i.calories) continue;
    planned += i.calories;
    if (i.done) ticked += i.calories;
  }
  return { planned, ticked };
}

/** A short line for how far along the day is. Show it with `t(progressLineKey(percent))`. */
export function progressLineKey(percent: number): Key {
  if (percent >= 100) return 'hm.dayComplete';
  if (percent >= 85) return 'hm.almostThere';
  if (percent >= 50) return 'hm.goodPace';
  if (percent > 0) return 'hm.momentum';
  return 'hm.letsStart';
}
