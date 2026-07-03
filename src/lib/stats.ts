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
  phone_top_apps?: string;
}

/** Načte všechny daily entries pro aktuálního uživatele */
export async function fetchDailyEntries(): Promise<DailyEntry[]> {
  const sb = createSupabaseClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await sb
    .from("entries")
    .select("*")
    .eq("user_id", userData.user.id)
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
    phone_top_apps: e.phone_top_apps ? JSON.stringify(e.phone_top_apps) : undefined,
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
