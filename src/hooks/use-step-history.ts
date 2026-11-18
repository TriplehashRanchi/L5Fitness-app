import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { addDays, toDayKey, type CalendarDay } from '@/lib/datetime';
import { getStepHistory, putSteps } from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import { stepsProvider } from '@/lib/steps/provider';
import type { StepsStatus } from '@/lib/steps/types';

export const HISTORY_DAYS = 30;

export type StepDay = { key: string; day: CalendarDay; steps: number | null };

/**
 * The last 30 days of steps, oldest first.
 * Saved days come from the server (so they stay even if the phone's health app is cleared); when the health
 * app can be read, its counts are shown instead (they are the newest) and are saved to the server.
 */
export function useStepHistory(today: CalendarDay, fallbackGoal: number) {
  const todayKey = toDayKey(today);
  const [state, setState] = useState<{
    forDay: string;
    days: StepDay[] | null;
    goal: number;
    prescribed: boolean;
    status: StepsStatus | 'loading';
    error: string | null;
  }>({ forDay: todayKey, days: null, goal: fallbackGoal, prescribed: false, status: 'loading', error: null });
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    const [y, m, d] = todayKey.split('-').map(Number);
    const end: CalendarDay = { year: y, month: m, day: d };
    const calendar = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(end, i - (HISTORY_DAYS - 1)));

    // 1. What the server has kept.
    let saved = new Map<string, number | null>();
    let goal = fallbackGoal;
    let prescribed = false;
    let error: string | null = null;
    try {
      const history = await getStepHistory(todayKey, HISTORY_DAYS);
      saved = new Map(history.days.map((x) => [x.day, x.steps]));
      goal = history.goal;
      prescribed = history.prescribed;
    } catch (e) {
      error = messageFrom(e);
    }

    // 2. What the phone's health app says (newer than the server for recent days).
    const status = await stepsProvider.getStatus();
    const device = new Map<string, number>();
    if (status === 'ready') {
      const nowMs = Date.now();
      await Promise.all(
        calendar.map(async (c) => {
          const start = new Date(c.year, c.month - 1, c.day);
          const nextMidnight = new Date(c.year, c.month - 1, c.day + 1);
          const stop = nextMidnight.getTime() > nowMs ? new Date(nowMs) : nextMidnight;
          try {
            device.set(toDayKey(c), await stepsProvider.getSteps(start, stop));
          } catch {
            // keep the saved number for this day
          }
        })
      );
    }
    if (id !== latest.current) return;

    const days = calendar.map((c) => {
      const key = toDayKey(c);
      const fromPhone = device.get(key);
      // A phone that reports 0 for an old day may simply have no data: keep a saved number if there is one.
      const steps = fromPhone != null && (fromPhone > 0 || saved.get(key) == null) ? fromPhone : (saved.get(key) ?? null);
      return { key, day: c, steps };
    });
    setState({ forDay: todayKey, days, goal, prescribed, status, error: days.some((x) => x.steps != null) ? null : error });

    // 3. Keep what the phone knows on the server (only days that changed).
    const changed = days.filter((x) => x.steps != null && device.has(x.key) && saved.get(x.key) !== x.steps);
    if (changed.length) putSteps(changed.map((x) => ({ day: x.key, steps: x.steps as number }))).catch(() => {});
  }, [todayKey, fallbackGoal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** For the "Connect" button. */
  const connect = useCallback(async () => {
    setConnecting(true);
    await stepsProvider.requestAccess();
    await load();
    setConnecting(false);
  }, [load]);

  const fresh = state.forDay === todayKey;
  return {
    days: fresh ? state.days : null,
    goal: state.goal,
    prescribed: state.prescribed,
    status: state.status,
    error: state.error,
    loading: !fresh || state.days === null,
    refreshing,
    refresh,
    reload: load,
    connect,
    connecting,
    openSettings: stepsProvider.openSettings,
    sourceName: stepsProvider.sourceName,
  };
}
