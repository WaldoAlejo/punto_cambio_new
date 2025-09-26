// Frontend timezone utilities for Guayaquil (UTC-5)
// Ecuador (Guayaquil) doesn't use DST; we use a fixed offset of -05:00.

export const GYE_OFFSET_HOURS = -5;
export const GYE_OFFSET_MS = Math.abs(GYE_OFFSET_HOURS) * 60 * 60 * 1000; // 5h in ms

// Convert a UTC instant to "Guayaquil clock" (-05:00) without changing the real instant.
// Useful for extracting year/month/day according to Guayaquil calendar.
export function toGyeClock(date: Date): Date {
  return new Date(date.getTime() - GYE_OFFSET_MS);
}

// Convert a time that you assume is in "Guayaquil clock" to its corresponding UTC instant.
export function fromGyeClockToUtc(date: Date): Date {
  return new Date(date.getTime() + GYE_OFFSET_MS);
}

// Range [gte, lt) in UTC that covers the calendar day of Guayaquil for the given date.
// Ex: if date is 2025-09-16T18:00:00Z, returns UTC start of 2025-09-16 00:00 GYE and end +24h.
export function gyeDayRangeUtcFromDate(date: Date): { gte: Date; lt: Date } {
  const asGye = toGyeClock(date); // "see" the instant with the -05:00 clock
  const y = asGye.getUTCFullYear();
  const m = asGye.getUTCMonth();
  const d = asGye.getUTCDate();

  // 00:00 GYE of that day, expressed as if it were UTC
  const startGyeAsUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  // Return to the real instant in UTC by adding the offset
  const gte = fromGyeClockToUtc(startGyeAsUtc);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

// Returns the YYYY-MM-DD string of Guayaquil's "today" based on an instant (default: now)
export function todayGyeDateOnly(now: Date = new Date()): string {
  const asGye = toGyeClock(now);
  const y = asGye.getUTCFullYear();
  const m = asGye.getUTCMonth() + 1;
  const d = asGye.getUTCDate();
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = d < 10 ? `0${d}` : `${d}`;
  return `${y}-${mm}-${dd}`;
}
