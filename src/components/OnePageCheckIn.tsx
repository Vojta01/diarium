"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { saveEntry, getEntry, getHabits, setHabitVisibility, getActivities, getHiddenActivities, getAccessToken } from "@/lib/supabase/db";
import type { HabitDef, ActivityDef } from "@/lib/supabase/db";
import { PhotoPicker } from "@/components/PhotoPicker";
import type { CheckInData } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { getFeatureFlags, SENSITIVE_HABIT_KEYS } from "@/lib/feature-flags";
import { getSupabaseAuthTokenKey } from "@/lib/supabase-ref";
import { useTranslation } from "@/lib/i18n";

// ── Mood ──
const MOODS = [
  { value: 5, emoji: "😄", label: "skvěle", color: "#22c55e" },
  { value: 4, emoji: "🙂", label: "dobře", color: "#3b82f6" },
  { value: 3, emoji: "😐", label: "jde to", color: "#eab308" },
  { value: 2, emoji: "😟", label: "špatně", color: "#f97316" },
  { value: 1, emoji: "😡", label: "hrozně", color: "#ef4444" },
];

const MOOD_LABELS: Record<number, string> = {
  5: "Skvěle 😄", 4: "Dobře 🙂", 3: "Jde to 😐", 2: "Špatně 😟", 1: "Hrozně 😡"
};

// ── Sleep quality ──
const SLEEP_QUALITY = [
  { value: 3, emoji: "😴", label: "Skvělý" },
  { value: 2, emoji: "🥱", label: "Normální" },
  { value: 1, emoji: "😪", label: "Špatný" },
];

const SLEEP_LABELS: Record<number, string> = { 3: "Skvělý 😴", 2: "Normální 🥱", 1: "Špatný 😪" };

// ── Stress levels ──
const STRESS_LEVELS = [
  { value: 1, emoji: "😌", label: "Nízký" },
  { value: 2, emoji: "🙂", label: "Mírný" },
  { value: 3, emoji: "😐", label: "Střední" },
  { value: 4, emoji: "😰", label: "Vysoký" },
  { value: 5, emoji: "😤", label: "Extrémní" },
];

const STRESS_LABELS: Record<number, string> = {
  1: "Nízký 😌", 2: "Mírný 🙂", 3: "Střední 😐", 4: "Vysoký 😰", 5: "Extrémní 😤"
};

// ── Mood-based quotes ──
const MOOD_QUOTES: Record<number, string[]> = {
  5: [
    "Dny jako tenhle jsou důvod, proč to celé má smysl. ✨",
    "Když je duše v pohodě, celý svět se usmívá s tebou. 🌟",
    "Tohle si zapiš za uši — dneska jsi vyhrál/a. 🏆",
  ],
  4: [
    "Dobrý den je jako šálek dobré kávy — zahřeje a povzbudí. ☕",
    "Ne každý den je perfektní, ale dnešek byl zatraceně blízko. 🙂",
    "Vděčnost mění obyčejné dny ve výjimečné. 💫",
  ],
  3: [
    "I neutrální dny mají svou hodnotu — jsou to dny klidu. 🌤️",
    "Není to ani kopec, ani údolí. Prostě rovina. A to je v pořádku. 🛤️",
    "Zítra je nový den, nová příležitost. Dnes stačilo být. 🌅",
  ],
  2: [
    "I špatné dny končí. A zítřek začíná znovu. 🌙",
    "Nejsi sám/sama. Každý má někdy den, kdy to nejde. 🫂",
    "Tohle je jen kapitola, ne celá kniha. 📖",
  ],
  1: [
    "Někdy je vítězství jen to, že jsi ten den přežil/a. A to stačí. 💪",
    "Dno je pevný základ, ze kterého se dá odrazit. 🚀",
    "I po nejhorší bouřce vyjde slunce. Vydrž. 🌈",
  ],
};

// ── Activity groups (category → group name) ──
const CATEGORY_GROUPS: Record<string, string> = {
  "sociální": "Společenské",
  "volný čas": "Záliby", 
  "jídlo": "Jídlo",
  "sport": "Zdraví",
  "zdraví": "Zdraví",
  "wellness": "Mé lepší já",
  "práce": "Práce",
  "počasí": "Počasí",
  "domácí práce": "Domácí práce",
  "vlastní": "Vlastní",
  "obecné": "Ostatní",
};

function groupActivities(defs: ActivityDef[]): { title: string; items: ActivityDef[] }[] {
  const groups: Record<string, ActivityDef[]> = {};
  for (const d of defs) {
    const cat = d.category || "obecné";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(d);
  }
  // Order groups by predefined order, then any unknowns
  const order = ["sociální", "práce", "volný čas", "sport", "jídlo", "zdraví", "wellness", "domácí práce", "počasí", "vlastní", "obecné"];
  return order
    .filter(cat => groups[cat]?.length > 0)
    .map(cat => ({ title: CATEGORY_GROUPS[cat] || cat, items: groups[cat] }));
}

