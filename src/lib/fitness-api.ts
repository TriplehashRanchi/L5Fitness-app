/** Fitness data from L5Fitness-api: catalog, the member's tracking, classes. */
import { sendOrQueue } from '@/lib/outbox';
import { api, NetworkError } from '@/lib/http';
import { tr, type Key } from '@/lib/i18n';
import type { MealSlot } from '@/lib/wellness-api';

export type CoachingStatus = { status: 'not_shared' | 'pending' | 'accepted'; sharing: boolean; dietitianName: string | null; dietitianId: string | null };

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'all';

export type Workout = {
  id: string;
  slug: string;
  title: string;
  /** category slug, e.g. "strength" */
  category: string;
  level: Level;
  durationMin: number;
  /** estimated calories for the full workout */
  kcal: number;
  exerciseCount: number | null;
  focus: string | null;
  coach: string | null;
  /** icon key, see constants/icons.ts */
  icon: string;
  isProgram: boolean;
  instructions?: string;
  personal?: boolean;
};

export type Category = { slug: string; name: string; count: number };

export type GymClass = {
  /** id of the class in the weekly timetable */
  id: string;
  name: string;
  trainer: string;
  icon: string;
  durationMin: number;
  capacity: number;
  /** the gym's calendar date of this class, YYYY-MM-DD */
  date: string;
  /** exact start moment, ISO */
  startsAt: string;
  spotsLeft: number;
  /** true when the signed-in member has a place */
  booked: boolean;
};

export type Settings = { weeklyGoal: number; stepGoal: number; waterGoalMl: number };

/** Which goals the dietitian has fixed: true means the member cannot change it. */
export type Prescribed = { weeklyWorkouts?: number | null; steps?: number | null; waterMl?: number | null };

export type Targets = {
  waterMl: number | null;
  steps: number | null;
  weeklyWorkouts: number | null;
  calories: number | null;
  proteinG: number | null;
  prescribed: Prescribed;
};

export type WaterToday = { totalMl: number; lastId: string | null; goalMl: number };

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Meal = {
  id: string;
  mealType: MealType;
  note: string | null;
  /** the phone's calendar day, YYYY-MM-DD */
  day: string;
  eatenAt: string;
  /** short-lived link to the photo in storage, or null */
  photoUrl: string | null;
  /** What was eaten, from the food library, with the range the server worked out. Null for a photo or note only. */
  items?: { name: string; unit: string; count: number }[] | null;
  kcalMin?: number | null;
  kcalMax?: number | null;
  proteinMin?: number | null;
  proteinMax?: number | null;
};

/** The name of each meal: show it with `t(MEAL_LABEL_KEY[type])`. */
export const MEAL_LABEL_KEY: Record<MealType, Key> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  dinner: 'meal.dinner',
  snack: 'meal.snack',
};

export type Home = {
  /** Has the optional daily check-in been answered today? */
  checkedInToday: boolean;
  /** Set while the plan is paused for illness, injury or a clinician's restriction. */
  pause: import('@/lib/wellness-api').Pause | null;
  coaching: CoachingStatus;
  today: string;
  plan: Workout | null;
  /** today's totals; avgHeartRate is null without a heart-rate device */
  stats: { calories: number; minutes: number; avgHeartRate: number | null; workouts: number };
  week: {
    start: string;
    end: string;
    /** workouts per week the member aims for */
    goal: number;
    /** days (YYYY-MM-DD) with at least one workout */
    daysTrained: string[];
    done: number;
    percent: number;
  };
  categories: Category[];
  programs: Workout[];
  classes: GymClass[];
  settings: Settings;
  water: WaterToday;
  meals: Meal[];
  targets?: Targets;
  diet?: { total: number; done: number; next: { title: string; mealSlot: string } | null; items: DayItem[] };
  /** what the server has; the phone's pedometer may be higher */
  steps?: { value: number | null; goal: number };
};

