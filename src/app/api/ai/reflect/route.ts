import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `Jsi Diarium AI — osobní asistent pro denní reflexi. Uživatel právě vyplnil svůj denní záznam.

Tvůj úkol: napiš krátkou, osobní reflexi (2-3 věty v češtině), která:
1. Ocenění — pojmenuj jednu pozitivní věc ze dne
2. Vhled — pokud je něco znepokojivého (špatná nálada, vysoký stres, hodně screen timu), jemně na to upozorni
3. Povzbuzení — krátké povzbuzení do zítřka

Tón: přátelský, lidský, neformální. Jako bys byl/a kamarád/ka, ne terapeut.
Nikdy neříkej "tvůj záznam ukazuje" nebo "podle dat" — mluv přirozeně.
Max 3 krátké věty.`;

function buildUserPrompt(data: any): string {
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
  parts.push(`Nálada: ${moodLabels[data.mood] || "nevyplněno"}`);
  
  if (data.activities?.length > 0) {
    parts.push(`Aktivity: ${data.activities.join(", ")}`);
  }
  
  if (data.sleepQuality) {
    parts.push(`Spánek: ${sleepLabels[data.sleepQuality] || "?"}`);
  }
  
  if (data.stress) {
    parts.push(`Stres: ${stressLabels[data.stress] || "?"}`);
  }

  const goodHabits: string[] = [];
  const badHabits: string[] = [];
  if (data.habits) {
    for (const [k, v] of Object.entries(data.habits)) {
      if (v) badHabits.push(k);
      else goodHabits.push(k);
    }
  }
  if (goodHabits.length > 0) parts.push(`Dodrženo: ${goodHabits.join(", ")}`);
  if (badHabits.length > 0) parts.push(`Nedodrženo: ${badHabits.join(", ")}`);

  if (data.phone_screen_time) {
    const mins = Math.round(data.phone_screen_time / 60);
    parts.push(`Screen time: ${mins} minut`);
  }

  if (data.gratitude?.some((g: string) => g.trim())) {
    const g = data.gratitude.filter((g: string) => g.trim());
    parts.push(`Vděčnost: ${g.join("; ")}`);
  }

  if (data.note?.trim()) {
    parts.push(`Poznámka: ${data.note}`);
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
    const userPrompt = buildUserPrompt(body);

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
        max_tokens: 200,
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
