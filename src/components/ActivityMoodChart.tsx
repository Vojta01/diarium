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
  const trendStats = useMemo((): TrendItem[] => {
    // Overall mood trend
    const sortedEntries = [...entries].filter(e => e.mood > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (sortedEntries.length < 7) return [];

    // Split into halves
    const mid = Math.floor(sortedEntries.length / 2);
    const firstHalf = sortedEntries.slice(0, mid);
    const secondHalf = sortedEntries.slice(mid);
    
    const firstMood = firstHalf.reduce((s, e) => s + e.mood, 0) / firstHalf.length;
    const secondMood = secondHalf.reduce((s, e) => s + e.mood, 0) / secondHalf.length;
    const slope = secondMood - firstMood;
    
    const result: TrendItem[] = [{
      name: "Celková nálada",
      slope: parseFloat(slope.toFixed(2)),
      firstHalfMood: parseFloat(firstMood.toFixed(1)),
      secondHalfMood: parseFloat(secondMood.toFixed(1)),
      count: sortedEntries.length,
      direction: slope > 0.25 ? "📈" : slope < -0.25 ? "📉" : "➡️",
    }];

    // Screen time trend
    const stEntries = sortedEntries.filter(e => e.phone_screen_time != null && e.phone_screen_time > 0);
    if (stEntries.length >= 7) {
      const stMid = Math.floor(stEntries.length / 2);
      const stFirst = stEntries.slice(0, stMid).reduce((s, e) => s + (e.phone_screen_time || 0), 0) / stEntries.slice(0, stMid).length;
      const stSecond = stEntries.slice(stMid).reduce((s, e) => s + (e.phone_screen_time || 0), 0) / stEntries.slice(stMid).length;
      const diffMin = (stSecond - stFirst) / 60;
      result.push({
        name: "Screen time",
        slope: parseFloat(diffMin.toFixed(0)),
        firstHalfMood: parseFloat((stFirst / 3600).toFixed(1)),
        secondHalfMood: parseFloat((stSecond / 3600).toFixed(1)),
        count: stEntries.length,
        direction: diffMin > 15 ? "📈" : diffMin < -15 ? "📉" : "➡️",
      });
    }

    return result;
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
          ["trends", "📊 Trendy"],
        ] as [Tab, string][]).map(([key, label]) => {
          const hasData =
            key === "activities" ? activityStats.length > 0 :
            key === "habits" ? habitStats.length > 0 :
            key === "screentime" ? screenTimeStats.length > 0 :
            key === "unlocks" ? unlocksStats.length > 0 :
            key === "trends" ? trendStats.length > 0 :
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
            <p className="text-white/40 text-xs mb-2">
              Cohenovo d porovnává dny s návykem a bez. Kladné d = s návykem lepší nálada.
            </p>
            <div className="space-y-2">
              {habitStats.map(s => {
                const icon = 
                  s.name === "alkohol" ? "🍺" :
                  s.name === "cviceni" ? "🏋️" :
                  s.name === "meditace" ? "🧘" :
                  s.name === "spanek_7h" ? "😴" :
                  s.name === "venku" ? "🌿" :
                  s.name === "socializace" ? "👥" : "✅";
                const hasEffect = Math.abs(s.cohensD) > 0.3;
                const positive = s.cohensD > 0.1;
                const negative = s.cohensD < -0.1;
                
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
                      <span className="text-white/30 w-8 text-right shrink-0">Ano</span>
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
                      <span className="text-white/30 w-8 text-right shrink-0">Ne</span>
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
                  <span className="text-sm text-white/60">Spearmanova korelace (screen time vs nálada)</span>
                  <span className={`text-sm font-mono ${spearmanScreenTime.significant ? "text-white font-bold" : "text-white/40"}`}>
                    ρ = {spearmanScreenTime.r}
                  </span>
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {spearmanScreenTime.direction} · {spearmanScreenTime.interpretation} korelace · n = {spearmanScreenTime.n}
                </div>
              </div>
            )}

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
        {tab === "trends" && (
          <div>
            <p className="text-white/40 text-xs mb-2">
              Porovnání první a druhé poloviny sledovaného období — trendy v čase.
            </p>
            <div className="space-y-3">
              {trendStats.map(t => {
                const isScreenTime = t.name === "Screen time";
                return (
                  <div key={t.name} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/60">{t.name}</span>
                      <span className="text-lg">{t.direction}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <div className="text-white/30">1. polovina</div>
                        <div className="text-white font-mono">
                          {isScreenTime ? t.firstHalfMood + "h" : t.firstHalfMood.toFixed(1)}
                        </div>
                      </div>
                      <div className="flex-1 h-0.5 bg-white/10 rounded-full relative">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
                          style={{
                            left: "0%",
                            width: "100%",
                            background: t.direction === "📈"
                              ? `linear-gradient(90deg, ${moodColor(t.firstHalfMood)}, ${moodColor(t.secondHalfMood)})`
                              : t.direction === "📉"
                              ? `linear-gradient(90deg, ${moodColor(t.firstHalfMood)}, ${moodColor(t.secondHalfMood)})`
                              : "#ffffff22",
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-white/30">2. polovina</div>
                        <div className="text-white font-mono">
                          {isScreenTime ? t.secondHalfMood + "h" : t.secondHalfMood.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[9px] text-white/25 mt-2">
                      {t.count} dní · změna: {t.slope > 0 ? "+" : ""}{t.slope.toFixed(1)}{isScreenTime ? " min" : ""}
                    </div>
                  </div>
                );
              })}
              {trendStats.length === 0 && (
                <p className="text-white/20 text-xs text-center py-4">Potřebuju alespoň 7 dní dat pro trendy.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
