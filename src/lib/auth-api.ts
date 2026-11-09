/**
 * Auth calls to L5Fitness-api, which signs users in with Neon Auth.
 *
 * Email + password is live. Google and Apple are not set up yet (see the notes on each).
 */
import { NetworkError, send } from '@/lib/http';

export type AuthProvider = 'password' | 'google' | 'apple';

export type User = {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
};

export type Session = {
  token: string;
  user: User;
};

export class AuthError extends Error {}

type ApiUser = { id: string; name: string; email: string };

async function startSession(path: string, body: unknown): Promise<Session> {
  let result;
  try {
    result = await send<{ token: string; user: ApiUser }>(path, { method: 'POST', body });
  } catch (e) {
    throw new AuthError(e instanceof NetworkError ? e.message : 'Something went wrong. Please try again.');
  }
  const { status, data } = result;
  if (status >= 200 && status < 300 && data?.token && data.user) {
    const { id, name, email } = data.user;
    return { token: data.token, user: { id, name, email, provider: 'password' } };
  }
  // The API's messages are written to be shown to the user as they are.
  throw new AuthError(data?.error?.message ?? 'Something went wrong. Please try again.');
}

export function signInWithEmail(email: string, password: string): Promise<Session> {
  return startSession('/auth/login', { email, password });
}

export function signUpWithEmail(name: string, email: string, password: string): Promise<Session> {
  return startSession('/auth/register', { name, email, password });
}

/**
 * Checks a saved session with the server.
 *   'valid'   → still signed in
 *   'invalid' → expired or signed out elsewhere: the app should log the user out
 *   'unknown' → could not reach the server (offline): keep the saved session
 */
export async function checkSession(token: string): Promise<'valid' | 'invalid' | 'unknown'> {
  try {
    const { status } = await send('/auth/me', { token });
    if (status === 200) return 'valid';
    if (status === 401) return 'invalid';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function signInWithGoogle(): Promise<Session> {
  // TODO: Neon Auth supports Google, but it needs your own Google OAuth client IDs (iOS,
  // Android, web), a development build, and a browser sign-in flow that returns to the app.
  throw new AuthError('Google sign-in is not available yet. Please use your email and password.');
}

export async function signInWithApple(): Promise<Session> {
  // TODO: Neon Auth supports Apple, but it needs an Apple Developer account (Services ID and
  // .p8 key added to Neon Auth) and `expo-apple-authentication` in a development build.
  throw new AuthError('Apple sign-in is not available yet. Please use your email and password.');
}

export async function signOutRemote(token: string): Promise<void> {
  await send('/auth/logout', { method: 'POST', token });
}
