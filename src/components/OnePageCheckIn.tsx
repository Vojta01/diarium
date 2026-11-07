"use client";

import { useState, useEffect, useRef, useId } from "react";
import { saveEntry, patchEntry, getEntryOrThrow, getHabits, setHabitVisibility, getActivities, getHiddenActivities, getAccessToken } from "@/lib/supabase/db";
import type { HabitDef, ActivityDef } from "@/lib/supabase/db";
import { PhotoPicker } from "@/components/PhotoPicker";
import type { CheckInData } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { getFeatureFlags, SENSITIVE_HABIT_KEYS } from "@/lib/feature-flags";
import { useTranslation } from "@/lib/i18n";
import { readStoredSession } from "@/lib/auth-storage";
import { ScaleSlider } from "@/components/ScaleSlider";
import { TemplatePicker } from "@/components/TemplatePicker";
import { GoalEditorDialog } from "@/components/GoalEditorDialog";
import { HabitEditDialog } from "@/components/HabitEditDialog";
import { Modal } from "@/components/ui/Modal";
import { pragueDateKey, shiftDateKey } from "@/lib/date";
import { notifyDataChanged } from "@/lib/data-refresh";
import { seedDefaultScales, type Scale } from "@/lib/scales";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { WEATHER_KEYS } from "@/lib/dashboard-ui";
import {
  emptyCheckIn,
  filteredGratitude,
  fromEntry,
  hasContent,
  positiveScaleValues,
} from "@/lib/checkin/model";
import { buildCheckInPayload } from "@/lib/checkin/payload";
import { saveCheckIn } from "@/lib/checkin/save";
import { loadCheckIn } from "@/lib/checkin/load";
import { clampCheckInDate } from "@/lib/checkin/dates";
import { aiEmptyError, aiFailedError, aiNetworkError, aiPersistError, type CheckInError } from "@/lib/checkin/errors";
import { clearDraft, readDraft, writeDraft } from "@/lib/checkin/draft";

// ── Mood ──
const MOODS = [
  { value: 5, emoji: "😄", color: "#22c55e" },
  { value: 4, emoji: "🙂", color: "#3b82f6" },
  { value: 3, emoji: "😐", color: "#eab308" },
  { value: 2, emoji: "😟", color: "#f97316" },
  { value: 1, emoji: "😡", color: "#ef4444" },
];

// ── Sleep quality ──
const SLEEP_QUALITY = [
  { value: 3, emoji: "😴" },
  { value: 2, emoji: "🥱" },
  { value: 1, emoji: "😪" },
];

// ── Stress levels ──
const STRESS_LEVELS = [
  { value: 1, emoji: "😌" },
  { value: 2, emoji: "🙂" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "😰" },
  { value: 5, emoji: "😤" },
];

const STRESS_LABELS: Record<number, string> = {
  1: "stress.stress_1", 2: "stress.stress_2", 3: "stress.stress_3", 4: "stress.stress_4", 5: "stress.stress_5",
};

