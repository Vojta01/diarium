import { createSupabaseClient } from "./supabase/client";
import { readStoredSession } from "./auth-storage";

export interface Achievement {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
  progress: number;
  target: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  emoji: string;
  target: number;
  category: 'streak' | 'count' | 'feature' | 'mood' | 'special';
}

// Achievement definitions (inspired by Daylio)
export const ACHIEVEMENTS: AchievementDef[] = [
  // Streaks
  { key: 'first_entry', name: 'První zápis', description: 'Vytvoř svůj první záznam', emoji: '🌱', target: 1, category: 'count' },
  { key: 'streak_7', name: 'Týden v kuse', description: '7 dní v řadě', emoji: '🔥', target: 7, category: 'streak' },
  { key: 'streak_30', name: 'Měsíc v kuse', description: '30 dní v řadě', emoji: '💪', target: 30, category: 'streak' },
  { key: 'streak_100', name: 'Sto dní', description: '100 dní v řadě', emoji: '🏆', target: 100, category: 'streak' },
  { key: 'streak_365', name: 'Rok v kuse', description: '365 dní v řadě', emoji: '👑', target: 365, category: 'streak' },
  
  // Counts
  { key: 'entries_10', name: 'Desítka', description: '10 záznamů', emoji: '📝', target: 10, category: 'count' },
  { key: 'entries_100', name: 'Stovka', description: '100 záznamů', emoji: '📚', target: 100, category: 'count' },
  { key: 'entries_365', name: 'Rok deníků', description: '365 záznamů', emoji: '📖', target: 365, category: 'count' },
  
  // Features
  { key: 'use_template', name: 'Šablonový', description: 'Použij šablonu', emoji: '📋', target: 1, category: 'feature' },
  { key: 'add_photo', name: 'Fotograf', description: 'Přidej fotku', emoji: '📸', target: 1, category: 'feature' },
  { key: 'use_scale', name: 'Měřič', description: 'Použij škálu', emoji: '📊', target: 1, category: 'feature' },
  { key: 'create_goal', name: 'Cílový', description: 'Vytvoř cíl', emoji: '🎯', target: 1, category: 'feature' },
  { key: 'complete_goal', name: 'Splněno', description: 'Splň cíl', emoji: '✅', target: 1, category: 'feature' },
  
  // Moods
  { key: 'all_moods_week', name: 'Emoční spektrum', description: 'Všechny nálady v týdnu', emoji: '🌈', target: 5, category: 'mood' },
  { key: 'perfect_week', name: 'Perfektní týden', description: 'Jen skvělé nálady 7 dní', emoji: '✨', target: 7, category: 'mood' },
  
  // Special
  { key: 'early_bird', name: 'Ranní ptáče', description: 'Záznam před 9:00', emoji: '🐦', target: 1, category: 'special' },
  { key: 'night_owl', name: 'Noční sova', description: 'Záznam po 23:00', emoji: '🦉', target: 1, category: 'special' },
  { key: 'weekend_warrior', name: 'Víkendový bojovník', description: 'Záznam v sobotu i neděli', emoji: '⚔️', target: 2, category: 'special' },
];

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

export async function getAchievements(): Promise<Achievement[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  const sb = await getAuthenticatedClient();
  const { data, error } = await sb
    .from("achievements")
    .select("*")
    .eq("user_id", userId);
  
  if (error) {
    console.error("getAchievements error:", error);
    return [];
  }
  return data || [];
}

export async function unlockAchievement(key: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  const def = ACHIEVEMENTS.find(a => a.key === key);
  if (!def) return;
  
  const sb = await getAuthenticatedClient();
  
  // Check if already unlocked
  const { data: existing } = await sb
    .from("achievements")
    .select("*")
    .eq("user_id", userId)
    .eq("achievement_key", key)
    .single();
  
  if (existing) {
    // Update progress if not at target
    if (existing.progress < def.target) {
      await sb
        .from("achievements")
        .update({ progress: existing.progress + 1 })
        .eq("id", existing.id);
    }
  } else {
    // Create new achievement
    await sb
      .from("achievements")
      .insert({
        user_id: userId,
        achievement_key: key,
        progress: 1,
        target: def.target,
      });
  }
}

export async function checkAndUnlockAchievements(entryData: {
  mood: number;
  hasPhoto: boolean;
  hasTemplate: boolean;
  hasScale: boolean;
  createdAt?: string;
}): Promise<string[]> {
  const unlocked: string[] = [];
  const userId = await getCurrentUserId();
  if (!userId) return unlocked;
  
  const sb = await getAuthenticatedClient();
  
  // Get all entries for stats
  const { data: entries } = await sb
    .from("entries")
    .select("date, mood, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .limit(10000);
  
  if (!entries || entries.length === 0) return unlocked;
  
  // First entry
  if (entries.length === 1) {
    await unlockAchievement('first_entry');
    unlocked.push('first_entry');
  }
  
  // Entry counts
  if (entries.length >= 10) {
    await unlockAchievement('entries_10');
    unlocked.push('entries_10');
  }
  if (entries.length >= 100) {
    await unlockAchievement('entries_100');
    unlocked.push('entries_100');
  }
  if (entries.length >= 365) {
    await unlockAchievement('entries_365');
    unlocked.push('entries_365');
  }
  
  // Streak calculation
  let streak = 1;
  const sortedDates = entries.map((e: any) => e.date).sort();
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const curr = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  if (streak >= 7) { await unlockAchievement('streak_7'); unlocked.push('streak_7'); }
  if (streak >= 30) { await unlockAchievement('streak_30'); unlocked.push('streak_30'); }
  if (streak >= 100) { await unlockAchievement('streak_100'); unlocked.push('streak_100'); }
  if (streak >= 365) { await unlockAchievement('streak_365'); unlocked.push('streak_365'); }
  
  // Feature achievements
  if (entryData.hasPhoto) { await unlockAchievement('add_photo'); unlocked.push('add_photo'); }
  if (entryData.hasTemplate) { await unlockAchievement('use_template'); unlocked.push('use_template'); }
  if (entryData.hasScale) { await unlockAchievement('use_scale'); unlocked.push('use_scale'); }
  
  // Time-based achievements
  const entryTime = entryData.createdAt ? new Date(entryData.createdAt) : new Date();
  const hour = entryTime.getHours();
  if (hour < 9) { await unlockAchievement('early_bird'); unlocked.push('early_bird'); }
  if (hour >= 23) { await unlockAchievement('night_owl'); unlocked.push('night_owl'); }
  
  // All moods in a week
  const last7Days = entries.slice(-7);
  const uniqueMoods = new Set(last7Days.map((e: any) => e.mood));
  if (uniqueMoods.size >= 5) {
    await unlockAchievement('all_moods_week');
    unlocked.push('all_moods_week');
  }
  
  // Perfect week (all mood 5 in last 7 days)
  if (last7Days.length >= 7 && last7Days.every((e: any) => e.mood === 5)) {
    await unlockAchievement('perfect_week');
    unlocked.push('perfect_week');
  }
  
  return unlocked;
}

export async function getAchievementProgress(): Promise<{ def: AchievementDef; unlocked: boolean; progress: number }[]> {
  const userAchievements = await getAchievements();
  const achievementMap = new Map(userAchievements.map(a => [a.achievement_key, a]));
  
  return ACHIEVEMENTS.map(def => {
    const userAch = achievementMap.get(def.key);
    return {
      def,
      unlocked: !!userAch && userAch.progress >= def.target,
      progress: userAch?.progress || 0,
    };
  });
}
