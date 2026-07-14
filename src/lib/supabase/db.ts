import { createSupabaseClient } from "./client";
import { getSupabaseAuthTokenKey } from "@/lib/supabase-ref";
import { isPersonalMode, SENSITIVE_HABIT_KEYS } from "@/lib/feature-flags";

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
  ai_reflection?: string;
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
  photoDataUrl?: string | null; // base64 data URL or Google Photos URL
  photo_path?: string | null;   // already-uploaded URL (set internally)
}

// ── Helpers ──

function getSupabase() {
  return createSupabaseClient();
}

/** Get the stored access token from localStorage (bypasses supabase-js auth issues) */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(getSupabaseAuthTokenKey());
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
    const stored = localStorage.getItem(getSupabaseAuthTokenKey());
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

  // ── Upload fotky do Storage ──
  let photoPath: string | null = payload.photo_path || null;

  if (payload.photoDataUrl && !photoPath) {
    try {
      const sb = getSupabase();
      let imageBlob: Blob;

      if (payload.photoDataUrl.startsWith("data:")) {
        // Base64 data URL from device upload
        const [header, base64] = payload.photoDataUrl.split(",");
        const mimeMatch = header.match(/data:(.*?);/);
        const mimeType = mimeMatch?.[1] || "image/jpeg";
        const byteChars = atob(base64);
        const byteNums = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        imageBlob = new Blob([byteNums], { type: mimeType });
      } else if (payload.photoDataUrl.startsWith("https://")) {
        // Google Photos URL — download and re-upload to our Storage
        const resp = await fetch(payload.photoDataUrl);
        if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
        imageBlob = await resp.blob();
      } else {
        throw new Error("Neznámý formát fotky");
      }

      // Upload to Supabase Storage: diary-photos/{user_id}/{date}.jpg
      const filePath = `${user.id}/${entryDate}.jpg`;
      const { error: uploadErr } = await sb.storage
        .from("diary-photos")
        .upload(filePath, imageBlob, {
          contentType: imageBlob.type || "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        // Fallback: try to store the data URL directly as base64 in photo_path
        if (payload.photoDataUrl.length < 500_000) {
          photoPath = payload.photoDataUrl;
        }
      } else {
        // Construct the public URL
        const { data: urlData } = sb.storage
          .from("diary-photos")
          .getPublicUrl(filePath);
        photoPath = urlData.publicUrl;
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      // Fallback: store as base64 if small enough
      if (payload.photoDataUrl.length < 500_000) {
        photoPath = payload.photoDataUrl;
      }
    }
  }

  // ── Uložit záznam ──
  const row: Record<string, any> = {
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
  if (photoPath) row.photo_path = photoPath;
  if ((payload as any).ai_reflection) row.ai_reflection = (payload as any).ai_reflection;

  // Use our API endpoint which has the service_role key
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch("/api/save-entry", {
    method: "POST",
    headers,
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

// Hardcoded fallback — original activity catalog, used when DB is empty
const FALLBACK_ACTIVITIES: ActivityDef[] = [
  // Společenské
  { key: "rodina", label: "Rodina", icon: "👨‍👩‍👧", category: "sociální", color: "#8b5cf6", source: "default" },
  { key: "pratele", label: "Přátelé", icon: "👥", category: "sociální", color: "#8b5cf6", source: "default" },
  { key: "rande", label: "Rande", icon: "💑", category: "sociální", color: "#ec4899", source: "default" },
  { key: "party", label: "Párty", icon: "🎉", category: "sociální", color: "#f97316", source: "default" },
  { key: "office", label: "Office", icon: "🏢", category: "sociální", color: "#3b82f6", source: "default" },
  // Záliby
  { key: "filmy_a_tv", label: "Filmy a TV", icon: "🎬", category: "volný čas", color: "#eab308", source: "default" },
  { key: "cteni", label: "Čtení", icon: "📖", category: "volný čas", color: "#a855f7", source: "default" },
  { key: "hrani_her", label: "Hraní her", icon: "🎮", category: "volný čas", color: "#22c55e", source: "default" },
  { key: "sport", label: "Sport", icon: "🏃", category: "volný čas", color: "#22c55e", source: "default" },
  { key: "relax", label: "Relax", icon: "😌", category: "volný čas", color: "#8b5cf6", source: "default" },
  { key: "hudba", label: "Hudba", icon: "🎵", category: "volný čas", color: "#ef4444", source: "default" },
  // Jídlo
  { key: "jist_zdrave", label: "Jíst zdravě", icon: "🥗", category: "jídlo", color: "#22c55e", source: "default" },
  { key: "rychle_obcerstveni", label: "Rychlé občerstvení", icon: "🍔", category: "jídlo", color: "#f97316", source: "default" },
  { key: "domaci_vyroba", label: "Domácí výroba", icon: "🍳", category: "jídlo", color: "#f59e0b", source: "default" },
  { key: "restaurace", label: "Restaurace", icon: "🍽️", category: "jídlo", color: "#f97316", source: "default" },
  { key: "donaska", label: "Donáška", icon: "📦", category: "jídlo", color: "#f97316", source: "default" },
  { key: "den_bez_masa", label: "Den bez masa", icon: "🥬", category: "jídlo", color: "#22c55e", source: "default" },
  { key: "zadne_sladkosti", label: "Žádné sladkosti", icon: "🚫🍰", category: "jídlo", color: "#ef4444", source: "default" },
  { key: "zadne_limonady", label: "Žádné limonády", icon: "🚫🥤", category: "jídlo", color: "#ef4444", source: "default" },
  // Zdraví / Sport
  { key: "trenink", label: "Trénink", icon: "🏋️", category: "sport", color: "#16a34a", source: "default" },
  { key: "pit_vody", label: "Pít vodu", icon: "💧", category: "sport", color: "#3b82f6", source: "default" },
  { key: "chuze", label: "Chůze", icon: "🚶", category: "sport", color: "#84cc16", source: "default" },
  { key: "kolo", label: "Kolo", icon: "🚴", category: "sport", color: "#84cc16", source: "default" },
  { key: "plavani", label: "Plavání", icon: "🏊", category: "sport", color: "#06b6d4", source: "default" },
  { key: "paddleboard", label: "Paddleboard", icon: "🏄", category: "sport", color: "#06b6d4", source: "default" },
  { key: "snooker", label: "Snooker", icon: "🎱", category: "sport", color: "#ef4444", source: "default" },
  // Mé lepší já
  { key: "meditovat", label: "Meditovat", icon: "🧘", category: "wellness", color: "#7c3aed", source: "default" },
  { key: "laskavost", label: "Laskavost", icon: "💝", category: "wellness", color: "#ec4899", source: "default" },
  { key: "naslouchani", label: "Naslouchání", icon: "👂", category: "wellness", color: "#8b5cf6", source: "default" },
  { key: "darcovstvi", label: "Dárcovství", icon: "💰", category: "wellness", color: "#22c55e", source: "default" },
  { key: "dej_darek", label: "Dej dárek", icon: "🎁", category: "wellness", color: "#f97316", source: "default" },
  { key: "terapie", label: "Terapie", icon: "🛋️", category: "wellness", color: "#8b5cf6", source: "default" },
  { key: "integrita", label: "Integrita", icon: "⚖️", category: "wellness", color: "#6366f1", source: "default" },
  // Domácí práce
  { key: "nakupovani", label: "Nakupování", icon: "🛒", category: "domácí práce", color: "#f59e0b", source: "default" },
  { key: "uklizeni", label: "Uklízení", icon: "🧹", category: "domácí práce", color: "#3b82f6", source: "default" },
  { key: "vareni", label: "Vaření", icon: "🍲", category: "domácí práce", color: "#f97316", source: "default" },
  { key: "prani", label: "Praní", icon: "🧺", category: "domácí práce", color: "#3b82f6", source: "default" },
  { key: "zehleni", label: "Žehlení", icon: "👕", category: "domácí práce", color: "#ef4444", source: "default" },
  // Počasí
  { key: "slunecno", label: "Slunečno", icon: "☀️", category: "počasí", color: "#eab308", source: "default" },
  { key: "zatazeno", label: "Zataženo", icon: "☁️", category: "počasí", color: "#9ca3af", source: "default" },
  { key: "dest", label: "Déšť", icon: "🌧️", category: "počasí", color: "#3b82f6", source: "default" },
  { key: "snih", label: "Sníh", icon: "❄️", category: "počasí", color: "#e0e7ff", source: "default" },
  { key: "mraz", label: "Mráz", icon: "🥶", category: "počasí", color: "#93c5fd", source: "default" },
  { key: "horko", label: "Horko", icon: "🌡️", category: "počasí", color: "#ef4444", source: "default" },
  { key: "bourka", label: "Bouřka", icon: "🌩️", category: "počasí", color: "#f59e0b", source: "default" },
  { key: "vitr", label: "Vítr", icon: "💨", category: "počasí", color: "#9ca3af", source: "default" },
];

export async function getActivities(): Promise<ActivityDef[]> {
  // Always start with hardcoded fallback — guarantees activities show even if DB fails
  let defaults: ActivityDef[] = [...FALLBACK_ACTIVITIES];
  let customs: ActivityDef[] = [];

  try {
    const user = await getCurrentUser();
    const sb = getAuthenticatedClient();

    const [defaultRes, customRes, hiddenRes] = await Promise.all([
      sb.from("activity_catalog").select("*").eq("is_default", true).order("sort_order"),
      user
        ? sb.from("user_activities").select("*").eq("user_id", user.id).eq("is_active", true)
        : Promise.resolve({ data: [] }),
      user
        ? sb.from("user_activities").select("*").eq("user_id", user.id).eq("is_active", false)
        : Promise.resolve({ data: [] }),
    ]);

    // Only override defaults if DB returned valid data
    if (defaultRes.data && defaultRes.data.length > 0 && !('error' in defaultRes && defaultRes.error)) {
      defaults = defaultRes.data.map((a: any) => ({ ...a, source: "default" as const }));
      
      // Filter out defaults that user has hidden
      const hiddenKeys = new Set((hiddenRes.data || []).map((h: any) => h.key));
      defaults = defaults.filter(d => !hiddenKeys.has(d.key));
    }

    if (customRes.data && customRes.data.length > 0 && !('error' in customRes && customRes.error)) {
      customs = customRes.data.map((a: any) => ({ ...a, source: "custom" as const }));
    }

    // If DB is empty, try seeding in background
    if ((!defaultRes.data || defaultRes.data.length === 0) && customs.length === 0) {
      fetch("/api/seed-activities", { method: "POST" }).catch(() => {});
    }
  } catch (e) {
    console.error("getActivities() DB error, using fallback:", e);
  }

  return [...defaults, ...customs];
}

/** Returns activities that user has hidden (is_active=false) — for the "restore" UI */
export async function getHiddenActivities(): Promise<ActivityDef[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const sb = getAuthenticatedClient();

  const { data } = await sb
    .from("user_activities")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", false);

  if (!data || data.length === 0) return [];

  // Enrich with default catalog data if available
  const hiddenKeys = data.map((h: any) => h.key);
  const { data: catalogData } = await sb
    .from("activity_catalog")
    .select("*")
    .in("key", hiddenKeys);

  const catalogMap: Record<string, any> = {};
  (catalogData || []).forEach((c: any) => { catalogMap[c.key] = c; });

  return data.map((h: any) => {
    const catalog = catalogMap[h.key];
    return {
      key: h.key,
      label: catalog?.label || h.label || h.key,
      icon: catalog?.icon || h.icon || "📌",
      category: catalog?.category || "skryté",
      color: catalog?.color || "#6366f1",
      source: "default" as const,
    };
  });
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

  let defaults: HabitDef[] = defaultRes.data?.map((h: any) => ({ ...h, source: "default" as const })) ?? [];
  const userHabits: any[] = userRes.data ?? [];

  // Fallback: if DB returned empty, use hardcoded alkohol only + auto-seed
  if (defaults.length === 0) {
    defaults = [
      { key: "alkohol", label: "Alkohol", icon: "🍺", category: "zdraví", color: "#ef4444", is_negative: true, source: "default" as const },
    ];
    // Try to seed + clean up the DB in the background
    fetch("/api/seed-habits", { method: "POST" }).catch(() => {});
  }
  
  // Auto-seed if DB has more than just alkohol as default (old data)
  if (defaults.length > 1) {
    fetch("/api/seed-habits", { method: "POST" }).catch(() => {});
  }
  
  // Build a map of user overrides: habit key → is_active
  const overrides: Record<string, boolean> = {};
  userHabits.forEach((h: any) => { overrides[h.key] = h.is_active; });
  
  // Default habits ALWAYS show (no filtering). User custom habits show in addition.
  const defaultKeys = new Set(defaults.map(d => d.key));
  
  // Auto-clean: delete any user_habit entries that collide with defaults (they're redundant/stale)
  for (const uh of userHabits) {
    if (defaultKeys.has(uh.key)) {
      try { await sb.from("user_habits").delete().eq("id", uh.id); } catch {}
    }
  }
  
  // Add user's custom active habits (not in defaults)
  const customs: HabitDef[] = userHabits
    .filter((h: any) => h.is_active && !defaultKeys.has(h.key))
    .map((h: any) => ({ ...h, source: "custom" as const })) ?? [];
  
  // In core mode, filter out sensitive habits (porno, masturbace)
  if (!isPersonalMode()) {
    const sensitiveSet = new Set(SENSITIVE_HABIT_KEYS);
    defaults = defaults.filter(d => !sensitiveSet.has(d.key));
  }
  
  return [...defaults, ...customs];
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
