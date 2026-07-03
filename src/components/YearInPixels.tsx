"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchDailyEntries, MOOD_COLORS, MOOD_EMOJIS, type DailyEntry } from "@/lib/stats";

const MONTHS_SHORT = ["Led","Úno","Bře","Dub","Kvě","Čvn","Čvc","Srp","Zář","Říj","Lis","Pro"];
const WEEKDAYS = ["Po","Út","St","Čt","Pá","So","Ne"];

export function YearInPixels() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchDailyEntries()
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const moodMap = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.date] = e.mood; });
    return map;
  }, [entries]);

  const noteMap = useMemo(() => {
    const map: Record<string, string> = {};
    entries.forEach(e => { if (e.note) map[e.date] = e.note; });
    return map;
  }, [entries]);

  // Build the classic year grid: 7 rows (weekdays) × columns (days/weeks)
  const { grid, monthMarkers } = useMemo(() => {
    const year = selectedYear;
    // Find the first day of year
    const jan1 = new Date(year, 0, 1);
    // Align to Monday (ISO week): if Jan 1 is not Monday, start from previous Monday
    const startDow = jan1.getDay() || 7; // Mon=1..Sun=7
    const startDate = new Date(jan1);
    startDate.setDate(startDate.getDate() - (startDow - 1));

    // Find last day of year
    const dec31 = new Date(year, 11, 31);
    const endDow = dec31.getDay() || 7;
    const endDate = new Date(dec31);
    endDate.setDate(endDate.getDate() + (7 - endDow));

    const grid: { date: string; mood: number; note?: string }[][] = [[],[],[],[],[],[],[]];
    const markers: { label: string; col: number }[] = [];
    let col = 0;
    let lastMonth = -1;

    const d = new Date(startDate);
    while (d <= endDate) {
      const dateStr = d.toISOString().split("T")[0];
      const dayOfWeek = (d.getDay() || 7) - 1; // 0=Mon..6=Sun
      const month = d.getMonth();

      // Track month start columns
      if (month !== lastMonth && d.getFullYear() === year) {
        markers.push({ label: MONTHS_SHORT[month], col });
        lastMonth = month;
      }

      grid[dayOfWeek].push({
        date: dateStr,
        mood: moodMap[dateStr] || 0,
        note: noteMap[dateStr],
      });

      if (dayOfWeek === 6) col++;
      d.setDate(d.getDate() + 1);
    }

    return { grid, monthMarkers: markers };
  }, [selectedYear, moodMap, noteMap]);

  const stats = useMemo(() => {
    const yearEntries = entries.filter(e => e.date.startsWith(String(selectedYear)));
    if (yearEntries.length === 0) return null;
    const avg = yearEntries.reduce((s, e) => s + e.mood, 0) / yearEntries.length;
    return { avg: avg.toFixed(1), total: yearEntries.length };
  }, [entries, selectedYear]);

  if (loading) {
    return <div className="glass-card"><div className="text-center py-8 text-white/40">Načítám...</div></div>;
  }

  const cols = grid[0].length;
  const cellSize = cols > 40 ? "calc((100% - 2px) / " + cols + ")" : "14px";

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Year in Pixels</h2>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
        >
          {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {stats && (
        <div className="flex gap-4 text-xs mb-3">
          <span className="text-white/60">Průměr <span className="text-white font-semibold">{stats.avg}</span></span>
          <span className="text-white/60">Dní <span className="text-white font-semibold">{stats.total}</span></span>
        </div>
      )}

      {/* Month labels */}
      <div className="flex mb-0.5 text-[8px] text-white/20 overflow-hidden" style={{ paddingLeft: "24px" }}>
        {monthMarkers.map((m, i) => {
          const nextCol = i < monthMarkers.length - 1 ? monthMarkers[i + 1].col : cols;
          const width = nextCol - m.col;
          return (
            <div key={m.label} className="text-left overflow-hidden whitespace-nowrap" style={{ width: `calc(${width} * ${cellSize})`, maxWidth: "none", flex: "none" }}>
              {m.label}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[1px] mr-1.5">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="text-[8px] text-white/15 flex items-center justify-end" style={{ height: cellSize, width: "20px" }}>
              {i % 2 === 0 ? d[0] : ""}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="flex-1 overflow-hidden">
          {grid.map((row, ri) => (
            <div key={ri} className="flex gap-[1px]" style={{ marginBottom: "1px" }}>
              {row.map(cell => (
                <div
                  key={cell.date}
                  className="rounded-[1px] transition-all hover:scale-[2.5] hover:z-10 hover:shadow-lg relative"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: cell.mood ? MOOD_COLORS[cell.mood] : "rgba(255,255,255,0.03)",
                    flex: "1 1 auto",
                    minWidth: "6px",
                    minHeight: "6px",
                    maxWidth: "14px",
                    maxHeight: "14px",
                  }}
                  title={cell.mood ? `${cell.date}: nálada ${cell.mood}/5` : cell.date}
                  onMouseEnter={() => setHoveredDay(cell.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {hoveredDay === cell.date && cell.mood > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 border border-white/20 rounded-lg px-2 py-1 shadow-xl z-20 whitespace-nowrap animate-fade-in">
                      <span className="text-xs text-white">
                        {MOOD_EMOJIS[cell.mood]} {new Date(cell.date).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
                      </span>
                      {cell.note && (
                        <span className="text-[9px] text-white/30 ml-1">— {cell.note.slice(0, 30)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px]">
        {[5,4,3,2,1].map(m => (
          <span key={m} className="flex items-center gap-1 text-white/30">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: MOOD_COLORS[m] }} />
            {MOOD_EMOJIS[m]}
          </span>
        ))}
      </div>
    </div>
  );
}
