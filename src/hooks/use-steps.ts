import { useCallback, useEffect, useRef, useState } from 'react';

import { toDayKey, type CalendarDay } from '@/lib/datetime';
import { stepsProvider } from '@/lib/steps/provider';
import { summarizeWeek, type WeekSummary } from '@/lib/steps/summary';
import type { StepsStatus } from '@/lib/steps/types';


/**
 * Steps for each day of the week shown on Home, from Apple Health / Health Connect.
 *
 * Pass the screen's `now` (it changes every minute and when the app comes back to the front):
 * the counts refresh each time it changes.
 */
export function useSteps(now: Date, days: CalendarDay[], today: CalendarDay, goal: number) {
  const [status, setStatus] = useState<StepsStatus | 'loading'>('loading');
  const [counts, setCounts] = useState<(number | null)[]>([]);
  /** True once the member has been through the permission screen in this session. */
  const [asked, setAsked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const latest = useRef(0);

  // The week's day keys as one text value, so the effect below re-runs only when the week changes.
  const keysText = days.map(toDayKey).join(',');
  const todayKey = toDayKey(today);

  const load = useCallback(async () => {
    const id = ++latest.current;
    const next = await stepsProvider.getStatus();
    let result: (number | null)[] = [];
    if (next === 'ready') {
      const nowMs = Date.now();
      result = await Promise.all(
        keysText.split(',').map(async (key) => {
          const [y, m, d] = key.split('-').map(Number);
          const start = new Date(y, m - 1, d);
          if (start.getTime() > nowMs) return null; // a day that has not started
          const nextMidnight = new Date(y, m - 1, d + 1);
          const end = nextMidnight.getTime() > nowMs ? new Date(nowMs) : nextMidnight;
          try {
            return await stepsProvider.getSteps(start, end);
          } catch {
            return null; // show "–" for this day rather than a wrong number
          }
        })
      );
    }
    if (id !== latest.current) return; // a newer read finished first
    setStatus(next);
    setCounts(result);
  }, [keysText]);

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

  const week: WeekSummary = summarizeWeek(keysText.split(','), counts, todayKey, goal);
  const todaySteps = week.bars.find((b) => b.isToday)?.steps ?? null;

  return {
    status,
    week,
    todaySteps,
    asked,
    connecting,
    connect,
    openSettings: stepsProvider.openSettings,
    sourceName: stepsProvider.sourceName,
  };
}
