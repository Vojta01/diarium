"use client";

import { useState, useEffect } from "react";
import { fetchDailyEntries, type DailyEntry, MOOD_COLORS, MOOD_EMOJIS, MOOD_LABELS } from "@/lib/stats";
import { getScales, getScaleDistribution, type Scale } from "@/lib/scales";
import { useTranslation } from "@/lib/i18n";
import { InfoPopover } from "@/components/InfoPopover";

export function AdvancedStats() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [scaleDistributions, setScaleDistributions] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);

  // Selection state — one selected item per section, click again to deselect
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedScale, setSelectedScale] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [entryData, scaleData] = await Promise.all([
        fetchDailyEntries(),
        getScales(),
      ]);
      setEntries(entryData);

      const dists: Record<string, Record<number, number>> = {};
      for (const scale of scaleData) {
        try {
          dists[scale.id] = await getScaleDistribution(scale.id, 30);
        } catch {}
      }
      setScaleDistributions(dists);
      setScales(scaleData);
    } catch (e) {
      console.error("Failed to load advanced stats:", e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="text-white/40 text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const last30 = entries.slice(-30);

  // ── Mood distribution ──
  const moodCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  last30.forEach((e) => { if (e.mood >= 1 && e.mood <= 5) moodCounts[e.mood]++; });
  const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0);

  // ── Activity correlation (with best/worst day per activity) ──
  const activityStats: Record<string, { count: number; totalMood: number; best: DailyEntry | null; worst: DailyEntry | null }> = {};
  last30.forEach((e) => {
    e.activities?.forEach((a) => {
      if (!activityStats[a]) activityStats[a] = { count: 0, totalMood: 0, best: null, worst: null };
      activityStats[a].count++;
      activityStats[a].totalMood += e.mood;
      if (!activityStats[a].best || e.mood > activityStats[a].best.mood) activityStats[a].best = e;
      if (!activityStats[a].worst || e.mood < activityStats[a].worst.mood) activityStats[a].worst = e;
    });
  });
  const activityCorrelations = Object.entries(activityStats)
    .map(([name, stats]) => ({
      name,
      avgMood: stats.totalMood / stats.count,
      count: stats.count,
      best: stats.best,
      worst: stats.worst,
    }))
    .sort((a, b) => b.avgMood - a.avgMood)
    .slice(0, 10);

  // ── Mood trend with moving average ──
  const trendEntries = last30;
  const moodTrend = trendEntries.map((e) => ({ date: e.date, mood: e.mood }));
  const movingAvg = moodTrend.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = moodTrend.slice(start, i + 1);
    return slice.reduce((sum, e) => sum + e.mood, 0) / slice.length;
  });

  // ── Best and worst days ──
  const sortedByMood = [...last30].sort((a, b) => b.mood - a.mood);
  const bestDay = sortedByMood[0];
  const worstDay = sortedByMood[sortedByMood.length - 1];

  const selectedDayEntry = selectedDay !== null ? trendEntries[selectedDay] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">📈 {t("advanced_stats.title")}</h2>
      </div>

      {/* ── Mood Distribution ── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-white/60">{t("advanced_stats.mood_distribution")}</h3>
          <span className="text-xs text-white/30">· 30 dní</span>
          <span className="ml-auto">
            <InfoPopover text={t("advanced_stats.legend_mood")} />
          </span>
        </div>
        <div className="flex gap-1.5 h-28 items-end">
          {[1, 2, 3, 4, 5].map((mood) => {
            const count = moodCounts[mood];
            const pct = totalMoods > 0 ? (count / totalMoods) * 100 : 0;
            const isSelected = selectedMood === mood;
            const isDimmed = selectedMood !== null && !isSelected;
            return (
              <button
                key={mood}
                onClick={() => setSelectedMood(isSelected ? null : mood)}
                className={`flex-1 flex flex-col items-center gap-1.5 transition-all duration-300 ${isDimmed ? "opacity-25" : "opacity-100"}`}
              >
                <span className={`text-xs font-medium transition-colors ${isSelected ? "text-white" : "text-white/50"}`}>{count}</span>
                <div
                  className={`w-full rounded-t transition-all duration-300 ${isSelected ? "ring-2 ring-white/80" : ""}`}
                  style={{
                    height: `${Math.max(4, pct * 0.8)}%`,
                    backgroundColor: MOOD_COLORS[mood],
                    boxShadow: isSelected ? `0 0 18px ${MOOD_COLORS[mood]}99` : undefined,
                  }}
                />
                <span className={`text-base transition-transform duration-300 ${isSelected ? "scale-125" : ""}`}>{MOOD_EMOJIS[mood]}</span>
              </button>
            );
          })}
        </div>
        {selectedMood !== null && (
          <div className="mt-3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 animate-slide-up">
            <span className="mr-1">{MOOD_EMOJIS[selectedMood]}</span>
            <span className="font-medium text-white">{MOOD_LABELS[selectedMood]}</span>
            <span className="text-white/30"> — </span>
            {t("advanced_stats.days", { count: moodCounts[selectedMood] })}
            <span className="text-white/30"> · </span>
            {t("advanced_stats.percent", { pct: totalMoods > 0 ? Math.round((moodCounts[selectedMood] / totalMoods) * 100) : 0 })}
          </div>
        )}
      </div>

      {/* ── Activity Correlation ── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-white/60">{t("advanced_stats.activity_correlation")}</h3>
          <span className="ml-auto">
            <InfoPopover text={t("advanced_stats.legend_activity")} />
          </span>
        </div>
        {activityCorrelations.length === 0 ? (
          <p className="text-xs text-white/30 py-4 text-center">{t("advanced_stats.no_activities")}</p>
        ) : (
          <div className="space-y-1 mt-2">
            {activityCorrelations.map(({ name, avgMood, count, best, worst }) => {
              const color = avgMood >= 3.5 ? "#22c55e" : avgMood >= 3 ? "#eab308" : "#ef4444";
              const barWidth = Math.max(5, (avgMood / 5) * 100);
              const isSelected = selectedActivity === name;
              const isDimmed = selectedActivity !== null && !isSelected;
              return (
                <div key={name}>
                  <button
                    onClick={() => setSelectedActivity(isSelected ? null : name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${isSelected ? "bg-white/10 ring-1 ring-indigo-400/40" : "hover:bg-white/5"} ${isDimmed ? "opacity-25" : ""}`}
                  >
                    <span className="text-xs text-white/70 w-24 truncate text-left">{name}</span>
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs text-white/50 w-12 text-right">{avgMood.toFixed(1)}</span>
                    <span className="text-xs text-white/30 w-6 text-right">{count}×</span>
                  </button>
                  {isSelected && (
                    <div className="ml-2 mt-1 mb-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 animate-slide-up space-y-1">
                      <div>
                        <span className="text-white/40">{t("advanced_stats.avg_mood")}: </span>
                        <span className="font-medium text-white">{avgMood.toFixed(1)}</span>
                        <span className="text-white/30"> · </span>
                        {t("advanced_stats.days", { count })}
                      </div>
                      {best && (
                        <div>
                          <span className="text-emerald-400/70">▲ {t("advanced_stats.best_day_with")}: </span>
                          <span className="text-white/70">{best.date}</span>
                          <span className="ml-1">{MOOD_EMOJIS[best.mood]}</span>
                        </div>
                      )}
                      {worst && (
                        <div>
                          <span className="text-red-400/70">▼ {t("advanced_stats.worst_day_with")}: </span>
                          <span className="text-white/70">{worst.date}</span>
                          <span className="ml-1">{MOOD_EMOJIS[worst.mood]}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Mood Trends ── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-white/60">{t("advanced_stats.mood_trends")}</h3>
          <span className="ml-auto">
            <InfoPopover text={t("advanced_stats.legend_trends")} />
          </span>
        </div>
        <div className="h-32 flex items-end gap-0.5">
          {moodTrend.map((point, i) => {
            const maxMood = 5;
            const moodH = (point.mood / maxMood) * 100;
            const isSelected = selectedDay === i;
            const isDimmed = selectedDay !== null && !isSelected;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : i)}
                title={`${point.date} — ${MOOD_LABELS[point.mood]}`}
                className={`relative flex-1 flex items-end justify-center h-full transition-opacity duration-300 ${isDimmed ? "opacity-25" : "opacity-100"}`}
              >
                {/* 7-day average dot — aligned to the same axis/scale as the bars */}
                <div
                  className="w-full flex justify-center pointer-events-none"
                  style={{
                    position: "absolute",
                    bottom: `${(movingAvg[i] / maxMood) * 60}%`,
                    transform: "translateY(50%)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: "#6366f1", boxShadow: "0 0 0 2px rgba(99,102,241,0.25)" }}
                  />
                </div>
                <div
                  className={`w-full rounded-t transition-all ${isSelected ? "ring-1 ring-white/80" : ""}`}
                  style={{
                    height: `${Math.max(2, moodH * 0.6)}%`,
                    backgroundColor: MOOD_COLORS[point.mood],
                    opacity: isSelected ? 1 : 0.7,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-white/30">{moodTrend[0]?.date}</span>
          <span className="text-xs text-indigo-400">━ {t("advanced_stats.moving_average")}</span>
          <span className="text-xs text-white/30">{moodTrend[moodTrend.length - 1]?.date}</span>
        </div>
        {selectedDayEntry && (
          <div className="mt-3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 animate-slide-up">
            <span className="font-medium text-white">{selectedDayEntry.date}</span>
            <span className="text-white/30"> — </span>
            {MOOD_EMOJIS[selectedDayEntry.mood]} {MOOD_LABELS[selectedDayEntry.mood]}
            {selectedDayEntry.activities && selectedDayEntry.activities.length > 0 && (
              <>
                <span className="text-white/30"> · </span>
                {selectedDayEntry.activities.slice(0, 5).join(", ")}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Scale Distributions ── */}
      {scales.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-white/60">{t("advanced_stats.scale_distribution")}</h3>
            <span className="ml-auto">
              <InfoPopover text={t("advanced_stats.legend_scales")} />
            </span>
          </div>
          <div className="space-y-3">
            {scales.map((scale) => {
              const dist = scaleDistributions[scale.id] || {};
              const maxCount = Math.max(1, ...Object.values(dist));
              const isSelected = selectedScale === scale.id;
              const isDimmed = selectedScale !== null && !isSelected;
              return (
                <button
                  key={scale.id}
                  onClick={() => setSelectedScale(isSelected ? null : scale.id)}
                  className={`w-full text-left rounded-lg transition-all duration-300 ${isSelected ? "bg-white/10 ring-1 ring-indigo-400/40 p-2 -mx-2" : ""} ${isDimmed ? "opacity-25" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{scale.emoji}</span>
                    <span className="text-xs text-white/70">{scale.name}</span>
                  </div>
                  <div className="flex gap-0.5 h-8 items-end">
                    {Array.from({ length: scale.max_value - scale.min_value + 1 }, (_, i) => {
                      const val = scale.min_value + i;
                      const count = dist[val] || 0;
                      return (
                        <div key={val} className="flex-1 flex flex-col items-center gap-0.5 justify-end">
                          <span className="text-[10px] text-white/40">{count || ''}</span>
                          <div
                            className="w-full rounded-t transition-all"
                            style={{
                              height: `${Math.max(4, (count / maxCount) * 100)}%`,
                              backgroundColor: scale.color,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Best/Worst Days ── */}
      <div className="grid grid-cols-2 gap-3">
        {bestDay && (
          <div className="glass-card p-3 border-green-500/20" title={(bestDay.activities || []).join(", ")}>
            <h3 className="text-xs font-medium text-green-400 mb-1">{t("advanced_stats.best_day")}</h3>
            <div className="text-sm text-white">{bestDay.date}</div>
            <div className="text-lg">{MOOD_EMOJIS[bestDay.mood]}</div>
            <div className="text-xs text-white/40 mt-1">{bestDay.activities?.slice(0, 3).join(", ")}</div>
          </div>
        )}
        {worstDay && (
          <div className="glass-card p-3 border-red-500/20" title={(worstDay.activities || []).join(", ")}>
            <h3 className="text-xs font-medium text-red-400 mb-1">{t("advanced_stats.worst_day")}</h3>
            <div className="text-sm text-white">{worstDay.date}</div>
            <div className="text-lg">{MOOD_EMOJIS[worstDay.mood]}</div>
            <div className="text-xs text-white/40 mt-1">{worstDay.activities?.slice(0, 3).join(", ")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
