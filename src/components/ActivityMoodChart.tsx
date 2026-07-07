"use client";

import { useMemo, useState } from "react";
import type { DailyEntry } from "@/lib/stats";

type Tab = "activities" | "habits" | "screentime" | "unlocks";

interface ActivityStats {
  activity: string;
  count: number;
  avgMood: number;
}

interface HabitStats {
  habit: string;
  whenTrue: { count: number; avgMood: number };
  whenFalse: { count: number; avgMood: number };
}

interface BucketStats {
  label: string;
  range: [number, number]; // [min, max) in minutes (screen time) or count (unlocks)
  count: number;
  avgMood: number;
}

export function ActivityMoodChart({ entries }: { entries: DailyEntry[] }) {
  const [tab, setTab] = useState<Tab>("activities");

  // ── 1. Activity Correlations ──
  const activityStats = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const entry of entries) {
      if (!entry.activities || entry.mood === 0) continue;
      for (const act of entry.activities) {
        if (!map.has(act)) map.set(act, []);
        map.get(act)!.push(entry.mood);
      }
    }
    const result: ActivityStats[] = [];
    for (const [activity, moods] of map) {
      if (moods.length < 2) continue;
      result.push({
        activity,
        count: moods.length,
        avgMood: moods.reduce((a, b) => a + b, 0) / moods.length,
      });
    }
    return result.sort((a, b) => b.avgMood - a.avgMood);
  }, [entries]);

  // ── 2. Habit Correlations ──
  const habitStats = useMemo(() => {
    const map = new Map<string, { trueMoods: number[]; falseMoods: number[] }>();
    for (const entry of entries) {
      if (entry.mood === 0) continue;
      const habits = entry.habits || {};
      for (const [key, value] of Object.entries(habits)) {
        if (!map.has(key)) map.set(key, { trueMoods: [], falseMoods: [] });
        const h = map.get(key)!;
        if (value) {
          h.trueMoods.push(entry.mood);
        } else {
          h.falseMoods.push(entry.mood);
        }
      }
    }
    const result: HabitStats[] = [];
    for (const [habit, data] of map) {
      if (data.trueMoods.length < 2 && data.falseMoods.length < 2) continue;
      result.push({
        habit,
        whenTrue: {
          count: data.trueMoods.length,
          avgMood: data.trueMoods.length > 0 ? data.trueMoods.reduce((a, b) => a + b, 0) / data.trueMoods.length : 0,
        },
        whenFalse: {
          count: data.falseMoods.length,
          avgMood: data.falseMoods.length > 0 ? data.falseMoods.reduce((a, b) => a + b, 0) / data.falseMoods.length : 0,
        },
      });
    }
    // Sort by impact (difference between true and false)
    return result.sort((a, b) => {
      const diffA = Math.abs(a.whenTrue.avgMood - a.whenFalse.avgMood);
      const diffB = Math.abs(b.whenTrue.avgMood - b.whenFalse.avgMood);
      return diffB - diffA;
    });
  }, [entries]);

  // ── 3. Screen Time Correlations ──
  const screenTimeStats = useMemo(() => {
    const buckets: { label: string; range: [number, number]; moods: number[] }[] = [
      { label: "0–30 min", range: [0, 30], moods: [] },
      { label: "30–60 min", range: [30, 60], moods: [] },
      { label: "1–2 h", range: [60, 120], moods: [] },
      { label: "2–4 h", range: [120, 240], moods: [] },
      { label: "4–6 h", range: [240, 360], moods: [] },
      { label: "6 h+", range: [360, Infinity], moods: [] },
    ];

    for (const entry of entries) {
      if (entry.mood === 0 || entry.phone_screen_time == null) continue;
      const minutes = Math.round(entry.phone_screen_time / 60);
      for (const bucket of buckets) {
        if (minutes >= bucket.range[0] && minutes < bucket.range[1]) {
          bucket.moods.push(entry.mood);
          break;
        }
      }
    }

    return buckets
      .map(b => ({
        label: b.label,
        range: b.range,
        count: b.moods.length,
        avgMood: b.moods.length > 0 ? b.moods.reduce((a, m) => a + m, 0) / b.moods.length : 0,
      }))
      .filter(b => b.count >= 2);
  }, [entries]);

  // ── 4. Phone Unlocks Correlations ──
  const unlocksStats = useMemo(() => {
    const buckets: { label: string; range: [number, number]; moods: number[] }[] = [
      { label: "0–20×", range: [0, 20], moods: [] },
      { label: "20–50×", range: [20, 50], moods: [] },
      { label: "50–100×", range: [50, 100], moods: [] },
      { label: "100–200×", range: [100, 200], moods: [] },
      { label: "200×+", range: [200, Infinity], moods: [] },
    ];

    for (const entry of entries) {
      if (entry.mood === 0 || entry.phone_unlocks == null) continue;
      const unlocks = entry.phone_unlocks;
      for (const bucket of buckets) {
        if (unlocks >= bucket.range[0] && unlocks < bucket.range[1]) {
          bucket.moods.push(entry.mood);
          break;
        }
      }
    }

    return buckets
      .map(b => ({
        label: b.label,
        range: b.range,
        count: b.moods.length,
        avgMood: b.moods.length > 0 ? b.moods.reduce((a, m) => a + m, 0) / b.moods.length : 0,
      }))
      .filter(b => b.count >= 2);
  }, [entries]);

  // ── Helper: mood bar color ──
  const moodColor = (avgMood: number) => {
    const hue = (avgMood / 5) * 120;
    return `hsl(${hue}, 60%, 50%)`;
  };

  const hasAnyData = activityStats.length > 0 || habitStats.length > 0 || screenTimeStats.length > 0 || unlocksStats.length > 0;

  if (!hasAnyData) {
    return (
      <div className="text-center text-white/30 py-12 glass-card">
        Zatím není dost dat pro korelace. Vyplňuj Diarium a uvidíš, co ovlivňuje tvou náladu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          ["activities", "🎯 Aktivity"],
          ["habits", "✅ Návyky"],
          ["screentime", "📱 Screen time"],
          ["unlocks", "🔓 Odemknutí"],
        ] as [Tab, string][]).map(([key, label]) => {
          const hasData =
            key === "activities" ? activityStats.length > 0 :
            key === "habits" ? habitStats.length > 0 :
            key === "screentime" ? screenTimeStats.length > 0 :
            unlocksStats.length > 0;

          if (!hasData) return null;

          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === key
                  ? "bg-indigo-500/20 text-white border border-indigo-400/30"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content based on active tab */}
      <div className="glass-card">
        {/* ── Activities Tab ── */}
        {tab === "activities" && (
          <div>
            <p className="text-white/30 text-xs mb-4 text-center">
              Když dělám tuhle aktivitu, moje nálada je průměrně:
            </p>
            <div className="space-y-1.5">
              {activityStats.slice(0, 15).map(s => {
                const barPercent = ((s.avgMood - 1) / 4) * 100;
                return (
                  <div key={s.activity} className="flex items-center gap-2">
                    <span className="text-xs text-white/50 w-24 text-right truncate shrink-0" title={s.activity}>
                      {s.activity}
                    </span>
                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barPercent}%`,
                          background: moodColor(s.avgMood),
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-8 text-right shrink-0">
                      {s.avgMood.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-white/20 w-8 text-right shrink-0">
                      {s.count}×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Habits Tab ── */}
        {tab === "habits" && (
          <div>
            <p className="text-white/30 text-xs mb-4 text-center">
              Jak návyky ovlivňují náladu — porovnání dnů s návykem a bez:
            </p>
            <div className="space-y-3">
              {habitStats.map(s => {
                const trueMood = s.whenTrue.avgMood;
                const falseMood = s.whenFalse.avgMood;
                const diff = trueMood - falseMood;
                const icon = s.habit === "alkohol" ? "🍺" : s.habit === "cviceni" ? "🏋️" : "✅";

                return (
                  <div key={s.habit} className="p-3 rounded-lg bg-white/3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70 font-medium">
                        {icon} {s.habit}
                      </span>
                      <span className={`text-xs font-medium ${diff > 0.3 ? "text-emerald-400" : diff < -0.3 ? "text-red-400" : "text-white/30"}`}>
                        {diff > 0.3 ? `+${diff.toFixed(1)} 😊` : diff < -0.3 ? `${diff.toFixed(1)} 😟` : "≈ stejné"}
                      </span>
                    </div>

                    {/* Bar comparison */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-white/30 w-10 text-right shrink-0">
                        {s.whenTrue.count > 0 ? "Ano" : ""}
                      </span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        {s.whenTrue.count > 0 && (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${((trueMood - 1) / 4) * 100}%`,
                              background: moodColor(trueMood),
                              opacity: 0.7,
                            }}
                          />
                        )}
                      </div>
                      <span className="text-white/40 w-6 text-right shrink-0">
                        {s.whenTrue.count > 0 ? trueMood.toFixed(1) : "—"}
                      </span>
                      <span className="text-white/20 w-6 text-right shrink-0">
                        {s.whenTrue.count > 0 ? `${s.whenTrue.count}×` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] mt-1">
                      <span className="text-white/30 w-10 text-right shrink-0">
                        {s.whenFalse.count > 0 ? "Ne" : ""}
                      </span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        {s.whenFalse.count > 0 && (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${((falseMood - 1) / 4) * 100}%`,
                              background: moodColor(falseMood),
                              opacity: 0.7,
                            }}
                          />
                        )}
                      </div>
                      <span className="text-white/40 w-6 text-right shrink-0">
                        {s.whenFalse.count > 0 ? falseMood.toFixed(1) : "—"}
                      </span>
                      <span className="text-white/20 w-6 text-right shrink-0">
                        {s.whenFalse.count > 0 ? `${s.whenFalse.count}×` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Screen Time Tab ── */}
        {tab === "screentime" && (
          <div>
            <p className="text-white/30 text-xs mb-4 text-center">
              Jak čas na telefonu ovlivňuje náladu:
            </p>
            {screenTimeStats.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">
                Zatím nemáš data o screen timu. Data se načítají z Home Assistanta.
              </p>
            ) : (
              <div className="space-y-1.5">
                {screenTimeStats.map(s => {
                  const barPercent = s.count > 0 ? ((s.avgMood - 1) / 4) * 100 : 0;
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="text-xs text-white/50 w-16 text-right truncate shrink-0">
                        {s.label}
                      </span>
                      <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barPercent}%`,
                            background: moodColor(s.avgMood),
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/60 w-8 text-right shrink-0">
                        {s.avgMood.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-white/20 w-8 text-right shrink-0">
                        {s.count}×
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Unlocks Tab ── */}
        {tab === "unlocks" && (
          <div>
            <p className="text-white/30 text-xs mb-4 text-center">
              Jak počet odemknutí telefonu ovlivňuje náladu:
            </p>
            {unlocksStats.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">
                Zatím nemáš data o odemknutích. Data se načítají z Home Assistanta.
              </p>
            ) : (
              <div className="space-y-1.5">
                {unlocksStats.map(s => {
                  const barPercent = s.count > 0 ? ((s.avgMood - 1) / 4) * 100 : 0;
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="text-xs text-white/50 w-16 text-right truncate shrink-0">
                        {s.label}
                      </span>
                      <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barPercent}%`,
                            background: moodColor(s.avgMood),
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/60 w-8 text-right shrink-0">
                        {s.avgMood.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-white/20 w-8 text-right shrink-0">
                        {s.count}×
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
