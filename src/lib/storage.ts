import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small values go to the Keychain / Keystore. Web has no secure store, so localStorage. */
const secure = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  remove: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

// ── Workout in progress ──────────────────────────────────────────────────────────────────────
// Saved on the device so a workout keeps running if the app is closed or the phone restarts.

export type ActiveWorkout = { userId: string; workoutId: string; title: string; startedAt: string };

const ACTIVE_WORKOUT_KEY = 'l5.activeWorkout';

export async function loadActiveWorkout(userId: string): Promise<ActiveWorkout | null> {
  try {
    const raw = await secure.get(ACTIVE_WORKOUT_KEY);
    const saved = raw ? (JSON.parse(raw) as ActiveWorkout) : null;
    // Never show one member's workout to another member on a shared phone.
    return saved?.userId === userId ? saved : null;
  } catch {
    return null;
  }
}

export function saveActiveWorkout(workout: ActiveWorkout) {
  return secure.set(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
}

export function clearActiveWorkout() {
  return secure.remove(ACTIVE_WORKOUT_KEY);
}
