/**
 * Sign-up, login and Google sign-in, all through Firebase Authentication.
 * Our API only checks the token Firebase issues (see lib/http.ts).
 *
 * Apple is not set up yet (see the note on it).
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { deleteAccountData } from '@/lib/fitness-api';
import { googleSignIn } from '@/lib/google-sign-in';

export type AuthProvider = 'password' | 'google' | 'apple';

export type User = {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
  /** Profile picture address (Google accounts have one), or null */
  image: string | null;
};

export type Session = { user: User };

export class AuthError extends Error {}

/** The member backed out (closed the Google sheet). Screens should stay quiet, not show an error. */
export class AuthCancelled extends Error {}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact the gym desk.',
  'auth/network-request-failed': "Can't reach the server. Check your internet connection and try again.",
  'auth/operation-not-allowed': 'This way of signing in is not available yet.',
};

function toAuthError(e: unknown) {
  const code = (e as { code?: string }).code ?? '';
  return new AuthError(MESSAGES[code] ?? 'Something went wrong. Please try again.');
}

function providerOf(user: FirebaseUser): AuthProvider {
  const id = user.providerData[0]?.providerId;
  return id === 'google.com' ? 'google' : id === 'apple.com' ? 'apple' : 'password';
}

/**
 * The profile picture, if the account has one. Google gives a small 96px picture by default;
 * ask for a sharper one so it stays crisp on high-resolution screens.
 */
function photoOf(user: FirebaseUser): string | null {
  const url = user.photoURL ?? user.providerData.find((p) => p.photoURL)?.photoURL ?? null;
  if (!url) return null;
  return url.includes('googleusercontent.com') ? url.replace(/=s\d+-c$/, '=s256-c') : url;
}

/** The app's own shape of the signed-in member. */
export function toUser(user: FirebaseUser): User {
  const email = user.email ?? '';
  const fallback = email.split('@')[0] || 'Athlete';
  return {
    id: user.uid,
    name: user.displayName?.trim() || fallback.charAt(0).toUpperCase() + fallback.slice(1),
    email,
    provider: providerOf(user),
    image: photoOf(user),
  };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw toAuthError(e);
  }
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<void> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    // Best effort: the account exists either way, and the name falls back to the email name.
    await updateProfile(user, { displayName: name }).catch(() => {});
  } catch (e) {
    throw toAuthError(e);
  }
}

export async function signInWithGoogle(): Promise<void> {
  const result = await googleSignIn();
  if (result.type === 'cancelled') throw new AuthCancelled();
  if (result.type === 'error') throw new AuthError(result.message);
}

export async function signInWithApple(): Promise<void> {
  // TODO: needs an Apple Developer account, "Sign in with Apple" enabled for this app and for
  // Firebase (Authentication → Sign-in method → Apple), and `expo-apple-authentication`.
  throw new AuthError('Apple sign-in is not available yet. Please use your email and password.');
}

export async function signOutNow(): Promise<void> {
  await signOut(auth);
}

/**
 * Permanently deletes the member's account: first everything we store about them (workouts,
 * meals, photos, water), then their sign-in. Safe to retry: if the second step needs a fresh
 * login, the first is already done and simply runs again.
 */
export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthError('You are not signed in.');
  await deleteAccountData();
  try {
    await deleteUser(user);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/requires-recent-login') {
      throw new AuthError(
        'For your security, log out and log in again, then delete your account. Your data has already been erased.'
      );
    }
    throw toAuthError(e);
  }
}
