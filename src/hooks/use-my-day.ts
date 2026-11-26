import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useForegroundReload } from '@/hooks/use-foreground-reload';
import { addWater, getMyDay, undoWater, type DayItem, type MyDay } from '@/lib/fitness-api';
import { dayCounts } from '@/lib/day-plan';
import { messageFrom } from '@/lib/http';
import { tickItem, untickItem } from '@/lib/wellness-api';

/**
 * Loads one calendar day (the plan and what is done). Reloads when the screen comes into view or the day changes,
 * keeps the last good data when a reload fails, and ticks diet items at once (undone again if the server says no).
 */
export function useMyDay(day: string) {
  // Everything is stored with the day it belongs to, so a different day never shows the old day's numbers.
  const [stored, setStored] = useState<{ day: string; data: MyDay | null; error: string | null; notice: string | null }>({
    day,
    data: null,
    error: null,
    notice: null,
  });
  const fresh = stored.day === day;
  const data = fresh ? stored.data : null;
  const error = fresh ? stored.error : null;
  const notice = fresh ? stored.notice : null;
  const patch = useCallback(
    (p: Partial<{ data: MyDay | null; error: string | null; notice: string | null }>) =>
      setStored((prev) => (prev.day === day ? { ...prev, ...p } : { day, data: null, error: null, notice: null, ...p })),
    [day]
  );
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const next = await getMyDay(day);
      if (id !== latest.current) return;
      patch({ data: next, error: null });
    } catch (e) {
      if (id === latest.current) patch({ error: messageFrom(e) });
    }
  }, [day, patch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useForegroundReload(load);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const setDone = (id: string, done: boolean) =>
    setStored((prev) => {
      if (prev.day !== day || !prev.data) return prev;
      const items = prev.data.diet.items.map((i) => (i.id === id ? { ...i, done } : i));
      const next = { ...prev.data, diet: { ...prev.data.diet, items, done: items.filter((i) => i.done).length } };
      return { ...prev, data: { ...next, percent: dayCounts(next).percent } };
    });

  const toggleItem = async (item: DayItem) => {
    if (pending.has(item.id)) return;
    const nextDone = !item.done;
    patch({ notice: null });
    setPending((p) => new Set(p).add(item.id));
    setDone(item.id, nextDone);
    try {
      await (nextDone ? tickItem(item.id) : untickItem(item.id));
    } catch (e) {
      setDone(item.id, item.done);
      patch({ notice: messageFrom(e) });
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(item.id);
        return n;
      });
    }
  };

  // Water: the total moves at once and snaps back if the server says no. `lastWater` is the drink that "Undo" removes.
  const [lastWater, setLastWater] = useState<{ id: string; ml: number; day: string } | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);
  const setWaterTotal = (change: (total: number) => number) =>
    setStored((prev) => {
      if (prev.day !== day || !prev.data) return prev;
      const water = { ...prev.data.water, totalMl: Math.max(0, change(prev.data.water.totalMl)) };
      const next = { ...prev.data, water };
      return { ...prev, data: { ...next, percent: dayCounts(next).percent } };
    });

  const drink = async (ml: number) => {
    if (waterBusy) return;
    setWaterBusy(true);
    patch({ notice: null });
    setWaterTotal((t) => t + ml);
    try {
      const water = await addWater(ml, day);
      // null: no signal, kept on the phone to send later. What is shown stays, and there is nothing to undo yet.
      if (water) {
        setWaterTotal(() => water.totalMl);
        setLastWater(water.lastId ? { id: water.lastId, ml, day } : null);
      } else setLastWater(null);
    } catch (e) {
      setWaterTotal((t) => t - ml);
      patch({ notice: messageFrom(e) });
    } finally {
      setWaterBusy(false);
    }
  };

  const undoDrink = async () => {
    const last = lastWater && lastWater.day === day ? lastWater : null;
    if (!last || waterBusy) return;
    setWaterBusy(true);
    patch({ notice: null });
    setWaterTotal((t) => t - last.ml);
    try {
      const water = await undoWater(last.id, day);
      setWaterTotal(() => water.totalMl);
      setLastWater(null);
    } catch (e) {
      setWaterTotal((t) => t + last.ml);
      patch({ notice: messageFrom(e) });
    } finally {
      setWaterBusy(false);
    }
  };

  return {
    data,
    error,
    notice,
    loading: data === null && error === null,
    refreshing,
    refresh,
    reload: load,
    toggleItem,
    pending,
    drink,
    undoDrink,
    waterBusy,
    lastDrinkMl: lastWater && lastWater.day === day ? lastWater.ml : null,
  };
}
