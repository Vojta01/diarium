"use client";

import { createSupabaseClient } from "@/lib/supabase/client";

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
}

/** Načte všechny daily entries pro aktuálního uživatele */
export async function fetchDailyEntries(): Promise<DailyEntry[]> {
  const sb = createSupabaseClient();
  
  // Get user from localStorage (bypasses supabase-js auth issues)
  let userId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('sb-vmqbslghzgfotwhzgawa-auth-token');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user?.id) {
          userId = parsed.user.id;
          // Set session explicitly so RLS queries work
          if (parsed.access_token) {
            await sb.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token || '' }).catch(() => {});
          }
        }
      }
    } catch {}
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
    .order("date", { ascending: true });

  if (error) {
    console.error("Chyba při načítání entries:", error);
    return [];
  }

  return (data ?? []).map((e: any) => ({
    date: e.date,
    mood: e.mood ?? 3,
    moodEmoji: e.mood_emoji ?? "😐",
    activities: e.activities ?? [],
    habits: e.habits ?? {},
    gratitude: e.gratitude ?? [],
    note: e.note ?? "",
    phone_screen_time: e.phone_screen_time,
    phone_unlocks: e.phone_unlocks,
    phone_top_apps: e.phone_top_apps ?? undefined,
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
