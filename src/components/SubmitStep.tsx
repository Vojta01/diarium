"use client";

import { useState } from "react";
import type { CheckInData } from "@/lib/types";
import { saveCheckIn } from "@/lib/github";

export function SubmitStep({
  data,
  isExisting,
  editDate,
  onBack,
  onDone,
}: {
  data: CheckInData;
  isExisting?: boolean;
  editDate?: string | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isEdit = isExisting || editDate;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("diarium_github_token")!;
      const repo = localStorage.getItem("diarium_repo")!;
      await saveCheckIn(token, repo, data);
      setDone(true);
      setTimeout(onDone, 2500);
    } catch (e: any) {
      setError(e.message || "Něco se pokazilo");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="glass-card text-center py-12">
        <div className="text-6xl mb-4">{isEdit ? "✅" : "✨"}</div>
        <h2 className="text-xl font-semibold mb-2">
          {isEdit ? "Aktualizováno!" : "Uloženo!"}
        </h2>
        <p className="text-white/40 text-sm">
          {isEdit ? "Změny jsou ve tvém vaultu." : "Dnešní zápis je ve tvém vaultu."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold text-center mb-6">
        {isEdit ? "Rekapitulace (editace)" : "Rekapitulace"}
      </h2>

      <div className="space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/40">Nálada</span>
          <span className="text-2xl">{data.moodEmoji || "—"}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/40">Aktivity</span>
          <span className="text-right max-w-[60%]">
            {data.activities.length > 0
              ? data.activities.join(", ")
              : "—"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/40">Návyky</span>
          <span className="text-right max-w-[60%]">
            {Object.entries(data.habits)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(", ") || "—"}
          </span>
        </div>

        {data.gratitude.some((g) => g.trim()) && (
          <div>
            <span className="text-white/40 block mb-1">Vděčnost</span>
            <ul className="list-disc list-inside text-white/70">
              {data.gratitude
                .filter((g) => g.trim())
                .map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
            </ul>
          </div>
        )}

        {data.note && (
          <div>
            <span className="text-white/40 block mb-1">Poznámka</span>
            <p className="text-white/70">{data.note}</p>
          </div>
        )}

        {data.photoDataUrl && (
          <div>
            <span className="text-white/40 block mb-1">Fotka</span>
            <img src={data.photoDataUrl} alt="Fotka" className="rounded-lg max-h-32" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-glass flex-1" disabled={saving}>
          ← Zpět
        </button>
        <button
          onClick={handleSave}
          className="btn-primary flex-1"
          disabled={saving}
        >
          {saving ? "Ukládám..." : isEdit ? "Uložit změny" : "Uložit do vaultu"}
        </button>
      </div>
    </div>
  );
}
