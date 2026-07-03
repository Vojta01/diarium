"use client";

import { useMemo } from "react";
import type { DailyEntry } from "@/lib/stats";

interface ActivityStats {
  activity: string;
  count: number;
  avgMood: number;
}

export function ActivityMoodChart({ entries }: { entries: DailyEntry[] }) {
  const stats = useMemo(() => {
    // Build activity → mood scores map
    const map = new Map<string, number[]>();

    for (const entry of entries) {
      if (!entry.activities || entry.mood === 0) continue;
      for (const act of entry.activities) {
        if (!map.has(act)) map.set(act, []);
        map.get(act)!.push(entry.mood);
      }
    }

    // Compute stats
    const result: ActivityStats[] = [];
    for (const [activity, moods] of map) {
      if (moods.length < 2) continue; // skip with too few data points
      result.push({
        activity,
        count: moods.length,
        avgMood: moods.reduce((a, b) => a + b, 0) / moods.length,
      });
    }

    // Sort by mood (best first) and take top 15
    return result.sort((a, b) => b.avgMood - a.avgMood).slice(0, 15);
  }, [entries]);

  if (stats.length === 0) {
    return (
      <div className="text-center text-white/30 py-12">
        Zatím není dost dat pro korelace. Vyplňuj Diarium a uvidíš, co ovlivňuje tvou náladu.
      </div>
    );
  }

  const maxMood = Math.max(...stats.map(s => s.avgMood), 1);
  const minMood = Math.min(...stats.map(s => s.avgMood), 5);

  return (
    <div className="space-y-2">
      <p className="text-white/30 text-xs mb-4 text-center">
        Když dělám tuhle aktivitu, moje nálada je průměrně:
      </p>
      {stats.map(s => {
        const barPercent = ((s.avgMood - 1) / 4) * 100;
        const hue = (s.avgMood / 5) * 120; // 0 (red) to 120 (green)
        const color = `hsl(${hue}, 60%, 50%)`;

        return (
          <div key={s.activity} className="flex items-center gap-3">
            <span className="text-sm text-white/60 w-24 text-right truncate" title={s.activity}>
              {s.activity}
            </span>
            <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${barPercent}%`,
                  background: color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-sm text-white/60 w-10 text-right">
              {s.avgMood.toFixed(1)}
            </span>
            <span className="text-xs text-white/20 w-8 text-right">
              {s.count}×
            </span>
          </div>
        );
      })}
    </div>
  );
}