/** The name of each level: show it with `t(LEVEL_LABEL_KEY[level])`. */
export const LEVEL_LABEL_KEY: Record<Level, Key> = {
  beginner: 'hm.levelBeginner',
  intermediate: 'hm.levelIntermediate',
  advanced: 'hm.levelAdvanced',
  all: 'hm.levelAll',
};

/** `today` and `weekStart` are the phone's own calendar days (YYYY-MM-DD). */
export function getHome(today: string, weekStart: string) {
  return api<Home>(`/home?today=${today}&weekStart=${weekStart}`);
}

export async function listWorkouts() {
  return (await api<{ workouts: Workout[] }>('/workouts')).workouts;
}

export async function listCategories() {
  return (await api<{ categories: Category[] }>('/workouts/categories')).categories;
}

/** Records a finished workout. The server works out the calories. */
export function logWorkout(input: { workoutId: string; startedAt: string; durationMin: number; day: string }) {
  return api('/workout-logs', { method: 'POST', body: input });
}

export async function bookClass(id: string, date: string) {
  return (await api<{ class: GymClass }>(`/classes/${id}/bookings`, { method: 'POST', body: { date } })).class;
}

export async function cancelBooking(id: string, date: string) {
  return (await api<{ class: GymClass }>(`/classes/${id}/bookings/${date}`, { method: 'DELETE' })).class;
}

// ── Settings ─────────────────────────────────────────────────────────────────────────────────

export async function getSettings() {
  return await api<{ settings: Settings; prescribed?: Prescribed }>('/me/settings');
}

/** Send only the goals that changed. */
export async function updateSettings(patch: Partial<Settings>) {
  return (await api<{ settings: Settings }>('/me/settings', { method: 'PUT', body: patch })).settings;
}

// ── Water ────────────────────────────────────────────────────────────────────────────────────

/** A drink of water. Returns the day's totals, or null when it was kept on the phone to send later (the screen keeps what it showed). */
export async function addWater(amountMl: number, day: string): Promise<WaterToday | null> {
  const out = await sendOrQueue<{ water: WaterToday }>({ kind: 'water', method: 'POST', path: '/water', body: { amountMl, day } });
  return out.queued ? null : out.data.water;
}

export async function undoWater(id: string, day: string) {
  return (await api<{ water: WaterToday }>(`/water/${id}?day=${day}`, { method: 'DELETE' })).water;
}

// ── Meals ────────────────────────────────────────────────────────────────────────────────────

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
// Camera photos are sent as taken (see add-meal.tsx), so the limit and the time allowed leave room for them.
// The API has the same limit (controllers/upload.controller.js).
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Uploads a photo straight to storage with a short-lived signed link, and returns its id.
 * The photo never passes through our server.
 */
export async function uploadPhoto(uri: string, mimeType?: string | null): Promise<string> {
  let blob: Blob;
  try {
    blob = await (await fetch(uri)).blob();
  } catch {
    throw new Error(tr('hm.photoRead'));
  }
  const wanted = (mimeType || blob.type || 'image/jpeg').toLowerCase().replace('image/jpg', 'image/jpeg');
  const contentType = PHOTO_TYPES.includes(wanted) ? wanted : 'image/jpeg';
  if (blob.size > MAX_PHOTO_BYTES) throw new Error(tr('hm.photoTooBig'));
  if (blob.size === 0) throw new Error(tr('hm.photoEmpty'));

  const created = await api<{ upload: { id: string }; uploadUrl: string; headers: Record<string, string> }>(
    '/uploads',
    { method: 'POST', body: { contentType, size: blob.size } }
  );
  let put: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    put = await fetch(created.uploadUrl, { method: 'PUT', headers: created.headers, body: blob, signal: controller.signal });
  } catch {
    throw new NetworkError(tr('hm.noServer'));
  } finally {
    clearTimeout(timer);
  }
  if (!put.ok) throw new Error(tr('hm.photoUpload'));
  await api(`/uploads/${created.upload.id}/complete`, { method: 'POST' });
  return created.upload.id;
}

