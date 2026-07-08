"use client";

import { useMemo } from "react";
import type { DailyEntry } from "@/lib/stats";

interface ScreenTimeEntry extends DailyEntry {
  phone_screen_time?: number;
  phone_unlocks?: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1) + "h";
}

/** Barva podle času — jasná škála od zelené (málo) po červenou (hodně) */
function getBarColor(seconds: number): { bg: string; label: string } {
  if (seconds < 1800) return { bg: "#22c55e", label: "🟢 <30m" };       // <30 min
  if (seconds < 3600) return { bg: "#4ade80", label: "🟢 30m–1h" };      // 30m-1h
  if (seconds < 7200) return { bg: "#3b82f6", label: "🔵 1–2h" };        // 1-2h
  if (seconds < 14400) return { bg: "#eab308", label: "🟡 2–4h" };       // 2-4h
  if (seconds < 21600) return { bg: "#f97316", label: "🟠 4–6h" };       // 4-6h
  return { bg: "#ef4444", label: "🔴 6h+" };                              // >6h
}

const WEEKDAYS_CZ = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

/** Max height of bar area in pixels (Tailwind h-36 = 9rem = 144px) */
const BAR_AREA_H = 144;

export function ScreenTimeChart({ entries }: { entries: DailyEntry[] }) {
  const last7Days = useMemo(() => {
    const typed = entries as ScreenTimeEntry[];
    const withData = typed.filter(e => e.phone_screen_time && e.phone_screen_time > 0);
    if (withData.length === 0) return null;
    const sorted = [...withData].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, 7).reverse();
  }, [entries]);

  // Data for unlocks (same 7-day window as screen time)
  const unlocksData = useMemo(() => {
    if (!last7Days) return null;
    const hasData = last7Days.some(d => (d as any).phone_unlocks && (d as any).phone_unlocks > 0);
    if (!hasData) return null;
    return last7Days;
  }, [last7Days]);

  if (!last7Days || last7Days.length === 0) {
    return (
      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-2">📱 Screen Time</h2>
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

  // Unlocks max
  const maxUnlocks = unlocksData
    ? Math.max(...unlocksData.map(d => (d as any).phone_unlocks || 0), 1)
    : 0;

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold mb-1">📱 Screen Time</h2>
      <p className="text-white/30 text-xs mb-4">posledních 7 dní</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{formatTime(Math.round(avgTime))}</div>
          <div className="text-[10px] text-white/30">průměr denně</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{Math.round(totalHours)}h</div>
          <div className="text-[10px] text-white/30">celkem</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold" style={{ color: getBarColor(maxTime).bg }}>
            {formatTime(maxTime)}
          </div>
          <div className="text-[10px] text-white/30">nejvíc</div>
        </div>
      </div>

      {/* Screen time bar chart */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          ⏱️ Čas na obrazovce
        </h3>

        {/* Chart area with explicit height */}
        <div className="relative" style={{ height: BAR_AREA_H + 48 }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(fraction => (
            <div
              key={fraction}
              className="absolute left-0 right-0 border-t border-white/5"
              style={{ bottom: fraction * BAR_AREA_H + 32 }}
            />
          ))}

          {/* Average line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-white/20 z-10"
            style={{ bottom: (avgTime / maxTime) * BAR_AREA_H + 32 }}
          >
            <span className="absolute -top-3 right-0 text-[9px] text-white/20 bg-[#0f0f0f] px-1 rounded">
              Ø {formatTime(Math.round(avgTime))}
            </span>
          </div>

          {/* Bars */}
          <div className="absolute bottom-8 left-0 right-0 flex items-end gap-1.5" style={{ height: BAR_AREA_H }}>
            {last7Days.map((d) => {
              const seconds = d.phone_screen_time || 0;
              const barH = seconds > 0 ? Math.max(4, (seconds / maxTime) * BAR_AREA_H) : 0;
              const date = new Date(d.date);
              const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
              const isToday = d.date === new Date().toISOString().split("T")[0];
              const color = getBarColor(seconds);

              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                  {/* Bar itself — fixed pixel height, NOT percentage */}
                  <div
                    className="w-full max-w-[48px] mx-auto rounded-t-md transition-all relative group"
                    style={{
                      height: barH,
                      background: isToday
                        ? `linear-gradient(180deg, ${color.bg}, ${color.bg}88)`
                        : color.bg,
                      opacity: isToday ? 1 : 0.75,
                      boxShadow: isToday ? `0 0 8px ${color.bg}44` : "none",
                    }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10">
                      {formatTime(seconds)}
                      <span className="text-white/40 ml-1">{color.label.split(" ")[0]}</span>
                    </div>
                  </div>

                  {/* Time label below bar */}
                  <span className={`text-[9px] leading-none ${isToday ? "text-white font-semibold" : "text-white/40"}`}>
                    {formatTime(seconds)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="absolute bottom-0 left-0 right-0 flex gap-1.5">
            {last7Days.map((d) => {
              const date = new Date(d.date);
              const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
              const isToday = d.date === new Date().toISOString().split("T")[0];
              return (
                <div key={d.date} className={`flex-1 text-center text-[10px] ${isToday ? "text-white font-semibold" : "text-white/25"}`}>
                  {dayName}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Color legend — clearer */}
      <div className="flex items-center gap-2 mb-4 text-[9px] text-white/30 flex-wrap">
        <span className="text-white/40 mr-1">Legenda:</span>
        {[
          { sec: 900, label: "<30m", color: "#22c55e" },
          { sec: 2700, label: "30m–1h", color: "#4ade80" },
          { sec: 5400, label: "1–2h", color: "#3b82f6" },
          { sec: 10800, label: "2–4h", color: "#eab308" },
          { sec: 18000, label: "4–6h", color: "#f97316" },
          { sec: 25200, label: "6h+", color: "#ef4444" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-white/15">HA</span>
      </div>

      {/* Phone Unlocks */}
      {unlocksData && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            🔓 Odemknutí telefonu
          </h3>

          <div className="relative" style={{ height: 100 + 48 }}>
            {/* Grid line at 50% */}
            <div
              className="absolute left-0 right-0 border-t border-white/5"
              style={{ bottom: 50 + 32 }}
            />

            {/* Average line */}
            {(() => {
              const avgU = unlocksData.reduce((s, d) => s + ((d as any).phone_unlocks || 0), 0) / unlocksData.length;
              return (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-white/20 z-10"
                  style={{ bottom: maxUnlocks > 0 ? (avgU / maxUnlocks) * 100 + 32 : 32 }}
                >
                  <span className="absolute -top-3 right-0 text-[9px] text-white/20 bg-[#0f0f0f] px-1 rounded">
                    Ø {Math.round(avgU)}×
                  </span>
                </div>
              );
            })()}

            {/* Bars */}
            <div className="absolute bottom-8 left-0 right-0 flex items-end gap-1.5" style={{ height: 100 }}>
              {unlocksData.map((d: any) => {
                const unlocks = d.phone_unlocks || 0;
                const barH = unlocks > 0 ? Math.max(3, (unlocks / maxUnlocks) * 100) : 0;
                const date = new Date(d.date);
                const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
                const isToday = d.date === new Date().toISOString().split("T")[0];

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                    <div
                      className="w-full max-w-[48px] mx-auto rounded-t-sm transition-all relative group"
                      style={{
                        height: barH,
                        background: isToday
                          ? "linear-gradient(180deg, #c084fc, #a855f7)"
                          : "#a855f7",
                        opacity: isToday ? 1 : 0.6,
                        boxShadow: isToday ? "0 0 8px #a855f744" : "none",
                      }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10">
                        {unlocks}×
                      </div>
                    </div>
                    <span className={`text-[9px] leading-none ${isToday ? "text-purple-300 font-semibold" : "text-white/30"}`}>
                      {unlocks || "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex gap-1.5">
              {unlocksData.map((d: any) => {
                const date = new Date(d.date);
                const dayName = WEEKDAYS_CZ[(date.getDay() || 7) - 1];
                const isToday = d.date === new Date().toISOString().split("T")[0];
                return (
                  <div key={d.date} className={`flex-1 text-center text-[10px] ${isToday ? "text-purple-300 font-semibold" : "text-white/25"}`}>
                    {dayName}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 text-[9px] text-white/30">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#a855f7" }} />
              počet odemknutí
            </span>
            <span className="text-white/15 ml-auto">HA</span>
          </div>
        </div>
      )}
    </div>
  );
}
