/** Check-in date guards. `pragueDateKey` remains the single source of "today". */
import { pragueDateKey } from "../date.ts";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real `YYYY-MM-DD` calendar date. */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * A check-in can only open a real date that is not in the future. An invalid or
 * future `?edit=` value falls back to today instead of rendering a phantom day.
 */
export function clampCheckInDate(
  value: string | null | undefined,
  today: string = pragueDateKey()
): string {
  if (!isValidDateKey(value)) return today;
  return value > today ? today : value;
}
