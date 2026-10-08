// Get the base URL from Astro config
const baseUrl = import.meta.env.BASE_URL;

/**
 * IANA timezone for MADE's Oakland, CA venue. Event dates/times should always be
 * formatted with this timezone so they render correctly regardless of the runtime's
 * local timezone (e.g. UTC on Cloudflare Workers vs. a developer's own machine locally,
 * or a visitor's browser timezone), and automatically resolve to the correct PST/PDT
 * abbreviation for the given date.
 */
export const EVENT_TIME_ZONE = 'America/Los_Angeles';

/**
 * Returns the calendar year/month/day for a given Date as observed in MADE's venue
 * timezone (Pacific), so calendar day-bucketing (e.g. "which day of the month does this
 * event fall on") is consistent regardless of the runtime's local timezone (server or
 * client) or a visitor's own browser timezone. `month` is 0-indexed to match the native
 * `Date` convention (e.g. January is 0).
 */
export function getEventDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const lookup = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: lookup('year'), month: lookup('month') - 1, day: lookup('day') };
}

/**
 * "YYYY-MM" key for the Pacific calendar month a given event startDate falls on. Shared
 * by the by_month calendar JSON endpoints (src/pages/[locale]/event/by_month/) so events
 * are bucketed into months identically everywhere - the by-month index, the per-month
 * blobs, and the calendar's own day-bucketing above.
 */
export function getEventMonthKey(startDate: string): string {
  const { year, month } = getEventDateParts(new Date(startDate));
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Pattern for a leading locale segment only when it's a full path segment (e.g. /en/, /es/, /en-US/). Uses lookahead so we don't strip "ev" from "event". */
const LOCALE_SEGMENT = /^\/?([a-z]{2}(-[a-z]{2,3})?)(?=\/|$)\/?/i;

/**
 * Prepends the base path (from astro.config.ts) to relative URLs.
 * When locale is provided, ensures the path has that locale prefix (and strips any existing one to avoid duplication).
 * @param href - The URL to prepend the base path to
 * @param locale - Optional locale (e.g. 'en-US'). When set, the result is base + /{localeShort}/path
 * @returns The URL with the base path (and optionally locale) prepended, or the original URL if it's absolute
 */
export function prependBase(href: string | undefined, locale?: string): string {
  if (!href) {
    if (locale) {
      const localeShort = locale.split('-')[0];
      const base = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
      return base ? `${base}/${localeShort}` : `/${localeShort}`;
    }
    return baseUrl;
  }
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    return href;
  }
  let path = href.startsWith('/') ? href.slice(1) : href;
  if (locale) {
    path = path.replace(LOCALE_SEGMENT, '') || '';
    const localeShort = locale.split('-')[0];
    path = path ? `${localeShort}/${path}` : localeShort;
  }
  if (path === '' || path === '/') {
    return baseUrl === '/' ? '/' : baseUrl.replace(/\/$/, '');
  }
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return base ? `${base}/${path}` : `/${path}`;
}

/**
 * Gets the base URL from Astro config
 * @returns The base URL (e.g., "/made_evo/" or "/")
 */
export function getBaseUrl(): string {
  return baseUrl;
}

/**
 * Formats an ISO date string for display.
 * When estimated: year only (e.g. "1985"). Otherwise: full date (e.g. "October 18, 1985").
 * @param isoDate - ISO date string from Contentful or similar
 * @param locale - Optional locale (e.g. 'en-US') for localized output
 * @param isDateEstimated - When true, show only the year (no day/month)
 * @returns Human-readable date string, or the original string if parsing fails
 */
export function formatReleaseDate(isoDate: string, locale?: string, isDateEstimated?: boolean): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const loc = locale ?? 'en-US';
  if (isDateEstimated) {
    return new Intl.DateTimeFormat(loc, { year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(loc, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Formats an event's date, e.g. "Thursday, July 16, 2026", in MADE's venue timezone (Pacific)
 * regardless of the runtime's local timezone.
 * @param dateStr - ISO date string (event startDate)
 * @returns Human-readable date string, or null if dateStr is missing/invalid
 */
export function formatEventDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: EVENT_TIME_ZONE,
  });
}

/**
 * Formats an event's time range, e.g. "7:00 PM \u2013 10:00 PM" (or just the start time when
 * there's no end date), in MADE's venue timezone (Pacific) regardless of the runtime's local
 * timezone.
 * @param startStr - ISO date string (event startDate)
 * @param endStr - Optional ISO date string (event endDate)
 * @returns Human-readable time range, or null if startStr is missing/invalid
 */
export function formatEventTime(startStr?: string, endStr?: string): string | null {
  if (!startStr) return null;
  const start = new Date(startStr);
  if (isNaN(start.getTime())) return null;
  const startTime = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EVENT_TIME_ZONE,
  });

  if (!endStr) return startTime;
  const end = new Date(endStr);
  if (isNaN(end.getTime())) return startTime;

  const endTime = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EVENT_TIME_ZONE,
  });
  const sameDay =
    start.toLocaleDateString('en-US', { timeZone: EVENT_TIME_ZONE }) ===
    end.toLocaleDateString('en-US', { timeZone: EVENT_TIME_ZONE });
  if (sameDay) {
    return `${startTime} \u2013 ${endTime}`;
  }
  const endDateLabel = end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: EVENT_TIME_ZONE,
  });
  return `${startTime} \u2013 ${endDateLabel}, ${endTime}`;
}
