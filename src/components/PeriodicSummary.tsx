"use client";

import { useState, useEffect } from "react";
import { Markdown } from "@/components/Markdown";
import { getAccessToken } from "@/lib/supabase/db";

interface Report {
  content: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

interface Props {
  userId: string;
}

export function PeriodicSummary({ userId }: Props) {
  const [type, setType] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch existing report on mount and when type changes
  useEffect(() => {
    async function fetchExisting() {
      setLoadingReport(true);
      setAnalysis(null);
      setReportMeta(null);
      setError(null);
      try {
        const tok = getAccessToken();
        const resp = await fetch(`/api/ai/reports?type=${type}&user_id=${userId}`, {
          headers: { ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        });
        const json = await resp.json();
        if (json.report) {
          setAnalysis(json.report.content);
          setReportMeta(json.report);
        }
      } catch {}
      setLoadingReport(false);
    }
    fetchExisting();
  }, [type, userId]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const tok = getAccessToken();
      const resp = await fetch("/api/ai/periodic", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { "Authorization": `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ type, user_id: userId }),
      });
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
      } else if (json.analysis) {
        setAnalysis(json.analysis);
        setReportMeta(null); // Live generated, no DB meta
      }
    } catch (e: any) {
      setError(e.message || "Chyba připojení");
    }
    setLoading(false);
  };

  const periodLabel = type === "weekly" ? "Týdenní" : type === "monthly" ? "Měsíční" : "Roční";

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold text-white mb-4">🤖 AI Přehledy</h2>

      <div className="flex gap-2 mb-4">
        {(["weekly", "monthly", "yearly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              type === t
                ? "bg-indigo-500/20 text-white border border-indigo-400/30"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            {t === "weekly" ? "📅 Týdenní" : t === "monthly" ? "🗓️ Měsíční" : "📆 Roční"}
          </button>
        ))}
      </div>

      {/* Existing report (from cron) */}
      {loadingReport && (
        <div className="p-4 text-white/30 text-sm text-center">⏳ Načítám...</div>
      )}

      {analysis && (
        <div className="p-4 bg-indigo-500/5 border border-indigo-400/10 rounded-xl mb-4">
          {reportMeta && (
            <div className="text-xs text-white/30 mb-2">
              Vygenerováno {new Date(reportMeta.created_at).toLocaleDateString("cs-CZ")} · období {reportMeta.period_start} až {reportMeta.period_end}
            </div>
          )}
          {!reportMeta && (
            <div className="text-xs text-white/30 mb-2">Právě vygenerováno</div>
          )}
          <Markdown content={analysis} />
        </div>
      )}

      {!loadingReport && !analysis && (
        <div className="p-4 text-white/20 text-sm text-center mb-2">
          Zatím žádný {periodLabel.toLowerCase()} report
        </div>
      )}

      {/* Manual generate button */}
      <button
        onClick={fetchSummary}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 text-white/50 hover:text-white/70 text-sm transition-colors"
      >
        {loading ? "⏳ AI přemýšlí..." : `🔄 Znovu vygenerovat ${periodLabel.toLowerCase()} přehled`}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error === "Not enough data yet"
            ? "Zatím není dostatek dat. Potřebuješ alespoň 2 dny záznamů."
            : `Chyba: ${error}`}
        </div>
      )}
    </div>
  );
}
