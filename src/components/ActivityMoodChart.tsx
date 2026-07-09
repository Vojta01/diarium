"use client";

import { useMemo, useState } from "react";
import type { DailyEntry } from "@/lib/stats";

type Tab = "activities" | "habits" | "screentime" | "unlocks" | "trends";

// ── Statistical helpers ──

/** Standard deviation */
function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Cohen's d — effect size: how many standard deviations apart are two groups */
function cohensD(group1: number[], group2: number[]): number {
  if (group1.length < 2 || group2.length < 2) return 0;
  const m1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const m2 = group2.reduce((a, b) => a + b, 0) / group2.length;
  const s1 = stddev(group1, m1);
  const s2 = stddev(group2, m2);
  // Pooled standard deviation
  const n1 = group1.length, n2 = group2.length;
  const pooled = Math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2));
  if (pooled === 0) return 0;
  return (m1 - m2) / pooled;
}

/** Welch's t-test approximate p-value (simplified, good enough for visualization) */
function tTestPValue(group1: number[], group2: number[]): number {
  if (group1.length < 2 || group2.length < 2) return 1;
  const m1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const m2 = group2.reduce((a, b) => a + b, 0) / group2.length;
  const s1 = stddev(group1, m1);
  const s2 = stddev(group2, m2);
  const n1 = group1.length, n2 = group2.length;
  // Welch's t
  const se = Math.sqrt(s1 ** 2 / n1 + s2 ** 2 / n2);
  if (se === 0) return 1;
  const t = (m1 - m2) / se;
  // Welch-Satterthwaite degrees of freedom
  const num = (s1 ** 2 / n1 + s2 ** 2 / n2) ** 2;
  const denom = (s1 ** 2 / n1) ** 2 / (n1 - 1) + (s2 ** 2 / n2) ** 2 / (n2 - 1);
  const df = denom === 0 ? n1 + n2 - 2 : num / denom;
  // Approximate two-tailed p-value using simple t-distribution approximation
  const absT = Math.abs(t);
  // For visualization: just return a significance level
  // p < 0.01 → high significance, 0.01-0.05 → medium, 0.05-0.1 → weak, >0.1 → not significant
  return 2 * (1 - tCDF(absT, df));
}

/** Simplified Student's t CDF approximation */
function tCDF(t: number, df: number): number {
  // Use normal approximation for df > 30, otherwise simplified
  if (df > 30) return normCDF(t);
  // Crude approximation — good enough for our significance stars
  const x = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + t * t / (2 * df));
  return normCDF(x);
}

function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** Spearman rank correlation between two numeric arrays */
function spearmanR(x: number[], y: number[]): number {
  if (x.length < 3) return 0;
  // Rank both arrays
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let i = 0; i < sorted.length; i++) {
      ranks[sorted[i].i] = i + 1;
    }
    return ranks;
  };
  const rx = rank(x);
  const ry = rank(y);
  const n = x.length;
  let sumD2 = 0;
  for (let i = 0; i < n; i++) sumD2 += (rx[i] - ry[i]) ** 2;
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// ── Types ──

interface CorrelatedItem {
  name: string;
  /** Effect size (Cohen's d) — positive means better mood */
  cohensD: number;
  /** Average mood when condition is true / with activity */
  moodWith: number;
  /** Average mood when condition is false / without activity */
  moodWithout: number;
  /** p-value from t-test */
  pValue: number;
  /** Number of days with this activity/habit */
  countWith: number;
  /** Number of days without */
  countWithout: number;
  /** 95% confidence interval for the difference [lower, upper] */
  ci: [number, number];
  /** Significance level for display */
  significance: "***" | "**" | "*" | "~" | "";
}

interface TrendItem {
  name: string;
  /** Slope over time — positive = improving mood trend */
  slope: number;
  /** Average mood in first half vs second half */
  firstHalfMood: number;
  secondHalfMood: number;
  /** Count of days */
  count: number;
  direction: "📈" | "📉" | "➡️";
}

