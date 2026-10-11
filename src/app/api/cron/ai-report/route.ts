import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';
import { VAPID_PUBLIC_KEY, VAPID_EMAIL } from "@/lib/vapid";
import { getRedis } from "@/lib/redis";
import { guardAIUser } from "@/lib/ai-guard";
import { getAIModel } from "@/lib/ai-config";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPTS: Record<string, string> = {
  weekly: `Jsi Diarium AI — asistent pro týdenní reflexi.

Napiš shrnutí uplynulého týdne (3-5 odstavců v češtině):

1. Přehled — shrň náladu za týden (průměr, trend, nejlepší/nejhorší den)
2. Vzorce — co ovlivňovalo náladu? Které aktivity pomáhaly? Souvislosti mezi spánkem, cvičením, screen timem a náladou
3. Návyky — jak šly návyky? Je tam progres?
4. Vděčnost — opakující se témata
5. Doporučení — jedna konkrétní věc na příští týden

Tón: přátelský, jako kamarád. Používej emoji a krátké odstavce. Max 800 znaků.`,

  monthly: `Jsi Diarium AI — asistent pro měsíční reflexi.

Napiš shrnutí uplynulého měsíce (4-6 odstavců v češtině):

1. Celkový obrázek — průměrná nálada, trend, porovnání
2. Klíčové momenty — nejlepší a nejhorší dny
3. Hlubší vzorce — co ovlivňuje náladu dlouhodobě?
4. Návyky a cíle — progres, úspěchy
5. Vhled — co ses o sobě naučil/a
6. Výhled — co zkusit příští měsíc jinak?

Tón: reflektivní, optimistický. Max 1200 znaků.`
};

type HabitInfo = { label: string; negative: boolean; order: number };

function buildPeriodPrompt(entries: any[], type: string, scaleNameMap: Record<string, string>, habitMap: Record<string, HabitInfo>): string {
  const lines: string[] = [];
  lines.push(`Data za období: ${entries.length} dní\n`);

  const moods = entries.filter((e: any) => e.mood > 0).map((e: any) => e.mood);
  const avgMood = moods.length > 0 ? (moods.reduce((a: number, b: number) => a + b, 0) / moods.length).toFixed(1) : "?";

  const moodLabels: Record<number, string> = { 5: "skvěle 😄", 4: "dobře 🙂", 3: "neutrálně 😐", 2: "špatně 😟", 1: "hrozně 😡" };
  const moodCounts: Record<string, number> = {};
  moods.forEach((m: number) => { const l = moodLabels[m] || "?"; moodCounts[l] = (moodCounts[l] || 0) + 1; });

  lines.push(`Průměrná nálada: ${avgMood}/5`);
  lines.push(`Rozložení: ${Object.entries(moodCounts).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);

  const stresses = entries.filter((e: any) => e.stress && e.stress > 0).map((e: any) => e.stress);
  if (stresses.length > 0) {
    lines.push(`Průměrný stres: ${(stresses.reduce((a: number, b: number) => a + b, 0) / stresses.length).toFixed(1)}/5`);
  }

  const sleeps = entries.filter((e: any) => e.sleep_quality && e.sleep_quality > 0).map((e: any) => e.sleep_quality);
  if (sleeps.length > 0) {
    const sleepLabels: Record<number, string> = { 3: "skvělý", 2: "normální", 1: "špatný" };
    const sc: Record<string, number> = {};
    sleeps.forEach((s: number) => { const l = sleepLabels[s] || "?"; sc[l] = (sc[l] || 0) + 1; });
    lines.push(`Spánek: ${Object.entries(sc).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);
  }

  // Scales (Energie, Produktivita) — from scale_values JSONB
  const scaleSums: Record<string, { sum: number; count: number }> = {};
  entries.forEach((e: any) => {
    if (e.scale_values && typeof e.scale_values === "object") {
      for (const [scaleId, val] of Object.entries(e.scale_values)) {
        const name = scaleNameMap[scaleId];
        if (!name || typeof val !== "number") continue;
        if (!scaleSums[name]) scaleSums[name] = { sum: 0, count: 0 };
        scaleSums[name].sum += val;
        scaleSums[name].count++;
      }
    }
  });
  if (Object.keys(scaleSums).length > 0) {
    lines.push(`Škály: ${Object.entries(scaleSums).map(([name, s]) => `${name}: průměr ${(s.sum / s.count).toFixed(1)}/5`).join(", ")}`);
  }

  const screenTimes = entries.filter((e: any) => e.phone_screen_time && e.phone_screen_time > 0);
  if (screenTimes.length > 0) {
    const avgST = screenTimes.reduce((a: number, e: any) => a + e.phone_screen_time, 0) / screenTimes.length;
    lines.push(`Průměrný screen time: ${Math.round(avgST / 60)} min/den`);
  }

  const activityCounts: Record<string, number> = {};
  entries.forEach((e: any) => e.activities?.forEach((a: string) => { activityCounts[a] = (activityCounts[a] || 0) + 1; }));
  const top = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length > 0) lines.push(`\nNejčastější aktivity: ${top.map(([a, c]) => `${a} (${c}×)`).join(", ")}`);

  // Habits: only the user's effective active set (catalogue defaults merged with
  // the active user rows — an inactive row hides the habit), and only those with
  // recorded days. A negative habit counts value=true as a slip; a positive one
  // counts value=true as done.
  const habitCounts: Record<string, { yes: number; no: number }> = {};
  entries.forEach((e: any) => {
    if (!e.habits || typeof e.habits !== "object") return;
    for (const [key, value] of Object.entries(e.habits)) {
      if (!(key in habitMap)) continue;
      if (!habitCounts[key]) habitCounts[key] = { yes: 0, no: 0 };
      if (value) habitCounts[key].yes++;
      else habitCounts[key].no++;
    }
  });
  const habitParts = Object.entries(habitMap)
    .sort((a, b) => a[1].order - b[1].order)
    .filter(([key]) => habitCounts[key])
    .map(([key, info]) => {
      const c = habitCounts[key];
      const good = info.negative ? c.no : c.yes;
      const bad = info.negative ? c.yes : c.no;
      return `${info.label}: ${good}d OK / ${bad}d NE`;
    });
  if (habitParts.length > 0) lines.push(`\nNávyky: ${habitParts.join("; ")}`);

  const allGratitude: string[] = [];
  entries.forEach((e: any) => e.gratitude?.forEach((g: string) => { if (g.trim()) allGratitude.push(g.trim()); }));
  if (allGratitude.length > 0) lines.push(`\nVděčnost: ${allGratitude.slice(0, 15).join("; ")}`);

  const notes = entries.filter((e: any) => e.note?.trim()).map((e: any) => e.note.trim());
  if (notes.length > 0) lines.push(`\nPoznámky: ${notes.slice(0, 10).join(" | ")}`);

  if (type === "weekly") {
    lines.push(`\n─── Denní přehled ───`);
    entries.forEach((e: any) => {
      const parts = [`${e.date}: nálada ${e.mood}/5`];
      if (e.sleep_quality > 0) parts.push(`spánek ${e.sleep_quality}/3`);
      if (e.stress > 0) parts.push(`stres ${e.stress}/5`);
      if (e.activities?.length) parts.push(`aktivity: ${e.activities.join(", ")}`);
      if (e.note?.trim()) parts.push(`poznámka: "${e.note}"`);
      lines.push(parts.join(" | "));
    });
  }

  return lines.join("\n");
}

