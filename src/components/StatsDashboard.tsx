"use client";

import { useState, useEffect } from "react";
import { YearInPixels } from "@/components/YearInPixels";
import { CalendarView } from "@/components/CalendarView";
import { ScreenTimeChart } from "@/components/ScreenTimeChart";
import { ActivityMoodChart } from "@/components/ActivityMoodChart";
import { PeriodicSummary } from "@/components/PeriodicSummary";
import { fetchDailyEntries, type DailyEntry } from "@/lib/stats";
import { getSupabaseAuthTokenKey } from "@/lib/supabase-ref";
import { getFeatureFlags } from "@/lib/feature-flags";
import { useTranslation } from "@/lib/i18n";

export function StatsDashboard({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "correlation" | "screentime" | "ai" | "year">("calendar");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const flags = getFeatureFlags();

  useEffect(() => {
    fetchDailyEntries()
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(getSupabaseAuthTokenKey());
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
        <div className="text-white/40 text-lg">{t("statsDashboard.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pt-8">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          {t("statsDashboard.title")}
        </h1>
        <p className="text-white/40 text-sm mt-1">{t("statsDashboard.subtitle")}</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 max-w-md mx-auto">
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "calendar"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          {t("statsDashboard.tab_calendar")}
        </button>
        <button
          onClick={() => setTab("correlation")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "correlation"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          {t("statsDashboard.tab_correlation")}
        </button>
        {flags.screenTime && (
          <button
            onClick={() => setTab("screentime")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === "screentime"
                ? "bg-indigo-500/20 text-white border border-indigo-400/30"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            {t("statsDashboard.tab_screentime")}
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
          {t("statsDashboard.tab_ai")}
        </button>
        <button
          onClick={() => setTab("year")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === "year"
              ? "bg-indigo-500/20 text-white border border-indigo-400/30"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          {t("statsDashboard.tab_pixels")}
        </button>
      </div>

      <div className="max-w-2xl mx-auto pb-16">
        {tab === "calendar" && <CalendarView entries={entries} onNavigateToDate={onNavigateToDate} />}
        {tab === "correlation" && <ActivityMoodChart entries={entries} />}
        {tab === "screentime" && flags.screenTime && <ScreenTimeChart entries={entries} />}
        {tab === "ai" && <PeriodicSummary userId={userId} />}
        {tab === "year" && <YearInPixels />}
      </div>

    </div>
  );
}
