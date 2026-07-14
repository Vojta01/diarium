"use client";

import { useMemo } from "react";
import type { DailyEntry } from "@/lib/stats";
import { useTranslation } from "@/lib/i18n";

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

/** Barva podle počtu odemknutí — stejný princip jako screen time */
function getUnlockColor(unlocks: number): string {
  if (unlocks < 30) return "#22c55e";    // zelená — málo
  if (unlocks < 60) return "#3b82f6";    // modrá — střed
  if (unlocks < 100) return "#eab308";   // žlutá — hodně
  return "#ef4444";                        // červená — extrém
}
function getBarColor(seconds: number): { bg: string; label: string } {
  if (seconds < 1800) return { bg: "#22c55e", label: "🟢 <30m" };       // <30 min
  if (seconds < 3600) return { bg: "#4ade80", label: "🟢 30m–1h" };      // 30m-1h
  if (seconds < 7200) return { bg: "#3b82f6", label: "🔵 1–2h" };        // 1-2h
  if (seconds < 14400) return { bg: "#eab308", label: "🟡 2–4h" };       // 2-4h
  if (seconds < 21600) return { bg: "#f97316", label: "🟠 4–6h" };       // 4-6h
  return { bg: "#ef4444", label: "🔴 6h+" };                              // >6h
}

/** Max height of bar area in pixels (Tailwind h-36 = 9rem = 144px) */
const BAR_AREA_H = 144;

/** App color palette for stacked bar segments */
const APP_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#eab308", // yellow
  "#ef4444", // red
];

