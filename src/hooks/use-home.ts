import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getHome, type Home } from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';

/**
 * Loads everything the Home screen shows.
 *
 * - Reloads each time the screen comes back into view, and when the calendar day changes.
 * - Keeps showing the last good data while reloading or when a reload fails.
 */
export function useHome(today: string, weekStart: string) {
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const next = await getHome(today, weekStart);
      // A slower, older request must not overwrite a newer answer.
      if (id !== latest.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError(messageFrom(e));
    }
  }, [today, weekStart]);

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

  return { data, error, loading: data === null && error === null, refreshing, refresh, reload: load, setData };
}
