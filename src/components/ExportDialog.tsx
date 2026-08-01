"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const resp = await fetch(`/api/export/${format}?${params}`);
      
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Export failed" }));
        throw new Error(err.error || `Export failed (${resp.status})`);
      }

      // Download the file
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diarium-export-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      onClose();
    } catch (e: any) {
      setError(e.message || "Export failed");
    }
    setExporting(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-card p-6 w-full max-w-sm mx-4 mb-4 sm:mb-0">
        <h2 className="text-xl font-bold text-white mb-4">{t("export.title")}</h2>

        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        {/* Date range */}
        <label className="block mb-3">
          <span className="text-sm text-white/60 mb-1 block">{t("export.date_range")}</span>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-xs text-white/30 block mb-0.5">{t("export.from")}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex-1">
              <span className="text-xs text-white/30 block mb-0.5">{t("export.to")}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        </label>

        {/* Format */}
        <label className="block mb-4">
          <span className="text-sm text-white/60 mb-1 block">{t("export.format")}</span>
          <div className="flex gap-2">
            {(["csv", "pdf"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  format === fmt
                    ? "bg-indigo-500 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                {t(`export.${fmt}`)}
              </button>
            ))}
          </div>
        </label>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {exporting ? t("export.exporting") : t("export.export_button")}
        </button>
      </div>
    </div>
  );
}
