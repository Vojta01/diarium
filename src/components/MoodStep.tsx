"use client";

const MOODS = [
  { value: 5, emoji: "😄", label: "Skvěle" },
  { value: 4, emoji: "🙂", label: "Dobře" },
  { value: 3, emoji: "😐", label: "Jde to" },
  { value: 2, emoji: "😟", label: "Špatně" },
  { value: 1, emoji: "😡", label: "Hrozně" },
];

export function MoodStep({
  onSelect,
  selected,
}: {
  onSelect: (mood: number) => void;
  selected: number;
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
    </div>
  );
}
