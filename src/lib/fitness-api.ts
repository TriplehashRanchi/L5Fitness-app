/** Fitness data from L5Fitness-api: catalog, the member's tracking, classes. */
import { api } from '@/lib/http';

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
