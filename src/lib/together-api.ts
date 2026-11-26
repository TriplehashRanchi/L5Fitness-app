import { api } from '@/lib/http';
import type { Key, Translate } from '@/lib/i18n';

// ── Community ────────────────────────────────────────────────────────────────────────────────

export type Region = 'kerala' | 'gulf' | 'tamil_nadu' | 'karnataka' | 'andhra_telangana' | 'general';
export const REGION_LABEL_KEY: Record<Region, Key> = {
  kerala: 'care.regionKerala',
  gulf: 'care.regionGulf',
  tamil_nadu: 'care.regionTamilNadu',
  karnataka: 'care.regionKarnataka',
  andhra_telangana: 'care.regionAndhra',
  general: 'care.regionGeneral',
};

export type Cohort = { id: string; name: string; region: Region; description: string | null; members: number };
export type BoardRow = { rank: number; name: string; value: number; you: boolean; reached: boolean };
export type Mission = {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  metricLabel: string;
  unit: string;
  goal: number;
  startsOn: string;
  endsOn: string;
  upcoming: boolean;
  ended: boolean;
  daysLeft: number;
  joined: boolean;
  board: { top: BoardRow[]; participants: number; reached: number; total: number; onBreak: number; mine: { value: number; onBreak: boolean } | null } | null;
};

export type CommunityState =
  | { joined: false; suggestedName: string; cohorts: Cohort[] }
  | { joined: true; consentGranted: boolean; cohort: Cohort; displayName: string; missions: Mission[] };

/** What each mission metric counts, by the server's code. */
const MISSION_METRIC_KEY: Record<string, { label: Key; unit: Key }> = {
  steps: { label: 'care.metricSteps', unit: 'care.unitSteps' },
  workout_days: { label: 'care.metricWorkoutDays', unit: 'care.unitDays' },
  water_days: { label: 'care.metricWaterDays', unit: 'care.unitDays' },
  meal_log_days: { label: 'care.metricMealDays', unit: 'care.unitDays' },
  checkin_days: { label: 'care.metricCheckinDays', unit: 'care.unitDays' },
};

/** A mission's metric and unit in the app's language; a metric this app does not know keeps the server's words. */
export function missionWords(m: Pick<Mission, 'metric' | 'metricLabel' | 'unit'>, t: Translate) {
  const keys = MISSION_METRIC_KEY[m.metric];
  return keys ? { label: t(keys.label), unit: t(keys.unit) } : { label: m.metricLabel, unit: m.unit };
}

export const getCommunity = () => api<CommunityState>('/me/community');
export const joinCommunity = (cohortId: string, displayName: string) =>
  api<CommunityState>('/me/community/join', { method: 'POST', body: { cohortId, displayName, agree: true } });
export const leaveCommunity = () => api<{ joined: false }>('/me/community/leave', { method: 'POST' });
export const joinMission = (id: string) => api<CommunityState>(`/me/missions/${id}/join`, { method: 'POST' });
export const leaveMission = (id: string) => api<CommunityState>(`/me/missions/${id}/join`, { method: 'DELETE' });

// ── Milestones ───────────────────────────────────────────────────────────────────────────────

export type Badge = { code: string; title: string; how: string; icon: string; earnedAt: string | null; goal: number | null; have: number | null };
export type Milestones = { streak: number; fresh: string[]; badges: Badge[] };
export const getMilestones = (today: string) => api<Milestones>(`/me/milestones?today=${today}`);

