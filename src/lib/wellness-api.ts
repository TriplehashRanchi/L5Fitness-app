import type { Workout, CoachingStatus } from '@/lib/fitness-api';
/** Profile, weight, workout history, diet plans and the dietitian tools (all from L5Fitness-api). */
import type { Activity, DietType, Goal, Sex } from '@/lib/body';
import { api } from '@/lib/http';
import type { Key } from '@/lib/i18n';

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
  // Health screening. null = not answered (unknown, never "no").
  takesMedication: boolean | null;
  pregnancyStatus: PregnancyStatus | null;
  hasInjury: boolean | null;
  injuryNotes: string | null;
  hasRestriction: boolean | null;
  restrictionNotes: string | null;
  screeningReviewedAt: string | null;
  /** How they eat: a fasting pattern, and whether they work night shifts. null = not answered. */
  fasting: Fasting | null;
  shiftWork: boolean | null;
  /** Why a dietitian has to look at the answers before prescribing; empty when nothing needs a look. Set by the server. */
  reviewReasons: string[];
};

export type PregnancyStatus = 'no' | 'pregnant' | 'breastfeeding';
export type Fasting = 'none' | 'ekadashi' | 'ramadan' | 'weekly' | 'intermittent' | 'other';

export type WeightEntry = { id: string; weightKg: number; day: string };
export type Role = 'member' | 'dietitian' | 'admin';

export type ProfileState = {
  role: Role;
  completed: boolean;
  profile: BodyProfile | null;
  /** newest first */
  weightHistory: WeightEntry[];
};

/** What the setup form sends. `day` is the phone's calendar day. */
export type ProfileInput = Omit<BodyProfile, 'age' | 'startWeightKg' | 'screeningReviewedAt' | 'reviewReasons'> & { day: string };

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
/** The words for each meal: show them with `t(SLOT_KEY[slot])`. */
export const SLOT_KEY: Record<MealSlot, Key> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  snack: 'meal.snack',
  dinner: 'meal.dinner',
  supplement: 'prof.slot.supplement',
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
  coaching: CoachingStatus;
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
  pauseStatus: PauseStatus | null;
  needsReview: boolean;
  /** Where they are in their journey (new, active, at_risk…), and how many cases need a person. */
  lifecycle: string | null;
  openCases: number;
};

export type ClientDetail = {
  pause: Pause | null;
  client: { id: string; name?: string; email?: string; image?: string | null };
  profile: BodyProfile;
  weightHistory: WeightEntry[];
  adherence: { planned: number; done: number };
  recentWorkouts: HistoryDay[];
};

export type PlanDay = { day: string; items: DietItem[]; week: WeekDay[] };
export type NewItem = { day: string; mealSlot: MealSlot; title: string; details?: string; calories?: number };

export const listClients = (q: string) =>
  api<{ clients: ClientSummary[]; requests: ClientRequest[] }>(`/dietitian/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const getClient = (id: string) => api<ClientDetail>(`/dietitian/clients/${encodeURIComponent(id)}`);
export const getClientPlan = (id: string, day: string, weekStart: string) =>
  api<PlanDay>(`/dietitian/clients/${encodeURIComponent(id)}/plan?day=${day}&weekStart=${weekStart}`);
export const addPlanItem = (id: string, item: NewItem) =>
  api<{ item: DietItem }>(`/dietitian/clients/${encodeURIComponent(id)}/plan`, { method: 'POST', body: item });
export const removePlanItem = (itemId: string) => api(`/dietitian/plan-items/${itemId}`, { method: 'DELETE' });
export const copyPlanDay = (id: string, from: string, to: string) =>
  api<{ copied: number }>(`/dietitian/clients/${encodeURIComponent(id)}/plan/copy`, { method: 'POST', body: { from, to } });

export type ClientRequest = { id: string; name: string; email: string; image: string | null };
export const acceptClient = (id: string) => api(`/dietitian/clients/${encodeURIComponent(id)}/accept`, { method: 'POST' });
export const getClientTraining = (id: string, day: string) => api<{ plan: Workout | null }>(`/dietitian/clients/${encodeURIComponent(id)}/training?day=${day}`);
export type TrainingInput = { day: string; title: string; durationMin: number; kcal: number; instructions: string };
export const saveClientTraining = (id: string, input: TrainingInput) => api(`/dietitian/clients/${encodeURIComponent(id)}/training`, { method: 'PUT', body: input });
export const removeClientTraining = (id: string, day: string) => api(`/dietitian/clients/${encodeURIComponent(id)}/training?day=${day}`, { method: 'DELETE' });

// ── Daily targets set by the dietitian (null = not set, the member chooses) ───────────────────

export type ClientTargets = {
  waterMl: number | null;
  steps: number | null;
  calories: number | null;
  proteinG: number | null;
  weeklyWorkouts: number | null;
};

export const getClientTargets = (id: string) =>
  api<{ targets: ClientTargets }>(`/dietitian/clients/${encodeURIComponent(id)}/targets`);
export const saveClientTargets = (id: string, targets: ClientTargets) =>
  api<{ targets: ClientTargets }>(`/dietitian/clients/${encodeURIComponent(id)}/targets`, { method: 'PUT', body: { targets } });

// ── Clinical pause ───────────────────────────────────────────────────────────────────────────

export type PauseReason = 'illness' | 'injury' | 'clinician' | 'other';
export type PauseStatus = 'paused' | 'restart_requested';
export type Pause = {
  id: string;
  reason: PauseReason;
  note: string | null;
  status: PauseStatus;
  startedAt: string;
  restartRequestedAt: string | null;
};

export const PAUSE_REASON_KEY: Record<PauseReason, Key> = {
  illness: 'prof.reason.illness',
  injury: 'prof.reason.injury',
  clinician: 'prof.reason.clinician',
  other: 'eating.other',
};

export const getPause = () => api<{ pause: Pause | null }>('/me/pause');
export const startPause = (reason: PauseReason, note?: string) =>
  api<{ pause: Pause }>('/me/pause', { method: 'POST', body: { reason, note: note?.trim() || undefined } });
export const requestRestart = () => api<{ pause: Pause }>('/me/pause/restart', { method: 'POST' });

export const pauseClient = (id: string, reason: PauseReason, note?: string) =>
  api<{ pause: Pause }>(`/dietitian/clients/${encodeURIComponent(id)}/pause`, { method: 'POST', body: { reason, note: note?.trim() || undefined } });
export const resumeClient = (id: string) => api(`/dietitian/clients/${encodeURIComponent(id)}/resume`, { method: 'POST' });
export const reviewScreening = (id: string) =>
  api<{ profile: BodyProfile }>(`/dietitian/clients/${encodeURIComponent(id)}/screening/review`, { method: 'POST' });
