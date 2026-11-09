/**
 * Turns seven daily step counts into what the Home chart shows.
 * Pure functions with no phone APIs, so the arithmetic can be tested on its own.
 */

/** Daily target the progress bar and chart aim at. The WHO-style "10,000 steps a day". */
export const DAILY_STEP_GOAL = 10_000;

export type DayBar = {
  key: string;
  /** null = not known (day not started yet, or it could not be read) */
  steps: number | null;
  /** 0 to 1: bar height against the chart's scale */
  ratio: number;
  reachedGoal: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type WeekSummary = {
  bars: DayBar[];
  /** Steps that make a full-height bar: the goal, or the best day if that is higher */
  scale: number;
  goalRatio: number;
  total: number;
  /** Average over the days that have passed (including today); 0 when none */
  average: number;
  daysReachedGoal: number;
  daysCounted: number;
};

export function summarizeWeek(
  keys: string[],
  counts: (number | null)[],
  todayKey: string,
  goal: number = DAILY_STEP_GOAL
): WeekSummary {
  const clean = counts.map((n) => (n == null || !Number.isFinite(n) || n < 0 ? null : Math.round(n)));
  const best = clean.reduce<number>((max, n) => (n != null && n > max ? n : max), 0);
  const scale = Math.max(goal, best);

  let total = 0;
  let daysCounted = 0;
  let daysReachedGoal = 0;

  const bars = keys.map((key, i) => {
    // Day keys are YYYY-MM-DD, so plain text comparison orders them correctly.
    const isFuture = key > todayKey;
    const steps = isFuture ? null : (clean[i] ?? null);
    if (steps != null) {
      total += steps;
      daysCounted += 1;
      if (steps >= goal) daysReachedGoal += 1;
    }
    return {
      key,
      steps,
      ratio: steps == null ? 0 : Math.min(1, steps / scale),
      reachedGoal: steps != null && steps >= goal,
      isToday: key === todayKey,
      isFuture,
    };
  });

  return {
    bars,
    scale,
    goalRatio: goal / scale,
    total,
    average: daysCounted ? Math.round(total / daysCounted) : 0,
    daysReachedGoal,
    daysCounted,
  };
}

/** 8240 → "8.2k", 850 → "850", 12000 → "12k". Short enough to sit above a chart bar. */
export function compactSteps(steps: number): string {
  if (steps < 1000) return String(steps);
  const thousands = steps / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`;
}

/** Share of the goal reached, as a whole percent, never above 100. */
export function goalPercent(steps: number, goal: number = DAILY_STEP_GOAL): number {
  return Math.min(100, Math.round((steps / goal) * 100));
}
