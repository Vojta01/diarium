"use client";

export function HabitsStep({
  habits,
  habitDefs,
  onToggle,
  onNext,
  onBack,
}: {
  habits: Record<string, boolean>;
  habitDefs: Record<string, { emoji: string; label: string; abstinence: boolean }>;
  onToggle: (habit: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold text-center mb-4">Denní návyky</h2>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {Object.entries(habitDefs).map(([key, def]) => {
          const isOn = habits[key];
          // For abstinence habits, "on" (true) = relapsed, so green = false
          const isGreen = def.abstinence ? !isOn : isOn;

          return (
            <div key={key} className="habit-row">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{def.emoji}</span>
                <span className="text-sm">{def.label}</span>
                {def.abstinence && (
                  <span className="text-[10px] text-white/25 px-1.5 py-0.5 rounded-full border border-white/10">
                    abstinence
                  </span>
                )}
              </div>
              <button
                onClick={() => onToggle(key)}
                className={`habit-toggle ${isGreen ? "on" : "off"}`}
                aria-label={def.label}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-glass flex-1">
          ← Zpět
        </button>
        <button onClick={onNext} className="btn-primary flex-1">
          Pokračovat
        </button>
      </div>
    </div>
  );
}
