import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { startOutbox, stopOutbox } from '@/lib/outbox';
import { useAuth } from '@/providers/auth-provider';

type Ctx = { pending: number; rejected: number; flushNow: () => Promise<void>; clearRejected: () => void };
const OutboxContext = createContext<Ctx | null>(null);

/**
 * Keeps the outbox going: it sends what is waiting when the app opens, when it comes back to the front, when
 * the phone gets a connection again, and every minute while something is still waiting.
 */
export function OutboxProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!userId) {
      stopOutbox();
      return;
    }
    const outbox = startOutbox(userId);
    const stop = outbox.onChange(setPending);
    void outbox.count().then(setPending);
    const flush = async () => {
      const r = await outbox.flush().catch(() => null);
      if (r?.rejected.length) setRejected((n) => n + r.rejected.length);
    };
    flushRef.current = flush;
    void flush();
    const app = AppState.addEventListener('change', (s) => s === 'active' && void flush());
    // expo-network is native code: a build made before it was added does not have it, and loading it would crash
    // the whole app. So it is loaded here, and without it the minute timer below still retries.
    let net: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Network = require('expo-network') as typeof import('expo-network');
      net = Network.addNetworkStateListener((state) => state.isConnected && void flush());
    } catch {
      // not in this build
    }
    const timer = setInterval(() => void outbox.count().then((n) => (n > 0 ? flush() : undefined)), 60_000);
    return () => {
      stop();
      app.remove();
      net?.remove();
      clearInterval(timer);
    };
  }, [userId]);

  const flushNow = useCallback(() => flushRef.current(), []);
  const value = useMemo(() => ({ pending, rejected, flushNow, clearRejected: () => setRejected(0) }), [pending, rejected, flushNow]);
  return <OutboxContext value={value}>{children}</OutboxContext>;
}

export function useOutbox() {
  const ctx = use(OutboxContext);
  if (!ctx) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return ctx;
}
