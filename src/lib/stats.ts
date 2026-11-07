"use client";

import { createSupabaseClient } from "./supabase/client.ts";
import { readStoredSession } from "./auth-storage.ts";
import { recordedMood } from "./mood.ts";

/** One app used most on the phone that day, in the single shape the dashboard reads. */
export interface TopApp {
  app: string;
  /** Seconds of use. The phone worker stores seconds; legacy rows stored minutes. */
  time_sec: number;
}

export interface DailyEntry {
  date: string;
  /** Recorded mood 1..5; 0 means the day has no recorded mood. */
  mood: number;
  moodEmoji: string;
  /** 0/null means the sleep question was not answered. */
  sleep_quality: number | null;
  /** 0/null means the stress question was not answered. */
  stress: number | null;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  weather: string[];
  /** Only scales the user actually touched are stored (value > 0). */
  scale_values: Record<string, number>;
  /** AI-generated reflection, or null when none was generated. */
  ai_reflection: string | null;
  phone_screen_time?: number | null;
  phone_unlocks?: number | null;
  /** Always normalized to {app, time_sec}; legacy minute rows are converted. */
  phone_top_apps?: TopApp[];
  /** Public URL of the day's photo (null if no photo). */
  photo_path: string | null;
}

/** Supabase/PostgREST returns at most this many rows per request by default. */
const ENTRY_PAGE_SIZE = 1000;

/** Coerce a database numeric value without turning null/undefined into zero. */
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Coerce a database boolean map, ignoring arrays and non-boolean values. */
function booleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
    )
  );
}

/** Coerce a JSON object of numeric scale values, dropping unknown entries. */
function numericMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  );
}

/**
 * Normalize one `entries` row to the dashboard shape.
 *
 * The previous mapper dropped sleep, stress, weather, scales, the AI reflection
 * and the photo, so every card that needed them read `undefined`. It also left
 * `phone_top_apps` in two shapes: older rows store `{app, minutes}`, newer ones
 * `{app, time_sec}`. Both are converted here so downstream code has one key.
 */
export function mapDailyEntryRow(row: Record<string, unknown>): DailyEntry {
  const rawApps = Array.isArray(row.phone_top_apps) ? row.phone_top_apps : [];
  const apps: TopApp[] = [];
  for (const raw of rawApps) {
    if (!raw || typeof raw !== "object") continue;
    const app = (raw as { app?: unknown }).app;
    if (typeof app !== "string" || !app.trim()) continue;

    const seconds = (raw as { time_sec?: unknown }).time_sec;
    const minutes = (raw as { minutes?: unknown }).minutes;
    const timeSec =
      typeof seconds === "number" && Number.isFinite(seconds)
        ? seconds
        : typeof minutes === "number" && Number.isFinite(minutes)
          ? Math.round(minutes * 60)
          : null;
    if (timeSec == null || timeSec < 0) continue;

    apps.push({ app, time_sec: timeSec });
  }

  return {
    date: typeof row.date === "string" ? row.date : "",
    // Never invent a neutral 3 for an unanswered day; 0 means "not recorded".
    mood: recordedMood(row.mood) ?? 0,
    moodEmoji: typeof row.mood_emoji === "string" ? row.mood_emoji : "",
    sleep_quality: numberOrNull(row.sleep_quality),
    stress: numberOrNull(row.stress),
    activities: Array.isArray(row.activities)
      ? row.activities.filter((item): item is string => typeof item === "string")
      : [],
    habits: booleanMap(row.habits),
    gratitude: Array.isArray(row.gratitude)
      ? row.gratitude.filter((item): item is string => typeof item === "string")
      : [],
    note: typeof row.note === "string" ? row.note : "",
    weather: Array.isArray(row.weather)
      ? row.weather.filter((item): item is string => typeof item === "string")
      : [],
    scale_values: numericMap(row.scale_values),
    ai_reflection:
      typeof row.ai_reflection === "string" && row.ai_reflection.trim()
        ? row.ai_reflection
        : null,
    phone_screen_time: numberOrNull(row.phone_screen_time),
    phone_unlocks: numberOrNull(row.phone_unlocks),
    phone_top_apps: apps.length > 0 ? apps : undefined,
    photo_path:
      typeof row.photo_path === "string" && row.photo_path.trim()
        ? row.photo_path
        : null,
  };
}

/**
 * Collapse duplicate dates, newest row wins.
 *
 * A day should have one row, but sync workers and retried saves have produced
 * duplicates in production. The rows are read oldest first (date, then
 * created_at), so "last one wins" is the newest write for that date. The result
 * is ascending by date, which is the order every statistics view expects.
 */
export function dedupeDailyEntries(
  entries: readonly DailyEntry[]
): DailyEntry[] {
  const byDate = new Map<string, DailyEntry>();
  for (const entry of entries) {
    if (!entry.date) continue;
    byDate.set(entry.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Resolve the signed-in user the same way the rest of the web data layer does. */
async function resolveUserId(
  sb: ReturnType<typeof createSupabaseClient>
): Promise<string | null> {
  const session = readStoredSession();
  if (session?.access_token) {
    // Always set session so RLS has auth.uid() context.
    await sb.auth
      .setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token || "",
      })
      .catch(() => {});

    const sessionUserId = session.user?.id || null;
    if (sessionUserId) return sessionUserId;
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      if (typeof payload.sub === "string") return payload.sub;
    } catch {
      // Fall through to supabase-js.
    }
  }

  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Load every daily entry for the signed-in user, oldest first.
 *
 * The old read asked for 1000 rows and stopped: an account with more than
 * 1000 days silently lost its oldest history (streaks, year pixels, memories).
 * The read is paginated until a short page arrives. A real read failure throws
 * instead of returning `[]`, because "no entries" and "the request died" must
 * not look the same to the dashboard.
 */
export async function fetchDailyEntries(): Promise<DailyEntry[]> {
  const sb = createSupabaseClient();
  const userId = await resolveUserId(sb);
  if (!userId) return [];

  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from("entries")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + ENTRY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Entries se nepodařilo načíst: ${error.message || "neznámá chyba"}`
      );
    }

    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < ENTRY_PAGE_SIZE) break;
    from += ENTRY_PAGE_SIZE;
  }

  return dedupeDailyEntries(rows.map(mapDailyEntryRow));
}

export const MOOD_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#3b82f6",
  3: "#eab308",
  2: "#f97316",
  1: "#ef4444",
};

export const MOOD_LABELS: Record<number, string> = {
  5: "😄 Skvěle",
  4: "🙂 Dobře",
  3: "😐 Jde to",
  2: "😟 Špatně",
  1: "😡 Hrozně",
};

export const MOOD_EMOJIS: Record<number, string> = {
  5: "😄",
  4: "🙂",
  3: "😐",
  2: "😟",
  1: "😡",
};
