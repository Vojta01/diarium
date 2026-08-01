"use client";

import type { Scale } from "@/lib/scales";

interface ScaleSliderProps {
  scale: Scale;
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
}

export function ScaleSlider({ scale, value, onChange, readonly }: ScaleSliderProps) {
  const range = scale.max_value - scale.min_value + 1;
  
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Label */}
      <div className="flex items-center gap-1.5 min-w-[100px]">
        <span className="text-lg">{scale.emoji}</span>
        <span className="text-sm text-white/80 font-medium truncate">{scale.name}</span>
        {scale.unit && (
          <span className="text-xs text-white/40 ml-0.5">{scale.unit}</span>
        )}
      </div>
      
      {/* Number buttons */}
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
              className={`
                w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? `text-white shadow-lg scale-110`
                  : `text-white/50 hover:text-white/80 hover:bg-white/10 active:scale-90`
                }
                ${readonly ? 'cursor-default' : 'cursor-pointer'}
              `}
              style={{
                backgroundColor: isActive ? scale.color : 'transparent',
                boxShadow: isActive ? `0 0 12px ${scale.color}40` : 'none',
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
