import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { putSteps, type DayItem, type Home } from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import { SLOT_ORDER, tickItem, untickItem } from '@/lib/wellness-api';

export const MAX_STEPS = 200_000;

/** The diet items with one changed, and the totals worked out again from the items themselves. */
function withItemDone(diet: NonNullable<Home['diet']>, id: string, done: boolean): NonNullable<Home['diet']> {
  const items = diet.items.map((i) => (i.id === id ? { ...i, done } : i));
  const next = [...items].sort((a, b) => SLOT_ORDER.indexOf(a.mealSlot) - SLOT_ORDER.indexOf(b.mealSlot)).find((i) => !i.done);
  return { ...diet, items, done: items.filter((i) => i.done).length, next: next ? { title: next.title, mealSlot: next.mealSlot } : null };
}

/** The card's own actions: tick a meal and type in steps. Changes show at once and are taken back if the server says no. */
export function useTodayCard(setData: Dispatch<SetStateAction<Home | null>>, todayKey: string) {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [dietError, setDietError] = useState<string | null>(null);
  const [savingSteps, setSavingSteps] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const setItem = useCallback(
    (id: string, done: boolean) => setData((prev) => (prev?.diet ? { ...prev, diet: withItemDone(prev.diet, id, done) } : prev)),
    [setData]
  );

  const toggleItem = useCallback(
    async (item: DayItem) => {
      const next = !item.done;
      setDietError(null);
      setPending((p) => new Set(p).add(item.id));
      setItem(item.id, next);
      try {
        await (next ? tickItem(item.id) : untickItem(item.id));
      } catch (e) {
        setItem(item.id, item.done);
        setDietError(`Could not save “${item.title}”. ${messageFrom(e)}`);
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(item.id);
          return n;
        });
      }
    },
    [setItem]
  );

  /** Returns true when saved. `text` is what the member typed. */
  const saveSteps = useCallback(
    async (text: string) => {
      const n = Number(text.replace(/[\s,]/g, ''));
      if (!text.trim() || !Number.isInteger(n) || n < 0 || n > MAX_STEPS) {
        setStepsError(`Enter a whole number from 0 to ${MAX_STEPS.toLocaleString('en')}.`);
        return false;
      }
      setStepsError(null);
      setSavingSteps(true);
      try {
        await putSteps([{ day: todayKey, steps: n }]);
        setData((prev) => (prev ? { ...prev, steps: { value: n, goal: prev.steps?.goal ?? prev.settings.stepGoal } } : prev));
        return true;
      } catch (e) {
        setStepsError(messageFrom(e));
        return false;
      } finally {
        setSavingSteps(false);
      }
    },
    [setData, todayKey]
  );

  return { pending, dietError, toggleItem, savingSteps, stepsError, saveSteps, clearStepsError: () => setStepsError(null) };
}
