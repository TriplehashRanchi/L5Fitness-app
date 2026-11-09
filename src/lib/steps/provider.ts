import type { StepsProvider } from './types';

/**
 * Web (and any platform without its own file): there is no health store to read from.
 * iOS uses provider.ios.ts and Android uses provider.android.ts instead of this file.
 */
export const stepsProvider: StepsProvider = {
  sourceName: 'your health app',
  getStatus: async () => 'unavailable',
  requestAccess: async () => 'unavailable',
  getSteps: async () => 0,
  openSettings: () => {},
};
