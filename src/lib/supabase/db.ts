import { createSupabaseClient } from "./client";

// ── Typy ──

export interface Profile {
  id: string;
  github_user?: string;
  default_repo?: string;
  created_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  mood_emoji: string;
  sleep_quality?: number;
  stress?: number;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  weather: string[];
  phone_screen_time?: number;
  phone_unlocks?: number;
  phone_top_apps?: { app: string; minutes: number }[];
  photo_path?: string;
  created_at: string;
}

export interface CheckInPayload {
  mood: number;
  mood_emoji: string;
  sleep_quality: number;
  stress: number;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  weather: string[];
  date?: string; // ISO date string — defaults to today if not set
}

// ── Helpers ──

function getSupabase() {
  return createSupabaseClient();
}

/** Get the stored access token from localStorage (bypasses supabase-js auth issues) */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('sb-vmqbslghzgfotwhzgawa-auth-token');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.access_token || null;
    }
  } catch {}
  return null;
}

/** Vytvoří Supabase klienta s explicitním session tokenem pro obcházení "Invalid API key" */
function getAuthenticatedClient() {
  const token = getAccessToken();
  if (!token) return getSupabase();
  
  const sb = getSupabase();
  // Don't await — we just need the client to have the session in its internal state
  // The session will be used for subsequent queries
  sb.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
  return sb;
}

/** Získá aktuálně přihlášeného uživatele — z localStorage (rychlé, offline) */
export async function getCurrentUser() {
  // Try localStorage first (set by callback page)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sb-vmqbslghzgfotwhzgawa-auth-token');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.user) return parsed.user;
      } catch {}
    }
  }

  // Fallback: Supabase API
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

/** Vráti profil přihlášeného uživatele (vytvoří ho, pokud neexistuje) */
export async function getProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const sb = getSupabase();
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!data) {
    const { data: created } = await (sb
      .from("profiles") as any)
      .insert([{ id: user.id, github_user: user.user_metadata?.user_name ?? null }])
      .select()
      .single();
    return created ?? null;
  }

  return data;
}

// ── Entries ──

/** Uloží nebo updatuje denní check-in — používá interní API (service_role) */
export async function saveEntry(payload: CheckInPayload): Promise<Entry> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nepřihlášen");

  const entryDate = payload.date || new Date().toISOString().split("T")[0];

  const row = {
    user_id: user.id,
    date: entryDate,
    mood: payload.mood,
    mood_emoji: payload.mood_emoji,
    sleep_quality: payload.sleep_quality,
    stress: payload.stress,
    activities: payload.activities,
    habits: payload.habits,
    gratitude: payload.gratitude,
    note: payload.note,
    weather: payload.weather,
  };

  // Use our API endpoint which has the service_role key
  const res = await fetch("/api/save-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Save failed");
  }

  return (await res.json()) as Entry;
}

/** Načte entries pro dané období */
export async function getEntries(from?: string, to?: string): Promise<Entry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const sb = getAuthenticatedClient();
  let query = sb
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) {
    console.error("Chyba při načítání entries:", error);
    return [];
  }
  return (data as Entry[]) ?? [];
}

/** Načte jeden denní zápis */
export async function getEntry(date: string): Promise<Entry | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const sb = getAuthenticatedClient();
  const { data } = await sb
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  return data ?? null;
}

// ── Aktivity & Návyky ──

export interface ActivityDef {
  key: string;
  label: string;
  icon: string;
  category: string;
  color: string;
  source: "default" | "custom";
}

export interface HabitDef {
  key: string;
  label: string;
  icon: string;
  category: string;
  color: string;
  is_negative: boolean;
  source: "default" | "custom";
}

export async function getActivities(): Promise<ActivityDef[]> {
  const user = await getCurrentUser();
  const sb = getAuthenticatedClient();

  const [defaultRes, customRes] = await Promise.all([
    sb.from("activity_catalog").select("*").eq("is_default", true).order("sort_order"),
    user
      ? sb.from("user_activities").select("*").eq("user_id", user.id).eq("is_active", true)
      : Promise.resolve({ data: [] }),
  ]);

  const defaults: ActivityDef[] = defaultRes.data?.map((a: any) => ({ ...a, source: "default" as const })) ?? [];
  const customs: ActivityDef[] = customRes.data?.map((a: any) => ({ ...a, source: "custom" as const })) ?? [];
  return [...defaults, ...customs];
}

export async function getHabits(): Promise<HabitDef[]> {
  const user = await getCurrentUser();
  const sb = getAuthenticatedClient();

  const [defaultRes, userRes] = await Promise.all([
    sb.from("habit_catalog").select("*").eq("is_default", true).order("sort_order"),
    user
      ? sb.from("user_habits").select("*").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const defaults: HabitDef[] = defaultRes.data?.map((h: any) => ({ ...h, source: "default" as const })) ?? [];
  const userHabits: any[] = userRes.data ?? [];
  
  // Build a map of user overrides: habit key → is_active
  const overrides: Record<string, boolean> = {};
  userHabits.forEach((h: any) => { overrides[h.key] = h.is_active; });
  
  // Filter defaults: hide if user has an explicit override with is_active=false
  const activeDefaults = defaults.filter(h => overrides[h.key] !== false);
  
  // Add user's custom active habits (not already in defaults)
  const customKeys = new Set(defaults.map(d => d.key));
  const customs: HabitDef[] = userHabits
    .filter((h: any) => h.is_active && !customKeys.has(h.key))
    .map((h: any) => ({ ...h, source: "custom" as const })) ?? [];
  
  return [...activeDefaults, ...customs];
}

/** Toggle a habit's visibility for the current user.
 *  Setting visible=false creates a user_habit with is_active=false (hides it).
 *  Setting visible=true removes the override (shows default) or creates an active custom habit. */
export async function setHabitVisibility(key: string, visible: boolean, habitInfo?: { label?: string; icon?: string; is_negative?: boolean }): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const sb = getAuthenticatedClient();

  if (visible) {
    // Remove the "hide" override if it exists
    await sb.from("user_habits").delete().eq("user_id", user.id).eq("key", key).eq("is_active", false);
  } else {
    // Insert or update a "hide" override
    await sb.from("user_habits").upsert({
      user_id: user.id,
      key,
      label: habitInfo?.label || key,
      icon: habitInfo?.icon || '✅',
      is_negative: habitInfo?.is_negative ?? true,
      is_active: false,
    }, { onConflict: 'user_id,key' });
  }
}
