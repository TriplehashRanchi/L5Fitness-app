import { useCallback, useEffect, useRef, useState } from 'react';

import { getSettings, updateSettings, type Settings } from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';

/**
 * The member's goals. A change shows on screen straight away and is saved to the server half a
 * second after the last tap (so tapping "+" five times sends one request, not five). If saving
 * fails, the screen goes back to what the server has and says so.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<Partial<Settings>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (cancelled) return;
        saved.current = s;
        setSettings(s);
      })
      .catch((e) => {
        if (!cancelled) setError(messageFrom(e));
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      const next = await updateSettings(patch);
      saved.current = next;
      // Keep any change made while this one was saving.
      setSettings((current) => (current ? { ...next, ...pending.current } : next));
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
      if (saved.current) setSettings(saved.current);
    } finally {
      setSaving(false);
    }
  }, []);

  const change = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => (current ? { ...current, ...patch } : current));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
    },
    [flush]
  );

  return { settings, error, saving, change };
}
