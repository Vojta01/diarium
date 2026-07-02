"use client";

const ACTIVITIES: { emoji: string; label: string; category: string }[] = [
  // Jídlo
  { emoji: "🥗", label: "Zdravě", category: "Jídlo" },
  { emoji: "🍔", label: "Fast food", category: "Jídlo" },
  { emoji: "🍳", label: "Domácí", category: "Jídlo" },
  { emoji: "🍽️", label: "Restaurace", category: "Jídlo" },
  { emoji: "📦", label: "Donáška", category: "Jídlo" },
  // Pohyb
  { emoji: "🏋️", label: "Trénink", category: "Pohyb" },
  { emoji: "🚶", label: "Chůze", category: "Pohyb" },
  { emoji: "🚴", label: "Kolo", category: "Pohyb" },
  { emoji: "🏊", label: "Plavání", category: "Pohyb" },
  { emoji: "🏄", label: "Paddleboard", category: "Pohyb" },
  { emoji: "🎱", label: "Snooker", category: "Pohyb" },
  // Záliby
  { emoji: "📖", label: "Čtení", category: "Záliby" },
  { emoji: "🎵", label: "Hudba", category: "Záliby" },
  { emoji: "🎬", label: "Filmy/TV", category: "Záliby" },
  { emoji: "🎮", label: "Hry", category: "Záliby" },
  { emoji: "😴", label: "Relax", category: "Záliby" },
  // Společnost
  { emoji: "👥", label: "Přátelé", category: "Lidé" },
  { emoji: "👨‍👩‍👧", label: "Rodina", category: "Lidé" },
  { emoji: "💑", label: "Rande", category: "Lidé" },
  { emoji: "🎉", label: "Párty", category: "Lidé" },
  { emoji: "🏢", label: "Office", category: "Lidé" },
  // Osobní
  { emoji: "🧘", label: "Meditace", category: "Osobní" },
  { emoji: "💆", label: "Terapie", category: "Osobní" },
  { emoji: "🛒", label: "Nákupy", category: "Osobní" },
  { emoji: "🧹", label: "Úklid", category: "Osobní" },
  { emoji: "💤", label: "Spánek", category: "Osobní" },
];

const WEATHER = [
  { emoji: "☀️", label: "Slunečno" },
  { emoji: "☁️", label: "Zataženo" },
  { emoji: "🌧️", label: "Déšť" },
  { emoji: "❄️", label: "Sníh" },
  { emoji: "🌡️", label: "Horko" },
  { emoji: "🌩️", label: "Bouřka" },
  { emoji: "💨", label: "Vítr" },
];

export function ActivityStep({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: string[];
  onToggle: (activity: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const toggle = (label: string) => onToggle(label);

  return (
    <div className="glass-card">
      <h2 className="text-xl font-semibold text-center mb-4">Co jsi dnes dělal?</h2>

      <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
        {(["Jídlo", "Pohyb", "Záliby", "Lidé", "Osobní"] as string[]).map(
          (cat) => {
            const items = ACTIVITIES.filter((a) => a.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs text-white/30 uppercase tracking-wider mb-2">
                  {cat}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => toggle(a.label)}
                      className={`activity-btn ${
                        selected.includes(a.label) ? "selected" : ""
                      }`}
                    >
                      <span className="text-2xl">{a.emoji}</span>
                      <span className="text-xs text-white/60">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }
        )}

        <div>
          <h3 className="text-xs text-white/30 uppercase tracking-wider mb-2">
            Počasí
          </h3>
          <div className="flex flex-wrap gap-2">
            {WEATHER.map((w) => (
              <button
                key={w.label}
                onClick={() => toggle(w.label)}
                className={`activity-btn ${
                  selected.includes(w.label) ? "selected" : ""
                }`}
              >
                <span className="text-2xl">{w.emoji}</span>
                <span className="text-xs text-white/60">{w.label}</span>
              </button>
            ))}
          </div>
        </div>
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
