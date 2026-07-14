import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SYSTEM_PROMPTS: Record<string, string> = {
  weekly: `Jsi Diarium AI — osobní asistent pro týdenní reflexi.

Tvůj úkol: napiš shrnutí uplynulého týdne (3-5 krátkých odstavců v češtině):

1. Přehled — shrň náladu za týden (průměr, trend, nejlepší/nejhorší den)
2. Vzorce — co ovlivňovalo náladu? Které aktivity pomáhaly? Všimni si souvislostí mezi spánkem, cvičením, screen timem a náladou
3. Návyky — jak šly návyky? Je tam progres?
4. Vděčnost — zmiň opakující se témata vděčnosti
5. Doporučení — jedna konkrétní věc, na kterou se zaměřit příští týden

Tón: přátelský, konverzační, občas vtipný. Jako kamarád, který to s tebou myslí dobře.
Formát: používej emoji a krátké odstavce. Maximálně 800 znaků.`,

  monthly: `Jsi Diarium AI — osobní asistent pro měsíční reflexi.

Tvůj úkol: napiš shrnutí uplynulého měsíce (4-6 odstavců v češtině):

1. Celkový obrázek — průměrná nálada, trend, porovnání s předchozím měsícem (pokud máš data)
2. Klíčové momenty — nejlepší a nejhorší dny, co se dělo
3. Hlubší vzorce — co opravdu ovlivňuje tvoji náladu dlouhodobě? Spánek? Cvičení? Screen time? Sociální aktivity?
4. Návyky a cíle — progres za měsíc, streak, úspěchy
5. Vhled — jedna věc, kterou ses o sobě tento měsíc naučil/a (z dat i z poznámek)
6. Výhled — co zkusit příští měsíc jinak?

Tón: reflektivní, ale optimistický. Jako měsíční zamyšlení u kafe.
Formát: používej emoji, nadpisy ###, krátké odstavce. Maximálně 1200 znaků.`,

  yearly: `Jsi Diarium AI — osobní asistent pro roční reflexi.

Tvůj úkol: napiš shrnutí celého roku (5-8 odstavců v češtině):

1. Rok v kostce — průměrná nálada, nejlepší měsíc, nejhorší měsíc, celkový trend
2. Transformace — jak ses změnil/a za ten rok? Co je jinak oproti začátku roku?
3. Vzorce roku — co celoročně ovlivňovalo náladu? Které měsíce byly nejsilnější a proč?
4. Návyky — celoroční progres, nejsilnější streaky, co se povedlo udržet
5. Vděčnost — co se opakovalo nejčastěji? Za co jsi byl/a nejvíc vděčný/á?
6. Milníky — shrň klíčové momenty, úspěchy, zlomy
7. Lekce — co tě tenhle rok naučil?
8. Příští rok — jedna věc, na kterou se zaměřit

Tón: slavnostní, reflektivní, vřelý. Jako dopis sobě na konci roku.
Formát: používej emoji, nadpisy ###, krátké odstavce. Maximálně 2000 znaků.`
};

interface DayEntry {
  date: string;
  mood: number;
  mood_emoji: string;
  activities: string[];
  stress?: number;
  sleep_quality?: number;
  habits?: Record<string, boolean>;
  gratitude?: string[];
  note?: string;
  phone_screen_time?: number;
}

