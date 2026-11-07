"use client";

import { Fragment, type ReactNode } from "react";

import type { CheckInData } from "@/lib/types";
import type { ActivityDef, HabitDef } from "@/lib/supabase/db";
import type { Scale } from "@/lib/scales";
import { useTranslation } from "@/lib/i18n";
import { toggleWeatherKey } from "@/lib/checkin/options";
import {
  CHECKIN_SECTION_ORDER,
  hasContent,
  type CheckInSectionId,
} from "@/lib/checkin/model";

import { ActivitiesSection } from "./sections/ActivitiesSection";
import { GratitudeSection } from "./sections/GratitudeSection";
import { HabitsSection } from "./sections/HabitsSection";
import { MoodSection, SleepSection, StressSection } from "./sections/MoodSleepStress";
import { NoteSection } from "./sections/NoteSection";
import { PhotoSection } from "./sections/PhotoSection";
import { ScalesSection } from "./sections/ScalesSection";
import { WeatherSection } from "./sections/WeatherSection";

export interface CheckInFormProps {
  data: CheckInData;
  /** The date being edited; photo uploads are scoped to it. */
  date: string;
  setData: (updater: (data: CheckInData) => CheckInData) => void;
  onPhotoSelected: (url: string | null) => void;
  onPhotoUploading: (uploading: boolean) => void;
  activities: readonly ActivityDef[];
  hiddenActivities: readonly ActivityDef[];
  activityError: string | null;
  onToggleActivity: (label: string) => void;
  onAddActivity: (input: {
    name: string;
    icon: string;
    category: string;
  }) => Promise<string | null>;
  onRemoveActivity: (key: string) => void;
  onRestoreActivity: (key: string) => void;
  habits: readonly HabitDef[];
  habitError: string | null;
  onToggleHabit: (key: string, checked: boolean) => void;
  onAddHabit: (input: {
    name: string;
    icon: string;
    isNegative: boolean;
  }) => Promise<string | null>;
  onUpdateHabit: (
    key: string,
    input: { name: string; icon: string; isNegative: boolean }
  ) => Promise<string | null>;
  onRemoveHabit: (key: string) => void;
  scales: readonly Scale[];
  scalesLoading: boolean;
  scalesError: string | null;
  onScaleChange: (scale: Scale, value: number) => void;
  onClearScale: (scale: Scale) => void;
  onRetryScales: () => void;
  saving: boolean;
  photoUploading: boolean;
  saved: boolean;
  loadFailed: boolean;
  onSave: () => void;
  onViewPhoto: (url: string) => void;
}

/**
 * The ordered check-in form.
 *
 * Sections are built into a map and rendered by iterating
 * `CHECKIN_SECTION_ORDER`, so the visual order can never drift from Android's.
 * Reserved ids (goals, screen time, reflection) are simply absent from the map
 * until their phase lands. The only save action is the inline button below.
 */
export function CheckInForm(props: CheckInFormProps) {
  const { t } = useTranslation();
  const { data, setData } = props;

  const sections: Partial<Record<CheckInSectionId, ReactNode>> = {
    mood: (
      <MoodSection
        value={data.mood}
        onChange={(value, emoji) =>
          setData((current) => ({ ...current, mood: value, moodEmoji: emoji }))
        }
      />
    ),
    sleep: (
      <SleepSection
        value={data.sleepQuality}
        onChange={(value) =>
          setData((current) => ({ ...current, sleepQuality: value }))
        }
      />
    ),
    stress: (
      <StressSection
        value={data.stress}
        onChange={(value) => setData((current) => ({ ...current, stress: value }))}
      />
    ),
    activities: (
      <ActivitiesSection
        activities={props.activities}
        hidden={props.hiddenActivities}
        selected={data.activities}
        error={props.activityError}
        onToggle={props.onToggleActivity}
        onAdd={props.onAddActivity}
        onRemove={props.onRemoveActivity}
        onRestore={props.onRestoreActivity}
      />
    ),
    habits: (
      <HabitsSection
        habits={props.habits}
        values={data.habits}
        error={props.habitError}
        onToggle={props.onToggleHabit}
        onAdd={props.onAddHabit}
        onUpdate={props.onUpdateHabit}
        onRemove={props.onRemoveHabit}
      />
    ),
    gratitude: (
      <GratitudeSection
        values={data.gratitude}
        onChange={(gratitude) => setData((current) => ({ ...current, gratitude }))}
      />
    ),
    weather: (
      <WeatherSection
        selected={data.weather}
        onToggle={(key) =>
          setData((current) => ({
            ...current,
            weather: toggleWeatherKey(current.weather, key),
          }))
        }
      />
    ),
    photo: (
      <PhotoSection
        currentPhoto={data.photoPath}
        date={props.date}
        legacyPhoto={data.photoLegacy}
        onPhotoSelected={props.onPhotoSelected}
        onUploadingChange={props.onPhotoUploading}
        onView={props.onViewPhoto}
      />
    ),
    scales: (
      <ScalesSection
        scales={props.scales}
        values={data.scaleValues}
        loading={props.scalesLoading}
        error={props.scalesError}
        onChange={props.onScaleChange}
        onClear={props.onClearScale}
        onRetry={props.onRetryScales}
      />
    ),
    note: (
      <NoteSection
        value={data.note}
        onChange={(note) => setData((current) => ({ ...current, note }))}
      />
    ),
  };

  const content = hasContent(data);
  const canSave = content && !props.saving && !props.photoUploading && !props.loadFailed;

  return (
    <div aria-busy={props.saving} className="space-y-3 pb-8">
      {CHECKIN_SECTION_ORDER.map((id) => {
        const section = sections[id];
        return section ? <Fragment key={id}>{section}</Fragment> : null;
      })}

      <div className="pt-2">
        <button
          type="button"
          onClick={props.onSave}
          disabled={!canSave}
          className="min-h-12 w-full rounded-xl bg-indigo-500 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.25)] transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {props.photoUploading
            ? t("checkin.photo_uploading")
            : props.saving
              ? t("checkin.saving_checkin")
              : t("checkin.save_checkin")}
        </button>

        {!content ? (
          <p className="mt-2 text-center text-[12px] text-[color:var(--text-3)]">
            {t("checkin.error_empty")}
          </p>
        ) : null}

        {props.saved ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-center text-[13px] font-medium text-emerald-200"
          >
            {t("checkin.saved")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
