"use client";

import { useMemo } from "react";
import type { DailyEntry } from "@/lib/stats";

interface ScreenTimeChartProps {
  entries: DailyEntry[];
}

// Extended entry type — screen time is in the YAML but not in our DailyEntry interface
interface ScreenTimeEntry extends DailyEntry {
  phone_screen_time?: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function getBarColor(seconds: number): string {
  if (seconds < 3600) return "#22c55e";       // <1h = green
  if (seconds < 7200) return "#86efac";        // 1-2h = light green
  if (seconds < 14400) return "#facc15";       // 2-4h = yellow
  if (seconds < 21600) return "#fb923c";       // 4-6h = orange
  return "#ef4444";                             // >6h = red
}

export function ScreenTimeChart({ entries }: ScreenTimeChartProps) {
  const last30Days = useMemo(() => {
    const typed = entries as ScreenTimeEntry[];
    const withScreenTime = typed.filter((e) => e.phone_screen_time && e.phone_screen_time > 0);
    if (withScreenTime.length === 0) return null;

    // Take last 30 days
    const sorted = [...withScreenTime].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-30);
  }, [entries]);

  if (!last30Days || last30Days.length === 0) {
    return (
      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-2">Screen Time</h2>
        <div className="text-center py-8 text-white/30 text-sm">
          Zatím žádná data o screen timu.
          <br />
          <span className="text-[11px]">
            Data se sbírají z Home Assistant senzoru.
          </span>
        </div>
      </div>
    );
  }

  const maxTime = Math.max(...last30Days.map((d) => d.phone_screen_time || 0));
  const avgTime = last30Days.reduce((s, d) => s + (d.phone_screen_time || 0), 0) / last30Days.length;
  const totalHours = last30Days.reduce((s, d) => s + (d.phone_screen_time || 0), 0) / 3600;

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold mb-1">Screen Time</h2>
      <p className="text-white/30 text-xs mb-4">čas na displeji za posledních 30 dní</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center">
          <div className="text-xl font-bold text-white">{formatTime(Math.round(avgTime))}</div>
          <div className="text-[10px] text-white/30">průměr denně</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{Math.round(totalHours)}h</div>
          <div className="text-[10px] text-white/30">celkem za 30 dní</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: getBarColor(maxTime) }}>
            {formatTime(maxTime)}
          </div>
          <div className="text-[10px] text-white/30">nejhorší den</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-[2px] h-32">
        {last30Days.map((d) => {
          const seconds = d.phone_screen_time || 0;
          const height = maxTime > 0 ? (seconds / maxTime) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex-1 relative group"
              style={{ height: "100%" }}
              title={d.date + ": " + formatTime(seconds)}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-[2px] transition-all hover:opacity-80"
                style={{
                  height: height + "%",
                  background: getBarColor(seconds),
                  minHeight: seconds > 0 ? "2px" : "0",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Color scale */}
      <div className="flex justify-between mt-3 text-[9px] text-white/25">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#22c55e" }} />
            &lt;1h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#facc15" }} />
            2-4h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#ef4444" }} />
            &gt;6h
          </span>
        </div>
        <span>data z HA senzoru</span>
      </div>
    </div>
  );
}
