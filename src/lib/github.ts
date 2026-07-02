import type { CheckInData } from "@/lib/types";

const WEATHER_EMOJI: Record<string, string> = {
  Slunečno: "slunečno",
  Zataženo: "zataženo",
  Déšť: "deštivo",
  Sníh: "sněžno",
  Horko: "horko",
  Bouřka: "bouřka",
  Vítr: "větrno",
};

function getWeather(activities: string[]): string[] {
  return activities
    .filter((a) => WEATHER_EMOJI[a])
    .map((a) => WEATHER_EMOJI[a]);
}

function getNonWeatherActivities(activities: string[]): string[] {
  return activities
    .filter((a) => !WEATHER_EMOJI[a])
    .map((a) => {
      const map: Record<string, string> = {
        Zdravě: "zdravé jídlo",
        "Fast food": "fast food",
        Domácí: "domácí výroba",
        Restaurace: "restaurace",
        Donáška: "donáška",
        Trénink: "trénink",
        Chůze: "chůze",
        Kolo: "kolo",
        Plavání: "plavání",
        Paddleboard: "paddleboard",
        Snooker: "snooker",
        Čtení: "čtení",
        Hudba: "hudba",
        "Filmy/TV": "filmy/tv",
        Hry: "hry",
        Relax: "relax",
        Přátelé: "přátelé",
        Rodina: "rodina",
        Rande: "rande",
        Párty: "párty",
        Office: "office",
        Meditace: "meditace",
        Terapie: "terapie",
        Nákupy: "nákupy",
        Úklid: "úklid",
        Spánek: "spánek",
      };
      return map[a] || a.toLowerCase();
    });
}

const STRESS_MAP: Record<number, number> = {
  5: 2,
  4: 2,
  3: 3,
  2: 4,
  1: 5,
};