/** Each badge's name and how it is earned, by the server's code (L5Fitness-api: services/badges.js). */
const BADGE_KEY: Record<string, { title: Key; how: Key }> = {
  first_step: { title: 'care.badgeFirstStep', how: 'care.badgeFirstStepHow' },
  streak_7: { title: 'care.badgeStreak7', how: 'care.badgeStreak7How' },
  streak_30: { title: 'care.badgeStreak30', how: 'care.badgeStreak30How' },
  perfect_week: { title: 'care.badgePerfectWeek', how: 'care.badgePerfectWeekHow' },
  checkins_10: { title: 'care.badgeCheckins', how: 'care.badgeCheckinsHow' },
  workouts_10: { title: 'care.badgeWorkouts', how: 'care.badgeWorkoutsHow' },
  meals_30: { title: 'care.badgeMeals', how: 'care.badgeMealsHow' },
  steps_100k: { title: 'care.badgeSteps', how: 'care.badgeStepsHow' },
  day_30: { title: 'care.badgeDay30', how: 'care.badgeDay30How' },
  day_60: { title: 'care.badgeDay60', how: 'care.badgeDay60How' },
  day_90: { title: 'care.badgeDay90', how: 'care.badgeDay90How' },
  mission_done: { title: 'care.badgeMission', how: 'care.badgeMissionHow' },
};

/** A badge's words in the app's language; a badge this app does not know keeps the server's words. */
export function badgeWords(b: Pick<Badge, 'code' | 'title' | 'how'>, t: Translate) {
  const keys = BADGE_KEY[b.code];
  return keys ? { title: t(keys.title), how: t(keys.how) } : { title: b.title, how: b.how };
}

// ── Calls and live sessions ──────────────────────────────────────────────────────────────────

export type CallSlot = { id: string; startsAt: string; durationMin: number; kind: 'call' | 'video'; status: string; joinNote?: string | null; dietitianName?: string };
export type Calls = { dietitianName: string | null; booked: CallSlot[]; open: CallSlot[]; recordingAllowed: boolean; noticeHours: number; maxBooked: number };
export const getCalls = () => api<Calls>('/me/calls');
export const bookCall = (id: string) => api<Calls>(`/me/calls/${id}/book`, { method: 'POST' });
export const cancelCall = (id: string) => api<Calls>(`/me/calls/${id}/cancel`, { method: 'POST' });

export type LiveSession = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMin: number;
  hostName: string | null;
  capacity: number | null;
  going: number;
  rsvp: boolean;
  full: boolean;
  joinUrl: string | null;
};
export const getLive = () => api<{ sessions: LiveSession[] }>('/me/live');
export const rsvpLive = (id: string) => api<{ sessions: LiveSession[] }>(`/me/live/${id}/rsvp`, { method: 'POST' });
export const unrsvpLive = (id: string) => api<{ sessions: LiveSession[] }>(`/me/live/${id}/rsvp`, { method: 'DELETE' });

// ── Family ───────────────────────────────────────────────────────────────────────────────────

export type FamilyPerson = { id: string; name: string; role: 'owner' | 'member'; you: boolean; sharing: boolean; summary: { agreed: { completed: number; total: number }; streak: number } | null };
export type Family = { id: string; name: string; role: 'owner' | 'member'; shareProgress: boolean; people: FamilyPerson[]; invites: { id: string; email: string }[] };
export type FamilyState = { family: Family | null; invitations: { id: string; familyName: string; invitedBy: string | null }[]; maxMembers: number };

export const getFamily = (today: string) => api<FamilyState>(`/me/family?today=${today}`);
export const createFamily = (name: string, today: string) => api<FamilyState>('/me/family', { method: 'POST', body: { name, today } });
export const inviteToFamily = (email: string, today: string) => api<FamilyState>('/me/family/invites', { method: 'POST', body: { email, today } });
export const removeFamilyInvite = (id: string, today: string) => api<FamilyState>(`/me/family/invites/${id}?today=${today}`, { method: 'DELETE' });
export const acceptInvitation = (id: string, today: string) => api<FamilyState>(`/me/family/invitations/${id}/accept`, { method: 'POST', body: { today } });
export const declineInvitation = (id: string, today: string) => api<FamilyState>(`/me/family/invitations/${id}/decline`, { method: 'POST', body: { today } });
export const shareFamilyProgress = (share: boolean, today: string) => api<FamilyState>('/me/family/share', { method: 'PUT', body: { share, today } });
export const leaveFamily = () => api<FamilyState>('/me/family/leave', { method: 'POST' });
export const removeFamilyMember = (memberId: string, today: string) => api<FamilyState>(`/me/family/members/${memberId}?today=${today}`, { method: 'DELETE' });
