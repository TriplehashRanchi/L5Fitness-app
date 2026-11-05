import { useCalendars, useLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilNextMinute, validLocale, validTimeZone, type FormatOptions } from '@/lib/datetime';

/**
 * The user's current time plus the phone's date/time settings.
 *
 * - `now` updates at every minute boundary, so the greeting and "today" change on their own
 *   (also across midnight).
 * - It refreshes as soon as the app comes back to the foreground, because timers pause in
 *   the background.
 * - `useCalendars` / `useLocales` re-render when the user changes time zone, 12/24-hour
 *   setting, region or first day of week in the phone settings.
 */
export function useDeviceClock() {
  const [calendar] = useCalendars();
  const [locale] = useLocales();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = new Date();
      setNow(next);
      timer = setTimeout(tick, msUntilNextMinute(next));
    };
    timer = setTimeout(tick, msUntilNextMinute(new Date()));

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        tick();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const timeZone =
    validTimeZone(calendar?.timeZone) ??
    validTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const format: FormatOptions = {
    // The UI text is English, but dates and times follow the user's region (en-IN, en-US, en-GB…).
    locale: locale?.regionCode ? validLocale(`en-${locale.regionCode}`) : 'en',
    timeZone,
    hour12: calendar?.uses24hourClock == null ? undefined : !calendar.uses24hourClock,
  };

  // expo-localization: 1 = Sunday … 7 = Saturday. Converted to 0 = Sunday. Defaults to Monday.
  const firstWeekday = ((calendar?.firstWeekday ?? 2) - 1) % 7;

  return { now, format, firstWeekday };
}
