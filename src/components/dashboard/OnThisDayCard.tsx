"use client";

import type { DashboardData } from "@/lib/dashboard";
import { formatDashboardDate } from "@/lib/dashboard-ui";
import { useTranslation } from "@/lib/i18n";
import { isRecordedMood } from "@/lib/mood";
import { MOOD_EMOJIS } from "@/lib/stats";

import { ACCENT, Card, Divider, Hint, Lead, SecondaryButton } from "./primitives";

type Memory = NonNullable<DashboardData["onThisDay"]>;

/** 🕰️ One memory from a year, six months or a month ago. */
export function OnThisDayCard({
  memory,
  onOpenDay,
}: {
  memory: Memory;
  onOpenDay: (date: string) => void;
}) {
  const { t, lang } = useTranslation();
  const mood = isRecordedMood(memory.entry.mood) ? memory.entry.mood : null;
  const note = memory.entry.note.trim();
  const date = formatDashboardDate(memory.date, lang, "long");

  return (
    <Card
      cardId="on_this_day"
      title={t("dashboard.on_this_day.title")}
      accent={ACCENT.violet}
      className="h-full"
    >
      <div className="mt-1">
        <Lead>{t(`dashboard.on_this_day.horizon_${memory.horizon}`)}</Lead>
        <Hint>{date}</Hint>
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <span aria-hidden="true" className="text-[26px] leading-none">
          {mood ? MOOD_EMOJIS[mood] : "🕰️"}
        </span>
        <div className="min-w-0 flex-1">
          {mood ? (
            <p className="text-[12px] font-medium text-[color:var(--text-2)]">
              {t(`mood.mood_${mood}`)}
            </p>
          ) : null}
          <p
            className={`mt-0.5 whitespace-pre-line text-[13px] leading-5 text-[color:var(--text-1)] ${
              note ? "" : "italic text-[color:var(--text-3)]"
            }`}
          >
            {note || t("dashboard.on_this_day.no_note")}
          </p>
        </div>
      </div>
      <Divider />
      <SecondaryButton onClick={() => onOpenDay(memory.date)}>
        {t("dashboard.on_this_day.open")}
      </SecondaryButton>
    </Card>
  );
}
