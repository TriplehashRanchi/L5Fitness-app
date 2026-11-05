/**
 * Auth calls.
 *
 * ⚠️ MOCK: these functions do not talk to a server yet. Any email + password works and
 * "Google" / "Apple" return a demo user, so the app flow can be built and tested now.
 * Replace the bodies with calls to L5Fitness-api when it is ready. Keep the same return type
 * and the rest of the app does not need to change.
 */

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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mockSession(user: Omit<User, 'id'>): Session {
  return {
    token: `mock-${Date.now().toString(36)}`,
    user: { id: `u_${Date.now().toString(36)}`, ...user },
  };
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'Athlete';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  // TODO: POST /auth/login { email, password }
  await delay(700);
  if (!email || !password) throw new AuthError('Enter your email and password.');
  return mockSession({ name: nameFromEmail(email), email, provider: 'password' });
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<Session> {
  // TODO: POST /auth/register { name, email, password }
  await delay(900);
  if (!name || !email || !password) throw new AuthError('Please fill in all fields.');
  return mockSession({ name, email, provider: 'password' });
}

export async function signInWithGoogle(): Promise<Session> {
  // TODO: real Google sign-in needs Google Cloud OAuth client IDs (iOS, Android, web) and a
  // development build. Get the Google ID token on the device, send it to
  // POST /auth/google { idToken }, and the API verifies it and returns the session.
  await delay(700);
  return mockSession({ name: 'Google User', email: 'google.user@gmail.com', provider: 'google' });
}

export async function signInWithApple(): Promise<Session> {
  // TODO: real Sign in with Apple uses `expo-apple-authentication` on iOS (needs an Apple
  // Developer account and a development build). Send Apple's identityToken to
  // POST /auth/apple { identityToken, fullName } and the API verifies it and returns the session.
  // Android has no native Apple sign-in; it needs Apple's web flow (Services ID + redirect URL).
  await delay(700);
  return mockSession({ name: 'Apple User', email: 'apple.user@icloud.com', provider: 'apple' });
}

export async function signOutRemote(_token: string): Promise<void> {
  // TODO: POST /auth/logout
}
