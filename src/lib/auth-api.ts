/**
 * Sign-up, login and Google sign-in, all through Firebase Authentication.
 * Our API only checks the token Firebase issues (see lib/http.ts).
 *
 * Apple needs "Sign in with Apple" switched on for the app in the Apple Developer account and the Apple provider
 * switched on in Firebase (Authentication, Sign-in method). Until then the button answers with a plain message.
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { deleteAccountData } from '@/lib/fitness-api';
import { googleSignIn } from '@/lib/google-sign-in';
import { tr, type Key } from '@/lib/i18n';

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

const MESSAGE_KEY: Record<string, Key> = {
  'auth/invalid-credential': 'acc.auth.wrongLogin',
  'auth/wrong-password': 'acc.auth.wrongLogin',
  'auth/user-not-found': 'acc.auth.wrongLogin',
  'auth/invalid-email': 'acc.auth.invalidEmail',
  'auth/email-already-in-use': 'acc.auth.emailInUse',
  'auth/weak-password': 'acc.auth.weakPassword',
  'auth/too-many-requests': 'acc.auth.tooMany',
  'auth/user-disabled': 'acc.auth.disabled',
  'auth/network-request-failed': 'acc.noServer',
  'auth/operation-not-allowed': 'acc.auth.notAllowed',
};

function toAuthError(e: unknown) {
  const code = (e as { code?: string }).code ?? '';
  return new AuthError(tr(MESSAGE_KEY[code] ?? 'acc.wrong'));
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
  const fallback = email.split('@')[0] || tr('activity.very_active');
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

/** The Apple module is native: an app build made before it was added does not have it. */
function loadApple() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { Apple: require('expo-apple-authentication') as typeof import('expo-apple-authentication'), Crypto: require('expo-crypto') as typeof import('expo-crypto') };
  } catch {
    return null;
  }
}

/**
 * Sign in with Apple (iPhone). Apple's rules ask for it wherever another social sign-in is offered. A random
 * one-time value (a nonce) is made on the phone; Apple gets its fingerprint, Firebase gets the original, so
 * Firebase can check the answer really answers this request.
 */
export async function signInWithApple(): Promise<void> {
  const tools = loadApple();
  if (!tools || !(await tools.Apple.isAvailableAsync().catch(() => false)))
    throw new AuthError(tr('acc.auth.appleUnavailable'));
  const { Apple, Crypto } = tools;
  const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: import('expo-apple-authentication').AppleAuthenticationCredential;
  try {
    credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthCancelled();
    throw new AuthError(tr('acc.auth.appleFailed'));
  }
  if (!credential.identityToken) throw new AuthError(tr('acc.auth.appleNoToken'));
  try {
    const result = await signInWithCredential(auth, new OAuthProvider('apple.com').credential({ idToken: credential.identityToken, rawNonce }));
    // Apple gives the name only the first time. Keep it, or the member would be nameless from then on.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name && !result.user.displayName) await updateProfile(result.user, { displayName: name });
  } catch (e) {
    throw toAuthError(e);
  }
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
  if (!user) throw new AuthError(tr('acc.auth.notSignedIn'));
  await deleteAccountData();
  try {
    await deleteUser(user);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/requires-recent-login') {
      throw new AuthError(tr('acc.auth.recentLogin'));
    }
    throw toAuthError(e);
  }
}