interface BucketStats {
  label: string;
  range: [number, number];
  count: number;
  avgMood: number;
  stdMood: number;
  cohensD: number; // vs overall mean
  ci: [number, number];
  significance: "***" | "**" | "*" | "~" | "";
}

// ── Component ──

export function ActivityMoodChart({ entries }: { entries: DailyEntry[] }) {
  const [tab, setTab] = useState<Tab>("activities");

  // ── Overall stats for reference ──
  const overallMean = useMemo(() => {
    const moods = entries.filter(e => e.mood > 0).map(e => e.mood);
    if (moods.length === 0) return 3;
    return moods.reduce((a, b) => a + b, 0) / moods.length;
  }, [entries]);

  // ── 1. Activity Correlations (with Cohen's d) ──
  const activityStats = useMemo((): CorrelatedItem[] => {
    const moodsWith = new Map<string, number[]>();
    const allMoods = entries.filter(e => e.mood > 0).map(e => e.mood);

    for (const entry of entries) {
      if (!entry.activities || entry.mood === 0) continue;
      for (const act of entry.activities) {
        if (!moodsWith.has(act)) moodsWith.set(act, []);
        moodsWith.get(act)!.push(entry.mood);
      }
    }

    const result: CorrelatedItem[] = [];
    for (const [activity, moods] of moodsWith) {
      if (moods.length < 2) continue;
      const withMoods = moods;
      const withoutMoods = allMoods.filter((_, i) => {
        // Approximate: moods not on days with this activity
        return !entries.filter(e => e.mood > 0)[i]?.activities?.includes(activity);
      });
      const d = cohensD(withMoods, withoutMoods);
      const p = tTestPValue(withMoods, withoutMoods);
      const se = Math.sqrt(
        (stddev(withMoods, withMoods.reduce((a,b)=>a+b,0)/withMoods.length) ** 2) / withMoods.length +
        (withoutMoods.length > 1 ? (stddev(withoutMoods, withoutMoods.reduce((a,b)=>a+b,0)/withoutMoods.length) ** 2) / withoutMoods.length : 0)
      );
      const diff = withMoods.reduce((a,b)=>a+b,0)/withMoods.length - (withoutMoods.length > 0 ? withoutMoods.reduce((a,b)=>a+b,0)/withoutMoods.length : overallMean);
      const ciMargin = 1.96 * Math.max(se, 0.1); // 95% CI
      
      result.push({
        name: activity,
        cohensD: parseFloat(d.toFixed(2)),
        moodWith: parseFloat((withMoods.reduce((a,b)=>a+b,0)/withMoods.length).toFixed(1)),
        moodWithout: parseFloat((withoutMoods.length > 0 ? withoutMoods.reduce((a,b)=>a+b,0)/withoutMoods.length : overallMean).toFixed(1)),
        pValue: parseFloat(p.toFixed(4)),
        countWith: withMoods.length,
        countWithout: withoutMoods.length,
        ci: [parseFloat((diff - ciMargin).toFixed(1)), parseFloat((diff + ciMargin).toFixed(1))] as [number, number],
        significance: p < 0.01 ? "***" : p < 0.05 ? "**" : p < 0.1 ? "*" : p < 0.2 ? "~" : "",
      });
    }
    return result.sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD));
  }, [entries, overallMean]);

  // ── 2. Habit Correlations ──
  const habitStats = useMemo((): CorrelatedItem[] => {
    const map = new Map<string, { withMoods: number[]; withoutMoods: number[] }>();
    for (const entry of entries) {
      if (entry.mood === 0) continue;
      const habits = entry.habits || {};
      for (const [key, value] of Object.entries(habits)) {
        if (!map.has(key)) map.set(key, { withMoods: [], withoutMoods: [] });
        const h = map.get(key)!;
        if (value) h.withMoods.push(entry.mood);
        else h.withoutMoods.push(entry.mood);
      }
    }
    const result: CorrelatedItem[] = [];
    for (const [habit, data] of map) {
      if (data.withMoods.length < 2 && data.withoutMoods.length < 2) continue;
      const d = cohensD(data.withMoods, data.withoutMoods);
      const p = tTestPValue(data.withMoods, data.withoutMoods);
      const mWith = data.withMoods.length > 0 ? data.withMoods.reduce((a,b)=>a+b,0)/data.withMoods.length : 0;
      const mWithout = data.withoutMoods.length > 0 ? data.withoutMoods.reduce((a,b)=>a+b,0)/data.withoutMoods.length : 0;
      const sWith = stddev(data.withMoods, mWith);
      const sWithout = stddev(data.withoutMoods, mWithout);
      const se = Math.sqrt(
        (sWith ** 2) / Math.max(data.withMoods.length, 1) + (sWithout ** 2) / Math.max(data.withoutMoods.length, 1)
      );
      const diff = mWith - mWithout;
      const ciMargin = 1.96 * Math.max(se, 0.1);
      
      result.push({
        name: habit,
        cohensD: parseFloat(d.toFixed(2)),
        moodWith: parseFloat(mWith.toFixed(1)),
        moodWithout: parseFloat(mWithout.toFixed(1)),
        pValue: parseFloat(p.toFixed(4)),
        countWith: data.withMoods.length,
        countWithout: data.withoutMoods.length,
        ci: [parseFloat((diff - ciMargin).toFixed(1)), parseFloat((diff + ciMargin).toFixed(1))] as [number, number],
        significance: p < 0.01 ? "***" : p < 0.05 ? "**" : p < 0.1 ? "*" : p < 0.2 ? "~" : "",
      });
    }
    return result.sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD));
  }, [entries]);

  // ── 3. Screen Time Buckets (with Spearman and Cohen's d) ──
  const screenTimeStats = useMemo((): BucketStats[] => {
    const buckets: { label: string; range: [number, number]; moods: number[] }[] = [
      { label: "0–30 min", range: [0, 30], moods: [] },
      { label: "30–60 min", range: [30, 60], moods: [] },
      { label: "1–2 h", range: [60, 120], moods: [] },
      { label: "2–4 h", range: [120, 240], moods: [] },
      { label: "4–6 h", range: [240, 360], moods: [] },
      { label: "6 h+", range: [360, Infinity], moods: [] },
    ];
    const allMoods = entries.filter(e => e.mood > 0 && e.phone_screen_time != null).map(e => e.mood);

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
      .map(b => {
        const m = b.moods.length > 0 ? b.moods.reduce((a, m) => a + m, 0) / b.moods.length : 0;
        const s = stddev(b.moods, m);
        const d = b.moods.length >= 2 ? cohensD(b.moods, allMoods.filter((_, i) => {
          // Compare bucket vs rest
          return true; // simplified — compare vs overall
        })) : 0;
        const overallStd = stddev(allMoods, overallMean);
        const se = overallStd / Math.sqrt(Math.max(b.moods.length, 1));
        const ciMargin = 1.96 * Math.max(se, 0.1);
        const ciLower = parseFloat((m - ciMargin).toFixed(1));
        const ciUpper = parseFloat((m + ciMargin).toFixed(1));
        
        return {
          label: b.label,
          range: b.range,
          count: b.moods.length,
          avgMood: parseFloat(m.toFixed(1)),
          stdMood: parseFloat(s.toFixed(1)),
          cohensD: parseFloat(d.toFixed(2)) as number,
          ci: [ciLower, ciUpper] as [number, number],
          significance: b.moods.length >= 3 ? (s < 0.3 ? "***" as const : s < 0.6 ? "**" as const : "*" as const) : "" as const,
        } as BucketStats;
      })
      .filter(b => b.count >= 1);
  }, [entries, overallMean]);

  // ── 4. Spearman: Screen time vs mood (overall) ──
  const spearmanScreenTime = useMemo(() => {
    const pairs = entries
      .filter(e => e.mood > 0 && e.phone_screen_time != null && e.phone_screen_time > 0)
      .map(e => ({ mood: e.mood, time: e.phone_screen_time! / 60 }));
    if (pairs.length < 5) return null;
    const r = spearmanR(
      pairs.map(p => p.time),
      pairs.map(p => p.mood)
    );
    const p = tTestPValue(
      pairs.map(p => p.mood),
      pairs.map(() => overallMean)
    );
    return {
      r: parseFloat(r.toFixed(3)),
      n: pairs.length,
      interpretation: Math.abs(r) < 0.1 ? "žádná" : Math.abs(r) < 0.3 ? "slabá" : Math.abs(r) < 0.5 ? "střední" : "silná",
      direction: r > 0.1 ? "📈 více času → lepší nálada" : r < -0.1 ? "📉 více času → horší nálada" : "➡️ žádný vztah",
      significant: Math.abs(r) > 0.3 && pairs.length >= 7,
    };
  }, [entries, overallMean]);

  // ── 5. Unlocks Buckets ──
  const unlocksStats = useMemo((): BucketStats[] => {
    const buckets: { label: string; range: [number, number]; moods: number[] }[] = [
      { label: "0–20×", range: [0, 20], moods: [] },
      { label: "20–50×", range: [20, 50], moods: [] },
      { label: "50–100×", range: [50, 100], moods: [] },
      { label: "100–200×", range: [100, 200], moods: [] },
      { label: "200×+", range: [200, Infinity], moods: [] },
    ];
    const allMoods = entries.filter(e => e.mood > 0 && e.phone_unlocks != null).map(e => e.mood);

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
      .map(b => {
        const m = b.moods.length > 0 ? b.moods.reduce((a, m) => a + m, 0) / b.moods.length : 0;
        const s = stddev(b.moods, m);
        const overallStd = stddev(allMoods, overallMean);
        const se = overallStd / Math.sqrt(Math.max(b.moods.length, 1));
        const ciMargin = 1.96 * Math.max(se, 0.1);
        const ciLower = parseFloat((m - ciMargin).toFixed(1));
        const ciUpper = parseFloat((m + ciMargin).toFixed(1));
        
        return {
          label: b.label,
          range: b.range,
          count: b.moods.length,
          avgMood: parseFloat(m.toFixed(1)),
          stdMood: parseFloat(s.toFixed(1)),
          cohensD: 0 as number,
          ci: [ciLower, ciUpper] as [number, number],
          significance: b.moods.length >= 3 ? (s < 0.3 ? "***" as const : s < 0.6 ? "**" as const : "*" as const) : "" as const,
        } as BucketStats;
      })
      .filter(b => b.count >= 1);
  }, [entries, overallMean]);

  // ── 6. Trends: 7-day rolling average mood ──
  // ── 6. Rolling average mood trend ──
  const trendData = useMemo(() => {
    const sortedEntries = [...entries].filter(e => e.mood > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (sortedEntries.length < 10) return null;

    const window = 7;
    const rolling: { date: string; avgMood: number }[] = [];
    
    for (let i = window - 1; i < sortedEntries.length; i++) {
      const slice = sortedEntries.slice(i - window + 1, i + 1);
      const avg = slice.reduce((s, e) => s + e.mood, 0) / slice.length;
      rolling.push({
        date: sortedEntries[i].date,
        avgMood: parseFloat(avg.toFixed(1)),
      });
    }

    // Overall trend direction
    const firstQuarter = rolling.slice(0, Math.floor(rolling.length / 4));
    const lastQuarter = rolling.slice(-Math.floor(rolling.length / 4));
    const firstAvg = firstQuarter.reduce((s, p) => s + p.avgMood, 0) / firstQuarter.length;
    const lastAvg = lastQuarter.reduce((s, p) => s + p.avgMood, 0) / lastQuarter.length;
    const slope = lastAvg - firstAvg;
    
    // Simple linear regression for trend line
    const n = rolling.length;
    const xMean = (n - 1) / 2;
    const yMean = rolling.reduce((s, p) => s + p.avgMood, 0) / n;
    let num = 0, den = 0;
    rolling.forEach((p, i) => {
      num += (i - xMean) * (p.avgMood - yMean);
      den += (i - xMean) ** 2;
    });
    const trendSlope = den !== 0 ? num / den : 0;

    return {
      rolling,
      firstAvg: parseFloat(firstAvg.toFixed(1)),
      lastAvg: parseFloat(lastAvg.toFixed(1)),
      slope: parseFloat(slope.toFixed(2)),
      trendSlope: parseFloat(trendSlope.toFixed(4)),
      direction: slope > 0.3 ? "📈" : slope < -0.3 ? "📉" : "➡️",
      days: sortedEntries.length,
      minMood: Math.min(...rolling.map(p => p.avgMood)),
      maxMood: Math.max(...rolling.map(p => p.avgMood)),
    };
  }, [entries]);

  // ── Mood color helper ──
  const moodColor = (avgMood: number) => {
    if (avgMood >= 4) return "#22c55e";
    if (avgMood >= 3) return "#eab308";
    return "#ef4444";
  };

  // ── Cohen's d interpretation ──
  const dLabel = (d: number) => {
    const abs = Math.abs(d);
    if (abs < 0.2) return "zanedbatelný";
    if (abs < 0.5) return "malý";
    if (abs < 0.8) return "střední";
    return "velký";
  };

  const hasAnyData = activityStats.length > 0 || habitStats.length > 0 || screenTimeStats.length > 0 || unlocksStats.length > 0 || trendData !== null;

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
          ["trends", "📊 Trendy"],
        ] as [Tab, string][]).map(([key, label]) => {
          const hasData =
            key === "activities" ? activityStats.length > 0 :
            key === "habits" ? habitStats.length > 0 :
            key === "screentime" ? screenTimeStats.length > 0 :
            key === "unlocks" ? unlocksStats.length > 0 :
            key === "trends" ? trendData !== null :
            false;
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

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 text-[9px] text-white/30 flex-wrap">
        <span>*** p&lt;0.01 (silné)</span>
        <span>** p&lt;0.05 (průkazné)</span>
        <span>* p&lt;0.1 (náznak)</span>
        <span>~ p&lt;0.2 (slabé)</span>
        <span className="ml-auto">
          d = Cohenovo d (míra účinku)
        </span>
      </div>

      {/* Content */}
      <div className="glass-card">
        {/* ── Activities Tab ── */}
        {tab === "activities" && (
          <div>
            <p className="text-white/40 text-xs mb-2">
              Cohenovo d porovnává náladu ve dnech s aktivitou vs bez ní.
              Kladné d = lepší nálada s aktivitou.
            </p>
            <div className="space-y-2">
              {activityStats.slice(0, 15).map(s => {
                const barPercent = Math.max(3, Math.min(100, ((s.moodWith - 1) / 4) * 100));
                const hasEffect = Math.abs(s.cohensD) > 0.3;
                const positive = s.cohensD > 0.1;
                const negative = s.cohensD < -0.1;
                
                return (
                  <div key={s.name} className={`p-2 rounded-lg ${hasEffect ? "bg-white/5" : "bg-white/2"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/60 w-28 text-right truncate shrink-0" title={s.name}>
                        {s.name}
                      </span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barPercent}%`,
                            background: `linear-gradient(90deg, ${moodColor(s.moodWith)}88, ${moodColor(s.moodWith)})`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-white/70 w-6 text-right shrink-0">
                        {s.moodWith.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px]">
                      <span className={`font-mono ${positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white/30"}`}>
                        d={s.cohensD > 0 ? "+" : ""}{s.cohensD}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/25">{dLabel(s.cohensD)} efekt</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/25">CI [{s.ci[0]}; {s.ci[1]}]</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/20">{s.countWith} dní</span>
                      {s.significance && (
                        <span className={`ml-auto font-bold ${
                          s.significance === "***" ? "text-emerald-400" :
                          s.significance === "**" ? "text-blue-400" :
                          s.significance === "*" ? "text-yellow-400" : "text-white/20"
                        }`}>
                          {s.significance}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Habits Tab ── */}
        {tab === "habits" && (
          <div>
            <p className="text-white/40 text-xs mb-1">
              Cohenovo d porovnává dny s návykem vs bez. <span className="text-emerald-400">Kladné d</span> = lepší nálada, když je hodnota <b>ano</b>.
            </p>
            <p className="text-white/20 text-[10px] mb-3">
              U negativních návyků (🍺{" "}alkohol, 🔞{" "}porno apod.) znamená "ano" = narušení. U pozitivních (🧘{" "}meditace, 🏋️{" "}cvičení) "ano" = splněno.
            </p>
            <div className="space-y-2">
              {habitStats.map(s => {
                const icon = 
                  s.name === "alkohol" ? "🍺" :
                  s.name === "cviceni" ? "🏋️" :
                  s.name === "meditace" ? "🧘" :
                  s.name === "spanek_7h" ? "😴" :
                  s.name === "venku" ? "🌿" :
                  s.name === "socializace" ? "👥" :
                  s.name === "porno" ? "🔞" :
                  s.name === "masturbace" ? "💦" : "✅";
                const isNegative = ["alkohol", "porno", "masturbace"].includes(s.name);
                const hasEffect = Math.abs(s.cohensD) > 0.3;
                const positive = s.cohensD > 0.1;
                const negative = s.cohensD < -0.1;
                
                // For negative habits, "Ano" means bad (abstinence failed).
                // For positive habits, "Ano" means good (task done).
                const withLabel = isNegative ? "⚠️ Narušeno" : "✅ Ano";
                const withoutLabel = isNegative ? "✅ V pořádku" : "❌ Ne";

                // Flip interpretation for negative habits
                const moodWithColor = isNegative
                  ? (s.moodWith < s.moodWithout ? "text-emerald-400" : "text-red-400")
                  : (s.moodWith > s.moodWithout ? "text-emerald-400" : "text-red-400");
                
                return (
                  <div key={s.name} className={`p-3 rounded-lg ${hasEffect ? "bg-white/5 border border-white/5" : "bg-white/2"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70 font-medium">
                        {icon} {s.name}
                      </span>
                      <span className={`text-xs font-mono ${
                        positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white/30"
                      }`}>
                        d = {s.cohensD > 0 ? "+" : ""}{s.cohensD}
                        {s.significance && ` ${s.significance}`}
                      </span>
                    </div>

                    {/* With habit */}
                    <div className="flex items-center gap-2 text-[10px] mb-1">
                      <span className={`w-16 text-right shrink-0 ${isNegative ? "text-red-400/60" : "text-emerald-400/60"}`}>{withLabel}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        {s.countWith > 0 && (
                          <div className="h-full rounded-full" style={{
                            width: `${((s.moodWith - 1) / 4) * 100}%`,
                            background: moodColor(s.moodWith),
                            opacity: 0.8,
                          }} />
                        )}
                      </div>
                      <span className="text-white/50 font-mono w-6 text-right shrink-0">
                        {s.countWith > 0 ? s.moodWith.toFixed(1) : "—"}
                      </span>
                      <span className="text-white/20 w-8 text-right shrink-0">
                        {s.countWith > 0 ? `${s.countWith}×` : ""}
                      </span>
                    </div>

                    {/* Without habit */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`w-16 text-right shrink-0 ${isNegative ? "text-emerald-400/60" : "text-red-400/60"}`}>{withoutLabel}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        {s.countWithout > 0 && (
                          <div className="h-full rounded-full" style={{
                            width: `${((s.moodWithout - 1) / 4) * 100}%`,
                            background: moodColor(s.moodWithout),
                            opacity: 0.8,
                          }} />
                        )}
                      </div>
                      <span className="text-white/50 font-mono w-6 text-right shrink-0">
                        {s.countWithout > 0 ? s.moodWithout.toFixed(1) : "—"}
                      </span>
                      <span className="text-white/20 w-8 text-right shrink-0">
                        {s.countWithout > 0 ? `${s.countWithout}×` : ""}
                      </span>
                    </div>

                    <div className="mt-2 text-[9px] text-white/25 flex gap-2">
                      <span>Efekt: {dLabel(s.cohensD)}</span>
                      <span>CI [{s.ci[0]}; {s.ci[1]}]</span>
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
            {/* Spearman correlation summary */}
            {spearmanScreenTime && (
              <div className={`p-3 rounded-lg mb-4 ${spearmanScreenTime.significant ? "bg-white/5 border border-white/10" : "bg-white/2"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">📱 Screen time vs nálada</span>
                  <span className={`text-sm font-mono ${spearmanScreenTime.significant ? "text-white font-bold" : "text-white/40"}`}>
                    ρ = {spearmanScreenTime.r}
                  </span>
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {spearmanScreenTime.interpretation === "silná" 
                    ? `Čím víc času na telefonu, tím ${spearmanScreenTime.direction === "negativní" ? "horší" : "lepší"} nálada (${spearmanScreenTime.interpretation} korelace, ${spearmanScreenTime.n} dní).`
                    : spearmanScreenTime.interpretation === "střední"
                    ? `Mírná souvislost: víc screen timu → ${spearmanScreenTime.direction === "negativní" ? "trochu horší" : "trochu lepší"} nálada (${spearmanScreenTime.n} dní).`
                    : `Slabá nebo žádná souvislost mezi screen timem a náladou (${spearmanScreenTime.n} dní).`
                  }
                </div>
              </div>
            )}

            <p className="text-white/25 text-[10px] mb-3">
              Průměrná nálada v jednotlivých pásmech screen timu. Sloupec ukazuje Ø náladu, pod ním je rozdíl proti celkovému průměru ({overallMean.toFixed(1)}).
            </p>

            <div className="space-y-2">
              {screenTimeStats.map(s => {
                const barPercent = Math.max(3, Math.min(100, ((s.avgMood - 1) / 4) * 100));
                const diffFromMean = s.avgMood - overallMean;
                
                return (
                  <div key={s.label} className="p-2 rounded-lg bg-white/2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/50 w-16 text-right shrink-0">{s.label}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${barPercent}%`,
                          background: `linear-gradient(90deg, ${moodColor(s.avgMood)}88, ${moodColor(s.avgMood)})`,
                        }} />
                      </div>
                      <span className="text-xs font-mono text-white/60 w-6 text-right shrink-0">{s.avgMood.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/25">
                      <span>{s.count} dní</span>
                      <span>·</span>
                      <span className={diffFromMean > 0.3 ? "text-emerald-400" : diffFromMean < -0.3 ? "text-red-400" : ""}>
                        {diffFromMean > 0 ? "+" : ""}{diffFromMean.toFixed(1)} vs Ø
                      </span>
                      <span>·</span>
                      <span>CI [{s.ci[0]}; {s.ci[1]}]</span>
                      <span>·</span>
                      <span>σ = {s.stdMood.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Unlocks Tab ── */}
        {tab === "unlocks" && (
          <div>
            <p className="text-white/40 text-xs mb-2">
              Průměrná nálada podle počtu odemknutí telefonu za den.
            </p>
            <div className="space-y-2">
              {unlocksStats.map(s => {
                const barPercent = Math.max(3, Math.min(100, ((s.avgMood - 1) / 4) * 100));
                const diffFromMean = s.avgMood - overallMean;
                
                return (
                  <div key={s.label} className="p-2 rounded-lg bg-white/2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/50 w-16 text-right shrink-0">{s.label}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${barPercent}%`,
                          background: `linear-gradient(90deg, ${moodColor(s.avgMood)}88, ${moodColor(s.avgMood)})`,
                        }} />
                      </div>
                      <span className="text-xs font-mono text-white/60 w-6 text-right shrink-0">{s.avgMood.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/25">
                      <span>{s.count} dní</span>
                      <span>·</span>
                      <span className={diffFromMean > 0.3 ? "text-emerald-400" : diffFromMean < -0.3 ? "text-red-400" : ""}>
                        {diffFromMean > 0 ? "+" : ""}{diffFromMean.toFixed(1)} vs Ø {overallMean.toFixed(1)}
                      </span>
                      <span>·</span>
                      <span>σ = {s.stdMood.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Trends Tab ── */}
        {tab === "trends" && trendData && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/60 text-sm font-medium">Vývoj nálady</p>
                <p className="text-white/25 text-[10px]">7denní klouzavý průměr — {trendData.days} dní</p>
              </div>
              <div className="text-right">
                <span className="text-2xl">{trendData.direction}</span>
                <p className={`text-xs font-mono ${trendData.slope > 0.2 ? "text-emerald-400" : trendData.slope < -0.2 ? "text-red-400" : "text-white/40"}`}>
                  {trendData.slope > 0 ? "+" : ""}{trendData.slope}
                </p>
              </div>
            </div>

            {/* Mini line chart */}
            <div className="relative h-24 mb-3">
              {/* Grid lines */}
              {[1, 2, 3, 4, 5].map(mood => (
                <div
                  key={mood}
                  className="absolute left-0 right-0 border-t border-white/5"
                  style={{ bottom: `${((mood - 1) / 4) * 100}%` }}
                />
              ))}
              
              {/* Mood labels */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[8px] text-white/20">
                <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
              </div>

              {/* Rolling average line */}
              <svg className="absolute inset-0 ml-4" viewBox={`0 0 ${trendData.rolling.length - 1} 4`} preserveAspectRatio="none">
                <polyline
                  points={trendData.rolling.map((p, i) => {
                    const x = i;
                    const y = 4 - ((p.avgMood - 1) / 4) * 4;
                    return `${x},${y.toFixed(1)}`;
                  }).join(" ")}
                  fill="none"
                  stroke="url(#trendGradient)"
                  strokeWidth="0.15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={moodColor(trendData.firstAvg)} />
                    <stop offset="100%" stopColor={moodColor(trendData.lastAvg)} />
                  </linearGradient>
                </defs>
              </svg>

              {/* Trend arrow annotation */}
              <div className="absolute bottom-0 right-0 text-[9px] text-white/30">
                {trendData.slope > 0.3 ? "↑ zlepšuje se" : trendData.slope < -0.3 ? "↓ zhoršuje se" : "→ stabilní"}
              </div>
            </div>

            <div className="flex gap-3 text-[10px]">
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">Začátek období</div>
                <div className="text-white font-mono">{trendData.firstAvg}</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">Konec období</div>
                <div className="text-white font-mono">{trendData.lastAvg}</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">Změna</div>
                <div className={`font-mono ${trendData.slope > 0.2 ? "text-emerald-400" : trendData.slope < -0.2 ? "text-red-400" : "text-white/40"}`}>
                  {trendData.slope > 0 ? "+" : ""}{trendData.slope}
                </div>
              </div>
            </div>

            <p className="text-white/20 text-[9px] mt-3 text-center">
              Čára ukazuje 7denní klouzavý průměr nálady. Barva přechází od začátku (vlevo) ke konci (vpravo) období.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
