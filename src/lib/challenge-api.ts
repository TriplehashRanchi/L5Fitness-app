/** The 90-day habit challenge (L5Fitness-api: /challenge). */
import { api } from '@/lib/http';

export type Habit = 'meal' | 'water' | 'move' | 'checkin';

export type ChallengeEntry = {
  id: string;
  startedOn: string;
  /** The last day. A pause for health moves it back. */
  endsOn: string;
  /** 1 on the day it started; days paused for health are not counted. */
  day: number;
  daysLeft: number;
  over: boolean;
  /** Enough habit days are in. */
  reached: boolean;
  completedOn: string | null;
  /** Days on which enough habits were done. */
  activeDays: number;
  todayHabits: Habit[];
};

export type ChallengeState = {
  rules: { days: number; goalDays: number; habitsNeeded: number; waterMl: number; steps: number };
  totals: { joined: number };
  /** The member's plan is paused for health (or a break). */
  paused: boolean;
  entry: ChallengeEntry | null;
};

export const getChallenge = (today: string) => api<ChallengeState>(`/challenge?today=${today}`);

export const startChallenge = (today: string) => api<ChallengeState>('/challenge/start', { method: 'POST', body: { today } });
