"use client";

import type { Scale } from "@/lib/scales";

const SCALE_EMOJIS = ["", "😐", "🙂", "😊", "😄", "🔥"];
const SCALE_LABELS = ["", "Nízká", "Podprůměrná", "Průměrná", "Nadprůměrná", "Vysoká"];

interface ScaleSliderProps {
  scale: Scale;
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
}

export function ScaleSlider({ scale, value, onChange, readonly }: ScaleSliderProps) {
  const range = scale.max_value - scale.min_value + 1;

  // For 5-level scales, use emoji buttons (same pattern as stress)
  if (range === 5) {
    const colors = [
      "", // index 0 unused
      scale.color + "40",
      scale.color + "60",
      scale.color + "80",
      scale.color + "A0",
      scale.color,
    ];

    return (
      <div className="flex items-center gap-1 w-full">
        <div className="flex items-center gap-1.5 min-w-[80px]">
          <span className="text-lg">{scale.emoji}</span>
          <span className="text-xs text-white/70 font-medium truncate">{scale.name}</span>
        </div>
        <div className="flex gap-1 flex-1 justify-end">
          {[1, 2, 3, 4, 5].map((num) => {
            const isActive = value === num;
            return (
              <button
                key={num}
                type="button"
                disabled={readonly}
                onClick={() => onChange(num)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1 rounded-lg transition-all ${
                  isActive
                    ? `ring-1`
                    : "bg-white/5 hover:bg-white/10"
                } ${readonly ? "cursor-default" : "cursor-pointer"}`}
                style={{
                  backgroundColor: isActive ? colors[num] : undefined,
                  borderColor: isActive ? scale.color : "transparent",
                  boxShadow: isActive ? `0 0 8px ${scale.color}40` : "none",
                }}
              >
                <span className="text-base">{SCALE_EMOJIS[num]}</span>
                <span className="text-[8px] text-white/40">{SCALE_LABELS[num]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // For other ranges, use number buttons
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 min-w-[100px]">
        <span className="text-lg">{scale.emoji}</span>
        <span className="text-sm text-white/80 font-medium truncate">{scale.name}</span>
      </div>

      <div className="flex items-center gap-1 flex-1 justify-end">
        {Array.from({ length: range }, (_, i) => {
          const num = scale.min_value + i;
          const isActive = value === num;

          return (
            <button
              key={num}
              type="button"
              disabled={readonly}
              onClick={() => onChange(num)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "text-white shadow-lg scale-110"
                  : "text-white/50 hover:text-white/80 hover:bg-white/10 active:scale-90"
              } ${readonly ? "cursor-default" : "cursor-pointer"}`}
              style={{
                backgroundColor: isActive ? scale.color : "transparent",
                boxShadow: isActive ? `0 0 12px ${scale.color}40` : "none",
              }}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
