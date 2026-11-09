/** Body measurements and goal progress. Pure functions, no phone APIs. */

export type Goal = 'lose' | 'maintain' | 'gain';
export type Sex = 'female' | 'male' | 'other';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan';

export const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Stay at my weight',
  gain: 'Gain weight',
};
export const SEX_LABEL: Record<Sex, string> = { female: 'Female', male: 'Male', other: 'Other' };
export const DIET_LABEL: Record<DietType, string> = {
  vegetarian: 'Vegetarian',
  non_vegetarian: 'Non-vegetarian',
  eggetarian: 'Eggetarian',
  vegan: 'Vegan',
};
export const ACTIVITY_LABEL: Record<Activity, { title: string; hint: string }> = {
  sedentary: { title: 'Mostly sitting', hint: 'Desk job, little exercise' },
  light: { title: 'Lightly active', hint: 'Exercise 1 to 3 days a week' },
  moderate: { title: 'Moderately active', hint: 'Exercise 3 to 5 days a week' },
  active: { title: 'Very active', hint: 'Hard exercise 6 to 7 days a week' },
  very_active: { title: 'Athlete', hint: 'Daily hard training or a physical job' },
};

/** Body mass index: weight (kg) / height (m) squared, one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** The standard adult BMI bands. A general guide, not a diagnosis. */
export function bmiCategory(value: number): { label: string; tone: 'low' | 'ok' | 'high' } {
  if (value < 18.5) return { label: 'Underweight', tone: 'low' };
  if (value < 25) return { label: 'Healthy range', tone: 'ok' };
  if (value < 30) return { label: 'Overweight', tone: 'high' };
  return { label: 'Obese range', tone: 'high' };
}

/**
 * How far along the member is, 0 to 1. For "lose": start 82 → now 78 → target 75 is 4 of 7 kg.
 * Going the wrong way counts as 0, passing the target counts as 1. "Maintain" is 1 while within 2 kg.
 */
export function goalProgress(goal: Goal, start: number, current: number, target: number): number {
  if (goal === 'maintain') return Math.abs(current - target) <= 2 ? 1 : 0;
  const total = target - start;
  if (total === 0) return 1;
  return Math.min(1, Math.max(0, (current - start) / total));
}

/** "7.5 kg to lose", "2 kg to gain", "Goal reached". */
export function goalRemaining(goal: Goal, current: number, target: number): string {
  if (goal === 'maintain') return Math.abs(current - target) <= 2 ? 'On target' : `${fmtKg(Math.abs(current - target))} from target`;
  const left = goal === 'lose' ? current - target : target - current;
  if (left <= 0) return 'Goal reached 🎉';
  return `${fmtKg(left)} to ${goal === 'lose' ? 'lose' : 'gain'}`;
}

/** 7.5 → "7.5 kg", 80 → "80 kg". */
export function fmtKg(kg: number): string {
  return `${parseFloat(kg.toFixed(1))} kg`;
}

/** Reads what a person typed: "72.5" or "72,5". Returns null when it is not a number. */
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Age in whole years on a given day (all YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * Builds YYYY-MM-DD from three typed parts and checks it is a real date.
 * Returns null for things like 31/02/1990.
 */
export function toBirthDate(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
