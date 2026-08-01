"use client";

import { useState, useEffect } from "react";
import { fetchDailyEntries, type DailyEntry, MOOD_COLORS, MOOD_EMOJIS } from "@/lib/stats";
import { getScales, getScaleDistribution, type Scale } from "@/lib/scales";
import { useTranslation } from "@/lib/i18n";

export function AdvancedStats() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [scaleDistributions, setScaleDistributions] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);

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

      // Load scale distributions
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

  // Mood distribution
  const moodCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  last30.forEach(e => { if (e.mood >= 1 && e.mood <= 5) moodCounts[e.mood]++; });
  const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0);

  // Activity correlation
  const activityStats: Record<string, { count: number; totalMood: number }> = {};
  last30.forEach(e => {
    e.activities?.forEach(a => {
      if (!activityStats[a]) activityStats[a] = { count: 0, totalMood: 0 };
      activityStats[a].count++;
      activityStats[a].totalMood += e.mood;
    });
  });
  const activityCorrelations = Object.entries(activityStats)
    .map(([name, stats]) => ({
      name,
      avgMood: stats.totalMood / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avgMood - a.avgMood)
    .slice(0, 10);

  // Mood trend with moving average
  const moodTrend = last30.map(e => ({ date: e.date, mood: e.mood }));
  const movingAvg = moodTrend.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = moodTrend.slice(start, i + 1);
    return slice.reduce((sum, e) => sum + e.mood, 0) / slice.length;
  });

  // Best and worst days
  const sortedByMood = [...last30].sort((a, b) => b.mood - a.mood);
  const bestDay = sortedByMood[0];
  const worstDay = sortedByMood[sortedByMood.length - 1];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">📈 {t("advanced_stats.title")}</h2>

      {/* Mood Distribution */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">{t("advanced_stats.mood_distribution")} (30 dní)</h3>
        <div className="flex gap-1 h-20 items-end">
          {[1, 2, 3, 4, 5].map(mood => {
            const count = moodCounts[mood];
            const pct = totalMoods > 0 ? (count / totalMoods) * 100 : 0;
            return (
              <div key={mood} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-white/60">{count}</span>
                <div
                  className="w-full rounded-t transition-all duration-500"
                  style={{
                    height: `${Math.max(4, pct * 0.8)}%`,
                    backgroundColor: MOOD_COLORS[mood],
                  }}
                />
                <span className="text-sm">{MOOD_EMOJIS[mood]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Correlation */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">{t("advanced_stats.activity_correlation")}</h3>
        <div className="space-y-1.5">
          {activityCorrelations.map(({ name, avgMood, count }) => {
            const color = avgMood >= 3.5 ? "#22c55e" : avgMood >= 3 ? "#eab308" : "#ef4444";
            const barWidth = Math.max(5, (avgMood / 5) * 100);
            return (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs text-white/70 w-24 truncate">{name}</span>
                <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-white/50 w-12 text-right">{avgMood.toFixed(1)}</span>
                <span className="text-xs text-white/30 w-6 text-right">{count}×</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mood Trends */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">{t("advanced_stats.mood_trends")}</h3>
        <div className="h-32 flex items-end gap-0.5">
          {moodTrend.map((point, i) => {
            const maxMood = 5;
            const moodH = (point.mood / maxMood) * 100;
            const avgH = (movingAvg[i] / maxMood) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                {/* MA line dot */}
                <div className="w-full flex justify-center" style={{ marginBottom: `${avgH - moodH}%` }}>
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: "#6366f1" }}
                  />
                </div>
                {/* Mood bar */}
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(2, moodH * 0.6)}%`,
                    backgroundColor: MOOD_COLORS[point.mood],
                    opacity: 0.7,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-white/30">{moodTrend[0]?.date}</span>
          <span className="text-xs text-indigo-400">━ {t("advanced_stats.moving_average")}</span>
          <span className="text-xs text-white/30">{moodTrend[moodTrend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Scale Distributions */}
      {scales.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-white/60 mb-3">{t("advanced_stats.scale_distribution")}</h3>
          <div className="space-y-3">
            {scales.map(scale => {
              const dist = scaleDistributions[scale.id] || {};
              const maxCount = Math.max(1, ...Object.values(dist));
              return (
                <div key={scale.id}>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Best/Worst Days */}
      <div className="grid grid-cols-2 gap-3">
        {bestDay && (
          <div className="glass-card p-3 border-green-500/20">
            <h3 className="text-xs font-medium text-green-400 mb-1">{t("advanced_stats.best_day")}</h3>
            <div className="text-sm text-white">{bestDay.date}</div>
            <div className="text-lg">{MOOD_EMOJIS[bestDay.mood]}</div>
            <div className="text-xs text-white/40 mt-1">
              {bestDay.activities?.slice(0, 3).join(", ")}
            </div>
          </div>
        )}
        {worstDay && (
          <div className="glass-card p-3 border-red-500/20">
            <h3 className="text-xs font-medium text-red-400 mb-1">{t("advanced_stats.worst_day")}</h3>
            <div className="text-sm text-white">{worstDay.date}</div>
            <div className="text-lg">{MOOD_EMOJIS[worstDay.mood]}</div>
            <div className="text-xs text-white/40 mt-1">
              {worstDay.activities?.slice(0, 3).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
