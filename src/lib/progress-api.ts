import { Linking } from 'react-native';

import { API_URL, api } from '@/lib/http';
import type { Key } from '@/lib/i18n';
import { sendOrQueue } from '@/lib/outbox';

// ── Readings: waist and clinical ─────────────────────────────────────────────────────────────

export type MeasureKind = 'waist_cm' | 'bp' | 'glucose' | 'hba1c' | 'ldl' | 'hdl' | 'triglycerides' | 'total_cholesterol';
export type GlucoseContext = 'fasting' | 'after_meal' | 'random';

export type Measure = {
  id: string;
  kind: MeasureKind;
  value: number;
  value2: number | null;
  unit: string;
  context: GlucoseContext | null;
  day: string;
  note: string | null;
  /** self = typed by the member, device = from the phone, verified = checked against a report */
  origin: 'self' | 'device' | 'verified';
  verified: boolean;
  edited: boolean;
};

/** What can be recorded: its name, unit, and the allowed range (the server checks the same). Show the names with `t`. */
export const MEASURE_SPEC: Record<MeasureKind, { labelKey: Key; unit: string; min: number; max: number; min2?: number; max2?: number; clinical: boolean; hintKey?: Key }> = {
  waist_cm: { labelKey: 'care.measureWaist', unit: 'cm', min: 40, max: 200, clinical: false, hintKey: 'care.measureWaistHint' },
  bp: { labelKey: 'care.measureBp', unit: 'mmHg', min: 70, max: 260, min2: 40, max2: 160, clinical: true, hintKey: 'care.measureBpHint' },
  glucose: { labelKey: 'care.measureGlucose', unit: 'mg/dL', min: 40, max: 600, clinical: true },
  hba1c: { labelKey: 'care.measureHba1c', unit: '%', min: 3, max: 15, clinical: true },
  ldl: { labelKey: 'care.measureLdl', unit: 'mg/dL', min: 10, max: 600, clinical: true },
  hdl: { labelKey: 'care.measureHdl', unit: 'mg/dL', min: 5, max: 200, clinical: true },
  triglycerides: { labelKey: 'care.measureTriglycerides', unit: 'mg/dL', min: 10, max: 2000, clinical: true },
  total_cholesterol: { labelKey: 'care.measureCholesterol', unit: 'mg/dL', min: 50, max: 800, clinical: true },
};
export const CLINICAL_KINDS = (Object.keys(MEASURE_SPEC) as MeasureKind[]).filter((k) => MEASURE_SPEC[k].clinical);
export const CONTEXT_LABEL_KEY: Record<GlucoseContext, Key> = { fasting: 'care.glucoseFasting', after_meal: 'care.glucoseAfterMeal', random: 'care.glucoseRandom' };
export const ORIGIN_LABEL_KEY: Record<Measure['origin'], Key> = { self: 'care.originSelf', device: 'care.originDevice', verified: 'care.originVerified' };

/** "128/82 mmHg" or "96.5 cm" */
export const readingText = (m: Pick<Measure, 'kind' | 'value' | 'value2' | 'unit'>) =>
  `${m.kind === 'bp' ? `${m.value}/${m.value2}` : m.value} ${m.unit}`;

export type MeasureInput = { kind: MeasureKind; value: number; value2?: number; context?: GlucoseContext; day: string; today: string; note?: string };

export const listMeasures = (kind?: MeasureKind) => api<{ measurements: Measure[] }>(`/me/measurements${kind ? `?kind=${kind}` : ''}`);
export const addMeasure = (input: MeasureInput) => api<{ measurement: Measure }>('/me/measurements', { method: 'POST', body: input });
export const updateMeasure = (id: string, input: MeasureInput) => api<{ measurement: Measure }>(`/me/measurements/${id}`, { method: 'PUT', body: input });
export const removeMeasure = (id: string) => api<{ deleted: boolean }>(`/me/measurements/${id}`, { method: 'DELETE' });

// ── Daily check-in ───────────────────────────────────────────────────────────────────────────

export type Checkin = { day: string; sleepHours: number | null; sleepQuality: number | null; energy: number | null; hunger: number | null; stress: number | null };
export type CheckinInput = Partial<Omit<Checkin, 'day'>>;

export const getCheckins = (to: string, days = 14) => api<{ checkins: Checkin[] }>(`/me/checkins?to=${to}&days=${days}`);
/** Saves the check-in. With no signal it is kept on the phone and sent later (a check-in for a day can safely be sent twice). */
export const saveCheckin = (day: string, input: CheckinInput) =>
  sendOrQueue<{ checkin: Checkin }>({ kind: 'check-in', method: 'PUT', path: `/me/checkins/${day}`, body: input });

