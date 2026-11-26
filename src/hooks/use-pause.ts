import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getPause, type Pause } from '@/lib/wellness-api';

/** The member's open clinical pause (null when the plan is running). Reloads whenever the screen comes into view. */
export function usePause() {
  const [pause, setPause] = useState<Pause | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPause()
        .then((r) => !cancelled && setPause(r.pause))
        // Offline: keep what we last knew.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return { pause, setPause };
}
