import { useCallback, useEffect, useRef, useState } from 'react';

import { stepsProvider } from '@/lib/steps/provider';
import type { StepsStatus } from '@/lib/steps/types';

/** Steps from midnight (on the phone's clock) until this moment. */
async function readStepsToday() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return stepsProvider.getSteps(midnight, now);
}

/**
 * Today's steps from Apple Health / Health Connect.
 *
 * Pass the screen's `now` (it changes every minute and when the app comes back to the front):
 * the count refreshes each time it changes.
 */
export function useSteps(now: Date) {
  const [status, setStatus] = useState<StepsStatus | 'loading'>('loading');
  const [steps, setSteps] = useState<number | null>(null);
  /** True once the member has been through the permission screen in this session. */
  const [asked, setAsked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    const next = await stepsProvider.getStatus();
    let count: number | null = null;
    if (next === 'ready') {
      try {
        count = await readStepsToday();
      } catch {
        count = null; // could not read right now: show "–" rather than a wrong number
      }
    }
    if (id !== latest.current) return; // a newer read finished first
    setStatus(next);
    setSteps(count);
  }, []);

  const minute = Math.floor(now.getTime() / 60_000);
  useEffect(() => {
    load();
  }, [load, minute]);

  /** For the "Connect" button. */
  const connect = useCallback(async () => {
    setConnecting(true);
    await stepsProvider.requestAccess();
    setAsked(true);
    await load();
    setConnecting(false);
  }, [load]);

  return {
    status,
    steps,
    asked,
    connecting,
    connect,
    openSettings: stepsProvider.openSettings,
    sourceName: stepsProvider.sourceName,
  };
}
