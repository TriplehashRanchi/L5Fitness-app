/**
 * Push notifications on this phone: ask permission, get this phone's push token, tell the server.
 *
 * `expo-notifications` has native code. A build made before it was added does not contain it, and Expo Go
 * cannot receive remote push on Android, so it is loaded defensively: when it is missing the app keeps
 * working and simply has no push alerts.
 */
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { registerToken, unregisterToken } from '@/lib/notifications-api';

type Module = typeof import('expo-notifications');

let loaded: Module | null | undefined;

/** The notifications module, or null when this build cannot use it. */
export function getNotifications(): Module | null {
  if (loaded !== undefined) return loaded;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    loaded = null; // Expo Go
    return loaded;
  }
  // A build made before the module was added does not have it. Look first: loading the package without its
  // native part throws (and Metro reports that as an error even when it is caught).
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
    loaded = null;
    return loaded;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as Module;
  } catch {
    loaded = null;
  }
  return loaded;
}

export type PushStatus =
  /** this phone is registered and can receive alerts */
  | 'on'
  /** the person blocked notifications in the phone's settings */
  | 'denied'
  /** simulator, Expo Go, or a build without the notifications module */
  | 'unavailable'
  /** something failed (offline, ...). Worth trying again later */
  | 'error';

let currentToken: string | null = null;
let handlerSet = false;

/** How a notification looks while the app is open: still show it, so it is not missed. */
function setUpHandler(N: Module) {
  if (handlerSet) return;
  handlerSet = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Asks for permission (once), gets the push token and gives it to the server. */
export async function registerForPush(): Promise<PushStatus> {
  const N = getNotifications();
  if (!N || !Device.isDevice) return 'unavailable';
  try {
    setUpHandler(N);
    if (Platform.OS === 'android') {
      // Android 13+ shows the permission question only after a channel exists.
      await N.setNotificationChannelAsync('default', {
        name: 'General',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c6f432',
      });
    }
    let { status, canAskAgain } = await N.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain) {
      ({ status } = await N.requestPermissionsAsync());
    }
    if (status !== 'granted') return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    await registerToken(token, Platform.OS === 'ios' ? 'ios' : 'android', Device.deviceName);
    currentToken = token;
    return 'on';
  } catch (e) {
    if (__DEV__) console.warn('[push] could not register:', (e as Error).message);
    return 'error';
  }
}

/** Stops alerts for this phone (call before logging out, while the sign-in still works). */
export async function unregisterPush() {
  const token = currentToken;
  currentToken = null;
  if (token) await unregisterToken(token).catch(() => {});
}
