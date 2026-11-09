/** Fitness data from L5Fitness-api: catalog, the member's tracking, classes. */
import { api, NetworkError } from '@/lib/http';

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
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export type Home = {
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
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all: 'All levels',
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
  return (await api<{ settings: Settings }>('/me/settings')).settings;
}

/** Send only the goals that changed. */
export async function updateSettings(patch: Partial<Settings>) {
  return (await api<{ settings: Settings }>('/me/settings', { method: 'PUT', body: patch })).settings;
}

// ── Water ────────────────────────────────────────────────────────────────────────────────────

export async function addWater(amountMl: number, day: string) {
  return (await api<{ water: WaterToday }>('/water', { method: 'POST', body: { amountMl, day } })).water;
}

export async function undoWater(id: string, day: string) {
  return (await api<{ water: WaterToday }>(`/water/${id}?day=${day}`, { method: 'DELETE' })).water;
}

// ── Meals ────────────────────────────────────────────────────────────────────────────────────

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Uploads a photo straight to storage with a short-lived signed link, and returns its id.
 * The photo never passes through our server.
 */
export async function uploadPhoto(uri: string, mimeType?: string | null): Promise<string> {
  let blob: Blob;
  try {
    blob = await (await fetch(uri)).blob();
  } catch {
    throw new Error('Could not read that photo. Please choose another one.');
  }
  const wanted = (mimeType || blob.type || 'image/jpeg').toLowerCase().replace('image/jpg', 'image/jpeg');
  const contentType = PHOTO_TYPES.includes(wanted) ? wanted : 'image/jpeg';
  if (blob.size > MAX_PHOTO_BYTES) throw new Error('That photo is larger than 10 MB. Choose a smaller one.');
  if (blob.size === 0) throw new Error('That photo is empty. Please choose another one.');

  const created = await api<{ upload: { id: string }; uploadUrl: string; headers: Record<string, string> }>(
    '/uploads',
    { method: 'POST', body: { contentType, size: blob.size } }
  );
  let put: Response;
  try {
    put = await fetch(created.uploadUrl, { method: 'PUT', headers: created.headers, body: blob });
  } catch {
    throw new NetworkError("Can't reach the server. Check your internet connection and try again.");
  }
  if (!put.ok) throw new Error('The photo could not be uploaded. Please try again.');
  await api(`/uploads/${created.upload.id}/complete`, { method: 'POST' });
  return created.upload.id;
}

export async function createMeal(input: {
  mealType: MealType;
  note?: string;
  uploadId?: string;
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