// ── Reduced habits ── (loaded dynamically below)
const EMPTY_HABITS: Record<string, boolean> = {};

// ── Hardcoded defaults used only as fallback ── (replaced by DB-loaded habits)
const FALLBACK_HABIT_DEFS: HabitDef[] = [
  { key: "alkohol", label: "Alkohol", icon: "🍺", category: "zdraví", color: "#ef4444", is_negative: true, source: "default" },
];

const EMPTY_DATA: CheckInData = {
  mood: 0, moodEmoji: "", sleepQuality: 0, stress: 0,
  activities: [], habits: { ...EMPTY_HABITS },
  gratitude: ["", "", ""], note: "", photoDataUrl: null,
};

// ── Goals ──
interface Goal {
  id: string; emoji: string; name: string; completedDates: string[];
}
const DEFAULT_GOALS: Goal[] = [
  { id: "1", emoji: "🏋️", name: "Krátké cvičení", completedDates: [] },
];

function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem("diarium_goals");
    return raw ? JSON.parse(raw) : [...DEFAULT_GOALS];
  } catch { return [...DEFAULT_GOALS]; }
}
function saveGoals(goals: Goal[]) { localStorage.setItem("diarium_goals", JSON.stringify(goals)); }

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  let expected = today, streak = 0;
  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected); prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().split("T")[0];
    } else if (d < expected) break;
  }
  return streak;
}

function pickQuote(mood: number): string {
  const quotes = MOOD_QUOTES[mood] || MOOD_QUOTES[3];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left mb-2 group">
        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
        <span className="text-sm font-medium text-white/80">{title}</span>
        <span className="ml-auto text-white/20 text-xs transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {open && children}
    </div>
  );
}

