import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SYSTEM_PROMPT = `Jsi Diarium AI — osobní asistent pro denní reflexi. Dostaneš dnešní záznam + historii posledních 7 dní.

Tvůj úkol: napiš krátkou, osobní reflexi (3-5 vět v češtině):

1. Ocenění dneška — konkrétně zareaguj na poznámku nebo vděčnost. Použij jeho vlastní slova.
2. Vzorce a trendy — porovnej dnešek s historií. Všimni si:
   - Změn nálady: "už 3 dny po sobě skvělá nálada" nebo "dneska poprvé za týden dobře"
   - Návratu k aktivitám: "konečně jsi po 4 dnech zase cvičil a hned je nálada lepší"
   - Zhoršení: "všiml jsem si, že když špatně spíš, druhý den máš vyšší stres"
   - Splněných cílů: "tenhle týden jsi meditoval 5 ze 7 dní!"
   - Screen time patternů: "screen time ti klesá — super trend!"
3. Návaznost na předchozí reflexe — pokud historie obsahuje 🤖 Včerejší reflexe, můžeš na ni navázat: "včera jsem ti psal, že... a dneska..."
4. Povzbuzení — krátké, osobní. Když je co chválit, chval. Když je zle, podpoř.

⚠️ DŮLEŽITÁ PRAVIDLA:
- Mluv přímo k uživateli. Pokud znáš jeho jméno, oslov ho jménem.
- **Respektuj pohlaví:** výchozí je mužský rod.
- **Odkazuj POUZE na konkrétní data.** Pokud data neukazují žádný trend, NEVYMÝŠLEJ si ho — prostě to přeskoč a soustřeď se na dnešek.
- **Nementoruj.** Jsi kamarád, ne terapeut. Když všechno klape, jen to ocen.
- **Nikdy neříkej "podle dat" nebo "záznam ukazuje"** — mluv přirozeně: "všiml jsem si, že..." nebo "tenhle týden..."
- Max 5 krátkých, smysluplných vět.
- Pokud historie neobsahuje dost dní pro trendy (míň než 3 dny), ber to v pohodě — soustřeď se hlavně na dnešek.`;

const moodLabels: Record<number, string> = {
  5: "skvěle 😄", 4: "dobře 🙂", 3: "neutrálně 😐", 2: "špatně 😟", 1: "hrozně 😡"
};
const stressLabels: Record<number, string> = {
  5: "extrémní", 4: "vysoký", 3: "střední", 2: "mírný", 1: "nízký"
};
const sleepLabels: Record<number, string> = {
  3: "skvělý", 2: "normální", 1: "špatný"
};

function formatDay(entry: any, isToday: boolean): string {
  const parts: string[] = [];
  const prefix = isToday ? "📅 DNEŠEK" : `📅 ${entry.date?.slice(5)}`;

  parts.push(`${prefix}:`);
  parts.push(`  Nálada: ${moodLabels[entry.mood] || "?"}`);
  
  if (entry.note?.trim()) {
    parts.push(`  Poznámka: "${entry.note}"`);
  }
  
  const gratitude = entry.gratitude?.filter((g: string) => g.trim());
  if (gratitude?.length) {
    parts.push(`  Vděčnost: ${gratitude.join("; ")}`);
  }
  
  if (entry.activities?.length) {
    parts.push(`  Aktivity: ${entry.activities.join(", ")}`);
  }
  
  if (entry.sleep_quality > 0) {
    parts.push(`  Spánek: ${sleepLabels[entry.sleep_quality] || "?"}`);
  }
  
  if (entry.stress > 0) {
    parts.push(`  Stres: ${stressLabels[entry.stress] || "?"}`);
  }

  // Habits — show only broken ones
  if (entry.habits) {
    const broken: string[] = [];
    for (const [k, v] of Object.entries(entry.habits)) {
      if (v) broken.push(k);
    }
    if (broken.length > 0) {
      parts.push(`  Narušené návyky: ${broken.join(", ")}`);
    }
  }

  if (entry.phone_screen_time) {
    const mins = Math.round(entry.phone_screen_time / 60);
    parts.push(`  Screen time: ${mins} min`);
  }

  // Previous AI reflection — for continuity
  if (!isToday && entry.ai_reflection?.trim()) {
    parts.push(`  🤖 Včerejší reflexe: "${entry.ai_reflection}"`);
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { userName, user_id, date, ...todayData } = body;

    // Fetch last 7 days from Supabase
    let history: any[] = [];
    if (user_id && date) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fromDate = sevenDaysAgo.toISOString().split("T")[0];

        const { data: rows } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", user_id)
          .gte("date", fromDate)
          .lte("date", date)
          .order("date", { ascending: true });

        history = rows || [];
      } catch (e) {
        console.error("Failed to fetch history:", e);
        // Continue with just today's data
      }
    }

    // Build the prompt
    const promptParts: string[] = [];
    
    if (userName) {
      promptParts.push(`👤 Uživatel: ${userName}`);
    }
    promptParts.push(`Historický kontext (posledních ${history.length} dní včetně dneška):`);
    promptParts.push("");

    for (const entry of history) {
      const isToday = entry.date === date;
      promptParts.push(formatDay(entry, isToday));
      promptParts.push("");
    }

    // If no history, fall back to just today
    if (history.length === 0) {
      promptParts.push(formatDay({ ...todayData, date }, true));
    }

    const userPrompt = promptParts.join("\n");

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("DeepSeek error:", err);
      return Response.json({ error: "AI failed" }, { status: 502 });
    }

    const json = await resp.json();
    const reflection = json.choices?.[0]?.message?.content?.trim() || "";

    return Response.json({ reflection });
  } catch (err) {
    console.error("AI reflect error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
