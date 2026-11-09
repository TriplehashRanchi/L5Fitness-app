import type { StepsProvider } from './types';

/**
 * Web (and any platform without its own file): there is no health store to read from.
 * iOS uses provider.ios.ts and Android uses provider.android.ts instead of this file.
 *
 * Development only: a test can put `{ 'YYYY-MM-DD': steps }` on `globalThis.__L5_FAKE_STEPS__`
 * to see the Home steps chart in a browser. It does nothing in a release build.
 */
const fake = () =>
  __DEV__ ? (globalThis as { __L5_FAKE_STEPS__?: Record<string, number> }).__L5_FAKE_STEPS__ : undefined;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const stepsProvider: StepsProvider = {
  sourceName: 'your health app',
  getStatus: async () => (fake() ? 'ready' : 'unavailable'),
  requestAccess: async () => (fake() ? 'ready' : 'unavailable'),
  getSteps: async (start) => fake()?.[dayKey(start)] ?? 0,
  openSettings: () => {},
};
