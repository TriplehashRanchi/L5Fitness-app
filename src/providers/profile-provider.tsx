import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { messageFrom } from '@/lib/http';
import {
  addWeight,
  getProfile,
  finishSetup,
  saveProfile,
  type BodyProfile,
  type ProfileInput,
  type ProfileState,
  type Role,
  type WeightEntry,
} from '@/lib/wellness-api';
import { useAuth } from '@/providers/auth-provider';

/**
 * loading → asking the server whether this member has finished setup
 * needed  → they have not: show the setup questions
 * ready   → they have: show the app
 * error   → could not find out (offline): offer a retry rather than guessing
 */
type Status = 'loading' | 'needed' | 'ready' | 'error';

type Loaded = {
  /** whose data this is, so one member's answers are never shown to the next one */
  userId: string | null;
  status: Status;
  error: string | null;
  role: Role;
  profile: BodyProfile | null;
  weightHistory: WeightEntry[];
};

const EMPTY: Loaded = { userId: null, status: 'loading', error: null, role: 'member', profile: null, weightHistory: [] };

type ProfileContextValue = Omit<Loaded, 'userId'> & {
  reload: () => Promise<void>;
  deferSetup: () => Promise<void>;
  save: (input: ProfileInput) => Promise<void>;
  logWeight: (weightKg: number, day: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const fromServer = (userId: string, state: ProfileState): Loaded => ({
  userId,
  status: state.completed ? 'ready' : 'needed',
  error: null,
  role: state.role ?? 'member',
  profile: state.profile,
  weightHistory: state.weightHistory,
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [state, setState] = useState<Loaded>(EMPTY);
  // Data that belongs to someone else (or nobody) counts as "still loading".
  const current: Loaded = state.userId === userId && userId !== null ? state : EMPTY;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getProfile()
      .then((s) => !cancelled && setState(fromServer(userId, s)))
      .catch((e) => !cancelled && setState({ ...EMPTY, userId, status: 'error', error: messageFrom(e) }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** The "Try again" button. */
  const reload = useCallback(async () => {
    if (!userId) return;
    setState({ ...EMPTY, userId });
    try {
      setState(fromServer(userId, await getProfile()));
    } catch (e) {
      setState({ ...EMPTY, userId, status: 'error', error: messageFrom(e) });
    }
  }, [userId]);

  const save = useCallback(
    async (input: ProfileInput) => {
      if (!userId) return;
      setState(fromServer(userId, await saveProfile(input)));
    },
    [userId]
  );

  const deferSetup = useCallback(async () => {
    if (!userId) return;
    setState(fromServer(userId, await finishSetup()));
  }, [userId]);

  const logWeight = useCallback(
    async (weightKg: number, day: string) => {
      const next = await addWeight(weightKg, day);
      setState((s) => (s.userId === userId ? { ...s, profile: next.profile, weightHistory: next.weightHistory } : s));
    },
    [userId]
  );

  const { userId: _ignored, ...visible } = current;
  return <ProfileContext value={{ ...visible, reload, save, logWeight, deferSetup }}>{children}</ProfileContext>;
}

export function useProfile() {
  const ctx = use(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
