"use client";

import { useState, useEffect } from "react";
import { YearInPixels } from "@/components/YearInPixels";
import { CalendarView } from "@/components/CalendarView";
import { ScreenTimeChart } from "@/components/ScreenTimeChart";
import { ActivityMoodChart } from "@/components/ActivityMoodChart";
import { fetchDailyEntries, type DailyEntry } from "@/lib/stats";

export function StatsDashboard({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"year" | "calendar" | "screentime" | "correlation">("year");

  useEffect(() => {
    fetchDailyEntries()
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">Načítám statistiky...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pt-8">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Diarium
        </h1>
        <p className="text-white/40 text-sm mt-1">Statistiky</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 max-w-md mx-auto">
        <button
          onClick={() => setTab("year")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "year"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          📅 Pixels
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "calendar"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          🗓️ Kalendář
        </button>
        <button
          onClick={() => setTab("screentime")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "screentime"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          📱 Screen
        </button>
        <button
          onClick={() => setTab("correlation")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "correlation"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          🔗 Korelace
        </button>
      </div>

      <div className="max-w-2xl mx-auto">
        {tab === "year" && <YearInPixels />}
        {tab === "calendar" && <CalendarView entries={entries} onNavigateToDate={onNavigateToDate} />}
        {tab === "screentime" && <ScreenTimeChart entries={entries} />}
        {tab === "correlation" && <ActivityMoodChart entries={entries} />}
      </div>
    </div>
  );
}
