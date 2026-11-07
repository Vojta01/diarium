/**
 * Canonical local calendar date for Diarium.
 *
 * The app's "today" is the date in Europe/Prague, never the UTC date and never
 * the browser's local date. Callers pass an instant; the helper is pure and
 * has no dependency on the runtime time zone.
 */
export const PRAGUE_TIME_ZONE = "Europe/Prague";

const pragueDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns the Europe/Prague calendar date as YYYY-MM-DD. */
export function pragueDateKey(instant: Date = new Date()): string {
  const parts = pragueDateFormatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * Shift a `YYYY-MM-DD` key by whole calendar days.
 *
 * Uses noon UTC as the anchor so adding/subtracting a day never lands on the
 * wrong date across a DST transition, regardless of the runtime time zone.
 */
export function shiftDateKey(key: string, days: number): string {
  const anchor = new Date(`${key}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/**
 * Returns the Europe/Prague calendar year.
 *
 * Year selectors must use this instead of `new Date().getFullYear()`: around
 * midnight on 31 December the Prague year is already the next one while the
 * runtime's local/UTC year is not.
 */
export function pragueYear(instant: Date = new Date()): number {
  return Number(pragueDateKey(instant).slice(0, 4));
}
