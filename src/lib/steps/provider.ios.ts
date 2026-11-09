import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking } from 'react-native';

import type { StepsProvider, StepsStatus } from './types';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

const STEPS = 'HKQuantityTypeIdentifierStepCount';
/** HealthKit's "the member has already been asked" answer (AuthorizationRequestStatus.unnecessary). */
const ALREADY_ASKED = 2;

let cached: HealthKit | null | undefined;

/**
 * The library is native code, so it only exists in an installed build. Expo Go does not have
 * it, and loading it there would crash, so it is loaded on first use and never in Expo Go.
 */
function load(): HealthKit | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Apple never tells an app whether the member allowed READING. It only says whether they have
 * been asked. So after asking, the status is 'ready' either way, and a member who said no simply
 * gets 0 steps. The Home card explains how to switch it on when it shows 0.
 */
async function getStatus(): Promise<StepsStatus> {
  const hk = load();
  if (!hk) return 'unavailable';
  try {
    if (!hk.isHealthDataAvailable()) return 'unavailable'; // e.g. an older iPad
    const asked = await hk.getRequestStatusForAuthorization({ toRead: [STEPS] });
    return asked === ALREADY_ASKED ? 'ready' : 'needs-permission';
  } catch {
    return 'unavailable';
  }
}

export const stepsProvider: StepsProvider = {
  sourceName: 'Apple Health',
  getStatus,

  async requestAccess() {
    const hk = load();
    if (!hk) return 'unavailable';
    try {
      await hk.requestAuthorization({ toRead: [STEPS] });
    } catch {
      // closed or failed: the status below tells the truth either way
    }
    return getStatus();
  },

  async getSteps(start, end) {
    const hk = load();
    if (!hk) return 0;
    // A statistics query lets HealthKit add up the steps and count a phone and a watch only once.
    const result = await hk.queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: end } },
      unit: 'count',
    });
    return Math.round(result.sumQuantity?.quantity ?? 0);
  },

  openSettings() {
    // Opens the Health app. The switch is under Sharing → Apps → L5 Fitness.
    Linking.openURL('x-apple-health://').catch(() => {});
  },
};
