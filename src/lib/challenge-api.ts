/** The 90-day challenge and its prize claim (L5Fitness-api: /challenge). */
import { api } from '@/lib/http';

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type PhotoKind = 'bodyBefore' | 'bodyAfter' | 'scaleBefore' | 'scaleAfter';

export type ChallengeEntry = {
  id: string;
  startedOn: string;
  endsOn: string;
  startWeightKg: number;
  /** The lowest weight logged inside the 90 days, if any. */
  finalWeightKg: number | null;
  /** The day the goal was reached, if it was. */
  reachedOn: string | null;
  /** 1 on the day it started. */
  day: number;
  over: boolean;
  reached: boolean;
  lostKg: number;
};

/** The member's own claim. The payout details come back partly hidden. */
export type Claim = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  payoutMethod: 'upi' | 'bank';
  upiId: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  status: ClaimStatus;
  /** Why it was rejected, or a word from the admin. */
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  photos: Record<PhotoKind, string>;
};

export type ChallengeState = {
  rules: { days: number; goalKg: number; prize: string };
  /** Across all members: how many joined and how many reached the goal. */
  totals: { joined: number; completed: number };
  entry: ChallengeEntry | null;
  claim: Claim | null;
};

export type ClaimInput = {
  today: string;
  fullName: string;
  phone: string;
  address: string;
  payoutMethod: 'upi' | 'bank';
  upiId?: string;
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  /** Upload ids (see uploadPhoto). */
  photos: Record<PhotoKind, string>;
};

export const getChallenge = (today: string) => api<ChallengeState>(`/challenge?today=${today}`);
export const startChallenge = (today: string) => api<ChallengeState>('/challenge/start', { method: 'POST', body: { today } });
export const sendClaim = (input: ClaimInput) => api<ChallengeState>('/challenge/claim', { method: 'POST', body: input });
