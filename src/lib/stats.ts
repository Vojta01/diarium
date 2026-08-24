"use client";

import { createSupabaseClient } from "@/lib/supabase/client";
import { readStoredSession } from "@/lib/auth-storage";

export interface DailyEntry {
  date: string;
  mood: number;
  moodEmoji: string;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  phone_screen_time?: number;
  phone_unlocks?: number;
  /** Array of {app: string, time_sec: number} from HA phone_usage.py */
  phone_top_apps?: { app: string; time_sec: number }[];
  /** Public URL of the day's photo (null if no photo). */
  photo_path?: string | null;
}

/** Načte všechny daily entries pro aktuálního uživatele */
export async function fetchDailyEntries(): Promise<DailyEntry[]> {
  const sb = createSupabaseClient();
  
  // Get user from localStorage (bypasses supabase-js auth issues)
  let userId: string | null = null;
  const session = readStoredSession();
  if (session?.access_token) {
    // Always set session so RLS has auth.uid() context
    await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token || '' }).catch(() => {});
    
    // Extract user ID from session, fallback to JWT decode
    userId = session.user?.id || null;
    if (!userId) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        userId = payload.sub;
      } catch {}
    }
  }
  
  if (!userId) {
    // Fallback to supabase-js getUser
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) return [];
    userId = userData.user.id;
  }

  const { data, error } = await sb
    .from("entries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Chyba při načítání entries:", error);
    return [];
  }

  return (data ?? []).reverse().map((e: any) => ({
    date: e.date,
    mood: e.mood ?? 3,
    moodEmoji: e.mood_emoji ?? "😐",
    activities: Array.isArray(e.activities) ? e.activities : [],
    habits: (e.habits && typeof e.habits === "object" && !Array.isArray(e.habits)) ? e.habits : {},
    gratitude: Array.isArray(e.gratitude) ? e.gratitude : [],
    note: e.note ?? "",
    phone_screen_time: e.phone_screen_time,
    phone_unlocks: e.phone_unlocks,
    phone_top_apps: Array.isArray(e.phone_top_apps) ? e.phone_top_apps : undefined,
    photo_path: e.photo_path ?? null,
  }));
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
