"use client";

import { Fragment, type ReactNode } from "react";

import type { CheckInError } from "@/lib/checkin/errors";
import type { GoalProgressData } from "@/lib/goal-progress";
import type { Goal } from "@/lib/goals";
import type { CheckInData } from "@/lib/types";
import type { ActivityDef, HabitDef } from "@/lib/supabase/db";
import type { Scale } from "@/lib/scales";
import { useTranslation } from "@/lib/i18n";
import { getFeatureFlags } from "@/lib/feature-flags";
import { toggleWeatherKey } from "@/lib/checkin/options";
import {
  hasContent,
  shouldRenderGoalsSection,
  visibleCheckInSections,
  type CheckInSectionId,
} from "@/lib/checkin/model";

import { ActivitiesSection } from "./sections/ActivitiesSection";
import { GoalsReadonlySection } from "./sections/GoalsReadonlySection";
import { GratitudeSection } from "./sections/GratitudeSection";
import { HabitsSection } from "./sections/HabitsSection";
import { MoodSection, SleepSection, StressSection } from "./sections/MoodSleepStress";
import { NoteSection } from "./sections/NoteSection";
import { PhotoSection } from "./sections/PhotoSection";
import { ReflectionSection } from "./sections/ReflectionSection";
import { ScalesSection } from "./sections/ScalesSection";
import { ScreenTimeSection } from "./sections/ScreenTimeSection";
import { WeatherSection } from "./sections/WeatherSection";

export interface CheckInFormProps {
  data: CheckInData;
  /** The date being edited; photo uploads are scoped to it. */
  date: string;
  setData: (updater: (data: CheckInData) => CheckInData) => void;
  onPhotoSelected: (url: string | null, uploadDate?: string) => void;
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
  onRemoveActivity: (key: string) => string | null | Promise<string | null>;
  onRestoreActivity: (key: string) => string | null | Promise<string | null>;
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
  onRemoveHabit: (key: string) => string | null | Promise<string | null>;
  scales: readonly Scale[];
  scalesLoading: boolean;
  scalesError: string | null;
  onScaleChange: (scale: Scale, value: number) => void;
  onClearScale: (scale: Scale) => void;
  onRetryScales: () => void;
  saving: boolean;
  photoUploading: boolean;
  /** The user removed the stored photo in this edit. */
  photoCleared: boolean;
  /** The loaded row has a stored photo that can be cleared. */
  hasStoredPhoto: boolean;
  saved: boolean;
  loadFailed: boolean;
  /** The form has edits that are not saved yet. */
  dirty: boolean;
  goals: readonly GoalProgressData<Goal>[];
  goalsLoading: boolean;
  /** i18n key for a failed goals read. */
  goalsError: string | null;
  onRetryGoals: () => void;
  onOpenGoals: () => void;
  reflectionLoading: boolean;
  reflectionError: CheckInError | null;
  reflectionCached: boolean;
  reflectionCanGenerate: boolean;
  onGenerateReflection: () => void;
  onSave: () => void;
  onViewPhoto: (url: string) => void;
}

/**
 * The ordered check-in form.
 *
 * Sections are built into a map and rendered by iterating
 * `CHECKIN_SECTION_ORDER`, so the visual order can never drift from Android's.
 * Goals, screen time and the AI reflection are read-only reports; the only
 * save action is the inline button below.
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
    goals: shouldRenderGoalsSection(props.goalsError) ? (
      <GoalsReadonlySection
        rows={props.goals}
        loading={props.goalsLoading}
        error={props.goalsError}
        onRetry={props.onRetryGoals}
        onOpenGoals={props.onOpenGoals}
      />
    ) : null,
    screenTime: <ScreenTimeSection data={data} />,
    reflection: (
      <ReflectionSection
        reflection={data.aiReflection}
        loading={props.reflectionLoading}
        error={props.reflectionError}
        cached={props.reflectionCached}
        canGenerate={props.reflectionCanGenerate}
        dirty={props.dirty}
        onGenerate={props.onGenerateReflection}
      />
    ),
  };

  const content = hasContent(data);
  const clearingPhoto = props.photoCleared && props.hasStoredPhoto;
  const canSave =
    (content || clearingPhoto) &&
    !props.saving &&
    !props.photoUploading &&
    !props.loadFailed;
  const order = visibleCheckInSections(getFeatureFlags());

  return (
    <div aria-busy={props.saving} className="space-y-3 pb-8">
      {/*
        While a save is in flight every field is locked, not just the button.
        `disabled` covers native controls and `inert` covers custom clickable
        elements, so an edit made after the POST started cannot be silently
        overwritten by the server row that comes back.
      */}
      <fieldset
        disabled={props.saving}
        inert={props.saving}
        className="m-0 min-w-0 space-y-3 border-0 p-0"
      >
        {order.map((id) => {
          const section = sections[id];
          return section ? <Fragment key={id}>{section}</Fragment> : null;
        })}
      </fieldset>

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

        {!content && !clearingPhoto ? (
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