// ── The week ─────────────────────────────────────────────────────────────────────────────────

export type ActionMetric = 'diet' | 'water' | 'steps' | 'workout' | 'meal_log' | 'weigh_in' | 'checkin' | 'custom';
export type WeekAction = { id: string; metric: ActionMetric; title: string; targetCount: number; done: number; ticks?: string[] };

export type WeekCard = {
  weekStart: string;
  weekEnd: string;
  isCurrent: boolean;
  daysLeft: number;
  weight: {
    baseline: number | null;
    target: number | null;
    current: number | null;
    previous: number | null;
    goal: 'lose' | 'maintain' | 'gain' | null;
    progress: number | null;
    weighIns: number;
    changeFromBaseline: number | null;
    changeFromLastWeek: number | null;
    trend: { weekStart: string; avg: number | null; weighIns: number }[];
  };
  waist: { baseline: number | null; current: number | null; change: number | null; readings: number };
  actions: WeekAction[];
  agreed: { completed: number; total: number };
  plan: { planned: number; done: number; percent: number | null };
  wellbeing: { checkins: number; sleepHours: number | null; energy: number | null; hunger: number | null; stress: number | null };
  activity: { workoutDays: number; avgSteps: number | null };
  review: { barriers: string | null; coachFeedback: string | null; reviewedAt: string } | null;
  next: { weekStart: string; actions: { id: string; metric: ActionMetric; title: string; targetCount: number }[] };
};

export const getWeek = (today: string, weekStart?: string) =>
  api<{ card: WeekCard }>(`/me/week?today=${today}${weekStart ? `&weekStart=${weekStart}` : ''}`);
export const tickAction = (id: string, day: string, done: boolean, today: string) =>
  api<{ card: WeekCard }>(`/me/week/actions/${id}/tick`, { method: 'PUT', body: { day, done, today } });

// ── 30 / 60 / 90-day summaries ───────────────────────────────────────────────────────────────

export type SummaryState = { days: 30 | 60 | 90; ready: boolean; readyOn: string | null };
export const getSummaries = () => api<{ started: string | null; summaries: SummaryState[] }>('/me/summaries');
/** The address of the PDF (works for five minutes). Open it in the browser to read or save it. */
export async function summaryUrl(days: number) {
  const { url } = await api<{ url: string }>(`/me/summaries/${days}/link`, { method: 'POST' });
  return `${API_URL}${url}`;
}

/** Everything one report shows (the same figures as its PDF). Numbers nobody logged are null. */
export type Report = {
  days: number;
  dayNumber: number;
  start: string;
  end: string;
  goal: 'lose' | 'gain' | 'maintain' | null;
  weight: {
    start: number | null;
    current: number | null;
    target: number | null;
    change: number | null;
    remaining: number | null;
    percent: number | null;
    reached: boolean;
    perWeek: number | null;
    weighIns: number;
  };
  waist: { first: number | null; last: number | null; readings: number };
  bmi: { start: number | null; current: number | null };
  habits: {
    water: { days: number; met: number; avgMl: number | null; goalMl: number };
    steps: { days: number; met: number; goal: number };
    mealDays: number;
  };
  adherence: { agreed: { completed: number; total: number }; agreedPercent: number | null; plan: { planned: number; done: number } };
  wellbeing: { checkins: number; sleepHours: number | null; energy: number | null; hunger: number | null; stress: number | null } | null;
  weeks: { weekStart: string; weight: number | null; steps: number | null; checkins: number; completed: number; total: number; mealPercent: number | null }[];
  selfReported: Measure[];
  clinician: Measure[];
  deviceDerived: { stepDays: number; avgSteps: number | null };
  reviews: { weekStart: string; barriers: string | null; coachFeedback: string | null }[];
};
export const getReport = (days: number) => api<{ report: Report }>(`/me/summaries/${days}`);
/** Saves the PDF: the phone's browser downloads a file the server marks as a download. */
export async function downloadSummary(days: number) {
  await Linking.openURL(`${await summaryUrl(days)}&download=1`);
}

// ── Reminders ────────────────────────────────────────────────────────────────────────────────

export type Reminders = { quietStart: number | null; quietEnd: number | null; snoozeUntil: string | null; pushEnabled: boolean };
export const getReminders = () => api<Reminders>('/me/reminders');
export const saveReminders = (input: { quietStart?: number | null; quietEnd?: number | null; snoozeHours?: number | null; utcOffsetMin?: number }) =>
  api<Reminders>('/me/reminders', { method: 'PUT', body: input });
