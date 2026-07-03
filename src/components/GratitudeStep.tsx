"use client";

import { PhotoPicker } from "@/components/PhotoPicker";

const STRESS_LEVELS = [
  { value: 1, emoji: "😌", label: "Klid" },
  { value: 2, emoji: "🙂", label: "Pohoda" },
  { value: 3, emoji: "😐", label: "Napětí" },
  { value: 4, emoji: "😰", label: "Stres" },
  { value: 5, emoji: "😤", label: "Krize" },
];

export function GratitudeStep({
  gratitude,
  note,
  photo,
  stress,
  onChangeGratitude,
  onChangeNote,
  onChangeStress,
  onPhotoChange,
  onNext,
  onBack,
}: {
  gratitude: string[];
  note: string;
  photo: string | null;
  stress: number;
  onChangeGratitude: (index: number, value: string) => void;
  onChangeNote: (value: string) => void;
  onChangeStress: (value: number) => void;
  onPhotoChange: (dataUrl: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const currentStress = STRESS_LEVELS.find(s => s.value === stress);

  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold text-center mb-2">Za co jsi dnes vděčný?</h2>
      <p className="text-white/30 text-sm text-center mb-6">Tři věci, klidně maličkosti</p>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-white/20 text-lg w-6 text-right">{i + 1}.</span>
            <input
              value={gratitude[i]}
              onChange={(e) => onChangeGratitude(i, e.target.value)}
              placeholder={`${i + 1}. věc...`}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                         placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50
                         transition-colors"
            />
          </div>
        ))}
      </div>

      {/* Stress level slider */}
      <div className="mt-6">
        <label className="text-white/30 text-sm block mb-3">Úroveň stresu</label>
        <div className="flex items-center gap-2 mb-2">
          {STRESS_LEVELS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChangeStress(s.value)}
              className={`btn-mood flex-1 ${stress === s.value ? "selected" : ""}`}
              style={{ transform: "scale(0.85)" }}
              title={s.label}
            >
              <span className="block text-xl">{s.emoji}</span>
              <span className="block text-[10px] mt-0.5 text-white/40">{s.label}</span>
            </button>
          ))}
        </div>
        {currentStress && (
          <p className="text-center text-xs text-white/25">
            {currentStress.label}
          </p>
        )}
      </div>

      <div className="mt-6">
        <label className="text-white/30 text-sm block mb-2">Fotka (volitelné)</label>
        <PhotoPicker onPhotoSelected={onPhotoChange} currentPhoto={photo} />
      </div>

      <div className="mt-6">
        <label className="text-white/30 text-sm block mb-2">Poznámka (volitelné)</label>
        <textarea
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="Co ti dnes běželo hlavou..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                     placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50
                     transition-colors resize-none"
        />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-glass flex-1">
          ← Zpět
        </button>
        <button onClick={onNext} className="btn-primary flex-1">
          Uložit
        </button>
      </div>
    </div>
  );
}
