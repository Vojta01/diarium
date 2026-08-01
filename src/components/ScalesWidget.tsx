"use client";

import { useState, useEffect } from "react";
import { getScales, getScaleEntries, getScaleAverage, type Scale, type ScaleEntry } from "@/lib/scales";
import { useTranslation } from "@/lib/i18n";

interface ScalesWidgetProps {
  userId: string;
  todayScaleValues?: Record<string, number>;
}

export function ScalesWidget({ userId, todayScaleValues }: ScalesWidgetProps) {
  const { t } = useTranslation();
  const [scales, setScales] = useState<Scale[]>([]);
  const [entries, setEntries] = useState<Record<string, ScaleEntry[]>>({});
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScales();
  }, []);

  async function loadScales() {
    try {
      const data = await getScales();
      setScales(data);

      // Load recent entries for each scale
      const entriesMap: Record<string, ScaleEntry[]> = {};
      const avgMap: Record<string, number> = {};

      for (const scale of data) {
        try {
          entriesMap[scale.id] = await getScaleEntries(scale.id, 7);
          avgMap[scale.id] = await getScaleAverage(scale.id, 7);
        } catch {}
      }

      setEntries(entriesMap);
      setAverages(avgMap);
    } catch (e) {
      console.error("Failed to load scales:", e);
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

  if (scales.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-lg font-semibold text-white mb-2">📊 {t("scales.title")}</h3>
        <p className="text-white/40 text-sm">{t("scales.no_scales")}</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-lg font-semibold text-white mb-3">📊 {t("scales.title")}</h3>

      <div className="space-y-3">
        {scales.map((scale) => {
          const scaleEntries = entries[scale.id] || [];
          const avg = averages[scale.id] || 0;
          const todayValue = todayScaleValues?.[scale.id];
          const maxVal = scale.max_value;
          const minVal = scale.min_value;
          const range = maxVal - minVal;

          // Build distribution bars
          const distribution: Record<number, number> = {};
          scaleEntries.forEach((e) => {
            distribution[e.value] = (distribution[e.value] || 0) + 1;
          });
          const maxCount = Math.max(1, ...Object.values(distribution));

          return (
            <div key={scale.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{scale.emoji}</span>
                  <span className="text-sm font-medium text-white">{scale.name}</span>
                  {scale.unit && (
                    <span className="text-xs text-white/40">{scale.unit}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {todayValue !== undefined && (
                    <span
                      className="text-sm font-bold px-2 py-0.5 rounded-lg"
                      style={{
                        color: scale.color,
                        backgroundColor: `${scale.color}20`,
                      }}
                    >
                      {todayValue}
                    </span>
                  )}
                  {avg > 0 && (
                    <span className="text-xs text-white/40">
                      Ø {avg.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Mini distribution bars */}
              <div className="flex items-end gap-0.5 h-8">
                {Array.from({ length: range + 1 }, (_, i) => {
                  const val = minVal + i;
                  const count = distribution[val] || 0;
                  const height = Math.max(4, (count / maxCount) * 100);
                  const isToday = todayValue === val;

                  return (
                    <div
                      key={val}
                      className="flex-1 rounded-t transition-all duration-300"
                      style={{
                        height: `${height}%`,
                        backgroundColor: isToday ? scale.color : `${scale.color}40`,
                        opacity: count > 0 ? 1 : 0.3,
                      }}
                      title={`${val}: ${count}×`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
