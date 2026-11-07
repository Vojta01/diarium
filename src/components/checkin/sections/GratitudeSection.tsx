"use client";

import { useTranslation } from "@/lib/i18n";

import { CheckInSection } from "../CheckInSection";

/** The three canonical slots; extras are legacy values the user can prune. */
export const GRATITUDE_MIN_SLOTS = 3;
export const GRATITUDE_MAX_SLOTS = 5;

/**
 * Za co jsi vděčný? — the first three slots are the stored contract. Legacy
 * rows with more than three values keep them visible and removable instead of
 * silently dropping data; "add" appends an extra slot (max five).
 */
export function GratitudeSection({
  values,
  onChange,
}: {
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation();
  const rows = Math.max(values.length, GRATITUDE_MIN_SLOTS);

  const update = (index: number, value: string) => {
    const next = [...values];
    while (next.length < rows) next.push("");
    next[index] = value;
    onChange(next);
  };

  const add = () => {
    if (rows >= GRATITUDE_MAX_SLOTS) return;
    const next = [...values];
    while (next.length < rows) next.push("");
    next.push("");
    onChange(next);
  };

  const remove = (index: number) => {
    if (index < GRATITUDE_MIN_SLOTS) return;
    onChange(values.filter((_, position) => position !== index));
  };

  return (
    <CheckInSection id="gratitude" title={t("checkin.gratitude_title")}>
      <ul className="space-y-2">
        {Array.from({ length: rows }, (_, index) => {
          const inputId = `checkin-gratitude-${index}`;
          return (
            <li key={index} className="flex items-center gap-2">
              <label
                htmlFor={inputId}
                className="w-5 shrink-0 text-right text-[13px] text-[color:var(--text-3)]"
              >
                {index + 1}.
              </label>
              <input
                id={inputId}
                value={values[index] ?? ""}
                maxLength={200}
                onChange={(event) => update(index, event.target.value)}
                placeholder={t("checkin.gratitude_placeholder", { n: index + 1 })}
                aria-label={t("checkin.gratitude_slot", { n: index + 1 })}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-[color:var(--text-1)] placeholder:text-white/25 focus:border-indigo-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              />
              {index >= GRATITUDE_MIN_SLOTS ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t("checkin.gratitude_remove", { n: index + 1 })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--text-3)] transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80"
                >
                  ✕
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows < GRATITUDE_MAX_SLOTS ? (
        <button
          type="button"
          onClick={add}
          className="mt-2 min-h-11 rounded-lg px-2 text-[12px] text-indigo-300/80 transition-colors hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80"
        >
          ＋ {t("checkin.gratitude_add")}
        </button>
      ) : null}
    </CheckInSection>
  );
}
