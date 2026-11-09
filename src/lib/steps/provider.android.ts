import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking } from 'react-native';

import type { StepsProvider, StepsStatus } from './types';

type HealthConnect = typeof import('react-native-health-connect');

/** Health Connect on Google Play. The extra `url` sends the member straight to its set-up screen. */
const PLAY_STORE = 'market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding';
const PLAY_STORE_WEB = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

let cached: HealthConnect | null | undefined;

/**
 * The library is native code, so it only exists in an installed build. Expo Go does not have
 * it, and loading it there would crash, so it is loaded on first use and never in Expo Go.
 */
function load(): HealthConnect | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-health-connect') as HealthConnect;
  } catch {
    cached = null;
  }
  return cached;
}

async function getStatus(): Promise<StepsStatus> {
  const hc = load();
  if (!hc) return 'unavailable';
  try {
    const sdk = await hc.getSdkStatus();
    // Android 13 and older: Health Connect is a separate app that may be missing or out of date.
    if (sdk === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-setup';
    if (sdk !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'unavailable';

    await hc.initialize(); // must run before any other call
    const granted = await hc.getGrantedPermissions();
    const canReadSteps = granted.some((p) => p.accessType === 'read' && p.recordType === 'Steps');
    return canReadSteps ? 'ready' : 'needs-permission';
  } catch {
    return 'unavailable';
  }
}

export const stepsProvider: StepsProvider = {
  sourceName: 'Health Connect',
  getStatus,

  async requestAccess() {
    const hc = load();
    if (!hc) return 'unavailable';
    try {
      await hc.initialize();
      await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    } catch {
      // closed or failed: the status below tells the truth either way
    }
    return getStatus();
  },

  async getSteps(start, end) {
    const hc = load();
    if (!hc) return 0;
    // "Aggregate" lets Health Connect add up the steps and remove double counting between apps.
    const result = await hc.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    return Math.round(result.COUNT_TOTAL ?? 0);
  },

  openSettings() {
    const hc = load();
    getStatus().then((status) => {
      if (status === 'needs-setup' || !hc) {
        Linking.openURL(PLAY_STORE).catch(() => Linking.openURL(PLAY_STORE_WEB).catch(() => {}));
      } else {
        hc.openHealthConnectSettings();
      }
    });
  },
};
