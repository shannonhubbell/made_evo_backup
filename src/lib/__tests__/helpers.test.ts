/**
 * Regression tests for MADE-venue-timezone-aware event formatting.
 *
 * These specifically guard against the class of bug where event dates/times render
 * correctly on a developer's machine (which happens to default to Pacific time) but
 * incorrectly once deployed (e.g. Cloudflare Workers, which defaults to UTC when no
 * explicit `timeZone` is provided to `Intl`/`Date` formatting). Every assertion below
 * is derived from a fixed UTC instant, so these tests fail if the Pacific `timeZone`
 * option is ever accidentally dropped from the underlying formatting calls - even
 * though the CI/dev machine running these tests might default to any timezone.
 */
import { describe, it, expect } from 'vitest';
import {
  EVENT_TIME_ZONE,
  formatEventDate,
  formatEventTime,
  getEventDateParts,
} from '../helpers';

describe('EVENT_TIME_ZONE', () => {
  it('is the IANA zone for MADE\'s Oakland, CA venue', () => {
    expect(EVENT_TIME_ZONE).toBe('America/Los_Angeles');
  });
});

describe('formatEventDate', () => {
  it('returns null when no date is provided', () => {
    expect(formatEventDate(undefined)).toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(formatEventDate('not-a-date')).toBeNull();
  });

  it('rolls back to the correct Pacific calendar day during PDT (summer)', () => {
    // 2026-07-17T02:00:00Z is 7:00 PM on 2026-07-16 in Pacific Daylight Time (UTC-7).
    // If the explicit timeZone were dropped, a UTC-defaulting runtime would show July 17.
    const label = formatEventDate('2026-07-17T02:00:00.000Z');
    expect(label).toContain('July 16, 2026');
    expect(label).not.toContain('July 17');
  });

  it('rolls back to the correct Pacific calendar day during PST (winter)', () => {
    // 2026-01-15T03:00:00Z is 7:00 PM on 2026-01-14 in Pacific Standard Time (UTC-8).
    const label = formatEventDate('2026-01-15T03:00:00.000Z');
    expect(label).toContain('January 14, 2026');
    expect(label).not.toContain('January 15');
  });
});

describe('formatEventTime', () => {
  it('returns null when no start date is provided', () => {
    expect(formatEventTime(undefined)).toBeNull();
  });

  it('formats a start time in Pacific Daylight Time (summer)', () => {
    expect(formatEventTime('2026-07-17T02:00:00.000Z')).toBe('7:00 PM');
  });

  it('formats a start time in Pacific Standard Time (winter)', () => {
    expect(formatEventTime('2026-01-15T03:00:00.000Z')).toBe('7:00 PM');
  });

  it('formats a same-day start/end range', () => {
    // 7:00 PM - 10:00 PM Pacific on the same day
    const range = formatEventTime(
      '2026-07-17T02:00:00.000Z',
      '2026-07-17T05:00:00.000Z'
    );
    expect(range).toBe('7:00 PM \u2013 10:00 PM');
  });

  it('formats a multi-day start/end range with the end date labeled', () => {
    const range = formatEventTime(
      '2026-07-17T02:00:00.000Z',
      '2026-07-18T02:00:00.000Z'
    );
    expect(range).toContain('7:00 PM');
    expect(range).toContain('July 17');
  });

  it('produces the same result regardless of the runtime default timezone', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      const utcResult = formatEventTime('2026-07-17T02:00:00.000Z');

      process.env.TZ = 'Asia/Tokyo';
      const tokyoResult = formatEventTime('2026-07-17T02:00:00.000Z');

      expect(utcResult).toBe('7:00 PM');
      expect(tokyoResult).toBe('7:00 PM');
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('getEventDateParts', () => {
  it('returns Pacific-time year/month/day for a UTC instant (PDT)', () => {
    // month is 0-indexed: July is 6
    expect(getEventDateParts(new Date('2026-07-17T02:00:00.000Z'))).toEqual({
      year: 2026,
      month: 6,
      day: 16,
    });
  });

  it('returns Pacific-time year/month/day for a UTC instant (PST)', () => {
    // month is 0-indexed: January is 0
    expect(getEventDateParts(new Date('2026-01-15T03:00:00.000Z'))).toEqual({
      year: 2026,
      month: 0,
      day: 14,
    });
  });

  it('is unaffected by the runtime default timezone', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      const utcResult = getEventDateParts(new Date('2026-07-17T02:00:00.000Z'));

      process.env.TZ = 'Asia/Tokyo';
      const tokyoResult = getEventDateParts(new Date('2026-07-17T02:00:00.000Z'));

      expect(utcResult).toEqual({ year: 2026, month: 6, day: 16 });
      expect(tokyoResult).toEqual({ year: 2026, month: 6, day: 16 });
    } finally {
      process.env.TZ = original;
    }
  });
});
