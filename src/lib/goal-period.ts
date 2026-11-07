import { pragueDateKey, shiftDateKey, shiftMonthKey } from "./date.ts";

export type GoalPeriod = "week" | "month";

export interface GoalPeriodRange {
  /** First day of the period (inclusive), YYYY-MM-DD in Europe/Prague. */
  start: string;
  /** Last day of the period (inclusive), YYYY-MM-DD in Europe/Prague. */
  end: string;
}

/**
 * Date range used to count goal activity, expressed in Europe/Prague days.
 *
 * The end must be the Prague date, never `toISOString()` (UTC): between
 * midnight and the UTC offset Prague is already on the next day, so a UTC end
 * would exclude the entry the user just saved. Both ends are computed from the
 * Prague key so DST transitions cannot shift a day.
 */
export function goalPeriodRange(
  period: GoalPeriod,
  now: Date = new Date()
): GoalPeriodRange {
  const end = pragueDateKey(now);
  const start =
    period === "week" ? shiftDateKey(end, -7) : shiftMonthKey(end, -1);

  return { start, end };
}
