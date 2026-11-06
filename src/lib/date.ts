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