export function ScreenTimeChart({ entries }: { entries: DailyEntry[] }) {
  const { t, lang } = useTranslation();
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

  // Data for per-app breakdown
  const appData = useMemo(() => {
    if (!last7Days) return null;
    // Get unique apps across all days for consistent colors
    const allApps = new Map<string, number>();
    for (const d of last7Days) {
      let apps = d.phone_top_apps;
      if (!apps) continue;
      // Normalize: handle both array and legacy string format
      if (typeof apps === 'string') {
        // Old format: "App:minutes, App:minutes" — skip, already handled by API
        continue;
      }
      if (!Array.isArray(apps)) continue;
      for (const a of apps) {
        if (a && typeof a === 'object' && a.app && typeof a.time_sec === 'number') {
          allApps.set(a.app, (allApps.get(a.app) || 0) + a.time_sec);
        }
      }
    }
    const hasData = allApps.size > 0;
    if (!hasData) return null;

    // Sort apps by total time, assign colors
    const sortedApps = [...allApps.entries()]
      .sort((a, b) => b[1] - a[1]);
    const appColorMap = new Map<string, string>();
    sortedApps.forEach(([app], i) => {
      appColorMap.set(app, APP_COLORS[i % APP_COLORS.length]);
    });

    return { appColorMap, days: last7Days };
  }, [last7Days]);

  const weekdays: string[] = Array.isArray(t("screenTime.weekdays"))
    ? (t("screenTime.weekdays") as unknown as string[])
    : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  if (!last7Days || last7Days.length === 0) {
    return (
      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-2">{t("screenTime.title")}</h2>
        <div className="text-center py-8 text-white/30 text-sm">
          {t("screenTime.no_data")}
          <br />
          <span className="text-[11px]">{t("screenTime.no_data_hint")}</span>
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
      <h2 className="text-lg font-semibold mb-1">{t("screenTime.title")}</h2>
      <p className="text-white/30 text-xs mb-4">{t("screenTime.last_7_days")}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{formatTime(Math.round(avgTime))}</div>
          <div className="text-[10px] text-white/30">{t("screenTime.avg_daily")}</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{Math.round(totalHours)}h</div>
          <div className="text-[10px] text-white/30">{t("screenTime.total")}</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold" style={{ color: getBarColor(maxTime).bg }}>
            {formatTime(maxTime)}
          </div>
          <div className="text-[10px] text-white/30">{t("screenTime.max")}</div>
        </div>
      </div>

      {/* Screen time bar chart */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          {t("screenTime.screen_time_chart")}
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

          {/* Bars — stacked when app data available, solid otherwise */}
          <div className="absolute bottom-8 left-0 right-0 flex items-end gap-1.5" style={{ height: BAR_AREA_H }}>
            {last7Days.map((d) => {
              const seconds = d.phone_screen_time || 0;
              const barH = seconds > 0 ? Math.max(4, (seconds / maxTime) * BAR_AREA_H) : 0;
              const date = new Date(d.date);
              const isToday = d.date === new Date().toISOString().split("T")[0];
              const hasApps = appData && d.phone_top_apps && Array.isArray(d.phone_top_apps) && d.phone_top_apps.length > 0;

              if (seconds === 0) {
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className="w-full max-w-[48px] mx-auto h-0" />
                    <span className="text-[9px] leading-none text-white/20">—</span>
                  </div>
                );
              }

              if (hasApps) {
                // Stacked bar with app segments
                const apps = d.phone_top_apps!;
                const sorted = [...apps].sort((a, b) => b.time_sec - a.time_sec);
                const top3 = sorted.slice(0, 3);
                const otherSec = sorted.slice(3).reduce((s, a) => s + a.time_sec, 0);

                const segments = [
                  ...top3.map(a => ({
                    name: a.app,
                    seconds: a.time_sec,
                    color: appData!.appColorMap.get(a.app) || "#6b7280",
                  })),
                  ...(otherSec > 0 ? [{ name: t("screenTime.other"), seconds: otherSec, color: "#374151" }] : []),
                ].reverse(); // bottom to top

                let cumH = 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                    <div
                      className="w-full max-w-[48px] mx-auto rounded-t-md relative group"
                      style={{
                        height: barH,
                        opacity: isToday ? 1 : 0.7,
                        boxShadow: isToday ? "0 0 8px rgba(99,102,241,0.15)" : "none",
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[9px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10 flex flex-col gap-0.5">
                        {[...top3, ...(otherSec > 0 ? [{ app: t("screenTime.other"), time_sec: otherSec }] : [])].map((a: any) => (
                          <div key={a.app} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: a.app === t("screenTime.other") ? "#374151" : appData!.appColorMap.get(a.app) }} />
                            <span className="text-white/60 max-w-[80px] truncate">{a.app}</span>
                            <span className="text-white/80 ml-auto">{formatTime(a.time_sec)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/10 pt-0.5 mt-0.5 text-white/50">{t("screenTime.total")} {formatTime(seconds)}</div>
                      </div>

                      {/* Stacked segments */}
                      {segments.map((seg, i) => {
                        const segH = (seg.seconds / seconds) * barH;
                        const prevCum = cumH;
                        cumH += segH;
                        return (
                          <div
                            key={i}
                            className="absolute left-0 right-0"
                            style={{
                              bottom: prevCum,
                              height: Math.max(1, segH),
                              background: seg.color,
                              ...(i === segments.length - 1 ? { borderTopLeftRadius: 4, borderTopRightRadius: 4 } : {}),
                            }}
                          />
                        );
                      })}
                    </div>
                    <span className={`text-[9px] leading-none ${isToday ? "text-white font-semibold" : "text-white/40"}`}>
                      {formatTime(seconds)}
                    </span>
                  </div>
                );
              }

              // Fallback: solid bar (no per-app data) — bright enough to be visible
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                  <div
                    className="w-full max-w-[48px] mx-auto rounded-t-md transition-all relative group"
                    style={{
                      height: barH,
                      background: isToday
                        ? `linear-gradient(180deg, #818cf8, #6366f1)`
                        : "#818cf8",
                      opacity: 0.85,
                      boxShadow: "0 0 6px rgba(129,140,248,0.15)",
                    }}
                  >
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10">
                      {formatTime(seconds)}
                    </div>
                  </div>
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
              const dayName = weekdays[(date.getDay() || 7) - 1];
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

      {/* Legend — app colors when available, time-based otherwise */}
      {appData ? (
        <div className="flex items-center gap-2 mb-4 text-[9px] text-white/30 flex-wrap">
          <span className="text-white/40 mr-1">{t("screenTime.apps")}</span>
          {[...appData.appColorMap.entries()].slice(0, 6).map(([app, color]) => (
            <span key={app} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="max-w-[60px] truncate">{app}</span>
            </span>
          ))}
          <span className="mx-1 text-white/10">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#374151" }} />
            {t("screenTime.other")}
          </span>
          <span className="ml-auto text-white/15">HA</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 text-[9px] text-white/30 flex-wrap">
          <span className="text-white/40 mr-1">{t("screenTime.legend")}</span>
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
      )}

      {/* Phone Unlocks */}
      {unlocksData && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            {t("screenTime.unlocks_chart")}
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
                const isToday = d.date === new Date().toISOString().split("T")[0];
                const color = getUnlockColor(unlocks);

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                    <div
                      className="w-full max-w-[48px] mx-auto rounded-t-sm transition-all relative group"
                      style={{
                        height: barH,
                        background: isToday
                          ? `linear-gradient(180deg, ${color}, ${color}88)`
                          : color,
                        opacity: isToday ? 1 : 0.6,
                        boxShadow: isToday ? `0 0 8px ${color}44` : "none",
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
                const dayName = weekdays[(date.getDay() || 7) - 1];
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
            <span className="text-white/40 mr-1">{t("screenTime.legend")}</span>
            {[
              { val: 15, label: "<30×", color: "#22c55e" },
              { val: 45, label: "30–60×", color: "#3b82f6" },
              { val: 80, label: "60–100×", color: "#eab308" },
              { val: 120, label: "100×+", color: "#ef4444" },
            ].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {label}
              </span>
            ))}
            <span className="text-white/15 ml-auto">HA</span>
          </div>
        </div>
      )}

    </div>
  );
}
