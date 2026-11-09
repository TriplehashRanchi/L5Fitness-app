import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import * as api from '@/lib/auth-api';
import { setAuthToken, setSessionEndedHandler } from '@/lib/http';
import { clearActiveWorkout, clearSession, loadSession, saveSession } from '@/lib/storage';

type AuthContextValue = {
  /** false until the saved session is read from storage */
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

  /** Forget the session on this device (the server side is handled separately). */
  const endSession = async () => {
    setAuthToken(null);
    await Promise.all([clearSession(), clearActiveWorkout()]);
    setSession(null);
  };

  useEffect(() => {
    let cancelled = false;
    loadSession().then(async (saved) => {
      if (cancelled) return;
      // Show the app straight away from the saved session; do not wait for the network.
      setAuthToken(saved?.token ?? null); // before the screens render and start loading data
      setSession(saved);
      setIsReady(true);
      if (!saved) return;
      // Then confirm it with the server. Only an explicit "no longer valid" logs the user out,
      // so being offline never does.
      if ((await api.checkSession(saved.token)) === 'invalid' && !cancelled) await endSession();
    });
    // Any later call that the server rejects as "not signed in" also logs the user out.
    setSessionEndedHandler(() => {
      endSession();
    });
    return () => {
      cancelled = true;
      setSessionEndedHandler(null);
    };
  }, []);

  const startSession = async (next: api.Session) => {
    await saveSession(next);
    setAuthToken(next.token);
    setSession(next);
  };

  const value: AuthContextValue = {
    isReady,
    hasOnboarded,
    session,
    completeOnboarding: async () => {
      setHasOnboarded(true);
    },
    signIn: async (email, password) => startSession(await api.signInWithEmail(email, password)),
    signUp: async (name, email, password) =>
      startSession(await api.signUpWithEmail(name, email, password)),
    signInWithGoogle: async () => startSession(await api.signInWithGoogle()),
    signInWithApple: async () => startSession(await api.signInWithApple()),
    signOut: async () => {
      if (session) await api.signOutRemote(session.token).catch(() => {});
      await endSession();
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