export type SaveResult<T> = { queued: false; value: T } | { queued: true };

/**
 * Saves a meal. With no signal, a meal without a photo is kept on the phone and sent later, once. (A photo has
 * to be uploaded first, which needs a connection, so a meal with a photo is saved the usual way.)
 */
export async function saveMeal(input: Parameters<typeof createMeal>[0]): Promise<SaveResult<Meal>> {
  if (input.uploadId) return { queued: false, value: await createMeal(input) };
  const out = await sendOrQueue<{ meal: Meal }>({ kind: 'meal', method: 'POST', path: '/meals', body: input });
  return out.queued ? { queued: true } : { queued: false, value: out.data.meal };
}

export async function createMeal(input: {
  mealType: MealType;
  note?: string;
  uploadId?: string;
  items?: { foodId: string; portionId: string; count: number; oil?: string; coconut?: string }[];
  eatenAt: string;
  day: string;
}) {
  return (await api<{ meal: Meal }>('/meals', { method: 'POST', body: input })).meal;
}

export function deleteMeal(id: string) {
  return api(`/meals/${id}`, { method: 'DELETE' });
}

// ── Account ──────────────────────────────────────────────────────────────────────────────────

/** Erases everything we store about the member (the sign-in itself is removed by the app). */
export function deleteAccountData() {
  return api('/me', { method: 'DELETE' });
}

export type StepHistory = {
  from: string;
  to: string;
  /** today's step target (the dietitian's when `prescribed`) */
  goal: number;
  prescribed: boolean;
  /** one entry per calendar day, oldest first; `steps` is null when nothing was saved for that day */
  days: { day: string; steps: number | null }[];
};

/** The steps saved on the server for the `days` days up to `to` (YYYY-MM-DD). */
export function getStepHistory(to: string, days = 30) {
  return api<StepHistory>(`/me/steps?to=${to}&days=${days}`);
}

export type ActivityDay = {
  day: string;
  steps: number | null;
  waterMl: number;
  /** meal photos or notes logged */
  meals: number;
  dietPlanned: number;
  dietDone: number;
  workouts: number;
  workoutMinutes: number;
  workoutCalories: number;
};
export type ActivityRange = { from: string; to: string; goals: { steps: number; waterMl: number }; days: ActivityDay[] };

/** One row per day for the `days` days up to `to` (YYYY-MM-DD), oldest first: steps, water, meals and workouts. */
export function getActivity(to: string, days = 30) {
  return api<ActivityRange>(`/me/activity?to=${to}&days=${days}`);
}

/** Sends step counts so the coach can see them and they are kept. `entries` are 1 to 40 days, at most 35 days old. */
export function putSteps(entries: { day: string; steps: number }[]) {
  return api('/me/steps', { method: 'PUT', body: { entries } });
}

// ── One day, everything the dietitian planned and what is done ───────────────────────────────

export type DayItem = {
  id: string;
  mealSlot: MealSlot;
  title: string;
  details: string | null;
  calories: number | null;
  done: boolean;
};

export type MyDay = {
  day: string;
  coaching: CoachingStatus;
  targets: Targets | null;
  /** every diet item, the workout (if planned), water and steps count equally */
  percent: number;
  training: {
    id: string;
    title: string;
    durationMin: number;
    kcal: number;
    instructions: string | null;
    coach: string | null;
    done: boolean;
  } | null;
  diet: { total: number; done: number; items: DayItem[] };
  water: { totalMl: number; goalMl: number };
  steps: { value: number | null; goal: number };
  meals: { id: string; mealType: MealType; note: string | null; eatenAt: string; photoUrl: string | null }[];
  workouts: { id: string; title: string; startedAt: string; durationMin: number; calories: number }[];
};

/** `day` is a calendar day, YYYY-MM-DD. */
export function getMyDay(day: string) {
  return api<MyDay>(`/me/day?day=${day}`);
}
