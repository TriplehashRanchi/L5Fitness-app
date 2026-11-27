import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getSummaries, getWeek, type SummaryState, type WeekCard } from '@/lib/progress-api';

/** This week's result card and which 30/60/90-day summaries are ready. Reloads whenever the screen comes into view. */
export function useWeek(today: string) {
  const [card, setCard] = useState<WeekCard | null>(null);
  const [summaries, setSummaries] = useState<SummaryState[]>([]);
  const [started, setStarted] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      getWeek(today)
        .then((r) => live && setCard(r.card))
        .catch(() => {});
      getSummaries()
        .then((r) => {
          if (!live) return;
          setStarted(r.started);
          setSummaries(r.summaries);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [today])
  );
  return { card, summaries, started };
}
