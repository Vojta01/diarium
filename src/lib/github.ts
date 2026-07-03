import type { CheckInData } from "@/lib/types";

// ── UTF-8 safe base64 encode / decode ──
function strToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToStr(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

const WEATHER_LABELS = new Set([
  "slunečno", "zataženo", "déšť", "sníh", "mráz", "horko", "bouřka", "vítr",
]);

const WEATHER_YAML: Record<string, string> = {
  slunečno: "slunečno",
  zataženo: "zataženo",
  déšť: "deštivo",
  sníh: "sněžno",
  mráz: "mrazivo",
  horko: "horko",
  bouřka: "bouřka",
  vítr: "větrno",
};

function getWeather(activities: string[]): string[] {
  return activities
    .filter((a) => WEATHER_LABELS.has(a))
    .map((a) => WEATHER_YAML[a] || a);
}

function getNonWeatherActivities(activities: string[]): string[] {
  // Map display labels to YAML-friendly keys
  const map: Record<string, string> = {
    rodina: "rodina", přátelé: "přátelé", rande: "rande", párty: "párty", office: "office",
    "filmy a tv": "filmy_a_tv", čtení: "čtení", "hraní her": "hrani_her", sport: "sport", relax: "relax", hudba: "hudba",
    "brzký spánek": "brzky_spanek", "dobrý spánek": "dobry_spanek", "normální spánek": "normalni_spanek", "špatný spánek": "spatny_spanek",
    "jíst zdravě": "jist_zdrave", "rychlé občerstvení": "rychle_obcerstveni", "domácí výroba": "domaci_vyroba",
    restaurace: "restaurace", donáška: "donaska",
    "den bez masa": "den_bez_masa", "žádné sladkosti": "zadne_sladkosti", "žádné limonády": "zadne_limonady",
    trénink: "trenink", "pít vodu": "pit_vodu", chůze: "chuze", kolo: "kolo", plavání: "plavani",
    paddleboard: "paddleboard", snooker: "snooker",
    meditovat: "meditovat", laskavost: "laskavost", naslouchání: "naslouchání", dárcovství: "darcovství", "dej dárek": "dej_darek",
    nakupování: "nakupovani", uklízení: "uklizeni", vaření: "vareni", praní: "prani", žehlení: "zehlení",
  };
  return activities
    .filter((a) => !WEATHER_LABELS.has(a))
    .map((a) => map[a] || a.toLowerCase().replace(/\s+/g, "_"));
}

function buildFrontmatter(data: CheckInData, dateStr?: string, photoPath?: string): string {
  const targetDate = dateStr || new Date().toISOString().split("T")[0];
  const weather = getWeather(data.activities);
  const activities = getNonWeatherActivities(data.activities);

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

  const lines = ["---", `date: ${targetDate}`, `mood: ${data.mood}`, `mood_emoji: ${data.moodEmoji}`];

  if (data.sleepQuality > 0) {
    lines.push(`sleep_quality: ${data.sleepQuality}`);
  }
  if (data.stress > 0) {
    lines.push(`stress: ${data.stress}`);
  }

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
  const base64 = strToBase64(content);

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
  // Activities
  rodina: "rodina", přátelé: "přátelé", rande: "rande", párty: "párty", office: "office",
  filmy_a_tv: "filmy a tv", čtení: "čtení", hrani_her: "hraní her", sport: "sport", relax: "relax", hudba: "hudba",
  brzky_spanek: "brzký spánek", dobry_spanek: "dobrý spánek", normalni_spanek: "normální spánek", spatny_spanek: "špatný spánek",
  jist_zdrave: "jíst zdravě", rychle_obcerstveni: "rychlé občerstvení", domaci_vyroba: "domácí výroba",
  restaurace: "restaurace", donaska: "donáška",
  den_bez_masa: "den bez masa", zadne_sladkosti: "žádné sladkosti", zadne_limonady: "žádné limonády",
  trenink: "trénink", pit_vodu: "pít vodu", chuze: "chůze", kolo: "kolo", plavani: "plavání",
  paddleboard: "paddleboard", snooker: "snooker",
  meditovat: "meditovat", laskavost: "laskavost", naslouchání: "naslouchání", darcovství: "dárcovství", dej_darek: "dej dárek",
  nakupovani: "nakupování", uklizeni: "uklízení", vareni: "vaření", prani: "praní", zehleni: "žehlení",
  // Weather
  slunečno: "slunečno", zataženo: "zataženo", deštivo: "déšť", sněžno: "sníh",
  mrazivo: "mráz", horko: "horko", bouřka: "bouřka", větrno: "vítr",
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
    content = base64ToStr(file.content);
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
    sleepQuality: parsed.sleep_quality ?? 0,
    stress: parsed.stress ?? 0,
    activities: allActivities,
    habits: parsed.habits ?? {},
    gratitude: parsed.gratitude ?? ["", "", ""],
    note: parsed.note ?? "",
    photoDataUrl: null,
  };
}

export async function savePartialCheckIn(
  token: string,
  repo: string,
  data: CheckInData,
  dateStr: string,
  isFinal: boolean = false
): Promise<void> {
  const path = "daily/" + dateStr + ".md";

  const content = buildFrontmatter(data, dateStr);
  const base64 = strToBase64(content);

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
    ? "Check-in " + dateStr + ": nalada " + data.mood + "/5"
    : "Pruzeny check-in " + dateStr + " " + time;

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
