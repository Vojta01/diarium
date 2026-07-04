"use client";

import { useState } from "react";

interface Props {
  userId: string;
}

export function PeriodicSummary({ userId }: Props) {
  const [type, setType] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const resp = await fetch("/api/ai/periodic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, user_id: userId }),
      });
      const json = await resp.json();
      if (json.error) {
        setError(json.error);
      } else if (json.analysis) {
        setAnalysis(json.analysis);
      }
    } catch (e: any) {
      setError(e.message || "Chyba připojení");
    }
    setLoading(false);
  };

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold text-white mb-4">🤖 AI Přehledy</h2>

      <div className="flex gap-2 mb-4">
        {(["weekly", "monthly", "yearly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setAnalysis(null); setError(null); }}
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

      <button
        onClick={fetchSummary}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium transition-colors mb-4"
      >
        {loading ? "⏳ AI přemýšlí..." : `✨ Generovat ${type === "weekly" ? "týdenní" : type === "monthly" ? "měsíční" : "roční"} přehled`}
      </button>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error === "Not enough data yet"
            ? "Zatím není dostatek dat. Potřebuješ alespoň 2 dny záznamů."
            : `Chyba: ${error}`}
        </div>
      )}

      {analysis && (
        <div className="p-4 bg-indigo-500/5 border border-indigo-400/10 rounded-xl">
          <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}
