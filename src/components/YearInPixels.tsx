"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchDailyEntries, MOOD_COLORS, type DailyEntry } from "@/lib/stats";

const MONTHS_CZ = [
  "Led", "Úno", "Bře", "Dub", "Kvě", "Čvn",
  "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro",
];

function getYearDays(year: number): string[] {
  const days: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const d = new Date(start);
  while (d <= end) {
    days.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getDayOfYear(dateStr: string): number {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function YearInPixels() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("diarium_github_token");
    const repo = localStorage.getItem("diarium_repo");
    if (!token || !repo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchDailyEntries(token, repo)
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const moodMap = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      map[e.date] = e.mood;
    });
    return map;
  }, [entries]);

  const days = useMemo(() => getYearDays(selectedYear), [selectedYear]);

  // Month column positions
  const monthCols = useMemo(() => {
    const cols: { label: string; col: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const firstDay = new Date(selectedYear, m, 1);
      const dayOfYear = getDayOfYear(firstDay.toISOString().split("T")[0]);
      cols.push({ label: MONTHS_CZ[m], col: dayOfYear });
    }
    return cols;
  }, [selectedYear]);

  // Stats
  const stats = useMemo(() => {
    const yearEntries = entries.filter((e) => e.date.startsWith(String(selectedYear)));
    if (yearEntries.length === 0) return null;
    const avg = yearEntries.reduce((s, e) => s + e.mood, 0) / yearEntries.length;
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    yearEntries.forEach((e) => counts[e.mood]++);
    return { avg: avg.toFixed(1), total: yearEntries.length, counts };
  }, [entries, selectedYear]);

  if (loading) {
    return (
      <div className="glass-card">
        <div className="text-center py-8 text-white/40">Načítám data...</div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Year in Pixels</h2>
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(Number(e.target.value));
            setHoveredDay(null);
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400/50"
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Month headers */}
      <div className="flex mb-1 text-[9px] text-white/25" style={{ paddingLeft: "2px" }}>
        {monthCols.map((m, i) => (
          <div
            key={m.label}
            className="text-center truncate"
            style={{
              position: "relative",
              width: i < 11
                ? `${((monthCols[i + 1].col - m.col) / days.length) * 100}%`
                : "auto",
              flex: 1,
            }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-[1px] flex-wrap mb-3">
        {days.map((date) => {
          const mood = moodMap[date];
          return (
            <div
              key={date}
              className="rounded-[1px] transition-all hover:scale-[2.5] hover:z-10 hover:shadow-lg"
              style={{
                width: "calc(100% / 53 - 1px)",
                aspectRatio: "1",
                background: mood
                  ? MOOD_COLORS[mood]
                  : "rgba(255,255,255,0.04)",
              }}
              title={`${date}${mood ? ` — nálada ${mood}/5` : ""}`}
              onMouseEnter={() => setHoveredDay(date)}
              onMouseLeave={() => setHoveredDay(null)}
            />
          );
        })}
      </div>

      {/* Hover info */}
      <div className="text-center text-xs text-white/30 h-5">
        {hoveredDay && (
          <>
            {new Date(hoveredDay).toLocaleDateString("cs-CZ", {
              day: "numeric",
              month: "long",
            })}
            {moodMap[hoveredDay]
              ? ` — nálada ${moodMap[hoveredDay]}/5`
              : " — žádný záznam"}
          </>
        )}
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.avg}</div>
            <div className="text-[10px] text-white/30">průměrná nálada</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-[10px] text-white/30">záznamů</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center gap-1 text-lg">
              {[5, 4, 3, 2, 1].map((m) => (
                <span
                  key={m}
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: MOOD_COLORS[m] }}
                  title={`${(stats.counts[m] ?? 0)}×`}
                />
              ))}
            </div>
            <div className="text-[10px] text-white/30 mt-1">rozložení</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-3 mt-4 text-xs text-white/25">
        <span>😄</span>
        <span>🙂</span>
        <span>😐</span>
        <span>😟</span>
        <span>😡</span>
      </div>
    </div>
  );
}
