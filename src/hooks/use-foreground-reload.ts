import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Runs `reload` when the app comes back to the front. Pass a `reload` that is safe to call at any time.
 * (A change of calendar day already re-runs the screens' loads, because their `today` changes.)
 */
export function useForegroundReload(reload: () => void) {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') latest.current();
    });
    return () => sub.remove();
  }, []);
}
