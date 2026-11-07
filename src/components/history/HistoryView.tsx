"use client";

import { useCallback, useEffect, useState } from "react";

import { CalendarView } from "@/components/CalendarView";
import { PhotoGallery } from "@/components/PhotoGallery";
import { useTranslation } from "@/lib/i18n";
import { fetchDailyEntries, type DailyEntry } from "@/lib/stats";
import { useDataRefresh } from "@/lib/use-data-refresh";

interface HistoryViewProps {
  onNavigateToDate: (date: string) => void;
}

/**
 * Interim History destination. It reuses the real calendar and photo gallery
 * components already backed by `entries`; the final Android-style History
 * screen (day detail, month grouping) lands in a later phase.
 */
export function HistoryView({ onNavigateToDate }: HistoryViewProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"calendar" | "photos">("calendar");

  const load = useCallback(() => {
    let active = true;

    fetchDailyEntries()
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch((error) => {
        console.error("History load error:", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);
  useDataRefresh(["entries"], load);

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={t("history.view_mode")}
        className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
      >
        {(["calendar", "photos"] as const).map((item) => {
          const selected = mode === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(item)}
              className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                selected
                  ? "bg-indigo-500/20 text-[color:var(--text-1)] ring-1 ring-indigo-400/30"
                  : "text-[color:var(--text-3)] hover:text-[color:var(--text-2)]"
              }`}
            >
              {t(
                item === "calendar"
                  ? "statsDashboard.tab_calendar"
                  : "statsDashboard.tab_photos"
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="glass-card animate-pulse-slow text-sm text-[color:var(--text-2)]">
          {t("history.loading")}
        </div>
      ) : mode === "calendar" ? (
        <CalendarView entries={entries} onNavigateToDate={onNavigateToDate} />
      ) : (
        <PhotoGallery entries={entries} onNavigateToDate={onNavigateToDate} />
      )}
    </div>
  );
}