// ── COMPLETED DAY CARD ──
function CompletedCard({
  data, goals, aiReflection, onEdit, dateStr, habitDefs,
}: {
  data: CheckInData; goals: Goal[]; aiReflection: string | null; onEdit: () => void; dateStr: string;
  habitDefs: HabitDef[];
}) {
  const { t } = useTranslation();
  const mood = MOODS.find(m => m.value === data.mood);
  const sleep = SLEEP_QUALITY.find(s => s.value === data.sleepQuality);
  const stressLevel = data.stress > 0 ? STRESS_LEVELS[data.stress - 1] : null;
  const isToday = dateStr === new Date().toISOString().split("T")[0];
  const goalsDone = goals.filter(g => g.completedDates.includes(dateStr));
  const hasGratitude = data.gratitude.some(g => g.trim());
  const hasNote = data.note.trim().length > 0;

  // Habit status — filter out sensitive habits in core mode
  const flags = getFeatureFlags();
  const displayHabitDefs = flags.habitTracking
    ? habitDefs
    : habitDefs.filter(h => !SENSITIVE_HABIT_KEYS.includes(h.key));
  const habitStatus = displayHabitDefs.map(h => ({
    ...h,
    kept: h.is_negative ? !data.habits[h.key] : data.habits[h.key],
  }));

  return (
    <div className="min-h-screen px-4 pt-4 pb-24 space-y-4">
      {/* Hero banner */}
      {isToday && (
        <div className="text-center animate-fade-in pb-2">
          <div className="text-5xl mb-1">{data.mood >= 4 ? "✨" : data.mood >= 2 ? "🌟" : "💪"}</div>
          <h2 className="text-xl font-bold text-white">
            {data.mood >= 4 ? "Skvělý den!" : data.mood >= 2 ? "Den zapsán" : "I to se počítá"}
          </h2>
        </div>
      )}

      <p className="text-center text-white/25 text-sm">
        {new Date(dateStr).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      {/* Main mood pill */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border" style={{
          background: (mood?.color || "#6366f1") + "15",
          borderColor: (mood?.color || "#6366f1") + "30",
        }}>
          <span className="text-3xl">{mood?.emoji}</span>
          <span className="text-white font-medium">{mood?.label}</span>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="glass-card">
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Sleep */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{sleep?.emoji || "—"}</div>
            <div className="text-[10px] text-white/30">{t("completedCard.sleep")}</div>
            <div className="text-[11px] text-white/60 font-medium">{sleep?.label || t("common.no_data")}</div>
          </div>
          {/* Stress */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{stressLevel?.emoji || "—"}</div>
            <div className="text-[10px] text-white/30">{t("completedCard.stress")}</div>
            <div className="text-[11px] text-white/60 font-medium">{stressLevel?.label || "—"}</div>
          </div>
          {/* Activities count */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{data.activities.length || "—"}</div>
            <div className="text-[10px] text-white/30">Aktivit</div>
            <div className="text-[11px] text-white/60 font-medium">
              {data.activities.length > 0 ? data.activities.slice(0, 2).join(", ") : t("activities.none")}
            </div>
          </div>
        </div>
      </div>

      {/* Activities tags */}
      {data.activities.length > 0 && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">{t("completedCard.activities_section")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.activities.map(a => (
              <span key={a} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/70">{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Habits status */}
      <div className="glass-card">
        <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">{t("completedCard.habits_section")}</h3>
        <div className="flex gap-2">
          {habitStatus.map(h => (
            <div key={h.key} className={`flex-1 text-center p-2 rounded-lg ${h.kept ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/5 border border-red-500/10"}`}>
              <div className="text-lg">{h.icon}</div>
              <div className="text-[10px] text-white/50 mt-0.5">{h.label}</div>
              <div className={`text-[10px] font-medium ${h.kept ? "text-emerald-400" : "text-red-400"}`}>
                {h.kept ? "✓" : "✗"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">
            {t("completedCard.goals_label", { done: goalsDone.length, total: goals.length })}
          </h3>
          <div className="space-y-1.5">
            {goals.map(g => {
              const done = g.completedDates.includes(dateStr);
              const streak = computeStreak(g.completedDates);
              return (
                <div key={g.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-white/3">
                  <span className={`text-sm ${done ? "text-indigo-400" : "text-white/15"}`}>
                    {done ? "✓" : "○"}
                  </span>
                  <span className="text-white/70">{g.emoji} {g.name}</span>
                  {streak > 0 && <span className="text-[10px] text-indigo-400 ml-auto">🔥{streak}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gratitude */}
      {hasGratitude && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">{t("completedCard.gratitude_section")}</h3>
          {data.gratitude.filter(g => g.trim()).map((g, i) => (
            <p key={i} className="text-white/60 text-sm leading-relaxed">🙏 {g}</p>
          ))}
        </div>
      )}

      {/* Note */}
      {hasNote && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-1 uppercase tracking-wider">{t("completedCard.note_section")}</h3>
          <p className="text-white/60 text-sm leading-relaxed italic">&ldquo;{data.note}&rdquo;</p>
        </div>
      )}

      {/* AI Reflection */}
      {aiReflection && (
        <div className="glass-card bg-indigo-500/5 border-indigo-400/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🤖</span>
            <h3 className="text-xs font-medium text-indigo-300/60 uppercase tracking-wider">{t("completedCard.ai_reflection")}</h3>
          </div>
          <Markdown content={aiReflection} />
        </div>
      )}

      {/* Quote fallback */}
      {!aiReflection && data.mood > 0 && (
        <div className="text-center py-2">
          <p className="text-white/30 text-xs italic">&ldquo;{pickQuote(data.mood)}&rdquo;</p>
        </div>
      )}

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
      >
        ✏️ {t("completedCard.edit_record")}
      </button>
    </div>
  );
}

// ── MAIN COMPONENT ──
export function OnePageCheckIn({ onSaveDone, initialDate }: { onSaveDone: () => void; initialDate?: string | null }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CheckInData>({ ...EMPTY_DATA });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiReflection, setAiReflection] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>(FALLBACK_HABIT_DEFS);
  const [activityDefs, setActivityDefs] = useState<ActivityDef[]>([]);
  const [hiddenActivities, setHiddenActivities] = useState<ActivityDef[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemIcon, setNewItemIcon] = useState("📌");
  const [newItemCategory, setNewItemCategory] = useState("vlastní");
  const [activityError, setActivityError] = useState<string | null>(null);
  const flags = getFeatureFlags();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const dataRef = useRef<CheckInData>(data);
  const dateRef = useRef<string>(currentDate);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { dateRef.current = currentDate; }, [currentDate]);

  const today = new Date().toISOString().split("T")[0];

  // Load habits and activities from DB and user email
  useEffect(() => {
    // Load habits
    getHabits().then(defs => {
      if (defs.length > 0) setHabitDefs(defs);
      const initHabits: Record<string, boolean> = {};
      defs.forEach(h => { initHabits[h.key] = false; });
      setData(d => ({ ...d, habits: { ...initHabits, ...d.habits } }));
    }).catch(() => {});
    
    // Load activities
    getActivities().then(defs => {
      if (defs.length > 0) setActivityDefs(defs);
    }).catch(e => console.error('Failed to load activities:', e));
    
    // Load hidden activities (for restore UI)
    getHiddenActivities().then(defs => {
      if (defs.length > 0) setHiddenActivities(defs);
    }).catch(() => {});
    
    // Get user email and id
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(getSupabaseAuthTokenKey());
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.user?.email) setUserEmail(parsed.user.email);
          if (parsed.user?.id) setUserId(parsed.user.id);
        }
      } catch {}
    }
  }, []);

  // Load entry for current date
  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setEditing(false);
    setAiReflection(null);

    getEntry(currentDate).then((entry) => {
      if (entry) {
        setData({
          mood: entry.mood,
          moodEmoji: entry.mood_emoji,
          sleepQuality: entry.sleep_quality ?? 0,
          stress: entry.stress ?? 0,
          activities: entry.activities ?? [],
          habits: entry.habits ?? {},
          gratitude: entry.gratitude ?? [],
          note: entry.note ?? "",
          photoDataUrl: entry.photo_path || null,
        });
        if (entry.ai_reflection) {
          setAiReflection(entry.ai_reflection);
        }
        if (entry.mood > 0) {
          setSaved(true);
        }
      } else {
        // No DB entry — try to restore draft from localStorage
        const draftKey = `diarium_draft_${currentDate}`;
        try {
          const draft = localStorage.getItem(draftKey);
          if (draft) {
            const parsed = JSON.parse(draft);
            setData({ ...EMPTY_DATA, ...parsed });
          } else {
            setData({ ...EMPTY_DATA });
          }
        } catch {
          setData({ ...EMPTY_DATA });
        }
      }
      setGoals(loadGoals());
      setLoading(false);
    }).catch(() => { setGoals(loadGoals()); setLoading(false); });
  }, [currentDate]);

  useEffect(() => { if (goals.length > 0) saveGoals(goals); }, [goals]);

  const toggleGoal = (id: string) => {
    const d = currentDate;
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      const isDone = g.completedDates.includes(d);
      return {
        ...g,
        completedDates: isDone ? g.completedDates.filter(dd => dd !== d) : [...g.completedDates, d],
      };
    }));
  };

  const addGoal = () => {
    const name = prompt(t("goals.prompt_name"));
    if (!name) return;
    const emoji = prompt(t("goals.prompt_emoji")) || "✅";
    setGoals(prev => [...prev, { id: Date.now().toString(), emoji, name, completedDates: [] }]);
  };
  const removeGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));

  // Add custom activity (persisted to DB)
  const addCustomActivity = async () => {
    setNewItemName("");
    setNewItemIcon("📌");
    setNewItemCategory("vlastní");
    setActivityError(null);
    setShowAddActivity(true);
  };

  const confirmAddCustomActivity = async () => {
    const name = newItemName.trim();
    if (!name) {
      setActivityError(t("activities.error_empty"));
      return;
    }
    const icon = newItemIcon.trim() || "📌";
    const category = newItemCategory;

    setShowAddActivity(false);
    
    const key = name.toLowerCase().replace(/\s+/g, "_");
    const newActivity: ActivityDef = { key, label: name, icon, category, color: "#6366f1", source: "custom" };
    
    // Add to local state immediately
    setActivityDefs(prev => [...prev, newActivity]);
    
    // Persist to DB
    if (userId) {
      const tok = getAccessToken();
      try {
        const res = await fetch("/api/manage-activities", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
          body: JSON.stringify({ action: "add", userId, key, label: name, icon, category }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setActivityError(t("activities.error_save", { error: errData.error || res.statusText }));
          // Keep in local state — user can retry later
        }
      } catch (e: any) {
        setActivityError(t("activities.error_network", { error: e.message || "neznámá" }));
      }
    }
  };

  // Remove activity (local + DB)
  const removeActivity = (activityKey: string) => {
    const removed = activityDefs.find(a => a.key === activityKey);
    setActivityDefs(prev => prev.filter(a => a.key !== activityKey));
    
    // Add to hidden list for potential restore
    if (removed) {
      setHiddenActivities(prev => [...prev, removed]);
    }
    
    // Also remove from current selection
    if (removed?.label) {
      setData(d => ({ ...d, activities: d.activities.filter(a => a !== removed.label) }));
    }
    
    // Persist to DB
    if (userId) {
      const tok = getAccessToken();
      fetch("/api/manage-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ action: "remove", userId, key: activityKey }),
      }).then(res => {
        if (!res.ok) res.json().then(d => setActivityError(t("activities.error_remove", { error: d.error || res.statusText }))).catch(() => {});
      }).catch(e => setActivityError(t("activities.error_remove_network", { error: e.message })));
    }
  };

  // Restore a previously hidden activity
  const restoreActivity = (activityKey: string) => {
    const restored = hiddenActivities.find(a => a.key === activityKey);
    if (restored) {
      setActivityDefs(prev => [...prev, restored]);
      setHiddenActivities(prev => prev.filter(a => a.key !== activityKey));
    }
    
    // Persist to DB
    if (userId) {
      const tok = getAccessToken();
      fetch("/api/manage-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ action: "restore", userId, key: activityKey }),
      }).then(res => {
        if (!res.ok) res.json().then(d => setActivityError(t("activities.error_restore", { error: d.error || res.statusText }))).catch(() => {});
      }).catch(e => setActivityError(t("activities.error_restore_network", { error: e.message })));
    }
  };

  // Add custom habit (persisted to DB)
  const addCustomHabit = async () => {
    const name = prompt(t("habits.prompt_name"));
    if (!name) return;
    const icon = prompt(t("habits.prompt_emoji")) || "✅";
    const isNegative = confirm(t("habits.prompt_negative"));
    
    const key = name.toLowerCase().replace(/\s+/g, "_");
    const newHabit: HabitDef = { key, label: name, icon, category: "vlastní", color: "#6366f1", is_negative: isNegative, source: "custom" };
    setHabitDefs(prev => [...prev, newHabit]);
    setData(d => ({ ...d, habits: { ...d.habits, [key]: false } }));
    
    // Persist to DB
    if (userId) {
      const tok = getAccessToken();
      fetch("/api/manage-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ action: "add", userId, key, label: name, icon, is_negative: isNegative }),
      }).catch(() => {});
    }
  };

  // Remove habit (local + DB)
  const removeHabit = (habitKey: string) => {
    setHabitDefs(prev => prev.filter(d => d.key !== habitKey));
    setData(d => {
      const newHabits = { ...d.habits };
      delete newHabits[habitKey];
      return { ...d, habits: newHabits };
    });
    
    // Persist to DB
    if (userId) {
      const tok = getAccessToken();
      fetch("/api/manage-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ action: "remove", userId, key: habitKey }),
      }).catch(() => {});
    }
  };

  const doSave = useCallback((currentData: CheckInData, final: boolean) => {
    const serialized = JSON.stringify(currentData);
    if (serialized === lastSaved.current && !final) return;
    lastSaved.current = serialized;

    // Build payload
    const payload = {
      mood: currentData.mood,
      mood_emoji: currentData.moodEmoji,
      sleep_quality: currentData.sleepQuality,
      stress: currentData.stress,
      activities: currentData.activities,
      habits: currentData.habits,
      gratitude: currentData.gratitude.filter((g: string) => g.trim()),
      note: currentData.note,
      weather: [],
      date: dateRef.current,
      photoDataUrl: currentData.photoDataUrl,
    };
    saveEntry(payload as any).catch(() => {});
  }, []);

  // Autosave draft to localStorage — allows incremental check-in throughout the day.
  // Saves form state locally after 1.5s of inactivity. Restored on next visit.
  useEffect(() => {
    if (saved || loading) return;
    const draftKey = `diarium_draft_${currentDate}`;
    const hasContent =
      data.mood > 0 ||
      data.activities.length > 0 ||
      data.gratitude.some((g: string) => g.trim()) ||
      data.note.trim() ||
      data.sleepQuality > 0 ||
      data.stress > 0;

    if (!hasContent) {
      localStorage.removeItem(draftKey);
      return;
    }

    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(data));
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, saved, loading, currentDate]);

  // Safety net: save on page close / background
  useEffect(() => {
    const handle = () => {
      const d = dataRef.current;
      const hasData = d.mood > 0 || d.activities.length > 0 || d.gratitude.some(g => g.trim()) || d.note.trim();
      if (hasData) doSave(d, false);
    };
    window.addEventListener("beforeunload", handle);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") handle(); });
    return () => { window.removeEventListener("beforeunload", handle); document.removeEventListener("visibilitychange", handle); };
  }, [doSave]);

  const fetchAIReflection = async (entryData: CheckInData) => {
    setAiLoading(true);
    try {
      // Get user info for personalization
      let userName = "";
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(getSupabaseAuthTokenKey());
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.user?.email) userName = parsed.user.email;
          }
        } catch {}
      }

      const resp = await fetch("/api/ai/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getAccessToken()}` },
        body: JSON.stringify({
          user_id: userId,
          date: dateRef.current,
          userName,
          // Still send today's data as fallback (in case Supabase fetch fails)
          mood: entryData.mood,
          note: entryData.note,
          gratitude: entryData.gratitude,
          activities: entryData.activities,
          sleep_quality: entryData.sleepQuality,
          stress: entryData.stress,
          habits: entryData.habits,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.reflection) {
          setAiReflection(json.reflection);
          // Save reflection to DB
          try {
            const tok = getAccessToken();
            await fetch("/api/save-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
              body: JSON.stringify({
                user_id: userId,
                date: dateRef.current,
                ai_reflection: json.reflection,
              }),
            });
          } catch (e) {
            console.error("Failed to save AI reflection:", e);
          }
        }
      }
    } catch (e) {
      console.error("AI reflection fetch error:", e);
    }
    setAiLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEntry({
        mood: data.mood,
        mood_emoji: data.moodEmoji,
        sleep_quality: data.sleepQuality,
        stress: data.stress,
        activities: data.activities,
        habits: data.habits,
        gratitude: data.gratitude.filter((g: string) => g.trim()),
        note: data.note,
        weather: [],
        date: currentDate,
        photoDataUrl: data.photoDataUrl,
      } as any);
      setSaved(true);
      setEditing(false);
      // Clear the draft since it's now persisted to DB
      localStorage.removeItem(`diarium_draft_${currentDate}`);
      // Fetch AI reflection in background
      fetchAIReflection(data);
    } catch {}
    setSaving(false);
  };

  const toggleActivity = (label: string) => {
    setData(d => ({
      ...d,
      activities: d.activities.includes(label) ? d.activities.filter(a => a !== label) : [...d.activities, label],
    }));
  };

  const navigateDate = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/40">{t("common.loading")}</div>;
  }

  // ── COMPLETED CARD VIEW ──
  if (saved && !editing) {
    return (
      <div className="pb-24">
        {/* Date nav */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 sticky top-0 bg-black/80 backdrop-blur-xl z-10 border-b border-white/5">
          <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors">◀</button>
          <button
            onClick={() => setCurrentDate(today)}
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${
              currentDate === today ? "bg-indigo-500/20 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {currentDate === today ? t("checkin.today") : new Date(currentDate).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
          </button>
          <button
            onClick={() => navigateDate(1)}
            disabled={currentDate === today}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors"
          >▶</button>
        </div>
        <CompletedCard
          data={data}
          goals={goals}
          aiReflection={aiReflection}
          onEdit={() => setEditing(true)}
          dateStr={currentDate}
          habitDefs={habitDefs}
        />
        {aiLoading && (
          <div className="text-center text-white/20 text-sm py-4 animate-pulse">{t("checkin.ai_thinking")}</div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className="min-h-screen pb-36">
      {/* Header with date nav */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 sticky top-0 bg-black/80 backdrop-blur-xl z-10 border-b border-white/5">
        <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors">◀</button>
        <div className="text-center">
          <span className={`text-sm font-medium ${currentDate === today ? "text-white" : "text-white/40"}`}>
            {currentDate === today ? t("checkin.today") : new Date(currentDate).toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
          </span>
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={currentDate === today}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors"
        >▶</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
        >
          ✓ {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* ── MOOD ── */}
        <div>
          <div className="flex justify-center gap-2 flex-wrap">
            {MOODS.map(m => (
              <button
                key={m.value}
                onClick={() => setData(d => ({ ...d, mood: m.value, moodEmoji: m.emoji }))}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                style={{
                  background: data.mood === m.value ? m.color + "20" : "transparent",
                  border: data.mood === m.value ? `2px solid ${m.color}` : "2px solid transparent",
                }}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="text-[10px] text-white/50">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SLEEP QUALITY ── */}
        <div>
          <p className="text-xs text-white/30 text-center mb-2">{t("checkin.sleep_label")}</p>
          <div className="flex justify-center gap-1 flex-wrap">
            {SLEEP_QUALITY.map(s => (
              <button
                key={s.value}
                onClick={() => setData(d => ({ ...d, sleepQuality: s.value }))}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${
                  data.sleepQuality === s.value ? "bg-indigo-500/20 ring-1 ring-indigo-400/50" : "bg-white/5"
                }`}
              >
                <span className="text-3xl">{s.emoji}</span>
                <span className="text-[10px] text-white/40">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── ACTIVITIES ── */}
        <div className="space-y-1">
          {groupActivities(activityDefs).map(cat => (
            <Section key={cat.title} title={cat.title}>
              <div className="flex flex-wrap gap-2">
                {cat.items.map(a => {
                  const isSelected = data.activities.includes(a.label);
                  return (
                    <button
                      key={a.key}
                      onClick={() => toggleActivity(a.label)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[64px] transition-all ${
                        isSelected ? "bg-indigo-500/20 ring-1 ring-indigo-400/50" : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-2xl">{a.icon}</span>
                      <span className="text-[10px] text-white/50 leading-tight text-center">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          ))}
        </div>

        {/* Activity management buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={addCustomActivity}
            className="flex-1 py-2 rounded-xl bg-white/5 border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors text-xs flex items-center justify-center gap-1"
          >
            ➕ {t("activities.add_custom")}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`py-2 px-3 rounded-xl transition-colors text-xs flex items-center gap-1 ${
              showSettings ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/20" : "bg-white/5 border border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {t("activities.manage")}
          </button>
        </div>

        {/* ── HABITS ── */}
        <Section title={t("habits.section_title")}>
          <div className="space-y-2">
            {(flags?.habitTracking
              ? habitDefs
              : habitDefs.filter(h => !SENSITIVE_HABIT_KEYS.includes(h.key))
            ).map(h => {
              const isOn = data.habits[h.key] ?? false;
              const isGreen = h.is_negative ? !isOn : isOn;
              return (
                <div key={h.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.icon}</span>
                    <span className="text-sm text-white/80">{h.label}</span>
                    <span className="text-[10px] text-white/25 px-1.5 py-0.5 rounded-full border border-white/10">{t("habits.not_today")}</span>
                  </div>
                  <button
                    onClick={() => setData(d => ({ ...d, habits: { ...d.habits, [h.key]: !isOn } }))}
                    className={`w-12 h-7 rounded-full relative transition-colors ${isGreen ? "bg-emerald-500/60" : "bg-white/10"}`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isGreen ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Habit management buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={addCustomHabit}
              className="flex-1 py-2 rounded-xl bg-white/5 border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors text-xs flex items-center justify-center gap-1"
            >
              ➕ {t("habits.add_custom")}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`py-2 px-3 rounded-xl transition-colors text-xs flex items-center gap-1 ${
                showSettings ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/20" : "bg-white/5 border border-white/10 text-white/40 hover:text-white"
              }`}
            >
              {t("activities.manage")}
            </button>
          </div>
        </Section>

        {/* ── SETTINGS PANEL ── */}
        {showSettings && (
          <div className="mb-4 p-4 bg-white/3 rounded-xl border border-white/5 space-y-4">
            {/* Activity Management */}
            <div>
              <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">{t("activities.your_activities")}</p>
              <p className="text-[10px] text-white/25 mb-2">
                {t("activities.activities_summary", { count: activityDefs.length, categories: groupActivities(activityDefs).length })}
              </p>
              
              {/* Activity list with remove buttons */}
              <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
                {groupActivities(activityDefs).map(cat => (
                  <div key={cat.title}>
                    <p className="text-[10px] text-white/20 uppercase tracking-wider px-1 py-1">{cat.title}</p>
                    {cat.items.map(a => (
                      <div key={a.key} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{a.icon}</span>
                          <span className="text-white/60">{a.label}</span>
                          <span className="text-[10px] text-white/20">
                            {a.source === "custom" ? t("activities.custom_badge") : t("activities.default_badge")}
                          </span>
                        </span>
                        <button
                          onClick={() => removeActivity(a.key)}
                          className="text-red-400/40 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                          title={a.source === "custom" ? t("activities.remove_tooltip_custom") : t("activities.remove_tooltip_default")}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              
              <button
                onClick={addCustomActivity}
                className="w-full py-2 text-xs text-indigo-400/60 hover:text-indigo-400 border border-dashed border-indigo-400/20 rounded-lg transition-colors"
              >
                ➕ {t("activities.add_custom")}
              </button>

              {/* Hidden activities — restore section */}
              {hiddenActivities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
                    {t("activities.hidden_activities", { count: hiddenActivities.length })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hiddenActivities.map(a => (
                      <button
                        key={a.key}
                        onClick={() => restoreActivity(a.key)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 text-xs text-white/40 hover:text-emerald-400 transition-colors"
                        title={t("activities.restore_tooltip")}
                      >
                        <span>{a.icon}</span>
                        <span>{a.label}</span>
                        <span className="text-[10px] text-emerald-500/40 ml-0.5">↩</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/5"></div>

            {/* Habit Management */}
            <div>
              <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">{t("habits.your_habits")}</p>
              {habitDefs.length === 0 ? (
                <p className="text-xs text-white/20 italic mb-3">
                  {t("activities.no_activities_yet")}
                </p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {(flags.habitTracking
                    ? habitDefs
                    : habitDefs.filter(h => !SENSITIVE_HABIT_KEYS.includes(h.key))
                  ).map(h => (
                    <div key={h.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                      <span className="flex items-center gap-2 text-sm">
                        <span>{h.icon}</span>
                        <span className="text-white/70">{h.label}</span>
                        <span className="text-[10px] text-white/25">
                          {h.is_negative ? t("habits.negative_badge") : t("habits.positive_badge")}
                          {h.source === "default" ? t("habits.default_badge") : ""}
                        </span>
                      </span>
                      <button
                        onClick={() => removeHabit(h.key)}
                        className="text-red-400/50 hover:text-red-400 text-xs px-2 py-0.5"
                      >
                        ✕ {t("habits.remove_btn")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addCustomHabit}
                className="w-full py-2 text-xs text-indigo-400/60 hover:text-indigo-400 border border-dashed border-indigo-400/20 rounded-lg transition-colors"
              >
                ➕ {t("habits.add_habit")}
              </button>
            </div>
          </div>
        )}

        {/* ── GOALS ── */}
        <Section title={t("goals.section_title", { done: goals.filter(g => g.completedDates.includes(currentDate)).length, total: goals.length })} defaultOpen={goals.length > 0}>
          <div className="space-y-2">
            {goals.map(g => {
              const isDone = g.completedDates.includes(currentDate);
              const streak = computeStreak(g.completedDates);
              return (
                <div key={g.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 group">
                  <button onClick={() => toggleGoal(g.id)} className="flex items-center gap-3 flex-1">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${isDone ? "bg-indigo-500 text-white" : "bg-white/10"}`}>
                      {isDone ? "✓" : ""}
                    </span>
                    <span className="text-lg">{g.emoji}</span>
                    <div className="text-left">
                      <span className="text-sm text-white/80 block">{g.name}</span>
                      {streak > 0 && <span className="text-[10px] text-indigo-400">{t("goals.streak", { streak })}</span>}
                    </div>
                  </button>
                  <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 text-sm transition-all ml-2">✕</button>
                </div>
              );
            })}
          </div>
          <button onClick={addGoal} className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">+ {t("goals.add_goal")}</button>
        </Section>

        {/* ── STRESS ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
            <span className="text-sm font-medium text-white/80">{t("completedCard.stress")}</span>
          </div>
          <div className="flex gap-1">
            {STRESS_LEVELS.map(s => (
              <button
                key={s.value}
                onClick={() => setData(d => ({ ...d, stress: s.value }))}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                  data.stress === s.value ? "bg-orange-500/20 ring-1 ring-orange-400/50" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-lg">{s.emoji}</span>
                <span className="text-[9px] text-white/40">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── GRATITUDE ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-sm font-medium text-white/80">{t("checkin.gratitude_title")}</span>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/20 text-sm w-5 text-right">{i + 1}.</span>
                <input
                  value={data.gratitude[i]}
                  onChange={e => { const g = [...data.gratitude]; g[i] = e.target.value; setData(d => ({ ...d, gratitude: g })); }}
                  placeholder={t("gratitude.placeholder", { n: i + 1 })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── NOTE ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-sm font-medium text-white/80">{t("checkin.note_title")}</span>
          </div>
          <textarea
            value={data.note}
            onChange={e => setData(d => ({ ...d, note: e.target.value }))}
            placeholder={t("checkin.note_placeholder")}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50 resize-none"
          />
        </div>

        {/* ── PHOTO ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-sm font-medium text-white/80">{t("checkin.photo_title")}</span>
          </div>
          <PhotoPicker
            onPhotoSelected={url => setData(d => ({ ...d, photoDataUrl: url }))}
            currentPhoto={data.photoDataUrl}
          />
        </div>
      </div>

      {/* Error banner */}
      {activityError && !showAddActivity && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 flex items-center justify-between shadow-lg backdrop-blur-lg">
          <span>{activityError}</span>
          <button onClick={() => setActivityError(null)} className="text-red-400/60 hover:text-red-300 ml-2 shrink-0">✕</button>
        </div>
      )}

      {/* ── ADD ACTIVITY MODAL ── */}
      {showAddActivity && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddActivity(false)}>
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-white">{t("addActivity.title")}</h3>
          </div>

          <div className="px-5 pb-2 space-y-3">
            {/* Activity name */}
            <div>
              <label className="block text-[11px] text-white/40 mb-1 uppercase tracking-wider">{t("addActivity.name_label")}</label>
              <input
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder={t("addActivity.name_placeholder")}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") confirmAddCustomActivity(); }}
              />
            </div>

            {/* {t("addActivity.emoji_label")} */}
            <div>
              <label className="block text-[11px] text-white/40 mb-1 uppercase tracking-wider">{t("addActivity.emoji_label")}</label>
              <input
                value={newItemIcon}
                onChange={e => setNewItemIcon(e.target.value)}
                placeholder={t("addActivity.emoji_placeholder")}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
              />
            </div>

            {/* Category grid */}
            <div>
              <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wider">{t("addActivity.category_label")}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(CATEGORY_GROUPS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setNewItemCategory(key)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      newItemCategory === key
                        ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inline error */}
            {activityError && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{activityError}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-5 pb-5 pt-2">
            <button
              onClick={() => { setShowAddActivity(false); setActivityError(null); }}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors text-sm font-medium"
            >
              {t("addActivity.cancel")}
            </button>
            <button
              onClick={confirmAddCustomActivity}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white transition-colors text-sm font-medium"
            >
              {t("addActivity.add")}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Bottom area: Save button + Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/5">
        {/* Save button */}
        <div className="p-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {saving ? t("checkin.saving") : t("checkin.save_to_vault")}
          </button>
        </div>
      </div>
    </div>
  );
}
