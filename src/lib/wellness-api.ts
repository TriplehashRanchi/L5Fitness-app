/** Profile, weight, workout history, diet plans and the dietitian tools (all from L5Fitness-api). */
import type { Activity, DietType, Goal, Sex } from '@/lib/body';
import { api } from '@/lib/http';

export type BodyProfile = {
  goal: Goal;
  sex: Sex;
  birthDate: string;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  startWeightKg: number;
  activityLevel: Activity;
  dietType: DietType;
  allergies: string | null;
  medicalNotes: string | null;
  shareWithDietitian: boolean;
};

export type WeightEntry = { id: string; weightKg: number; day: string };
export type Role = 'member' | 'dietitian';

export type ProfileState = {
  role: Role;
  completed: boolean;
  profile: BodyProfile | null;
  /** newest first */
  weightHistory: WeightEntry[];
};

/** What the setup form sends. `day` is the phone's calendar day. */
export type ProfileInput = Omit<BodyProfile, 'age' | 'startWeightKg'> & { day: string };

export const finishSetup = () => api<ProfileState>('/me/onboarding/complete', { method: 'POST' });
export const getProfile = () => api<ProfileState>('/me/profile');
export const saveProfile = (input: ProfileInput) => api<ProfileState>('/me/profile', { method: 'PUT', body: input });
export const addWeight = (weightKg: number, day: string) =>
  api<{ profile: BodyProfile; weightHistory: WeightEntry[] }>('/me/weight', { method: 'POST', body: { weightKg, day } });

// ── Workout history ──────────────────────────────────────────────────────────────────────────

export type HistoryWorkout = { id: string; title: string; durationMin: number; calories: number; startedAt: string };
export type HistoryDay = { day: string; workouts: HistoryWorkout[]; totalMinutes: number; totalCalories: number };
export type History = {
  summary: { workouts: number; minutes: number; calories: number; activeDays: number } | null;
  days: HistoryDay[];
  nextBefore: string | null;
};

export const getHistory = (before?: string) =>
  api<History>(`/workout-logs/history?limit=14${before ? `&before=${before}` : ''}`);

// ── Diet plans ───────────────────────────────────────────────────────────────────────────────

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supplement';
export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'supplement'];
export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  supplement: 'Supplement',
};

export type DietItem = {
  id: string;
  day: string;
  mealSlot: MealSlot;
  title: string;
  details: string | null;
  calories: number | null;
  done: boolean;
};
export type WeekDay = { day: string; total: number; done: number };

export type DietDay = {
  day: string;
  items: DietItem[];
  summary: { total: number; done: number };
  week: WeekDay[];
  /** false when the member has not agreed to share with the dietitian */
  sharing: boolean;
};

export const getDiet = (day: string, weekStart: string) => api<DietDay>(`/diet?day=${day}&weekStart=${weekStart}`);
export const tickItem = (id: string) => api(`/diet/items/${id}/done`, { method: 'PUT' });
export const untickItem = (id: string) => api(`/diet/items/${id}/done`, { method: 'DELETE' });

// ── Dietitian tools ──────────────────────────────────────────────────────────────────────────

export type ClientSummary = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  goal: Goal;
  weightKg: number;
  targetWeightKg: number;
  planned7: number;
  done7: number;
};

export type ClientDetail = {
  client: { id: string; name?: string; email?: string; image?: string | null };
  profile: BodyProfile;
  weightHistory: WeightEntry[];
  adherence: { planned: number; done: number };
  recentWorkouts: HistoryDay[];
};

export type PlanDay = { day: string; items: DietItem[]; week: WeekDay[] };
export type NewItem = { day: string; mealSlot: MealSlot; title: string; details?: string; calories?: number };

export const listClients = (q: string) =>
  api<{ clients: ClientSummary[] }>(`/dietitian/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const getClient = (id: string) => api<ClientDetail>(`/dietitian/clients/${encodeURIComponent(id)}`);
export const getClientPlan = (id: string, day: string, weekStart: string) =>
  api<PlanDay>(`/dietitian/clients/${encodeURIComponent(id)}/plan?day=${day}&weekStart=${weekStart}`);
export const addPlanItem = (id: string, item: NewItem) =>
  api<{ item: DietItem }>(`/dietitian/clients/${encodeURIComponent(id)}/plan`, { method: 'POST', body: item });
export const removePlanItem = (itemId: string) => api(`/dietitian/plan-items/${itemId}`, { method: 'DELETE' });
export const copyPlanDay = (id: string, from: string, to: string) =>
  api<{ copied: number }>(`/dietitian/clients/${encodeURIComponent(id)}/plan/copy`, { method: 'POST', body: { from, to } });
