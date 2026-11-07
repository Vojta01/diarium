"use client";

import { deriveDashboard, type DashboardData } from "./dashboard.ts";
import { computeGoalProgressList, type GoalProgressData } from "./goal-progress.ts";
import { getGoals, type Goal } from "./goals.ts";
import { pragueDateKey } from "./date.ts";
import { getScalesOrThrow, type Scale } from "./scales.ts";
import { fetchDailyEntries, type DailyEntry } from "./stats.ts";
import { getHabitsOrThrow, type HabitDef } from "./supabase/db.ts";

/**
 * Everything one dashboard load produces.
 *
 * `data` is the only required part: if the entries read fails, this function
 * throws and the screen shows its error card. The optional resources are
 * independent cards, so a goals/scales/habits failure carries an error string
 * and `null` data instead of an empty list. `null` means "could not verify";
 * `[]` means "this account really has none". The UI must render those two
 * states differently (error + retry vs empty CTA), exactly like Android.
 */
export interface DashboardDataBundle {
  data: DashboardData;
  goals: GoalProgressData<Goal>[] | null;
  goalsError: string | null;
  scales: Scale[] | null;
  scalesError: string | null;
  habits: HabitDef[] | null;
  habitsError: string | null;
}

/** Short, user-showable message; never hides a real failure behind a generic one. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

/**
 * Load and derive the dashboard for `today` (Europe/Prague by default).
 *
 * One entries read supplies the whole dashboard, including the on-this-day
 * lookbacks, because `fetchDailyEntries` now pages through the account's full
 * history instead of stopping at 1000 rows. Goals are then counted against the
 * same rows with the pure calendar-period maths; scales and habits ride along
 * for the subscreens.
 *
 * No fake fallbacks: a failed entries read rejects, and every optional failure
 * is reported as `*Error` with `null` data.
 */
export async function fetchDashboardData(
  today: string = pragueDateKey()
): Promise<DashboardDataBundle> {
  const [entriesResult, goalsResult, scalesResult, habitsResult] =
    await Promise.allSettled([
      fetchDailyEntries(),
      getGoals(),
      getScalesOrThrow(),
      getHabitsOrThrow(),
    ]);

  if (entriesResult.status === "rejected") {
    throw entriesResult.reason;
  }

  const entries: DailyEntry[] = entriesResult.value;
  const data = deriveDashboard(today, entries);

  const goals =
    goalsResult.status === "fulfilled"
      ? computeGoalProgressList(goalsResult.value, entries, today)
      : null;

  return {
    data,
    goals,
    goalsError:
      goalsResult.status === "rejected"
        ? errorMessage(goalsResult.reason, "Cíle se nepodařilo načíst.")
        : null,
    scales: scalesResult.status === "fulfilled" ? scalesResult.value : null,
    scalesError:
      scalesResult.status === "rejected"
        ? errorMessage(scalesResult.reason, "Škály se nepodařilo načíst.")
        : null,
    habits: habitsResult.status === "fulfilled" ? habitsResult.value : null,
    habitsError:
      habitsResult.status === "rejected"
        ? errorMessage(habitsResult.reason, "Návyky se nepodařilo načíst.")
        : null,
  };
}
