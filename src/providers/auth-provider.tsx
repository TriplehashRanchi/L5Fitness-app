import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import * as api from '@/lib/auth-api';
import { clearSession, loadSession, saveSession } from '@/lib/storage';

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

  useEffect(() => {
    let cancelled = false;
    loadSession().then((saved) => {
      if (cancelled) return;
      setSession(saved);
      setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = async (next: api.Session) => {
    await saveSession(next);
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
      await clearSession();
      setSession(null);
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
