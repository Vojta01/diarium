"use client";

import { useState, useEffect } from "react";
import { fetchDailyEntries, type DailyEntry, MOOD_EMOJIS } from "@/lib/stats";
import { getEntry, getCurrentUser } from "@/lib/supabase/db";
import type { Entry } from "@/lib/supabase/db";
import { Markdown } from "@/components/Markdown";
import { getFeatureFlags } from "@/lib/feature-flags";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface Props {
  onNavigateToCheckIn: (date: string) => void;
  onNavigateToStats: () => void;
}

function formatScreenTime(seconds: number): string {
  if (seconds <= 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function Dashboard({ onNavigateToCheckIn, onNavigateToStats }: Props) {
  const { t, lang } = useTranslation();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const load = async () => {
      try {
        const [data, entry, user] = await Promise.all([
          fetchDailyEntries(),
          getEntry(today),
          getCurrentUser(),
        ]);
        setEntries(data);
        setTodayEntry(entry);
        setUserEmail(user?.email ?? null);
      } catch (e) {
        console.error("Dashboard load error:", e);
      }
      setLoading(false);
    };
    load();
  }, [today]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  const flags = getFeatureFlags();
  const hasHomeAssistant = flags.homeAssistant;

  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── Last 7 days (for emoji row) ──
  const last7Days: { date: string; mood?: number; label: string; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const entry = entries.find((e) => e.date === key);
    const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
    last7Days.push({
      date: key,
      mood: entry?.mood,
      label: i === 0 ? t("dashboard.today_label") : t(`dashboard.day_labels.${dayKey}`),
      isToday: i === 0,
    });
  }

  // ── Streak ──
  // Count consecutive days backwards. If today has no entry yet, start from yesterday.
  let streak = 0;
  const checkDate = new Date(today);
  if (!entries.find(e => e.date === today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  const streakDate = new Date(checkDate);
  while (true) {
    const key = streakDate.toISOString().split("T")[0];
    if (entries.find((e) => e.date === key)) {
      streak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else break;
  }

  // ── Today's data ──
  const screenTimeToday = todayEntry?.phone_screen_time ?? 0;
  const activitiesCount = todayEntry?.activities?.length ?? 0;
  const aiReflection = todayEntry?.ai_reflection ?? null;
  const sleepQuality = todayEntry?.sleep_quality;
  const totalEntries = entries.length;

  // ── Week stats (computed even before check-in) ──
  const weekEntriesWithMood = last7Days.filter(d => d.mood);
  const weekAvgMood = weekEntriesWithMood.length > 0
    ? (weekEntriesWithMood.reduce((s, d) => s + (d.mood || 0), 0) / weekEntriesWithMood.length).toFixed(1)
    : null;
  const weekEntryCount = weekEntriesWithMood.length;

  // ── Yesterday ──
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split("T")[0];
  const yesterdayEntry = entries.find(e => e.date === yesterdayKey);

  // ── This month ──
  const thisMonth = today.substring(0, 7);
  const entriesThisMonth = entries.filter((e) => e.date.startsWith(thisMonth)).length;

  // ── Gratitude ──
  const gratitudeEntry = [...entries].reverse().find(
    (e) => e.gratitude.length > 0
  );

  return (
    <div className="min-h-screen p-4 pt-8 pb-24">
      {/* Header */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <p className="text-white/40 text-sm mt-1">{t("dashboard.subtitle")}</p>
        <div className="flex items-center justify-center mt-2">
          <LanguageSwitcher />
        </div>
      </header>

      {/* ── Today Overview ── */}
      <div className="glass-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">{t("dashboard.today")}</h2>
          <span className="text-white/40 text-xs">{dateStr}</span>
        </div>

        {todayEntry ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{todayEntry.mood_emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-lg">
                  {t(`mood.mood_${todayEntry.mood}`)}
                </div>
                {todayEntry.note && (
                  <p className="text-white/50 text-sm mt-1 line-clamp-2">
                    {todayEntry.note}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => onNavigateToCheckIn(today)}
              className="w-full mt-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                         text-white/50 hover:text-white hover:bg-white/10
                         transition-colors text-sm font-medium cursor-pointer"
            >
              {t("dashboard.edit_today")}
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-white/40 text-sm mb-3">
              {t("dashboard.no_checkin_today")}
            </p>
            <button
              onClick={() => onNavigateToCheckIn(today)}
              className="w-full py-3 rounded-2xl font-semibold text-lg
                         bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600
                         text-white shadow-lg shadow-indigo-500/30
                         transition-all duration-200 active:scale-[0.97]
                         cursor-pointer flex items-center justify-center gap-2"
            >
              {t("dashboard.checkin_button")}
            </button>
          </div>
        )}
      </div>

      {/* ── Mood — Last 7 Days (Clickable Emoji Row) ── */}
      <div className="glass-card mb-4">
        <h3 className="text-sm font-medium text-white/50 mb-3">
          {t("dashboard.mood_last_7")}
        </h3>
        <div className="flex justify-between items-end gap-1">
          {last7Days.map((day) => (
            <button
              key={day.date}
              onClick={() => onNavigateToCheckIn(day.date)}
              className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer
                         hover:bg-white/5 rounded-lg py-1 transition-colors
                         focus:outline-none"
              title={
                day.mood
                  ? t("dashboard.tooltip_mood", { mood: t(`mood.mood_${day.mood}`) })
                  : t("dashboard.tooltip_no_entry")
              }
            >
              <span
                className={`text-2xl select-none transition-transform ${
                  day.mood
                    ? day.isToday
                      ? "scale-125 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      : "hover:scale-110"
                    : "opacity-15 grayscale hover:opacity-30"
                }`}
              >
                {day.mood ? MOOD_EMOJIS[day.mood] : "⚪"}
              </span>
              <span
                className={`text-[10px] ${
                  day.isToday ? "text-indigo-300 font-medium" : "text-white/30"
                }`}
              >
                {day.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Overview ── */}
      <div className="glass-card mb-4">
        <h3 className="text-sm font-medium text-white/50 mb-3">
          {t("dashboard.quick_overview")}
        </h3>

        {/* Main stats row */}
        {hasHomeAssistant ? (
          todayEntry ? (
            /* Has today's entry — show HA-specific data */
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  {streak > 0 ? `🔥${streak}` : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.days_streak")}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  📱{formatScreenTime(screenTimeToday)}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.screen_time")}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  {todayEntry?.phone_unlocks ? `🔓${todayEntry.phone_unlocks}` : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.unlocks")}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  🎯{activitiesCount > 0 ? activitiesCount : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.activities_count")}</div>
              </div>
            </div>
          ) : (
            /* No entry yet — show general stats like everyone else */
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  {streak > 0 ? `🔥${streak}` : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.days_streak")}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  {weekAvgMood ? `📊${weekAvgMood}` : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.mood_this_week")}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-0.5">
                  {yesterdayEntry?.moodEmoji
                    ? `${yesterdayEntry.moodEmoji}`
                    : "—"}
                </div>
                <div className="text-[10px] text-white/30">{t("dashboard.yesterday_mood")}</div>
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-0.5">
                {streak > 0 ? `🔥${streak}` : "—"}
              </div>
              <div className="text-[10px] text-white/30">{t("dashboard.days_streak")}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-0.5">
                {weekAvgMood ? `📊${weekAvgMood}` : "—"}
              </div>
              <div className="text-[10px] text-white/30">
                {t("dashboard.mood_this_week")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-0.5">
                {yesterdayEntry?.moodEmoji
                  ? `${yesterdayEntry.moodEmoji}`
                  : "—"}
              </div>
              <div className="text-[10px] text-white/30">{t("dashboard.yesterday_mood")}</div>
            </div>
          </div>
        )}

        {/* Secondary stats row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
          <div className="text-center">
            <div className="text-sm font-semibold text-white mb-0.5">
              {weekEntryCount > 0 ? `${weekEntryCount}/7` : "—"}
            </div>
            <div className="text-[10px] text-white/30">{t("dashboard.days_this_week")}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-white mb-0.5">
              {sleepQuality ? `😴${sleepQuality}/3` : "—"}
            </div>
            <div className="text-[10px] text-white/30">{t("dashboard.sleep_today")}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-white mb-0.5">
              📅{entriesThisMonth}
            </div>
            <div className="text-[10px] text-white/30">{t("dashboard.this_month")}</div>
          </div>
        </div>
      </div>

      {/* ── Today's AI Reflection ── */}
      {aiReflection && (
        <div className="glass-card mb-4 border-indigo-400/10 bg-indigo-500/5">
          <h3 className="text-sm font-medium text-indigo-300 mb-2">
            {t("dashboard.ai_reflection")}
          </h3>
          <Markdown content={aiReflection} />
        </div>
      )}

      {/* ── Last Gratitude Items ── */}
      {gratitudeEntry && gratitudeEntry.gratitude.length > 0 && (
        <div className="glass-card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/50">
              {t("dashboard.last_gratitude")}
            </h3>
            <span className="text-[11px] text-white/20">
              {new Date(gratitudeEntry.date + "T00:00:00").toLocaleDateString(
                lang === "cs" ? "cs-CZ" : "en-US",
                { day: "numeric", month: "short" }
              )}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {gratitudeEntry.gratitude.slice(0, 3).map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-white/60 text-sm"
              >
                <span className="text-indigo-400 mt-0.5 shrink-0">✨</span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
          {gratitudeEntry.moodEmoji && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-lg">{gratitudeEntry.moodEmoji}</span>
              <span className="text-[11px] text-white/20">{t("dashboard.mood_that_day")}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Entry Preview (fallback when no gratitude) ── */}
      {!gratitudeEntry && (
        (() => {
          const recentEntry = [...entries].reverse().find(
            (e) => e.date !== today && e.note.trim().length > 0
          );
          if (!recentEntry) return null;
          return (
            <div className="glass-card mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white/50">
                  {t("dashboard.last_entry")}
                </h3>
                <span className="text-[11px] text-white/20">
                  {new Date(recentEntry.date + "T00:00:00").toLocaleDateString(
                    lang === "cs" ? "cs-CZ" : "en-US",
                    { day: "numeric", month: "short" }
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2">
                {recentEntry.moodEmoji && (
                  <span className="text-xl">{recentEntry.moodEmoji}</span>
                )}
                <p className="text-white/50 text-sm leading-relaxed line-clamp-3 flex-1">
                  {recentEntry.note}
                </p>
              </div>
              {recentEntry.activities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recentEntry.activities.slice(0, 4).map((a) => (
                    <span
                      key={a}
                      className="text-[11px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full"
                    >
                      {a}
                    </span>
                  ))}
                  {recentEntry.activities.length > 4 && (
                    <span className="text-[11px] text-white/20">
                      +{recentEntry.activities.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
