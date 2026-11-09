/**
 * One place for every call to L5Fitness-api.
 *
 * The app only knows the API's address (EXPO_PUBLIC_API_URL). Database, storage and auth
 * secrets live on the server and must never be added to this app.
 */

// Must be written exactly as process.env.EXPO_PUBLIC_… for Expo to inline it.
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
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
  } catch {
    throw new NetworkError("Can't reach the server. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

// ── Signed-in calls ──────────────────────────────────────────────────────────────────────────

let authToken: string | null = null;
let onSessionEnded: (() => void) | null = null;

/** Called by the auth provider whenever the user signs in or out. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called by the auth provider: what to do when the server says the session is over. */
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler;
}

/** A call as the signed-in user. Returns the body, or throws ApiError / NetworkError. */
export async function api<T>(path: string, options: Omit<Options, 'token'> = {}): Promise<T> {
  const { status, data } = await send<T>(path, { ...options, token: authToken });
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
