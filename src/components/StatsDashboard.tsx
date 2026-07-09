"use client";

import { useState, useEffect } from "react";
import { YearInPixels } from "@/components/YearInPixels";
import { CalendarView } from "@/components/CalendarView";
import { ScreenTimeChart } from "@/components/ScreenTimeChart";
import { ActivityMoodChart } from "@/components/ActivityMoodChart";
import { PeriodicSummary } from "@/components/PeriodicSummary";
import { fetchDailyEntries, type DailyEntry } from "@/lib/stats";

export function StatsDashboard({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "correlation" | "screentime" | "ai" | "year">("calendar");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const isVojta = userEmail === "vojta1@gmail.com" || userEmail === "vojtech.marvan@gmail.com";

  useEffect(() => {
    fetchDailyEntries()
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sb-vmqbslghzgfotwhzgawa-auth-token');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.user?.id) setUserId(parsed.user.id);
          if (parsed.user?.email) setUserEmail(parsed.user.email);
        }
      } catch {}
    }
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

      {/* Tab bar — reordered: Calendar → Correlations → Screen → AI → Pixels */}
      <div className="flex gap-1 mb-6 max-w-md mx-auto">
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
          onClick={() => setTab("correlation")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "correlation"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          🔗 Korelace
        </button>
        {isVojta && (
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
        )}
        <button
          onClick={() => setTab("ai")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "ai"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          🤖 AI
        </button>
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
      </div>

      <div className="max-w-2xl mx-auto pb-16">
        {tab === "calendar" && <CalendarView entries={entries} onNavigateToDate={onNavigateToDate} />}
        {tab === "correlation" && <ActivityMoodChart entries={entries} />}
        {tab === "screentime" && isVojta && <ScreenTimeChart entries={entries} />}
        {tab === "ai" && <PeriodicSummary userId={userId} />}
        {tab === "year" && <YearInPixels />}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex">
          <button
            onClick={() => window.location.href = "/"}
            className="flex-1 py-2.5 text-xs font-medium text-white/30 hover:text-white/50 flex items-center justify-center gap-1.5 transition-colors"
          >
            📝 Check-in
          </button>
          <button className="flex-1 py-2.5 text-xs font-medium text-white flex items-center justify-center gap-1.5">
            📊 Statistiky
          </button>
        </div>
      </div>
    </div>
  );
}
