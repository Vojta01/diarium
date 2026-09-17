"use client";

import { useState } from "react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useTranslation } from "@/lib/i18n";
import type { HabitDef } from "@/lib/supabase/db";

interface HabitEditDialogProps {
  onClose: () => void;
  /** `habit` present → edit that habit (icon, label, type), absent → create. */
  onSave: (habit: { name: string; icon: string; isNegative: boolean }) => void;
  habit?: HabitDef | null;
}

/** Mounted only while open, so the fields start from props on every open. */
export function HabitEditDialog({ onClose, onSave, habit }: HabitEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(habit?.label ?? "");
  const [icon, setIcon] = useState(habit?.icon || "✅");
  const [isNegative, setIsNegative] = useState(habit?.is_negative ?? false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError(t("habits.error_name"));
      return;
    }
    onSave({ name: name.trim(), icon: icon || "✅", isNegative });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 flex items-center gap-2">
          <span className="text-xl leading-none">{icon || "✅"}</span>
          <h3 className="text-base font-semibold text-white">
            {habit ? t("habits.edit_title") : t("habits.new_title")}
          </h3>
        </div>

        <div className="px-5 pb-2 space-y-3">
          {error && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{error}</div>}

          <div>
            <label className="block text-[11px] text-white/40 mb-1 uppercase tracking-wider">
              {t("habits.name_label")}
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("habits.name_placeholder")}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") submit();
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
            />
          </div>

          <EmojiPicker value={icon} onChange={setIcon} label={t("emojiPicker.label")} />

          <button
            type="button"
            onClick={() => setIsNegative(!isNegative)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
              isNegative ? "bg-red-500/10 border-red-400/30" : "bg-white/5 border-white/10"
            }`}
          >
            <span
              className={`w-12 h-7 rounded-full relative shrink-0 transition-colors ${
                isNegative ? "bg-red-500/60" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  isNegative ? "translate-x-[22px]" : "translate-x-[2px]"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-white/80">{t("habits.negative_label")}</span>
              <span className="block text-[11px] text-white/35 leading-snug">{t("habits.negative_hint")}</span>
            </span>
          </button>

          {habit && (
            <p className="text-[11px] text-white/25 leading-snug">{t("habits.key_note")}</p>
          )}
        </div>

        <div className="px-5 pb-5 pt-1 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/60 text-sm font-medium hover:bg-white/20 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
