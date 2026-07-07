import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";

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

function buildPeriodPrompt(entries: any[], type: string): string {
  const lines: string[] = [];
  lines.push(`Data za období: ${entries.length} dní\n`);

  const moods = entries.filter((e: any) => e.mood > 0).map((e: any) => e.mood);
  const avgMood = moods.length > 0 ? (moods.reduce((a: number, b: number) => a + b, 0) / moods.length).toFixed(1) : "?";

  const moodLabels: Record<number, string> = { 5: "skvěle 😄", 4: "dobře 🙂", 3: "neutrálně 😐", 2: "špatně 😟", 1: "hrozně 😡" };
  const moodCounts: Record<string, number> = {};
  moods.forEach((m: number) => { const l = moodLabels[m] || "?"; moodCounts[l] = (moodCounts[l] || 0) + 1; });

  lines.push(`Průměrná nálada: ${avgMood}/5`);
  lines.push(`Rozložení: ${Object.entries(moodCounts).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);

  const stresses = entries.filter((e: any) => e.stress && e.stress > 0);
  if (stresses.length > 0) {
    lines.push(`Průměrný stres: ${(stresses.reduce((a: number, e: any) => a + e.stress, 0) / stresses.length).toFixed(1)}/5`);
  }

  const sleeps = entries.filter((e: any) => e.sleep_quality && e.sleep_quality > 0);
  if (sleeps.length > 0) {
    const sleepLabels: Record<number, string> = { 3: "skvělý", 2: "normální", 1: "špatný" };
    const sc: Record<string, number> = {};
    sleeps.forEach((s: number) => { const l = sleepLabels[s] || "?"; sc[l] = (sc[l] || 0) + 1; });
    lines.push(`Spánek: ${Object.entries(sc).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);
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

  const habitKeys = ["alkohol", "porno", "masturbace"];
  const habitStats: Record<string, { good: number; bad: number }> = {};
  habitKeys.forEach(k => { habitStats[k] = { good: 0, bad: 0 }; });
  entries.forEach((e: any) => {
    habitKeys.forEach(k => {
      if (e.habits && k in e.habits) {
        if (e.habits[k]) habitStats[k].bad++;
        else habitStats[k].good++;
      }
    });
  });
  lines.push(`\nNávyky: ${habitKeys.map(k => `${k}: ${habitStats[k].good}d OK / ${habitStats[k].bad}d NE`).join("; ")}`);

  const allGratitude: string[] = [];
  entries.forEach((e: any) => e.gratitude?.forEach((g: string) => { if (g.trim()) allGratitude.push(g.trim()); }));
  if (allGratitude.length > 0) lines.push(`\nVděčnost: ${allGratitude.slice(0, 15).join("; ")}`);

  const notes = entries.filter((e: any) => e.note?.trim()).map((e: any) => e.note.trim());
  if (notes.length > 0) lines.push(`\nPoznámky: ${notes.slice(0, 10).join(" | ")}`);

  if (type === "weekly") {
    lines.push(`\n─── Denní přehled ───`);
    entries.forEach((e: any) => {
      const parts = [`${e.date}: nálada ${e.mood}/5`];
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
    .select("date, mood, mood_emoji, activities, stress, sleep_quality, habits, gratitude, note, phone_screen_time")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .order("date", { ascending: true });

  if (dbError || !entries || entries.length < 2) {
    console.log(`Not enough entries for ${type} report (user ${userId}): ${entries?.length || 0} days`);
    return null;
  }

  const userPrompt = buildPeriodPrompt(entries, type);

  const resp = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[type] },
        { role: "user", content: userPrompt },
      ],
      max_tokens: type === "monthly" ? 1536 : 1024,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) throw new Error(`DeepSeek error: ${await resp.text()}`);

  const json = await resp.json();
  const analysis = json.choices?.[0]?.message?.content?.trim() || "";

  if (!analysis) return null;

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

async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    
    // Get push subscriptions for user
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!subs?.length) return;

    const webpush = await import("web-push");
    webpush.setVapidDetails(
      "mailto:vojta1@gmail.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
      process.env.VAPID_PRIVATE_KEY || ""
    );

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          typeof sub.subscription === "string" ? JSON.parse(sub.subscription) : sub.subscription,
          JSON.stringify({ title, body, icon: "/icon-192.png" })
        );
      } catch {}
    }
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine report type from query params or time
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "weekly";

    if (!["weekly", "monthly"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get all users who have entries
    const { data: users } = await supabase
      .from("entries")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!users?.length) {
      return NextResponse.json({ message: "No users found" });
    }

    // Deduplicate
    const uniqueUsers = [...new Set(users.map(u => u.user_id))];

    const results: any[] = [];
    for (const userId of uniqueUsers) {
      try {
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