// ── Activity catalog — key + label → icon mapping (for CompletedCard display) ──
interface ActivityInfo { icon: string; displayLabel: string; color?: string; }
const ACTIVITY_CATALOG: Record<string, ActivityInfo> = {
  // Both keys and labels as keys so either format works
  "rodina": { icon: "👨‍👩‍👧", displayLabel: "Rodina" },
  "Rodina": { icon: "👨‍👩‍👧", displayLabel: "Rodina" },
  "pratele": { icon: "👥", displayLabel: "Přátelé" },
  "Přátelé": { icon: "👥", displayLabel: "Přátelé" },
  "rande": { icon: "💑", displayLabel: "Rande" },
  "Rande": { icon: "💑", displayLabel: "Rande" },
  "party": { icon: "🎉", displayLabel: "Párty" },
  "Párty": { icon: "🎉", displayLabel: "Párty" },
  "office": { icon: "🏢", displayLabel: "Office" },
  "Office": { icon: "🏢", displayLabel: "Office" },
  "filmy_a_tv": { icon: "🎬", displayLabel: "Filmy a TV" },
  "Filmy a TV": { icon: "🎬", displayLabel: "Filmy a TV" },
  "cteni": { icon: "📖", displayLabel: "Čtení" },
  "Čtení": { icon: "📖", displayLabel: "Čtení" },
  "hrani_her": { icon: "🎮", displayLabel: "Hraní her" },
  "Hraní her": { icon: "🎮", displayLabel: "Hraní her" },
  "sport": { icon: "🏃", displayLabel: "Sport" },
  "Sport": { icon: "🏃", displayLabel: "Sport" },
  "relax": { icon: "😌", displayLabel: "Relax" },
  "Relax": { icon: "😌", displayLabel: "Relax" },
  "hudba": { icon: "🎵", displayLabel: "Hudba" },
  "Hudba": { icon: "🎵", displayLabel: "Hudba" },
  "jist_zdrave": { icon: "🥗", displayLabel: "Jíst zdravě" },
  "Jíst zdravě": { icon: "🥗", displayLabel: "Jíst zdravě" },
  "rychle_obcerstveni": { icon: "🍔", displayLabel: "Rychlé občerstvení" },
  "Rychlé občerstvení": { icon: "🍔", displayLabel: "Rychlé občerstvení" },
  "domaci_vyroba": { icon: "🍳", displayLabel: "Domácí výroba" },
  "Domácí výroba": { icon: "🍳", displayLabel: "Domácí výroba" },
  "restaurace": { icon: "🍽️", displayLabel: "Restaurace" },
  "Restaurace": { icon: "🍽️", displayLabel: "Restaurace" },
  "donaska": { icon: "📦", displayLabel: "Donáška" },
  "Donáška": { icon: "📦", displayLabel: "Donáška" },
  "den_bez_masa": { icon: "🥬", displayLabel: "Den bez masa" },
  "zadne_sladkosti": { icon: "🚫🍰", displayLabel: "Žádné sladkosti" },
  "zadne_limonady": { icon: "🚫🥤", displayLabel: "Žádné limonády" },
  "trenink": { icon: "🏋️", displayLabel: "Trénink" },
  "Trénink": { icon: "🏋️", displayLabel: "Trénink" },
  "pit_vody": { icon: "💧", displayLabel: "Pít vodu" },
  "chuze": { icon: "🚶", displayLabel: "Chůze" },
  "Chůze": { icon: "🚶", displayLabel: "Chůze" },
  "kolo": { icon: "🚴", displayLabel: "Kolo" },
  "plavani": { icon: "🏊", displayLabel: "Plavání" },
  "paddleboard": { icon: "🏄", displayLabel: "Paddleboard" },
  "snooker": { icon: "🎱", displayLabel: "Snooker" },
  "meditovat": { icon: "🧘", displayLabel: "Meditovat" },
  "Meditovat": { icon: "🧘", displayLabel: "Meditovat" },
  "laskavost": { icon: "💝", displayLabel: "Laskavost" },
  "Laskavost": { icon: "💝", displayLabel: "Laskavost" },
  "naslouchani": { icon: "👂", displayLabel: "Naslouchání" },
  "darcovstvi": { icon: "💰", displayLabel: "Dárcovství" },
  "dej_darek": { icon: "🎁", displayLabel: "Dej dárek" },
  "terapie": { icon: "🛋️", displayLabel: "Terapie" },
  "Terapie": { icon: "🛋️", displayLabel: "Terapie" },
  "integrita": { icon: "⚖️", displayLabel: "Integrita" },
  "nakupovani": { icon: "🛒", displayLabel: "Nakupování" },
  "Nakupování": { icon: "🛒", displayLabel: "Nakupování" },
  "uklizeni": { icon: "🧹", displayLabel: "Uklízení" },
  "Uklízení": { icon: "🧹", displayLabel: "Uklízení" },
  "vareni": { icon: "🍲", displayLabel: "Vaření" },
  "Vaření": { icon: "🍲", displayLabel: "Vaření" },
  "prani": { icon: "🧺", displayLabel: "Praní" },
  "zehleni": { icon: "👕", displayLabel: "Žehlení" },
  "slunecno": { icon: "☀️", displayLabel: "Slunečno" },
  "Slunečno": { icon: "☀️", displayLabel: "Slunečno" },
  "zatazeno": { icon: "☁️", displayLabel: "Zataženo" },
  "dest": { icon: "🌧️", displayLabel: "Déšť" },
  "Déšť": { icon: "🌧️", displayLabel: "Déšť" },
  "snih": { icon: "❄️", displayLabel: "Sníh" },
  "mraz": { icon: "🥶", displayLabel: "Mráz" },
  "horko": { icon: "🌡️", displayLabel: "Horko" },
  "bourka": { icon: "🌩️", displayLabel: "Bouřka" },
  "vitr": { icon: "💨", displayLabel: "Vítr" },
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

// ── Activity groups (category → group name) — uses i18n translations
const CATEGORY_ORDER = ["sociální", "práce", "volný čas", "sport", "jídlo", "zdraví", "wellness", "domácí práce", "počasí", "vlastní", "obecné"];

function groupActivities(defs: ActivityDef[], getCategoryName: (key: string) => string): { title: string; items: ActivityDef[] }[] {
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
    .map(cat => ({ title: getCategoryName(cat), items: groups[cat] }));
}

// ── Reduced habits ── (loaded dynamically below)

// ── Hardcoded defaults used only as fallback ── (replaced by DB-loaded habits)
const FALLBACK_HABIT_DEFS: HabitDef[] = [
  { key: "alkohol", label: "Alkohol", labelEn: "Alcohol", icon: "🍺", category: "zdraví", color: "#ef4444", is_negative: true, source: "default" },
];

// ── Form model ── (empty state and mapping live in src/lib/checkin/model.ts)

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
  const today = pragueDateKey();
  let expected = today, streak = 0;
  for (const d of sorted) {
    if (d === expected) {
      streak++;
      expected = shiftDateKey(expected, -1);
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
  data, goals, aiReflection, onEdit, onPhotoClick, dateStr, habitDefs,
}: {
  data: CheckInData; goals: Goal[]; aiReflection: string | null; onEdit: () => void; onPhotoClick?: (url: string) => void; dateStr: string;
  habitDefs: HabitDef[];
}) {
  const { t, lang } = useTranslation();
  const displayLabel = (item: { label: string; labelEn?: string }) =>
    lang === 'en' ? (item.labelEn || item.label) : item.label;
  const displayGoalName = (goal: Goal) =>
    lang === 'en' && goal.name === 'Krátké cvičení' ? t('goals.default_name') : goal.name;
  const mood = MOODS.find(m => m.value === data.mood);
  const sleep = SLEEP_QUALITY.find(s => s.value === data.sleepQuality);
  const stressLevel = data.stress > 0 ? STRESS_LEVELS[data.stress - 1] : null;
  const isToday = dateStr === pragueDateKey();
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
    kept: data.habits[h.key],
  }));

  return (
    <div className="space-y-4 px-4 pb-8 pt-2">
      {/* Hero banner */}
      {isToday && (
        <div className="text-center animate-fade-in pb-2">
          <div className="text-5xl mb-1">{data.mood >= 4 ? "✨" : data.mood >= 2 ? "🌟" : "💪"}</div>
          <h2 className="text-xl font-bold text-white">
            {data.mood >= 4 ? t("completedCard.great_day") : data.mood >= 2 ? t("completedCard.day_recorded") : t("completedCard.it_counts")}
          </h2>
        </div>
      )}

      <p className="text-center text-white/25 text-sm">
        {new Date(dateStr).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      {/* Main mood pill */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border" style={{
          background: (mood?.color || "#6366f1") + "15",
          borderColor: (mood?.color || "#6366f1") + "30",
        }}>
          <span className="text-3xl">{mood?.emoji}</span>
          <span className="text-white font-medium">{mood?.value ? t(`mood.mood_${mood.value}e`) : "—"}</span>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="glass-card">
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Sleep */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{sleep?.emoji || "—"}</div>
            <div className="text-[10px] text-white/30">{t("completedCard.sleep")}</div>
            <div className="text-[11px] text-white/60 font-medium">{sleep ? t(`sleep.sleep_${sleep.value}e`) : t("common.no_data")}</div>
          </div>
          {/* Stress */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{stressLevel?.emoji || "—"}</div>
            <div className="text-[10px] text-white/30">{t("completedCard.stress")}</div>
            <div className="text-[11px] text-white/60 font-medium">{stressLevel ? t(`stress.stress_${stressLevel.value}`) : "—"}</div>
          </div>
          {/* Activities count */}
          <div className="p-2">
            <div className="text-2xl mb-0.5">{data.activities.length || "—"}</div>
            <div className="text-[10px] text-white/30">{t("completedCard.activities_short")}</div>
            <div className="text-[11px] text-white/60 font-medium">
              {data.activities.length > 0 ? data.activities.slice(0, 2).join(", ") : t("activities.none")}
            </div>
          </div>
        </div>
      </div>

      {/* Activities tags — with icons */}
      {Array.isArray(data.activities) && data.activities.length > 0 && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">{t("completedCard.activities_section")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.activities.map(a => {
              const info = ACTIVITY_CATALOG[a] || ACTIVITY_CATALOG[a.toLowerCase().replace(/\s+/g, "_")];
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/70"
                >
                  {info ? <span className="text-sm">{info.icon}</span> : null}
                  <span>{info?.displayLabel || a}</span>
                </span>
              );
            })}
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
              <div className="text-[10px] text-white/50 mt-0.5">{displayLabel(h)}</div>
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
                  <span className="text-white/70">{g.emoji} {displayGoalName(g)}</span>
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

      {/* Photo */}
      {data.photoPath && (
        <div className="glass-card">
          <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">📷 {t("photo.label")}</h3>
          <img
            src={data.photoPath}
            alt={t("photo.label")}
            className="w-full rounded-xl object-cover max-h-96 cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => onPhotoClick?.(data.photoPath!)}
          />
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
        {t("completedCard.edit_record")}
      </button>
    </div>
  );
}