function buildFrontmatter(data: CheckInData, photoPath?: string): string {
  const today = new Date().toISOString().split("T")[0];
  const weather = getWeather(data.activities);
  const activities = getNonWeatherActivities(data.activities);
  const stress = STRESS_MAP[data.mood] || 3;

  const habits = {
    "cvičení": data.habits["cvičení"] ?? false,
    "alkohol": data.habits["alkohol"] ?? false,
    "meditace": data.habits["meditace"] ?? false,
    "čtení": data.habits["čtení"] ?? false,
    "zdrave_jidlo": data.habits["zdrave_jidlo"] ?? false,
    "piti_vody": data.habits["piti_vody"] ?? false,
    "porno": data.habits["porno"] ?? false,
    "masturbace": data.habits["masturbace"] ?? false,
  };

  const gratitude = data.gratitude.filter((g) => g.trim());
  const note = data.note.trim();

  const lines = ["---", `date: ${today}`, `mood: ${data.mood}`, `mood_emoji: ${data.moodEmoji}`, `stress: ${stress}`];

  if (weather.length > 0) {
    lines.push(`weather: [${weather.join(", ")}]`);
  }

  lines.push(`activities: [${activities.join(", ")}]`);
  lines.push("habits:");

  for (const [k, v] of Object.entries(habits)) {
    lines.push(`  ${k}: ${v}`);
  }

  if (gratitude.length > 0) {
    lines.push("gratitude:");
    for (const g of gratitude) {
      lines.push(`  - "${g}"`);
    }
  }

  if (photoPath) {
    lines.push(`photo: "${photoPath}"`);
  }

  if (note) {
    lines.push(`note: "${note}"`);
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

function makeHeaders(token: string) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function saveCheckIn(
  token: string,
  repo: string,
  data: CheckInData
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const path = `daily/${today}.md`;

  // Upload photo first if present
  let photoPath: string | undefined;
  if (data.photoDataUrl) {
    const photoFilename = `${today}.jpg`;
    const photoRepoPath = `assets/photos/${photoFilename}`;

    const base64Content = data.photoDataUrl.replace(/^data:image\/\w+;base64,/, "");

    const headers = makeHeaders(token);

    const existingPhoto = await fetch(
      `https://api.github.com/repos/${repo}/contents/${photoRepoPath}`,
      { headers }
    );
    let sha: string | undefined;
    if (existingPhoto.ok) {
      const body = await existingPhoto.json();
      sha = body.sha;
    }

    const photoBody: any = {
      message: "Photo check-in " + today,
      content: base64Content,
    };
    if (sha) photoBody.sha = sha;

    const photoRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${photoRepoPath}`,
      { method: "PUT", headers, body: JSON.stringify(photoBody) }
    );

    if (photoRes.ok) {
      photoPath = photoRepoPath;
    }
  }

  const content = buildFrontmatter(data, photoPath);
  const base64 = btoa(unescape(encodeURIComponent(content)));

  const api = (p: string) =>
    `https://api.github.com/repos/${repo}/contents/${p}`;

  const headers = makeHeaders(token);

  const existing = await fetch(api(path), { headers });
  let sha: string | undefined;

  if (existing.ok) {
    const body = await existing.json();
    sha = body.sha;
  }

  const body: any = {
    message: "Check-in " + today + ": nalada " + data.mood + "/5",
    content: base64,
  };

  if (sha) body.sha = sha;

  const res = await fetch(api(path), {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "HTTP " + res.status);
  }
}

function parseYamlFrontmatter(yaml: string): Partial<CheckInData> {
  const result: any = {};
  let currentKey: string | null = null;
  let inList = false;

  const lines = yaml.split("\n");
  for (const line of lines) {
    if (inList && line.startsWith("  - ")) {
      const val = line.replace(/^\s*-\s*"/, "").replace(/"\s*$/, "");
      if (currentKey && Array.isArray(result[currentKey])) {
        result[currentKey].push(val);
      }
      continue;
    }
    inList = false;

    const listMatch = line.match(/^(\w+):\s*$/);
    if (listMatch && listMatch[1] === "gratitude") {
      currentKey = listMatch[1];
      result[currentKey] = [];
      inList = true;
      continue;
    }

    const habitMatch = line.match(/^  (\w+):\s*(.+)/);
    if (habitMatch) {
      if (!result.habits) result.habits = {};
      result.habits[habitMatch[1]] = habitMatch[2].trim() === "true";
      continue;
    }

    const kv = line.match(/^(\w+):\s*(.+)/);
    if (!kv) continue;

    currentKey = kv[1];
    const val = kv[2].trim();

    if (val === "true" || val === "false") {
      result[currentKey] = val === "true";
    } else if (!isNaN(Number(val)) && val !== "") {
      result[currentKey] = Number(val);
    } else if (val.startsWith("[") && val.endsWith("]")) {
      result[currentKey] = val.slice(1, -1).split(",").map((s: string) => s.trim()).filter(Boolean);
    } else {
      result[currentKey] = val.replace(/^"(.*)"$/, "$1");
    }
  }

  return result;
}

// Reverse mapping: YAML value → display label
const REVERSE_ACTIVITY_MAP: Record<string, string> = {
  "zdravé jídlo": "Zdravě",
  "fast food": "Fast food",
  "domácí výroba": "Domácí",
  "restaurace": "Restaurace",
  "donáška": "Donáška",
  "trénink": "Trénink",
  "chůze": "Chůze",
  "kolo": "Kolo",
  "plavání": "Plavání",
  "paddleboard": "Paddleboard",
  "snooker": "Snooker",
  "čtení": "Čtení",
  "hudba": "Hudba",
  "filmy/tv": "Filmy/TV",
  "hry": "Hry",
  "relax": "Relax",
  "přátelé": "Přátelé",
  "rodina": "Rodina",
  "rande": "Rande",
  "párty": "Párty",
  "office": "Office",
  "meditace": "Meditace",
  "terapie": "Terapie",
  "nákupy": "Nákupy",
  "úklid": "Úklid",
  "spánek": "Spánek",
  "slunečno": "Slunečno",
  "zataženo": "Zataženo",
  "deštivo": "Déšť",
  "sněžno": "Sníh",
  "horko": "Horko",
  "bouřka": "Bouřka",
  "větrno": "Vítr",
};

export async function loadDayEntry(
  token: string,
  repo: string,
  dateStr: string
): Promise<CheckInData | null> {
  const path = "daily/" + dateStr + ".md";
  const headers = makeHeaders(token);

  const res = await fetch(
    "https://api.github.com/repos/" + repo + "/contents/" + path,
    { headers }
  );

  if (!res.ok) return null;

  const file: { content?: string; download_url?: string } = await res.json();

  let content: string;
  if (file.content) {
    content = atob(file.content);
  } else if (file.download_url) {
    const dlRes = await fetch(file.download_url);
    content = await dlRes.text();
  } else {
    return null;
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const parsed = parseYamlFrontmatter(fmMatch[1]) as any;

  // Map YAML activities back to display labels
  const allActivities: string[] = [];
  if (parsed.activities) {
    for (const a of parsed.activities) {
      // Check reverse map first
      let found = REVERSE_ACTIVITY_MAP[a];
      if (found) {
        allActivities.push(found);
      } else {
        allActivities.push(a);
      }
    }
  }
  if (parsed.weather) {
    for (const w of parsed.weather) {
      let found = REVERSE_ACTIVITY_MAP[w];
      if (found) allActivities.push(found);
    }
  }

  return {
    mood: parsed.mood ?? 0,
    moodEmoji: parsed.mood_emoji ?? "",
    activities: allActivities,
    habits: parsed.habits ?? {},
    gratitude: parsed.gratitude ?? ["", "", ""],
    note: parsed.note ?? "",
    photoDataUrl: null, // photos not re-loaded to save bandwidth
  };
}

export async function savePartialCheckIn(
  token: string,
  repo: string,
  data: CheckInData,
  isFinal: boolean = false
): Promise<void> {
  // Use the same save logic but with a different commit message
  const today = new Date().toISOString().split("T")[0];
  const path = "daily/" + today + ".md";

  const content = buildFrontmatter(data);
  const base64 = btoa(unescape(encodeURIComponent(content)));

  const headers = makeHeaders(token);

  const existing = await fetch(
    "https://api.github.com/repos/" + repo + "/contents/" + path,
    { headers }
  );
  let sha: string | undefined;
  if (existing.ok) {
    const body = await existing.json();
    sha = body.sha;
  }

  const now = new Date();
  const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const msg = isFinal
    ? "Check-in " + today + ": nalada " + data.mood + "/5"
    : "Pruzeny check-in " + today + " " + time;

  const body: any = {
    message: msg,
    content: base64,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    "https://api.github.com/repos/" + repo + "/contents/" + path,
    { method: "PUT", headers, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "HTTP " + res.status);
  }
}
