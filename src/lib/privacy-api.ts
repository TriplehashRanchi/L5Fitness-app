import { api } from '@/lib/http';
import type { Key } from '@/lib/i18n';

export type ConsentPurpose = 'health_data' | 'wearables' | 'marketing' | 'call_recording' | 'community';
export type ConsentState = { granted: boolean; at: string; version: string } | null;
export type Consents = { version: string; consents: Record<ConsentPurpose, ConsentState> };

/** What each purpose means: the keys of the words shown to the member. */
export const CONSENT_KEY: Record<ConsentPurpose, { title: Key; detail: Key }> = {
  health_data: { title: 'acc.consent.health', detail: 'acc.consent.healthDetail' },
  wearables: { title: 'acc.consent.steps', detail: 'acc.consent.stepsDetail' },
  marketing: { title: 'acc.consent.offers', detail: 'acc.consent.offersDetail' },
  call_recording: { title: 'acc.consent.recording', detail: 'acc.consent.recordingDetail' },
  community: { title: 'acc.consent.group', detail: 'acc.consent.groupDetail' },
};
export const CONSENT_ORDER: ConsentPurpose[] = ['health_data', 'wearables', 'marketing', 'call_recording', 'community'];

/**
 * Is it on? Health details and steps are on until the member takes them back (they were already
 * shared by using the app). Offers and call recording are off until the member says yes.
 */
export const consentIsOn = (purpose: ConsentPurpose, state: ConsentState): boolean =>
  purpose === 'marketing' || purpose === 'call_recording' || purpose === 'community' ? state?.granted === true : state?.granted !== false;

export const getConsents = () => api<Consents>('/me/consents');
export const setConsent = (purpose: ConsentPurpose, granted: boolean) =>
  api<Consents>('/me/consents', { method: 'PUT', body: { purpose, granted } });

/** A copy of everything stored about the member, as JSON. */
export const exportMyData = () => api<Record<string, unknown>>('/me/export');
