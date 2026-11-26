import { api } from '@/lib/http';

export type Membership = {
  id: string;
  planName: string;
  durationDays: number;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
  pausedDays: number;
  cancelRequestedAt: string | null;
};
export type MembershipState = {
  current: Membership | null;
  next: Membership | null;
  /** The last one, when it has run out and nothing follows it. */
  ended: Membership | null;
  terms: { inclusions: string | null; refundTerms: string | null; pauseTerms: string | null; description: string | null } | null;
};

export const getMembership = () => api<MembershipState>('/me/membership');
export const requestCancel = (reason?: string) =>
  api<MembershipState>('/me/membership/cancel-request', { method: 'POST', body: { reason: reason?.trim() || undefined } });
