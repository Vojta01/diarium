"use client";

const MOODS = [
  { value: 5, emoji: "😄", label: "Skvěle" },
  { value: 4, emoji: "🙂", label: "Dobře" },
  { value: 3, emoji: "😐", label: "Jde to" },
  { value: 2, emoji: "😟", label: "Špatně" },
  { value: 1, emoji: "😡", label: "Hrozně" },
];

const SLEEP_QUALITY = [
  { value: 5, emoji: "😴", label: "Výborný" },
  { value: 4, emoji: "💤", label: "Dobrý" },
  { value: 3, emoji: "🥱", label: "OK" },
  { value: 2, emoji: "😵", label: "Špatný" },
  { value: 1, emoji: "🥴", label: "Hrozný" },
];

export function MoodStep({
  onSelect,
  selected,
  sleepQuality,
  onSleepQuality,
}: {
  onSelect: (mood: number) => void;
  selected: number;
  sleepQuality: number;
  onSleepQuality: (q: number) => void;
}) {
  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold text-center mb-6">
        Jak se dnes cítíš?
      </h2>
      <div className="flex justify-center gap-3 flex-wrap">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => onSelect(m.value)}
            className={`btn-mood ${selected === m.value ? "selected" : ""}`}
            aria-label={m.label}
          >
            <span className="block">{m.emoji}</span>
            <span className="block text-xs mt-1 text-white/50">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Sleep quality — shown after mood pick */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <h3 className="text-sm text-white/40 text-center mb-4">
          Jak ses vyspal?
        </h3>
        <div className="flex justify-center gap-2 flex-wrap">
          {SLEEP_QUALITY.map((s) => (
            <button
              key={s.value}
              onClick={() => onSleepQuality(s.value)}
              className={`btn-mood ${sleepQuality === s.value ? "selected" : ""}`}
              style={{ transform: "scale(0.9)" }}
              aria-label={s.label}
            >
              <span className="block">{s.emoji}</span>
              <span className="block text-[10px] mt-1 text-white/50">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
