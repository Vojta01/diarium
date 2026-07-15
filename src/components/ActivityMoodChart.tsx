"use client";

import { useMemo, useState } from "react";
import type { DailyEntry } from "@/lib/stats";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
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
    return {
      r: parseFloat(r.toFixed(3)),
      n: pairs.length,
      interpretation: Math.abs(r) < 0.1 ? t("interpretation.none") : Math.abs(r) < 0.3 ? t("interpretation.weak") : Math.abs(r) < 0.5 ? t("interpretation.medium") : t("interpretation.strong"),
      direction: r > 0.1 ? t("interpretation.direction_more_time_better") : r < -0.1 ? t("interpretation.direction_more_time_worse") : t("interpretation.direction_no_relation"),
      significant: Math.abs(r) > 0.3 && pairs.length >= 7,
    };
  }, [entries, overallMean, t]);

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

  // ── Mood color helper (smooth gradient across 1-5) ──
  const moodColor = (avgMood: number) => {
    const colors = [
      { mood: 1, hex: { r: 0xef, g: 0x44, b: 0x44 } }, // red
      { mood: 2, hex: { r: 0xf9, g: 0x73, b: 0x16 } }, // orange
      { mood: 3, hex: { r: 0xea, g: 0xb3, b: 0x08 } }, // yellow
      { mood: 4, hex: { r: 0x84, g: 0xcc, b: 0x16 } }, // light green
      { mood: 5, hex: { r: 0x22, g: 0xc5, b: 0x5e } }, // green
    ];
    if (avgMood <= 1) return "#ef4444";
    if (avgMood >= 5) return "#22c55e";
    const idx = Math.min(Math.floor(avgMood - 1), 3);
    const t = avgMood - (idx + 1);
    const lower = colors[idx];
    const upper = colors[idx + 1];
    const r = Math.round(lower.hex.r * (1 - t) + upper.hex.r * t);
    const g = Math.round(lower.hex.g * (1 - t) + upper.hex.g * t);
    const b = Math.round(lower.hex.b * (1 - t) + upper.hex.b * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // ── Plain-language significance badge ──
  const significanceBadge = (sig: string) => {
    switch (sig) {
      case "***": return { text: t("correlation.legend_strong"), className: "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20" };
      case "**": return { text: t("correlation.legend_significant"), className: "text-yellow-300 bg-yellow-500/10 border border-yellow-500/20" };
      case "*": return { text: t("correlation.legend_hint"), className: "text-orange-300 bg-orange-500/10 border border-orange-500/20" };
      case "~": return { text: t("correlation.legend_weak"), className: "text-orange-300 bg-orange-500/10 border border-orange-500/20" };
      default: return { text: t("correlation.legend_hint").replace("p<0.1", "p≥0.2"), className: "text-white/30 bg-white/5 border border-white/10" };
    }
  };

  // ── Plain-language effect size ──
  const effectLabel = (d: number) => {
    const abs = Math.abs(d);
    let size: string;
    if (abs < 0.2) size = t("correlation.effect_negligible");
    else if (abs < 0.5) size = t("correlation.effect_small");
    else if (abs < 0.8) size = t("correlation.effect_medium");
    else size = t("correlation.effect_large");
    return t("correlation.effect_label", { label: size });
  };

  // ── Human-readable mood summary ──
  const moodSummary = (name: string, moodWith: number, moodWithout: number, d: number) => {
    const diff = moodWith - moodWithout;
    if (Math.abs(diff) < 0.15) return `${name}: ${t("correlation.activities_desc").split(".")[0]}`;
    if (diff > 0) return `${name}: ${t("interpretation.direction_more_time_better").replace("📈 ", "")}`;
    return `${name}: ${t("interpretation.direction_more_time_worse").replace("📉 ", "")}`;
  };

  // ── Human-readable habit summary ──
  const habitSummary = (name: string, moodWith: number, moodWithout: number, d: number, isNegative: boolean) => {
    const diff = moodWith - moodWithout;
    if (Math.abs(diff) < 0.15) return `${name}: ${t("correlation.habits_desc").split(".")[0]}`;
    if ((!isNegative && diff > 0) || (isNegative && diff < 0)) {
      return `${name}: ${t("correlation.habits_with_pos")}`;
    }
    return `${name}: ${t("correlation.habits_with_neg")}`;
  };

  // ── 6. Trends: 7-day rolling average mood ──
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
      direction: slope > 0.3 ? t("correlation.trends_improving") : slope < -0.3 ? t("correlation.trends_worsening") : t("correlation.trends_stable"),
      days: sortedEntries.length,
      minMood: Math.min(...rolling.map(p => p.avgMood)),
      maxMood: Math.max(...rolling.map(p => p.avgMood)),
    };
  }, [entries, t]);

  const hasAnyData = activityStats.length > 0 || habitStats.length > 0 || screenTimeStats.length > 0 || unlocksStats.length > 0 || trendData !== null;

  if (!hasAnyData) {
    return (
      <div className="text-center text-white/30 py-12 glass-card">
        {t("correlation.no_data")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {([
          ["activities", t("correlation.tab_activities")],
          ["habits", t("correlation.tab_habits")],
          ["screentime", t("correlation.tab_screentime")],
          ["unlocks", t("correlation.tab_unlocks")],
          ["trends", t("correlation.tab_trends")],
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
      <div className="flex items-center gap-2 text-[9px] flex-wrap">
        <span className="px-1.5 py-0.5 rounded text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">{t("correlation.legend_strong")}</span>
        <span className="px-1.5 py-0.5 rounded text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">{t("correlation.legend_significant")}</span>
        <span className="px-1.5 py-0.5 rounded text-orange-300 bg-orange-500/10 border border-orange-500/20">{t("correlation.legend_hint")}</span>
        <span className="px-1.5 py-0.5 rounded text-white/30 bg-white/5 border border-white/10">{t("correlation.legend_weak")}</span>
        <span className="ml-auto text-white/25">
          {t("correlation.activities_desc").split(".")[0]}
        </span>
      </div>

      {/* Content */}
      <div className="glass-card">
        {/* ── Activities Tab ── */}
        {tab === "activities" && (
          <div>
            <p className="text-white/30 text-[10px] mb-3 leading-relaxed">
              {t("correlation.activities_desc")}
            </p>
            <div className="space-y-2">
              {activityStats.slice(0, 15).map(s => {
                const barPercent = Math.max(3, Math.min(100, ((s.moodWith - 1) / 4) * 100));
                const hasEffect = Math.abs(s.cohensD) > 0.3;
                const positive = s.cohensD > 0.1;
                const negative = s.cohensD < -0.1;
                const badge = significanceBadge(s.significance);
                
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
                    <div className="flex items-center gap-1 text-[9px] flex-wrap">
                      <span className={`font-mono ${positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white/30"}`}>
                        {s.cohensD > 0 ? "+" : ""}{s.cohensD}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/25">{effectLabel(s.cohensD)}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/25">{t("correlation.diff_vs_mean", { diff: `+${(s.moodWith - s.moodWithout).toFixed(1)}` })}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/20">{t("correlation.days_count", { count: s.countWith })}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[8px] ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    {/* Human-readable summary */}
                    <div className="mt-1 text-[9px] text-white/40 italic">
                      {moodSummary(s.name, s.moodWith, s.moodWithout, s.cohensD)}
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
            <p className="text-white/30 text-[10px] mb-1 leading-relaxed">
              {t("correlation.habits_desc")}
            </p>
            <p className="text-white/20 text-[10px] mb-3">
              {t("correlation.habits_desc_neg")}
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
                const badge = significanceBadge(s.significance);

                // For negative habits, "Ano" means bad (abstinence failed).
                // For positive habits, "Ano" means good (task done).
                const withLabel = isNegative ? t("correlation.habits_with_neg") : t("correlation.habits_with_pos");
                const withoutLabel = isNegative ? t("correlation.habits_without_neg") : t("correlation.habits_without_pos");

                return (
                  <div key={s.name} className={`p-3 rounded-lg ${hasEffect ? "bg-white/5 border border-white/5" : "bg-white/2"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70 font-medium">
                        {icon} {s.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${badge.className}`}>
                        {badge.text}
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

                    <div className="mt-1 text-[9px] text-white/25 flex gap-2">
                      <span>{t("correlation.effect_label", { label: effectLabel(s.cohensD) })}</span>
                      <span>·</span>
                      <span>{t("correlation.ci", { low: s.ci[0].toFixed(1), high: s.ci[1].toFixed(1) })}</span>
                    </div>
                    {/* Human-readable summary */}
                    <div className="mt-1 text-[9px] text-white/40 italic">
                      {habitSummary(s.name, s.moodWith, s.moodWithout, s.cohensD, isNegative)}
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
                  <span className="text-sm text-white/60">{t("correlation.screentime_title")}</span>
                  <span className={`text-sm font-mono ${spearmanScreenTime.significant ? "text-white font-bold" : "text-white/40"}`}>
                    ρ = {spearmanScreenTime.r}
                  </span>
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {spearmanScreenTime.interpretation === t("interpretation.strong")
                    ? t("correlation.screentime_strong", { direction: spearmanScreenTime.direction.includes("worse") || spearmanScreenTime.direction.includes("horší") ? t("interpretation.worse") : t("interpretation.better"), interpretation: spearmanScreenTime.interpretation, n: spearmanScreenTime.n })
                    : spearmanScreenTime.interpretation === t("interpretation.medium")
                    ? t("correlation.screentime_medium", { direction: spearmanScreenTime.direction.includes("worse") || spearmanScreenTime.direction.includes("horší") ? t("interpretation.worse") : t("interpretation.better"), n: spearmanScreenTime.n })
                    : t("correlation.screentime_weak", { n: spearmanScreenTime.n })
                  }
                </div>
              </div>
            )}

            <p className="text-white/25 text-[10px] mb-3">
              {t("correlation.screentime_desc", { mean: overallMean.toFixed(1) })}
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
                      <span>{t("correlation.days_count", { count: s.count })}</span>
                      <span>·</span>
                      <span className={diffFromMean > 0.3 ? "text-emerald-400" : diffFromMean < -0.3 ? "text-red-400" : ""}>
                        {t("correlation.diff_vs_mean", { diff: `${diffFromMean > 0 ? "+" : ""}${diffFromMean.toFixed(1)}` })}
                      </span>
                      <span>·</span>
                      <span>{t("correlation.ci", { low: s.ci[0].toFixed(1), high: s.ci[1].toFixed(1) })}</span>
                      <span>·</span>
                      <span>{t("correlation.sigma", { value: s.stdMood.toFixed(1) })}</span>
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
              {t("correlation.unlocks_desc")}
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
                      <span>{t("correlation.days_count", { count: s.count })}</span>
                      <span>·</span>
                      <span className={diffFromMean > 0.3 ? "text-emerald-400" : diffFromMean < -0.3 ? "text-red-400" : ""}>
                        {t("correlation.diff_vs_mean", { diff: `${diffFromMean > 0 ? "+" : ""}${diffFromMean.toFixed(1)}` })}
                      </span>
                      <span>·</span>
                      <span>{t("correlation.sigma", { value: s.stdMood.toFixed(1) })}</span>
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
                <p className="text-white/60 text-sm font-medium">{t("correlation.trends_title")}</p>
                <p className="text-white/25 text-[10px]">{t("correlation.trends_subtitle", { days: trendData.days })}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl">{trendData.direction?.match(/[↑↓→]/)?.[0] || "→"}</span>
                <p className={`text-xs font-mono ${trendData.slope > 0.2 ? "text-emerald-400" : trendData.slope < -0.2 ? "text-red-400" : "text-white/40"}`}>
                  {trendData.slope > 0 ? "+" : ""}{trendData.slope}
                </p>
              </div>
            </div>

            {/* Trend summary */}
            <div className="text-xs text-white/60 mb-2 italic">
              {t("correlation.trends_footer").split(".")[0]}{' '}
              <span className={trendData.slope > 0.2 ? "text-emerald-400 not-italic" : trendData.slope < -0.2 ? "text-red-400 not-italic" : "text-white/40 not-italic"}>
                {trendData.direction}
              </span>
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

              {/* Rolling average line with mood-colored dots */}
              <svg className="absolute inset-0 ml-4" viewBox={`0 0 ${trendData.rolling.length - 1} 4`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                    {trendData.rolling.map((p, i) => (
                      <stop
                        key={i}
                        offset={`${(i / Math.max(trendData.rolling.length - 1, 1)) * 100}%`}
                        stopColor={moodColor(p.avgMood)}
                      />
                    ))}
                  </linearGradient>
                </defs>
                {/* Line */}
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
                {/* Dots */}
                {trendData.rolling.map((p, i) => {
                  const x = i;
                  const y = 4 - ((p.avgMood - 1) / 4) * 4;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y.toFixed(1)}
                      r={0.08}
                      fill={moodColor(p.avgMood)}
                      opacity={0.8}
                    />
                  );
                })}
              </svg>

              {/* Trend arrow annotation */}
              <div className="absolute bottom-0 right-0 text-[9px] text-white/30">
                {trendData.direction}
              </div>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between text-[9px] text-white/30 mt-1 px-2">
              {trendData.rolling.filter((_, i, arr) =>
                i === 0 || i === arr.length - 1 || i % Math.max(1, Math.floor(arr.length / 6)) === 0
              ).map((p, i) => (
                <span key={i}>{p.date.slice(8, 10)}.{p.date.slice(5, 7)}</span>
              ))}
            </div>

            <div className="flex gap-3 text-[10px]">
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">{t("correlation.trends_start")}</div>
                <div className="text-white font-mono" style={{ color: moodColor(trendData.firstAvg) }}>{trendData.firstAvg}</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">{t("correlation.trends_end")}</div>
                <div className="text-white font-mono" style={{ color: moodColor(trendData.lastAvg) }}>{trendData.lastAvg}</div>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-white/3 text-center">
                <div className="text-white/30">{t("correlation.trends_change")}</div>
                <div className={`font-mono ${trendData.slope > 0.2 ? "text-emerald-400" : trendData.slope < -0.2 ? "text-red-400" : "text-white/40"}`}>
                  {trendData.slope > 0 ? "+" : ""}{trendData.slope}
                </div>
              </div>
            </div>

            <p className="text-white/20 text-[9px] mt-3 text-center">
              {t("correlation.trends_footer")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
