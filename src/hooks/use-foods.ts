import { useEffect, useMemo, useState } from 'react';

import { fetchFoods, isFresh, readCachedFoods, saveCachedFoods, type Food } from '@/lib/foods-api';

/**
 * The food library. The last copy kept on the phone is used straight away (so it works on a slow or missing
 * connection), and a fresh copy is fetched in the background when the saved one is over a day old.
 */
export function useFoods() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const cached = await readCachedFoods();
      if (cached && live) {
        setFoods(cached.foods);
        setReady(true);
      }
      if (!cached || !isFresh(cached.at)) {
        try {
          const fresh = await fetchFoods();
          saveCachedFoods(fresh);
          if (live) setFoods(fresh);
        } catch {
          // Offline: whatever is saved is used.
        }
      }
      if (live) setReady(true);
    })();
    return () => {
      live = false;
    };
  }, []);
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  return { foods, byId, ready };
}
