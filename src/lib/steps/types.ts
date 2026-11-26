/**
 * Daily steps come from the phone's health store: Apple Health on iOS, Health Connect on
 * Android. Each platform has its own file (provider.ios.ts / provider.android.ts) with this shape.
 *
 * Steps are read on the phone and shown on the phone. They are not sent to our server.
 */

import type { Key, Translate } from '@/lib/i18n';

export type StepsStatus =
  /** This app or device cannot read steps: web, Expo Go, or a device without a health store. */
  | 'unavailable'
  /** Android only: Health Connect has to be installed or updated first. */
  | 'needs-setup'
  /** The member has not been asked yet, or has not allowed it. */
  | 'needs-permission'
  | 'ready';

export type StepsProvider = {
  /** Name shown to the member, e.g. "Apple Health". Show it with `sourceLabel(t, provider)`. */
  sourceName: string;
  /** Set when the name is a description rather than a product name, so it changes with the language. */
  sourceKey?: Key;
  getStatus(): Promise<StepsStatus>;
  /** Shows the system permission screen. Only call this from a button press. */
  requestAccess(): Promise<StepsStatus>;
  /** Total steps between two moments, counted once even when a phone and a watch both record. */
  getSteps(start: Date, end: Date): Promise<number>;
  /** Opens the place where the member can install the health app or change the permission. */
  openSettings(): void;
};

/** The health app's name in the member's language (product names stay as they are). */
export const sourceLabel = (t: Translate, provider: Pick<StepsProvider, 'sourceName' | 'sourceKey'>) =>
  provider.sourceKey ? t(provider.sourceKey) : provider.sourceName;
