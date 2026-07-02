export interface DailyEntry {
  date: string;
  mood: number;
  moodEmoji: string;
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  phone_screen_time?: number;
  phone_unlocks?: number;
}

function parseFrontmatter(content: string): Partial<DailyEntry> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm: Record<string, any> = {};
  let currentKey: string | null = null;
  let inList = false;

  const lines = match[1].split("\n");
  for (const line of lines) {
    // Gratitude list items
    if (inList && line.startsWith("  - ")) {
      const val = line.replace(/^\s*-\s*"/, "").replace(/"\s*$/, "");
      if (currentKey && fm[currentKey]) {
        fm[currentKey].push(val);
      }
      continue;
    }
    inList = false;

    // Habits (indented key: value)
    const habitMatch = line.match(/^  (\w+):\s*(.+)/);
    if (habitMatch) {
      const k = habitMatch[1];
      const v = habitMatch[2].trim();
      if (!fm.habits) fm.habits = {};
      fm.habits[k] = v === "true";
      continue;
    }

    // Top-level key: value
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (!kv) continue;

    currentKey = kv[1];
    const val = kv[2].trim();

    if (currentKey === "gratitude") {
      fm.gratitude = [];
      inList = true;
    } else if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1);
      fm[currentKey] = inner
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (val === "true" || val === "false") {
      fm[currentKey] = val === "true";
    } else if (!isNaN(Number(val)) && val !== "") {
      fm[currentKey] = Number(val);
    } else {
      fm[currentKey] = val.replace(/^"(.*)"$/, "$1");
    }
  }

  return fm as Partial<DailyEntry>;
}

export async function fetchDailyEntries(
  token: string,
  repo: string
): Promise<DailyEntry[]> {
  const headers: Record<string, string> = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
  };

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/daily`,
    { headers }
  );

  if (!res.ok) return [];

  const files: { name: string; download_url: string }[] = await res.json();
  const entries: DailyEntry[] = [];

  // Only fetch last 400 entries to avoid rate limits
  const recentFiles = files.slice(-400);

  for (const file of recentFiles) {
    if (!file.name.endsWith(".md")) continue;
    const dateStr = file.name.replace(".md", "");

    try {
      const contentRes = await fetch(file.download_url);
      if (!contentRes.ok) continue;
      const content = await contentRes.text();
      const fm = parseFrontmatter(content);

      entries.push({
        date: dateStr,
        mood: fm.mood ?? 3,
        moodEmoji: fm.moodEmoji ?? "😐",
        activities: fm.activities ?? [],
        habits: fm.habits ?? {},
        gratitude: fm.gratitude ?? [],
        note: fm.note ?? "",
      });
    } catch {
      // Skip unparseable files
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export const MOOD_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#86efac",
  3: "#facc15",
  2: "#fb923c",
  1: "#ef4444",
};

export const MOOD_LABELS: Record<number, string> = {
  5: "😄 Skvěle",
  4: "🙂 Dobře",
  3: "😐 Jde to",
  2: "😟 Špatně",
  1: "😡 Hrozně",
};

export const MOOD_EMOJIS: Record<number, string> = {
  5: "😄",
  4: "🙂",
  3: "😐",
  2: "😟",
  1: "😡",
};
