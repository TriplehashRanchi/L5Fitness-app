import { onAuthStateChanged } from 'firebase/auth';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import * as api from '@/lib/auth-api';
import { auth } from '@/lib/firebase';
import { setSessionEndedHandler, setTokenProvider } from '@/lib/http';
import { clearActiveWorkout } from '@/lib/storage';

type AuthContextValue = {
  /** false until Firebase has said whether someone is signed in (instant, read from the phone) */
  isReady: boolean;
  /** Onboarding is shown on every app start while logged out. Reset on each launch. */
  hasOnboarded: boolean;
  session: api.Session | null;
  completeOnboarding: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [session, setSession] = useState<api.Session | null>(null);

  useEffect(() => {
    // Firebase keeps the member signed in between launches and tells us whenever that changes:
    // after login, after sign-out, and when the account is removed or disabled.
    setTokenProvider(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
    // A request our API rejects as "not signed in" (e.g. the account was disabled) ends the session.
    setSessionEndedHandler(() => {
      api.signOutNow().catch(() => {});
    });

    const stop = onAuthStateChanged(auth, (user) => {
      setSession(user ? { user: api.toUser(user) } : null);
      // A workout in progress belongs to one member: never carry it over to the next one.
      if (!user) clearActiveWorkout().catch(() => {});
      setIsReady(true);
    });
    return () => {
      stop();
      setTokenProvider(null);
      setSessionEndedHandler(null);
    };
  }, []);

  const value: AuthContextValue = {
    isReady,
    hasOnboarded,
    session,
    completeOnboarding: async () => {
      setHasOnboarded(true);
    },
    signIn: (email, password) => api.signInWithEmail(email, password),
    signUp: (name, email, password) => api.signUpWithEmail(name, email, password),
    signInWithGoogle: () => api.signInWithGoogle(),
    signInWithApple: () => api.signInWithApple(),
    signOut: () => api.signOutNow(),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
