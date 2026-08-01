import { createSupabaseClient } from "./supabase/client";
import { readStoredSession } from "./auth-storage";

export interface Goal {
  id: string;
  user_id: string;
  activity_key: string;
  name: string;
  target_count: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
  created_at: string;
  archived_at?: string;
  completed_at?: string;
}

export interface GoalProgress {
  goal: Goal;
  current_count: number;
  streak: number;
  target_met: boolean;
  period_start: string;
  period_end: string;
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

export async function getGoals(): Promise<Goal[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  const sb = await getAuthenticatedClient();
  const { data, error } = await sb
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("getGoals error:", error);
    return [];
  }
  return data || [];
}

export async function createGoal(goal: Omit<Goal, 'id' | 'user_id' | 'created_at'>): Promise<Goal> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const sb = await getAuthenticatedClient();
  const { data, error } = await sb
    .from("goals")
    .insert({ ...goal, user_id: userId })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
  const sb = await getAuthenticatedClient();
  const { error } = await sb
    .from("goals")
    .update(updates)
    .eq("id", id);
  
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const sb = await getAuthenticatedClient();
  const { error } = await sb
    .from("goals")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
}

export async function getGoalProgress(goalId: string, period: 'week' | 'month'): Promise<GoalProgress> {
  const sb = await getAuthenticatedClient();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  // Get the goal
  const { data: goal, error: goalError } = await sb
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .single();
  
  if (goalError || !goal) throw new Error("Goal not found");
  
  // Calculate period dates
  const now = new Date();
  const periodStart = new Date(now);
  if (period === 'week') {
    periodStart.setDate(periodStart.getDate() - 7);
  } else {
    periodStart.setMonth(periodStart.getMonth() - 1);
  }
  
  const startStr = periodStart.toISOString().split('T')[0];
  const endStr = now.toISOString().split('T')[0];
  
  // Count entries with this activity in the period
  const { data: entries, error: entriesError } = await sb
    .from("entries")
    .select("date, activities")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);
  
  if (entriesError) throw entriesError;
  
  // Count occurrences of the activity
  let currentCount = 0;
  const datesWithActivity: string[] = [];
  
  (entries || []).forEach((entry: any) => {
    if (entry.activities?.includes(goal.activity_key)) {
      currentCount++;
      datesWithActivity.push(entry.date);
    }
  });
  
  // Calculate streak (consecutive days with the activity)
  let streak = 0;
  if (datesWithActivity.length > 0) {
    const sortedDates = [...datesWithActivity].sort().reverse();
    streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
  }
  
  return {
    goal,
    current_count: currentCount,
    streak,
    target_met: currentCount >= goal.target_count,
    period_start: startStr,
    period_end: endStr,
  };
}
