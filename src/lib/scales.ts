import { createSupabaseClient } from "./supabase/client";
import { readStoredSession } from "./auth-storage";

export interface Scale {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  min_value: number;
  max_value: number;
  unit?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ScaleEntry {
  id: string;
  user_id: string;
  scale_id: string;
  date: string;
  value: number;
  created_at: string;
}

function getSupabase() {
  return createSupabaseClient();
}

function getAccessToken(): string | null {
  const session = readStoredSession();
  return session?.access_token || null;
}

async function getAuthenticatedClient() {
  const token = getAccessToken();
  const sb = getSupabase();
  if (token) {
    await sb.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
  }
  return sb;
}

async function getCurrentUserId(): Promise<string | null> {
  const session = readStoredSession();
  if (session?.user?.id) return session.user.id;
  
  const token = getAccessToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub;
    } catch {}
  }
  
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  return data.user?.id || null;
}

export async function getScales(): Promise<Scale[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  const sb = await getAuthenticatedClient();
  const { data, error } = await sb
    .from("scales")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  
  if (error) {
    console.error("getScales error:", error);
    return [];
  }
  return data || [];
}

export async function createScale(scale: Omit<Scale, 'id' | 'user_id' | 'created_at'>): Promise<Scale> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const sb = await getAuthenticatedClient();
  const { data, error } = await sb
    .from("scales")
    .insert({ ...scale, user_id: userId })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateScale(id: string, updates: Partial<Scale>): Promise<void> {
  const sb = await getAuthenticatedClient();
  const { error } = await sb
    .from("scales")
    .update(updates)
    .eq("id", id);
  
  if (error) throw error;
}

export async function deleteScale(id: string): Promise<void> {
  const sb = await getAuthenticatedClient();
  const { error } = await sb
    .from("scales")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}

export async function saveScaleEntry(scaleId: string, date: string, value: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const sb = await getAuthenticatedClient();
  const { error } = await sb
    .from("scale_entries")
    .upsert({
      user_id: userId,
      scale_id: scaleId,
      date,
      value,
    }, { onConflict: 'user_id,scale_id,date' });
  
  if (error) throw error;
}

export async function getScaleEntries(scaleId: string, days: number = 30): Promise<ScaleEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  const sb = await getAuthenticatedClient();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  const { data, error } = await sb
    .from("scale_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("scale_id", scaleId)
    .gte("date", fromDate.toISOString().split('T')[0])
    .order("date", { ascending: true });
  
  if (error) {
    console.error("getScaleEntries error:", error);
    return [];
  }
  return data || [];
}

export async function getScaleDistribution(scaleId: string, days: number = 30): Promise<Record<number, number>> {
  const entries = await getScaleEntries(scaleId, days);
  const distribution: Record<number, number> = {};
  
  entries.forEach(entry => {
    distribution[entry.value] = (distribution[entry.value] || 0) + 1;
  });
  
  return distribution;
}

export async function getScaleAverage(scaleId: string, days: number = 30): Promise<number> {
  const entries = await getScaleEntries(scaleId, days);
  if (entries.length === 0) return 0;
  
  const sum = entries.reduce((acc, entry) => acc + entry.value, 0);
  return sum / entries.length;
}

// Seed default Daylio-inspired scales for new users
const DEFAULT_SCALES: Omit<Scale, 'id' | 'user_id' | 'created_at'>[] = [
  { name: "Energie", emoji: "⚡", min_value: 1, max_value: 5, color: "#eab308", sort_order: 0, is_active: true },
  { name: "Produktivita", emoji: "💪", min_value: 1, max_value: 5, color: "#22c55e", sort_order: 1, is_active: true },
];

export async function seedDefaultScales(): Promise<Scale[]> {
  const existing = await getScales();
  
  // Delete old scales that don't match the new defaults
  const allowedNames = new Set(DEFAULT_SCALES.map(s => s.name));
  for (const scale of existing) {
    if (!allowedNames.has(scale.name)) {
      try { await deleteScale(scale.id); } catch {}
    }
  }
  
  // Get remaining scales after cleanup
  const remaining = await getScales();
  if (remaining.length >= DEFAULT_SCALES.length) return remaining;
  
  // Create missing default scales
  const created = [];
  const existingNames = new Set(remaining.map(s => s.name));
  for (const scale of DEFAULT_SCALES) {
    if (!existingNames.has(scale.name)) {
      try {
        const s = await createScale(scale);
        created.push(s);
      } catch {}
    }
  }
  return [...remaining, ...created];
}
