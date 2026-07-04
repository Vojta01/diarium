import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `Jsi Diarium AI — osobní asistent pro denní reflexi. Uživatel ti posílá svůj denní záznam.

Tvůj úkol: napiš krátkou, upřímnou reflexi (2-3 věty v češtině):

1. Ocenění — konkrétně zareaguj na to, co uživatel napsal do poznámky nebo za co byl vděčný. Použij jeho vlastní slova.
2. Vhled — pokud data ukazují varovné signály (špatná nálada ≤2, vysoký stres ≥4, narušené návyky), krátce a jemně na to upozorni. Pokud je vše v pořádku, přeskoč to.
3. Povzbuzení — krátké, osobní povzbuzení.

⚠️ DŮLEŽITÁ PRAVIDLA:
- Mluv přímo k uživateli. Pokud znáš jeho jméno (z emailu nebo metadat), oslov ho jménem.
- **Respektuj pohlaví:** Pokud z kontextu nebo jména dokážeš určit pohlaví, používej správný rod (on/ona). Pokud nevíš, **výchozí je mužský rod** (on).
- **Odkazuj POUZE na konkrétní data v promptu.** Pokud uživatel nezmínil meditaci, vodu, cvičení apod., tak o tom NEMLUV.
- **Nementoruj.** Jsi kamarád, ne rodič ani terapeut. Když všechno klape, jen to ocen.
- Nikdy neříkej "tvůj záznam ukazuje" nebo "podle dat" — mluv přirozeně jako člověk.
- Max 3 krátké, smysluplné věty.
- Pokud uživatel napsal poznámku nebo vděčnost, ODRÁŽEJ TO v reflexi — to je to nejdůležitější.`;

function buildUserPrompt(data: any, userName?: string): string {
  const moodLabels: Record<number, string> = {
    5: "skvěle 😄", 4: "dobře 🙂", 3: "neutrálně 😐", 2: "špatně 😟", 1: "hrozně 😡"
  };
  const stressLabels: Record<number, string> = {
    5: "extrémní", 4: "vysoký", 3: "střední", 2: "mírný", 1: "nízký"
  };
  const sleepLabels: Record<number, string> = {
    3: "skvělý", 2: "normální", 1: "špatný"
  };

  const parts: string[] = [];
  
  // User info for personalization
  if (userName) {
    parts.push(`👤 Uživatel: ${userName}`);
  }
  
  // Nálada — vždy
  parts.push(`Nálada: ${moodLabels[data.mood] || "nevyplněno"}`);
  
  // Poznámka — první, je to to nejosobnější
  if (data.note?.trim()) {
    parts.push(`💬 Poznámka: "${data.note}"`);
  }
  
  // Vděčnost — druhá nejdůležitější
  if (data.gratitude?.some((g: string) => g.trim())) {
    const g = data.gratitude.filter((g: string) => g.trim());
    parts.push(`🙏 Vděčnost: ${g.join("; ")}`);
  }
  
  // Aktivity
  if (data.activities?.length > 0) {
    parts.push(`Aktivity: ${data.activities.join(", ")}`);
  }
  
  // Spánek
  if (data.sleepQuality > 0) {
    parts.push(`Spánek: ${sleepLabels[data.sleepQuality] || "?"}`);
  }
  
  // Stres
  if (data.stress > 0) {
    parts.push(`Stres: ${stressLabels[data.stress] || "?"}`);
  }

  // Návyky — jen pokud je co hlásit
  const badHabits: string[] = [];
  if (data.habits) {
    for (const [k, v] of Object.entries(data.habits)) {
      if (v) badHabits.push(k);
    }
  }
  if (badHabits.length > 0) {
    parts.push(`⚠️ Narušené návyky: ${badHabits.join(", ")}`);
  }

  // Screen time
  if (data.phone_screen_time) {
    const mins = Math.round(data.phone_screen_time / 60);
    parts.push(`Screen time: ${mins} minut`);
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { userName, ...entryData } = body;
    const userPrompt = buildUserPrompt(entryData, userName);

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
        max_tokens: 250,
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
