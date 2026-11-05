/**
 * Timezone-safe date helpers.
 *
 * Rules followed everywhere in the app:
 * - A moment in time is a `Date` (an absolute instant). API data should send ISO strings
 *   with an offset or `Z` (e.g. `2026-11-05T06:30:00+05:30`), never bare `2026-11-05`,
 *   which JS parses as UTC midnight and can shift the day by one.
 * - "Which day / hour is it for the user" is always derived with `Intl` using the device's
 *   time zone explicitly, instead of `date.getHours()` / `getDate()`. Those use the JS
 *   engine's cached zone, which can be stale after the user changes zone or travels.
 * - Calendar days are plain `{ year, month, day }` values. Day arithmetic is done in UTC,
 *   so DST changes never skip or repeat a day.
 */

export type CalendarDay = { year: number; month: number; day: number };

export type ZonedParts = CalendarDay & {
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

export type FormatOptions = {
  locale: string;
  timeZone?: string;
  /** undefined = use the locale default */
  hour12?: boolean;
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Returns the zone if this JS engine knows it, otherwise undefined. */
export function validTimeZone(timeZone: string | null | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    getFormatter('en-US', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** Returns the locale tag if this JS engine accepts it, otherwise the fallback. */
export function validLocale(tag: string, fallback = 'en'): string {
  try {
    getFormatter(tag, {});
    return tag;
  } catch {
    return fallback;
  }
}

/** Wall-clock parts of `date` as seen in `timeZone` (device zone when omitted). */
export function getZonedParts(date: Date, timeZone?: string): ZonedParts {
  try {
    const parts = getFormatter('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';

    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      // Some engines print midnight as "24" when hour12 is false.
      hour: Number(get('hour')) % 24,
      minute: Number(get('minute')),
      weekday: WEEKDAYS[get('weekday')] ?? date.getDay(),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekday: date.getDay(),
    };
  }
}

export function toDayKey({ year, month, day }: CalendarDay): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isSameDay(a: CalendarDay, b: CalendarDay) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function dayToUTC({ year, month, day }: CalendarDay) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(day: CalendarDay, amount: number): CalendarDay {
  const d = new Date(Date.UTC(day.year, day.month - 1, day.day + amount));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(day: CalendarDay) {
  return dayToUTC(day).getUTCDay();
}

/** The 7 days of the week containing `today`, starting on `firstWeekday` (0 = Sunday). */
export function getWeekDays(today: CalendarDay, firstWeekday: number): CalendarDay[] {
  const offset = (weekdayOf(today) - firstWeekday + 7) % 7;
  const start = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Weekday name of a calendar day ("Thu"), independent of any time zone. */
export function formatWeekday(
  day: CalendarDay,
  locale: string,
  style: 'narrow' | 'short' | 'long' = 'short'
) {
  return getFormatter(locale, { weekday: style, timeZone: 'UTC' }).format(dayToUTC(day));
}

/** "6:30 am" / "06:30", shown in the given zone and the user's 12/24-hour preference. */
export function formatTime(date: Date, { locale, timeZone, hour12 }: FormatOptions) {
  return getFormatter(locale, {
    // 24-hour clocks read as "06:30", not "6:30".
    hour: hour12 === false ? '2-digit' : 'numeric',
    minute: '2-digit',
    timeZone,
    hour12,
  }).format(date);
}

/** "Thursday, 5 Nov" in the given zone. */
export function formatLongDate(date: Date, { locale, timeZone }: FormatOptions) {
  return getFormatter(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone }).format(
    date
  );
}

export function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Late night grind';
}

/** Milliseconds until the next wall-clock minute starts. */
export function msUntilNextMinute(now: Date) {
  return 60_000 - (now.getTime() % 60_000) + 50;
}