async function generateAndSaveReport(userId: string, type: string, userEmail?: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date();
  let fromDate: string;
  let periodEnd: string = now.toISOString().split("T")[0];

  if (type === "weekly") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    fromDate = cutoff.toISOString().split("T")[0];
  } else {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    fromDate = cutoff.toISOString().split("T")[0];
  }

  // Fetch entries
  const { data: entries, error: dbError } = await supabase
    .from("entries")
    .select("date, mood, mood_emoji, activities, stress, sleep_quality, habits, gratitude, note, phone_screen_time, scale_values")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .order("date", { ascending: true });

  if (dbError || !entries || entries.length < 2) {
    console.log(`Not enough entries for ${type} report (user ${userId}): ${entries?.length || 0} days, dbError=${JSON.stringify(dbError)}`);
    return null;
  }

  // Fetch scales to map scale IDs → names (Energie, Produktivita)
  const scaleNameMap: Record<string, string> = {};
  try {
    const { data: scales } = await supabase
      .from("scales")
      .select("id, name")
      .eq("user_id", userId);
    (scales || []).forEach((s: any) => { scaleNameMap[s.id] = s.name; });
  } catch (e) {
    console.error("Failed to fetch scales:", e);
  }

  // Fetch the user's effective habit set — catalogue defaults merged with the
  // active user rows (an inactive row hides the habit). Same merge the app shows.
  const habitMap: Record<string, HabitInfo> = {};
  let habitOrder = 0;
  try {
    const { data: cat } = await supabase
      .from("habit_catalog")
      .select("key, label, is_negative")
      .eq("is_default", true);
    (cat || []).forEach((h: any) => {
      habitMap[h.key] = { label: h.label || h.key, negative: !!h.is_negative, order: habitOrder++ };
    });
    const { data: mine } = await supabase
      .from("user_habits")
      .select("key, label, is_negative, is_active")
      .eq("user_id", userId);
    (mine || []).forEach((h: any) => {
      if (!h.is_active) { delete habitMap[h.key]; return; }
      const known = habitMap[h.key];
      habitMap[h.key] = { label: h.label || h.key, negative: !!h.is_negative, order: known ? known.order : habitOrder++ };
    });
  } catch (e) {
    console.error("Failed to fetch habits:", e);
  }

  const userPrompt = buildPeriodPrompt(entries, type, scaleNameMap, habitMap);

  // The model occasionally returns an empty content (finish_reason stop/length)
  // even on a 200 — a repeated call usually succeeds, so retry before giving up.
  let analysis = "";
  for (let attempt = 1; attempt <= 3 && !analysis; attempt++) {
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: await getAIModel(),
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[type] },
          { role: "user", content: userPrompt },
        ],
        max_tokens: type === "monthly" ? 4096 : 3072,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) throw new Error(`DeepSeek error: ${await resp.text()}`);

    const raw = await resp.text();
    try {
      const json = JSON.parse(raw);
      analysis = json.choices?.[0]?.message?.content?.trim() || "";
    } catch (_) {}

    if (!analysis) {
      console.log(`AI returned empty analysis for ${type} (user ${userId}), attempt ${attempt}, resp status ${resp.status}, raw head: ${raw.slice(0, 300)}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  if (!analysis) {
    console.log(`AI stayed empty after 3 attempts for ${type} (user ${userId})`);
    return null;
  }

  // Save to DB
  const { error: insertError } = await supabase
    .from("ai_reports")
    .insert({
      user_id: userId,
      type,
      period_start: fromDate,
      period_end: periodEnd,
      content: analysis,
    });

  if (insertError) {
    console.error(`Failed to save ${type} report:`, insertError);
    return null;
  }

  return { analysis, fromDate, periodEnd };
}

const SUBSCRIPTIONS_KEY = "diarium:push:subscriptions";

async function sendPushNotification(userId: string, title: string, body: string, deepLink?: string) {
  try {
    // Variant A: the Android app polls ai_reports itself and shows LOCAL
    // notifications at user-chosen times. The server keeps web push only for
    // PWA/browser users. (No FCM here anymore — avoids duplicates.)
    const redis = getRedis();
    if (!redis) return;

    const rawSubs: any[] = await redis.smembers(SUBSCRIPTIONS_KEY);
    const subscriptions = rawSubs.map((s: any) => {
      if (typeof s === "string") {
        try { return JSON.parse(s); } catch { return null; }
      }
      return s;
    }).filter(Boolean);

    if (!subscriptions.length) return;

    const webpush = await import("web-push");
    webpush.setVapidDetails(
      VAPID_EMAIL,
      VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY || ""
    );

    const payload = JSON.stringify({ title, body, icon: "/icon-192.png" });

    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(sub, payload)
      )
    );

    // Clean up expired subscriptions
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        const err = (r as PromiseRejectedResult).reason;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await redis.srem(SUBSCRIPTIONS_KEY, rawSubs[i]);
        }
      }
    }
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    // See src/lib/cron-auth.ts — only a matching, non-empty secret counts.
    // (The caller-supplied `x-vercel-cron` header used to be trusted here; a
    // forged one reached this handler on production.)
    const isCron = isCronAuthorized(request);

    // The Android app triggers report generation itself (no server crons):
    // it authenticates with the user's own JWT. In that case we generate
    // ONLY that user's report.
    const user = await verifyAuth(request);

    if (!user && !isCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine report type from query params or time
    const type = url.searchParams.get("type") || "weekly";

    if (!["weekly", "monthly"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let uniqueUsers: string[];
    if (user) {
      // App-triggered: only the authenticated user
      uniqueUsers = [user.id];
    } else {
      // Server cron: all users who have entries
      const { data: users } = await supabase
        .from("entries")
        .select("user_id")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!users?.length) {
        return NextResponse.json({ message: "No users found" });
      }

      // Deduplicate
      uniqueUsers = [...new Set(users.map(u => u.user_id))];
    }

    const results: any[] = [];
    for (const userId of uniqueUsers) {
      try {
        // AI user whitelist
        const userBlock = guardAIUser(userId);
        if (userBlock) {
          results.push({ userId, success: false, reason: "not_authorized" });
          continue;
        }

        const result = await generateAndSaveReport(userId, type);
        if (result) {
          results.push({ userId, success: true });
          // Send push notification
          const title = type === "weekly" ? "📊 Týdenní přehled" : "🗓️ Měsíční přehled";
          const body = type === "weekly"
            ? "Tvůj týdenní AI report je připraven! Otevři Diarium."
            : "Tvůj měsíční AI report je připraven! Otevři Diarium.";
          await sendPushNotification(userId, title, body).catch(() => {});
        } else {
          results.push({ userId, success: false, reason: "not_enough_data" });
        }
      } catch (err: any) {
        results.push({ userId, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      type,
      processed: uniqueUsers.length,
      results,
    });
  } catch (err: any) {
    console.error("Cron AI report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
