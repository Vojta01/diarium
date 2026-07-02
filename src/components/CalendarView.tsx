"use client";

import { useState, useMemo } from "react";
import { MOOD_COLORS, MOOD_EMOJIS, type DailyEntry } from "@/lib/stats";

const DAY_NAMES = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

interface CalendarViewProps {
  entries: DailyEntry[];
}

export function CalendarView({ entries }: CalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const moodMap = useMemo(() => {
    const map: Record<string, DailyEntry> = {};
    entries.forEach((e) => {
      map[e.date] = e;
    });
    return map;
  }, [entries]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: (string | null)[] = [];
    // Empty cells before start
    for (let i = 0; i < startDow; i++) days.push(null);
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(ds);
    }

    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  };

  const selectedEntry = selectedDate ? moodMap[selectedDate] : null;

  return (
    <div className="glass-card">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn-glass text-sm px-3">
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button onClick={nextMonth} className="btn-glass text-sm px-3">
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-white/25 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />;

          const entry = moodMap[dateStr];
          const day = parseInt(dateStr.split("-")[2]);
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all
                ${isToday ? "ring-1 ring-indigo-400/50" : ""}
                ${isSelected ? "ring-2 ring-white/50 scale-110 z-10" : ""}
                hover:bg-white/5`}
              style={{
                background: entry
                  ? `${MOOD_COLORS[entry.mood]}33`
                  : "transparent",
              }}
            >
              <span className={entry ? "text-white/90 font-medium" : "text-white/25"}>
                {day}
              </span>
              {entry && (
                <span className="text-[14px] leading-none">
                  {MOOD_EMOJIS[entry.mood]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail */}
      {selectedEntry && (
        <div className="mt-4 p-4 bg-white/3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{MOOD_EMOJIS[selectedEntry.mood]}</span>
            <span className="font-medium">
              {new Date(selectedEntry.date).toLocaleDateString("cs-CZ", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>

          {selectedEntry.activities.length > 0 && (
            <div className="text-sm text-white/50 mb-2">
              {selectedEntry.activities.join(", ")}
            </div>
          )}

          {Object.keys(selectedEntry.habits).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(selectedEntry.habits)
                .filter(([, v]) => v)
                .map(([k]) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 bg-indigo-400/10 rounded-full text-[10px] text-indigo-300"
                  >
                    {k}
                  </span>
                ))}
            </div>
          )}

          {selectedEntry.gratitude.length > 0 && (
            <div className="text-sm text-white/40">
              <div className="text-[10px] uppercase text-white/20 mb-1">Vděčnost</div>
              {selectedEntry.gratitude.map((g, i) => (
                <div key={i} className="text-xs">• {g}</div>
              ))}
            </div>
          )}

          {selectedEntry.note && (
            <div className="text-sm text-white/40 mt-2 italic">
              &ldquo;{selectedEntry.note}&rdquo;
            </div>
          )}

          <button
            onClick={() => {
              localStorage.setItem("diarium_edit_date", selectedEntry.date);
              // Reload will trigger the main page to load this entry
              window.location.href = "/?edit=" + selectedEntry.date;
            }}
            className="btn-glass text-sm w-full mt-3 py-2 text-center"
          >
            ✏️ Upravit tento záznam
          </button>
        </div>
      )}
    </div>
  );
}
