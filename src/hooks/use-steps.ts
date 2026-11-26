import { useCallback, useEffect, useRef, useState } from 'react';

import { putSteps } from '@/lib/fitness-api';
import { toDayKey, type CalendarDay } from '@/lib/datetime';
import { stepsProvider } from '@/lib/steps/provider';
import { summarizeWeek, type WeekSummary } from '@/lib/steps/summary';
import { sourceLabel, type StepsStatus } from '@/lib/steps/types';
import { useT } from '@/providers/language-provider';

const SYNC_EVERY_MS = 5 * 60_000;
/** What was last sent (or tried), kept outside the hook so remounting does not resend at once. */
let lastSync = { signature: '', at: 0 };

/** Sends the week's known counts so the coach can see them. Throttled; errors are ignored. */
function syncSteps(keys: string[], counts: (number | null)[]) {
  const entries = keys
    .map((day, i) => ({ day, steps: counts[i] }))
    .filter((e): e is { day: string; steps: number } => e.steps != null && Number.isFinite(e.steps) && e.steps >= 0)
    .map((e) => ({ day: e.day, steps: Math.round(e.steps) }))
    .slice(-8);
  if (!entries.length) return;
  const signature = JSON.stringify(entries);
  const nowMs = Date.now();
  if (signature === lastSync.signature || nowMs - lastSync.at < SYNC_EVERY_MS) return;
  lastSync = { signature, at: nowMs };
  putSteps(entries).catch(() => {
    // Not worth bothering the member: the next change, after the throttle, tries again.
    if (lastSync.signature === signature) lastSync = { signature: '', at: nowMs };
  });
}

/**
 * Steps for each day of the week shown on Home, from Apple Health / Health Connect.
 *
 * Pass the screen's `now` (it changes every minute and when the app comes back to the front):
 * the counts refresh each time it changes.
 */
export function useSteps(now: Date, days: CalendarDay[], today: CalendarDay, goal: number) {
  const t = useT();
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
    if (next === 'ready') syncSteps(keysText.split(','), result);
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
    reload: load,
    openSettings: stepsProvider.openSettings,
    sourceName: sourceLabel(t, stepsProvider),
  };
}
