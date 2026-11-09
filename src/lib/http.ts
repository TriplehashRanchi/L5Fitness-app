/**
 * One place for every call to L5Fitness-api.
 *
 * The app only knows the API's address (EXPO_PUBLIC_API_URL). Database, storage and auth
 * secrets live on the server and must never be added to this app.
 */

import Constants from 'expo-constants';

/**
 * The API's address. Set EXPO_PUBLIC_API_URL (written exactly like this for Expo to inline it).
 *
 * While developing, a phone cannot use "localhost" (that is the phone itself), and the Mac's
 * Wi-Fi address changes between networks. So when the setting points at this computer
 * (localhost or a home-network address), the host is replaced by the computer that is serving
 * the app right now, keeping the same port. Real https addresses are used as they are.
 */
function resolveApiUrl() {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
  if (!__DEV__) return configured;
  try {
    const url = new URL(configured);
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
    const isAddress = !!metroHost && /^\d{1,3}(\.\d{1,3}){3}$/.test(metroHost);
    if (local && isAddress) {
      url.hostname = metroHost;
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    // not a valid address: used as it is below
  }
  return configured;
}

export const API_URL = resolveApiUrl();
const TIMEOUT_MS = 15_000;

/** The server answered with an error. `message` is written to be shown to the user as it is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

/** The server could not be reached at all (offline, timeout, wrong address). */
export class NetworkError extends Error {}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; token?: string | null; body?: unknown };
type ErrorBody = { error?: { code?: string; message?: string } };

/** Sends one request. Returns the status and parsed body; throws only NetworkError. */
export async function send<T>(
  path: string,
  options: Options = {}
): Promise<{ status: number; data: (T & ErrorBody) | null }> {
  if (!API_URL) {
    throw new NetworkError('The app is not connected to a server yet. Set EXPO_PUBLIC_API_URL.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: (T & ErrorBody) | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // not JSON: leave data as null
    }
    return { status: res.status, data };
  } catch (e) {
    // Developers get the real details; members get the plain sentence.
    if (__DEV__) console.warn(`[api] ${options.method ?? 'GET'} ${API_URL}${path} failed:`, (e as Error).message);
    throw new NetworkError(
      "Can't reach the server. Check your internet connection and try again." +
        (__DEV__ ? `\n\n(Developer note: the app tried ${API_URL}. Open that address plus /health in the phone's browser.)` : '')
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── Signed-in calls ──────────────────────────────────────────────────────────────────────────

let tokenProvider: (() => Promise<string | null>) | null = null;
let onSessionEnded: (() => void) | null = null;

/**
 * Called once by the auth provider. Returns a fresh Firebase token for the signed-in member
 * (Firebase renews it by itself when it is about to expire), or null when nobody is signed in.
 */
export function setTokenProvider(provider: (() => Promise<string | null>) | null) {
  tokenProvider = provider;
}

/** Called by the auth provider: what to do when the server says the session is over. */
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler;
}

/** A call as the signed-in user. Returns the body, or throws ApiError / NetworkError. */
export async function api<T>(path: string, options: Omit<Options, 'token'> = {}): Promise<T> {
  let token: string | null = null;
  try {
    token = (await tokenProvider?.()) ?? null;
  } catch {
    // The token could not be renewed, which in practice means there is no connection.
    throw new NetworkError("Can't reach the server. Check your internet connection and try again.");
  }
  const { status, data } = await send<T>(path, { ...options, token });
  if (status >= 200 && status < 300) return data as T;
  if (status === 401) onSessionEnded?.();
  throw new ApiError(
    data?.error?.message ?? 'Something went wrong. Please try again.',
    status,
    data?.error?.code
  );
}

/** A message for any failure that is safe to show on screen. */
export function messageFrom(error: unknown) {
  return error instanceof ApiError || error instanceof NetworkError
    ? error.message
    : 'Something went wrong. Please try again.';
}
