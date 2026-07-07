"use client";

import { useMemo } from "react";
import type { DailyEntry } from "@/lib/stats";

interface ScreenTimeEntry extends DailyEntry {
  phone_screen_time?: number;
  phone_unlocks?: number;
  phone_top_apps?: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function getBarColor(seconds: number): string {
  if (seconds < 3600) return "#22c55e";       // <1h
  if (seconds < 7200) return "#3b82f6";        // 1-2h
  if (seconds < 14400) return "#eab308";       // 2-4h
  if (seconds < 21600) return "#f97316";       // 4-6h
  return "#ef4444";                             // >6h
}

const WEEKDAYS_CZ = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export function ScreenTimeChart({ entries }: { entries: DailyEntry[] }) {
  const last7Days = useMemo(() => {
    const typed = entries as ScreenTimeEntry[];
    const withData = typed.filter(e => e.phone_screen_time && e.phone_screen_time > 0);
    if (withData.length === 0) return null;

    const sorted = [...withData].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, 7).reverse();
  }, [entries]);

  if (!last7Days || last7Days.length === 0) {
    return (
      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-2">Screen Time</h2>
        <div className="text-center py-8 text-white/30 text-sm">
          Zatím žádná data o screen timu.
          <br />
          <span className="text-[11px]">Data se sbírají z Home Assistant — první data budou zítra.</span>
        </div>
      </div>
    );
  }

  const maxTime = Math.max(...last7Days.map(d => d.phone_screen_time || 0), 1);
  const avgTime = last7Days.reduce((s, d) => s + (d.phone_screen_time || 0), 0) / last7Days.length;
  const totalHours = last7Days.reduce((s, d) => s + (d.phone_screen_time || 0), 0) / 3600;
  const avgHours = totalHours / last7Days.length;

  // Compare with previous period
  const prev7Total = last7Days.reduce((s, d) => s + (d.phone_screen_time || 0), 0);
  const trend = prev7Total > 25200 ? "📈" : prev7Total < 16800 ? "📉" : "➡️";

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold mb-1">Screen Time</h2>
      <p className="text-white/30 text-xs mb-4">posledních 7 dní</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{formatTime(Math.round(avgTime))}</div>
          <div className="text-[10px] text-white/30">průměr denně</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{Math.round(totalHours)}h</div>
          <div className="text-[10px] text-white/30">celkem za 7 dní</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold" style={{ color: getBarColor(maxTime) }}>
            {formatTime(maxTime)}
          </div>
          <div className="text-[10px] text-white/30">nejvíc za den</div>
        </div>
      </div>

      {/* 7-day bar chart */}
      <div className="flex items-end gap-1.5 h-28 mb-1">
        {last7Days.map((d) => {
          const seconds = d.phone_screen_time || 0;
          const height = (seconds / maxTime) * 100;
          const date = new Date(d.date);
          const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
          const isToday = d.date === new Date().toISOString().split("T")[0];

          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[9px] text-white/40 font-medium">
                {formatTime(seconds)}
              </span>
              <div className="w-full relative" style={{ height: height + "%", minHeight: seconds > 0 ? "4px" : "0" }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md transition-all opacity-80 hover:opacity-100"
                  style={{
                    height: "100%",
                    background: isToday
                      ? "linear-gradient(180deg, #818cf8, #6366f1)"
                      : getBarColor(seconds),
                  }}
                />
              </div>
              <span className={`text-[10px] ${isToday ? "text-indigo-400 font-semibold" : "text-white/25"}`}>
                {dayName}
              </span>
            </div>
          );
        })}
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[9px] text-white/25">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#22c55e" }} />&lt;1h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#3b82f6" }} />1-2h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#eab308" }} />2-4h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#f97316" }} />4-6h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: "#ef4444" }} />6h+</span>
        <span className="ml-auto text-white/15">HA</span>
      </div>

      {/* Phone Unlocks */}
      {last7Days.some((d: any) => d.phone_unlocks && d.phone_unlocks > 0) && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🔓</span>
            <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Odemčení telefonu</h3>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {last7Days.map((d: any) => {
              const unlocks = d.phone_unlocks || 0;
              const maxUnlocks = Math.max(...last7Days.map((x: any) => x.phone_unlocks || 0), 1);
              const height = (unlocks / maxUnlocks) * 100;
              const date = new Date(d.date);
              const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
              const isToday = d.date === new Date().toISOString().split("T")[0];

              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                  <span className="text-[9px] text-white/40 font-medium">{unlocks || "—"}</span>
                  <div className="w-full relative" style={{ height: height + "%", minHeight: unlocks > 0 ? "3px" : "0" }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all opacity-70 hover:opacity-100"
                      style={{
                        height: "100%",
                        background: isToday
                          ? "linear-gradient(180deg, #c084fc, #a855f7)"
                          : "#a855f7",
                      }}
                    />
                  </div>
                  <span className={`text-[10px] ${isToday ? "text-purple-400 font-semibold" : "text-white/25"}`}>
                    {dayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
