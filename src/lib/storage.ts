import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Session } from '@/lib/auth-api';

const SESSION_KEY = 'l5.session';

/** Session (token) goes to the Keychain / Keystore. Web has no secure store, so localStorage. */
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

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await secure.get(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    // Corrupt or unreadable value: treat as logged out instead of crashing on launch.
    return null;
  }
}

export function saveSession(session: Session) {
  return secure.set(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  return secure.remove(SESSION_KEY);
}