function buildPeriodPrompt(entries: DayEntry[], type: string): string {
  const lines: string[] = [];
  lines.push(`Data za období: ${entries.length} dní\n`);

  // Summary stats
  const moods = entries.filter(e => e.mood > 0).map(e => e.mood);
  const avgMood = moods.length > 0 ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "?";

  const moodLabels: Record<number, string> = { 5: "skvěle 😄", 4: "dobře 🙂", 3: "neutrálně 😐", 2: "špatně 😟", 1: "hrozně 😡" };
  const moodCounts: Record<string, number> = {};
  moods.forEach(m => { const l = moodLabels[m] || "?"; moodCounts[l] = (moodCounts[l] || 0) + 1; });

  lines.push(`Průměrná nálada: ${avgMood}/5`);
  lines.push(`Rozložení: ${Object.entries(moodCounts).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);

  // Stress
  const stresses = entries.filter(e => e.stress && e.stress > 0).map(e => e.stress!);
  if (stresses.length > 0) {
    const avgStress = (stresses.reduce((a, b) => a + b, 0) / stresses.length).toFixed(1);
    lines.push(`Průměrný stres: ${avgStress}/5`);
  }

  // Sleep
  const sleeps = entries.filter(e => e.sleep_quality && e.sleep_quality > 0).map(e => e.sleep_quality!);
  if (sleeps.length > 0) {
    const sleepLabels: Record<number, string> = { 3: "skvělý", 2: "normální", 1: "špatný" };
    const sleepCounts: Record<string, number> = {};
    sleeps.forEach(s => { const l = sleepLabels[s] || "?"; sleepCounts[l] = (sleepCounts[l] || 0) + 1; });
    lines.push(`Spánek: ${Object.entries(sleepCounts).map(([k, v]) => `${k}: ${v}×`).join(", ")}`);
  }

  // Screen time
  const screenTimes = entries.filter(e => e.phone_screen_time && e.phone_screen_time > 0);
  if (screenTimes.length > 0) {
    const avgST = screenTimes.reduce((a, e) => a + e.phone_screen_time!, 0) / screenTimes.length;
    const mins = Math.round(avgST / 60);
    lines.push(`Průměrný screen time: ${mins} min/den`);
  }

  // Activities
  const activityCounts: Record<string, number> = {};
  entries.forEach(e => e.activities?.forEach(a => { activityCounts[a] = (activityCounts[a] || 0) + 1; }));
  const topActivities = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (topActivities.length > 0) {
    lines.push(`\nNejčastější aktivity: ${topActivities.map(([a, c]) => `${a} (${c}×)`).join(", ")}`);
  }

  // Habits
  const habitKeys = ["alkohol", "porno", "masturbace"];
  const habitStats: Record<string, { good: number; bad: number }> = {};
  habitKeys.forEach(k => { habitStats[k] = { good: 0, bad: 0 }; });
  entries.forEach(e => {
    habitKeys.forEach(k => {
      if (e.habits && k in e.habits) {
        if (e.habits[k]) habitStats[k].bad++;
        else habitStats[k].good++;
      }
    });
  });
  lines.push(`\nNávyky: ${habitKeys.map(k => {
    const s = habitStats[k];
    return `${k}: ${s.good} dní OK / ${s.bad} dní NE`;
  }).join("; ")}`);

  // Gratitude themes
  const allGratitude: string[] = [];
  entries.forEach(e => e.gratitude?.forEach(g => { if (g.trim()) allGratitude.push(g.trim()); }));
  if (allGratitude.length > 0) {
    lines.push(`\nVděčnost (výběr): ${allGratitude.slice(0, 15).join("; ")}`);
  }

  // Notes sample
  const notes = entries.filter(e => e.note?.trim()).map(e => e.note!.trim());
  if (notes.length > 0) {
    lines.push(`\nPoznámky (výběr): ${notes.slice(0, 10).join(" | ")}`);
  }

  // Individual days (for weekly)
  if (type === "weekly") {
    lines.push(`\n─── Denní přehled ───`);
    entries.forEach(e => {
      const parts = [`${e.date}: nálada ${e.mood}/5`];
      if (e.activities?.length) parts.push(`aktivity: ${e.activities.join(", ")}`);
      if (e.note?.trim()) parts.push(`poznámka: "${e.note}"`);
      lines.push(parts.join(" | "));
    });
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "DEEPSEEK_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { type = "weekly", user_id, access_token } = body;

    if (!["weekly", "monthly", "yearly"].includes(type)) {
      return Response.json({ error: "Invalid type. Use: weekly, monthly, yearly" }, { status: 400 });
    }

    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    // Verify the caller owns this user_id
    if (user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Query entries from Supabase
    const serviceKey = SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return Response.json({ error: "Service key not configured" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, serviceKey);

    // Determine date range
    const now = new Date();
    let fromDate: string;

    if (type === "weekly") {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      fromDate = cutoff.toISOString().split("T")[0];
    } else if (type === "monthly") {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      fromDate = cutoff.toISOString().split("T")[0];
    } else {
      fromDate = `${now.getFullYear()}-01-01`;
    }

    const { data: entries, error: dbError } = await supabase
      .from("entries")
      .select("date, mood, mood_emoji, activities, stress, sleep_quality, habits, gratitude, note, phone_screen_time")
      .eq("user_id", user_id)
      .gte("date", fromDate)
      .order("date", { ascending: true });

    if (dbError) {
      console.error("Supabase query error:", dbError);
      return Response.json({ error: "Failed to fetch entries" }, { status: 500 });
    }

    if (!entries || entries.length < 2) {
      return Response.json({ error: "Not enough data yet", daysFound: entries?.length || 0 }, { status: 200 });
    }

    const userPrompt = buildPeriodPrompt(entries as DayEntry[], type);
    const systemPrompt = SYSTEM_PROMPTS[type];

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: type === "yearly" ? 2048 : type === "monthly" ? 1536 : 1024,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("DeepSeek error:", err);
      return Response.json({ error: "AI failed" }, { status: 502 });
    }

    const json = await resp.json();
    const analysis = json.choices?.[0]?.message?.content?.trim() || "";

    return Response.json({
      type,
      analysis,
      daysAnalyzed: entries.length,
    });
  } catch (err) {
    console.error("Periodic AI error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
