import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getMembership, type MembershipState } from '@/lib/membership-api';

/** The member's membership (null until they have one recorded). Reloads whenever the screen comes into view. */
export function useMembership() {
  const [state, setState] = useState<MembershipState | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      getMembership()
        .then((s) => live && setState(s))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [])
  );
  return { state, setState };
}
