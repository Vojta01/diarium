"use client";

import { StatsDashboard } from "@/components/StatsDashboard";
import { AdvancedStats } from "@/components/AdvancedStats";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

export default function StatsPage() {
  const { t } = useTranslation();
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="min-h-screen p-4 pt-6 pb-24 space-y-6">
      <StatsDashboard />
      <AdvancedStats />
      <AchievementsPanel />

      {/* Export button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setShowExport(true)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors text-sm"
        >
          📥 {t("export.export_button")}
        </button>
      </div>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
