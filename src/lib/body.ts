/** Body measurements and goal progress. Pure functions, no phone APIs. */
import type { Key, Translate } from '@/lib/i18n';

export type Goal = 'lose' | 'maintain' | 'gain';
export type Sex = 'female' | 'male' | 'other';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan';

/** The words for each answer: show them with `t(GOAL_KEY[goal])`. */
export const GOAL_KEY: Record<Goal, Key> = {
  lose: 'goal.lose',
  maintain: 'prof.goal.maintain',
  gain: 'goal.gain',
};
export const SEX_KEY: Record<Sex, Key> = { female: 'sex.female', male: 'sex.male', other: 'sex.other' };
export const DIET_KEY: Record<DietType, Key> = {
  vegetarian: 'diet.vegetarian',
  non_vegetarian: 'diet.non_vegetarian',
  eggetarian: 'diet.eggetarian',
  vegan: 'diet.vegan',
};
export const ACTIVITY_KEY: Record<Activity, { title: Key; hint: Key }> = {
  sedentary: { title: 'activity.sedentary', hint: 'activity.sedentaryHint' },
  light: { title: 'activity.light', hint: 'activity.lightHint' },
  moderate: { title: 'activity.moderate', hint: 'activity.moderateHint' },
  active: { title: 'activity.active', hint: 'activity.activeHint' },
  very_active: { title: 'activity.very_active', hint: 'activity.very_activeHint' },
};

/** Body mass index: weight (kg) / height (m) squared, one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** The standard adult BMI bands. A general guide, not a diagnosis. */
export function bmiCategory(value: number): { key: Key; tone: 'low' | 'ok' | 'high' } {
  if (value < 18.5) return { key: 'prof.bmi.under', tone: 'low' };
  if (value < 25) return { key: 'prof.bmi.healthy', tone: 'ok' };
  if (value < 30) return { key: 'prof.bmi.over', tone: 'high' };
  return { key: 'prof.bmi.obese', tone: 'high' };
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
export function goalRemaining(goal: Goal, current: number, target: number, t: Translate): string {
  if (goal === 'maintain') return Math.abs(current - target) <= 2 ? t('prof.left.onTarget') : t('prof.left.fromTarget', { kg: fmtKg(Math.abs(current - target)) });
  const left = goal === 'lose' ? current - target : target - current;
  if (left <= 0) return t('prof.left.reached');
  return t(goal === 'lose' ? 'prof.left.lose' : 'prof.left.gain', { kg: fmtKg(left) });
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