// ── PHOTO VIEWER ──
function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);

  return (
    <Modal
      onClose={onClose}
      ariaLabel={alt}
      fullScreen
      panelClassName="relative flex h-full w-full flex-col bg-black/95"
    >
      <div className="flex h-full flex-col" onClick={() => setZoomed(!zoomed)}>
        {/* Back button — always visible */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4" onClick={e => e.stopPropagation()}>
          <button
            onClick={onClose}
            aria-label={alt}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white text-xl backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            ←
          </button>
        </div>

        {/* Image — tap to toggle zoom */}
        <div
          className="flex-1 flex items-start justify-center overflow-auto"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className={`transition-all duration-200 ${
              zoomed
                ? "w-auto h-auto max-w-none max-h-none"
                : "max-w-full max-h-full object-contain"
            }`}
            style={zoomed ? { minWidth: "100%", minHeight: "100dvh" } : {}}
          />
        </div>

        {/* Hint */}
        {!zoomed && (
          <div className="absolute bottom-8 left-0 right-0 text-center" onClick={e => e.stopPropagation()}>
            <span className="inline-block text-white/30 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
              {t("photo.zoom_hint")}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── MAIN COMPONENT ──
export function OnePageCheckIn({ onSaveDone, initialDate, onBack }: {
  onSaveDone: () => void;
  initialDate?: string | null;
  onBack?: () => void;
}) {
  const { t, lang } = useTranslation();
  const addActivityTitleId = useId();
  const displayLabel = (item: { label: string; labelEn?: string }) =>
    lang === 'en' ? (item.labelEn || item.label) : item.label;
  const displayGoalName = (goal: Goal) =>
    lang === 'en' && goal.name === 'Krátké cvičení' ? t('goals.default_name') : goal.name;
  const [data, setData] = useState<CheckInData>(emptyCheckIn);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiReflection, setAiReflection] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => clampCheckInDate(initialDate));
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>(FALLBACK_HABIT_DEFS);
  const [activityDefs, setActivityDefs] = useState<ActivityDef[]>([]);
  const [hiddenActivities, setHiddenActivities] = useState<ActivityDef[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const [habitDialog, setHabitDialog] = useState<{ open: boolean; habit: HabitDef | null }>({ open: false, habit: null });
  const [newItemName, setNewItemName] = useState("");
  const [newItemIcon, setNewItemIcon] = useState("📌");
  const [newItemCategory, setNewItemCategory] = useState("vlastní");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [scales, setScales] = useState<Scale[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<CheckInError | null>(null);
  const [saveError, setSaveError] = useState<CheckInError | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [draftWarning, setDraftWarning] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const flags = getFeatureFlags();
  const saveInFlight = useRef(false);
  const aiInFlight = useRef(false);
  const loadToken = useRef(0);
  const dateRef = useRef<string>(currentDate);
  const saveErrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { dateRef.current = currentDate; }, [currentDate]);

  const today = pragueDateKey();

  // Load habits and activities from DB and user email
  useEffect(() => {
    // Load habits. Do not prefill every key with false: a habit appears in the
    // saved row only after the user touches it (Android's toggleHabit contract).
    getHabits().then(defs => {
      if (defs.length > 0) setHabitDefs(defs);
    }).catch(e => console.error('Failed to load habits:', e));
    
    // Load activities
    getActivities().then(defs => {
      if (defs.length > 0) setActivityDefs(defs);
    }).catch(e => console.error('Failed to load activities:', e));
    
    // Load hidden activities (for restore UI)
    getHiddenActivities().then(defs => {
      if (defs.length > 0) setHiddenActivities(defs);
    }).catch(() => {});
    
    // Get user email and id
    const session = readStoredSession();
    if (session?.user) {
      if (session.user.email) setUserEmail(session.user.email);
      if (session.user.id) setUserId(session.user.id);
    }

    // Load scales — auto-clean old ones, seed defaults
    seedDefaultScales().then(data => setScales(data)).catch(() => {});
  }, []);

  // Load entry for current date. `loadCheckIn` keeps "no entry" and "failed"
  // distinct: only a real `empty` may render an editable form.
  useEffect(() => {
    const token = ++loadToken.current;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setAiError(null);
    setPhotoUploading(false);
    setPhotoCleared(false);
    setSaved(false);
    setEditing(false);
    setAiReflection(null);

    loadCheckIn(currentDate, getEntryOrThrow).then((outcome) => {
      if (token !== loadToken.current) return;

      if (outcome.status === "failed") {
        // Never render an empty form over a stored day. The retry button is the
        // only way forward until the read succeeds.
        setLoadError(outcome.error);
        setData(emptyCheckIn());
        setGoals(loadGoals());
        setLoading(false);
        return;
      }

      if (outcome.status === "entry") {
        const next = fromEntry(
          outcome.entry as unknown as Record<string, unknown>
        );
        setData(next);
        setAiReflection(next.aiReflection);
        setSaved(next.mood > 0);
        setEditing(false);
        // The row is the source of truth; a stale draft for the same date must
        // not resurrect after the entry is deleted later.
        clearDraft(localStorage, currentDate);
      } else {
        setData(readDraft(localStorage, currentDate) ?? emptyCheckIn());
      }

      setGoals(loadGoals());
      setLoading(false);
    });
  }, [currentDate, reloadNonce]);

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
    notifyDataChanged("goals");
  };

  // Goals — created/edited through the visual editor (window.prompt() made
  // picking an emoji on a phone practically impossible)
  const addGoal = () => setGoalDialog({ open: true, goal: null });
  const editGoal = (goal: Goal) => setGoalDialog({ open: true, goal });

  const saveGoal = ({ id, name, emoji }: { id?: string; name: string; emoji: string }) => {
    setGoals(prev =>
      id
        ? prev.map(g => (g.id === id ? { ...g, name, emoji } : g))
        : [...prev, { id: Date.now().toString(), emoji, name, completedDates: [] }]
    );
    notifyDataChanged("goals");
  };

  const removeGoal = (goal: Goal) => {
    if (!confirm(t("goals.confirm_delete", { name: goal.name }))) return;
    setGoals(prev => prev.filter(g => g.id !== goal.id));
    notifyDataChanged("goals");
  };

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

  // Add custom habit — via the visual editor (icon picker + typed confirmation
  // of the negative flag, instead of three chained window.prompt()/confirm())
  const addCustomHabit = () => setHabitDialog({ open: true, habit: null });
  const editHabit = (habit: HabitDef) => setHabitDialog({ open: true, habit });

  const persistHabit = (
    action: "add" | "update",
    key: string,
    label: string,
    icon: string,
    isNegative: boolean
  ) => {
    if (!userId) return;
    const tok = getAccessToken();
    fetch("/api/manage-habits", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ action, userId, key, label, icon, is_negative: isNegative }),
    }).catch(() => {});
  };

  const saveHabit = ({ name, icon, isNegative }: { name: string; icon: string; isNegative: boolean }) => {
    const existing = habitDialog.habit;

    if (existing) {
      // Keep the key stable so days already recorded still point at this habit
      setHabitDefs(prev =>
        prev.map(h => (h.key === existing.key ? { ...h, label: name, icon, is_negative: isNegative } : h))
      );
      persistHabit("update", existing.key, name, icon, isNegative);
      notifyDataChanged("habits");
      return;
    }

    const key = name.toLowerCase().replace(/\s+/g, "_");
    const newHabit: HabitDef = { key, label: name, icon, category: "vlastní", color: "#6366f1", is_negative: isNegative, source: "custom" };
    setHabitDefs(prev => [...prev, newHabit]);
    setData(d => ({ ...d, habits: { ...d.habits, [key]: false } }));
    persistHabit("add", key, name, icon, isNegative);
    notifyDataChanged("habits");
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
    notifyDataChanged("habits");
  };

  // Draft autosave: local only. There is deliberately no server write on
  // `beforeunload`; closing the tab must never race the explicit save button.
  useEffect(() => {
    if (saved || loading || loadError) return;
    const timer = setTimeout(() => {
      const ok = writeDraft(localStorage, currentDate, data);
      setDraftWarning(!ok);
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, saved, loading, loadError, currentDate]);

  useEffect(() => {
    if (saveError) saveErrorRef.current?.focus();
  }, [saveError]);

  const fetchAIReflection = async (entryData: CheckInData, requestDate: string) => {
    if (aiInFlight.current || loadError) return;
    aiInFlight.current = true;
    setAiLoading(true);
    setAiError(null);
    try {
      const session = readStoredSession();
      const userName =
        session?.user?.user_metadata?.full_name || session?.user?.email || "";

      const resp = await fetch("/api/ai/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          user_id: userId || session?.user?.id || "",
          date: requestDate,
          lang,
          userName,
          mood: entryData.mood,
          mood_emoji: entryData.moodEmoji,
          sleep_quality: entryData.sleepQuality,
          stress: entryData.stress,
          activities: entryData.activities,
          habits: entryData.habits,
          gratitude: filteredGratitude(entryData.gratitude),
          note: entryData.note,
          weather: entryData.weather,
          scale_values: positiveScaleValues(entryData.scaleValues),
          ...(entryData.phoneScreenTime != null
            ? { phone_screen_time: entryData.phoneScreenTime }
            : {}),
        }),
      });

      if (!resp.ok) {
        setAiError(aiFailedError(resp.status).code);
        return;
      }

      const json = await resp.json().catch(() => null);
      const text =
        typeof json?.reflection === "string" ? json.reflection.trim() : "";
      if (!text) {
        setAiError(aiEmptyError().code);
        return;
      }
      if (requestDate !== dateRef.current) return;

      setAiReflection(text);
      try {
        // Partial patch only: resending the form here used to race a real save
        // and could overwrite newer field values with stale ones.
        await patchEntry({ date: requestDate, ai_reflection: text });
      } catch {
        setAiError(aiPersistError().code);
      }
    } catch (error) {
      setAiError(aiNetworkError(error).code);
    } finally {
      aiInFlight.current = false;
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (loadError) return;
    setSaveError(null);
    const saveDate = currentDate;
    const payload = buildCheckInPayload(data, saveDate, {
      clearPhoto: photoCleared && !data.photoPath,
    });

    setSaving(true);
    try {
      const result = await saveCheckIn({
        gate: {
          loadFailed: Boolean(loadError),
          photoUploading,
          hasContent: hasContent(data),
        },
        inFlight: saveInFlight,
        payload,
        post: saveEntry,
      });

      if (result.status === "failed") {
        setSaveError(result.error);
        return;
      }
      if (result.status !== "saved") return;
      if (saveDate !== dateRef.current) return;

      // Use the server row, not the local draft: it carries the normalised
      // photo URL, weather keys and read-only phone/AI fields.
      const savedData = fromEntry(
        result.entry as unknown as Record<string, unknown>
      );
      setData(savedData);
      setSaved(true);
      setEditing(false);
      setPhotoCleared(false);
      setAiReflection(savedData.aiReflection ?? null);
      clearDraft(localStorage, saveDate);
      notifyDataChanged("entries");
      onSaveDone();
      void fetchAIReflection(savedData, saveDate);
      checkAndUnlockAchievements({
        mood: savedData.mood,
        hasPhoto: Boolean(savedData.photoPath),
        hasScale: Object.values(savedData.scaleValues || {}).some(v => v > 0),
      }).then(unlocked => {
        if (unlocked.length > 0) console.log("🏆 Unlocked:", unlocked);
      }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const toggleActivity = (label: string) => {
    setData(d => ({
      ...d,
      activities: d.activities.includes(label) ? d.activities.filter(a => a !== label) : [...d.activities, label],
    }));
  };

  const toggleWeather = (key: string) => {
    setData(d => ({
      ...d,
      weather: d.weather.includes(key)
        ? d.weather.filter(value => value !== key)
        : [...d.weather, key],
    }));
  };

  const navigateDate = (offset: number) => {
    if (saving || photoUploading) return;
    const next = shiftDateKey(currentDate, offset);
    if (next > today) return;
    setCurrentDate(next);
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-white/40">{t("common.loading")}</div>;
  }

  // A failed read must never fall through to an editable empty form: saving it
  // would overwrite the stored day. Retry is the only action until it succeeds.
  if (loadError) {
    return (
      <div className="px-4 py-10">
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-center"
        >
          <p className="text-sm text-red-200">{t(loadError.code)}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            className="mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
          >
            {t("checkin.error_retry")}
          </button>
        </div>
      </div>
    );
  }

  // ── COMPLETED CARD VIEW ──
  if (saved && !editing) {
    return (
      <div className="pb-24">
        {/* Date nav */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/5 bg-ink/85 px-4 py-3 backdrop-blur-xl">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors shrink-0">←</button>
          )}
          <div className="flex items-center justify-center gap-4 flex-1">
          <button onClick={() => navigateDate(-1)} disabled={saving || photoUploading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors">◀</button>
          <button
            onClick={() => setCurrentDate(today)}
            className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${
              currentDate === today ? "bg-indigo-500/20 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {currentDate === today ? t("checkin.today") : new Date(currentDate).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", { day: "numeric", month: "short" })}
          </button>
          <button
            onClick={() => navigateDate(1)}
            disabled={currentDate === today}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors"
          >▶</button>
          </div>
        </div>
        {aiError && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {t(aiError)}
          </div>
        )}
        <CompletedCard
          data={data}
          goals={goals}
          aiReflection={aiReflection}
          onEdit={() => setEditing(true)}
          onPhotoClick={(url) => setViewingPhoto(url)}
          dateStr={currentDate}
          habitDefs={habitDefs}
        />
        {aiLoading && (
          <div className="text-center text-white/20 text-sm py-4 animate-pulse">{t("checkin.ai_thinking")}</div>
        )}
        {viewingPhoto && (
          <PhotoViewer
            src={viewingPhoto}
            alt={t("photo.label")}
            onClose={() => setViewingPhoto(null)}
          />
        )}
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className="pb-40">
      {/* Header with date nav */}
      <div className="sticky top-0 z-10 flex items-center justify-center gap-4 border-b border-white/5 bg-ink/85 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigateDate(-1)} disabled={saving || photoUploading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors">◀</button>
        <div className="text-center">
          <span className={`text-sm font-medium ${currentDate === today ? "text-white" : "text-white/40"}`}>
            {currentDate === today ? t("checkin.today") : new Date(currentDate).toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", { day: "numeric", month: "long" })}
          </span>
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={currentDate === today || saving || photoUploading}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/60 transition-colors"
        >▶</button>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {saveError && (
          <div
            ref={saveErrorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 outline-none"
          >
            {t(saveError.code)}
          </div>
        )}
        {aiError && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {t(aiError)}
          </div>
        )}
        {draftWarning && (
          <div role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {t("checkin.error_draft_storage")}
          </div>
        )}
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
                <span className="text-[10px] text-white/50">{t(`mood.mood_${m.value}`)}</span>
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
                <span className="text-[10px] text-white/40">{t(`sleep.sleep_${s.value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── ACTIVITIES ── */}
        <div className="space-y-1">
          {groupActivities(activityDefs, k => t("categoryGroups." + k)).map(cat => (
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
                      <span className="text-[10px] text-white/50 leading-tight text-center">{displayLabel(a)}</span>
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
            {t("activities.add_custom")}
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
              return (
                <div key={h.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.icon}</span>
                    <span className="text-sm text-white/80">{displayLabel(h)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                      isOn
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : "text-white/25 border-white/10"
                    }`}>
                      {isOn ? t("habits.done_badge") : t("habits.not_today")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editHabit(h)}
                      title={t("habits.edit_tooltip")}
                      aria-label={t("habits.edit_tooltip")}
                      className="w-8 h-8 rounded-lg text-white/25 hover:text-indigo-300 hover:bg-white/10 text-sm transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setData(d => ({ ...d, habits: { ...d.habits, [h.key]: !isOn } }))}
                      className={`w-12 h-7 rounded-full relative transition-colors ${isOn ? "bg-emerald-500/60" : "bg-white/10"}`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                    </button>
                  </div>
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
              {t("habits.add_custom")}
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
                {t("activities.activities_summary", { count: activityDefs.length, categories: groupActivities(activityDefs, k => "").length })}
              </p>
              
              {/* Activity list with remove buttons */}
              <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
                {groupActivities(activityDefs, k => t("categoryGroups." + k)).map(cat => (
                  <div key={cat.title}>
                    <p className="text-[10px] text-white/20 uppercase tracking-wider px-1 py-1">{cat.title}</p>
                    {cat.items.map(a => (
                      <div key={a.key} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{a.icon}</span>
                          <span className="text-white/60">{displayLabel(a)}</span>
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
                {t("activities.add_custom")}
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
                        <span>{displayLabel(a)}</span>
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
                        <span className="text-white/70">{displayLabel(h)}</span>
                        <span className="text-[10px] text-white/25">
                          {h.is_negative ? t("habits.negative_badge") : t("habits.positive_badge")}
                          {h.source === "default" ? t("habits.default_badge") : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => editHabit(h)}
                          title={t("habits.edit_tooltip")}
                          aria-label={t("habits.edit_tooltip")}
                          className="text-indigo-400/60 hover:text-indigo-300 text-xs px-2 py-0.5 rounded hover:bg-indigo-500/10 transition-colors"
                        >
                          ✏️ {t("common.edit")}
                        </button>
                        <button
                          onClick={() => removeHabit(h.key)}
                          className="text-red-400/50 hover:text-red-400 text-xs px-2 py-0.5"
                        >
                          {t("habits.remove_btn")}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addCustomHabit}
                className="w-full py-2 text-xs text-indigo-400/60 hover:text-indigo-400 border border-dashed border-indigo-400/20 rounded-lg transition-colors"
              >
                {t("habits.add_habit")}
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
                      <span className="text-sm text-white/80 block">{displayGoalName(g)}</span>
                      {streak > 0 && <span className="text-[10px] text-indigo-400">{t("goals.streak", { streak })}</span>}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => editGoal(g)}
                      title={t("goals.edit_btn")}
                      aria-label={t("goals.edit_btn")}
                      className="w-8 h-8 rounded-lg text-white/30 hover:text-indigo-300 hover:bg-white/10 text-sm transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeGoal(g)}
                      title={t("common.remove")}
                      aria-label={t("common.remove")}
                      className="w-8 h-8 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
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
                <span className="text-[9px] text-white/40">{t(STRESS_LABELS[s.value])}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SCALES ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-sm font-medium text-white/80">{t("scales.title")}</span>
          </div>
          {scales.length > 0 ? (
            <div className="space-y-1">
              {scales.map(scale => (
                <ScaleSlider
                  key={scale.id}
                  scale={scale}
                  value={data.scaleValues[scale.id] || 0}
                  onChange={(value) => setData(d => ({
                    ...d,
                    scaleValues: { ...d.scaleValues, [scale.id]: value },
                  }))}
                />
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-xs italic py-2">{t("scales.no_scales")}</p>
          )}
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

        {/* ── WEATHER ── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="text-sm font-medium text-white/80">{t("checkin.weather_title")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {WEATHER_KEYS.map(key => {
              const selected = data.weather.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleWeather(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    selected
                      ? "border-indigo-400/60 bg-indigo-400/15 text-white"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {t(`dashboard.weather.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── NOTE ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              <span className="text-sm font-medium text-white/80">{t("checkin.note_title")}</span>
            </div>
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="text-xs text-indigo-400/60 hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              📋 {t("templates.use_template")}
            </button>
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
            currentPhoto={data.photoPath}
            date={currentDate}
            legacyPhoto={data.photoLegacy}
            onUploadingChange={setPhotoUploading}
            onPhotoSelected={url => {
              setPhotoCleared(url === null);
              setData(d => ({
                ...d,
                photoPath: url,
                photoLegacy: url ? false : d.photoLegacy,
              }));
            }}
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
      <Modal
        onClose={() => { setShowAddActivity(false); setActivityError(null); }}
        labelledBy={addActivityTitleId}
        align="center"
        panelClassName="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl"
      >
          {/* Header */}
          <div className="px-5 pt-5 pb-2">
            <h3 id={addActivityTitleId} className="text-base font-semibold text-white">{t("addActivity.title")}</h3>
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
                {CATEGORY_ORDER.map((key) => (
                  <button
                    key={key}
                    onClick={() => setNewItemCategory(key)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      newItemCategory === key
                        ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {t("categoryGroups." + key)}
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
      </Modal>
      )}

      {/* Goal editor — add / edit a goal (name + icon) */}
      {goalDialog.open && (
        <GoalEditorDialog
          goal={goalDialog.goal}
          onClose={() => setGoalDialog({ open: false, goal: null })}
          onSave={saveGoal}
        />
      )}

      {/* Habit editor — add / edit a habit (name + icon + negative flag) */}
      {habitDialog.open && (
        <HabitEditDialog
          habit={habitDialog.habit}
          onClose={() => setHabitDialog({ open: false, habit: null })}
          onSave={saveHabit}
        />
      )}

      {/* Template Picker */}
      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={(content) => {
          // Replace the note content with the template (not append)
          setData(d => ({ ...d, note: content }));
        }}
        currentNote={data.note}
      />

      {/* Bottom area: Save button + Navigation — sits above the TabBar */}
      <div className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-white/5 bg-ink/95 backdrop-blur-xl">
        {/* Save button */}
        <div className="p-3">
          <button
            onClick={handleSave}
            disabled={saving || photoUploading || !hasContent(data)}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {photoUploading
              ? t("checkin.photo_uploading")
              : saving
                ? t("checkin.saving")
                : t("checkin.save_to_vault")}
          </button>
        </div>
      </div>
    </div>
  );
}
