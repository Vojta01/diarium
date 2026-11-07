"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAccessToken,
  getActivities,
  getEntryOrThrow,
  getHiddenActivities,
  getHabits,
  saveEntry,
  type ActivityDef,
  type Entry,
  type HabitDef,
} from "@/lib/supabase/db";
import { useTranslation } from "@/lib/i18n";
import { readStoredSession } from "@/lib/auth-storage";
import { pragueDateKey, shiftDateKey } from "@/lib/date";
import { notifyDataChanged } from "@/lib/data-refresh";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { getScalesOrThrow, seedDefaultScales, type Scale } from "@/lib/scales";
import type { CheckInData } from "@/lib/types";
import { isRecordedMood } from "@/lib/mood";
import {
  emptyCheckIn,
  fromEntry,
  hasContent,
  positiveScaleValues,
  filteredGratitude,
} from "@/lib/checkin/model";
import { buildCheckInPayload } from "@/lib/checkin/payload";
import { saveCheckIn } from "@/lib/checkin/save";
import { loadCheckIn } from "@/lib/checkin/load";
import {
  clampCheckInDate,
  isLateNight,
  isValidDateKey,
} from "@/lib/checkin/dates";
import { createDraftWriter, readDraft } from "@/lib/checkin/draft";
import {
  aiEmptyError,
  aiFailedError,
  aiNetworkError,
  type CheckInError,
} from "@/lib/checkin/errors";

import { CheckInForm } from "./CheckInForm";
import { CheckInHeader } from "./CheckInHeader";
import { StoredDayView } from "./StoredDayView";
import { PhotoViewer } from "./dialogs/PhotoViewer";

/**
 * Check-in orchestrator: date, load token, modes, save, draft and the
 * activity/habit/scale mutations. It renders no section internals — those live
 * in `sections/*` and are ordered by `CHECKIN_SECTION_ORDER`.
 *
 * Phase 2A renders mood → note. Goals, screen time and the AI reflection stay
 * reserved in the order constant for the following phases.
 */
export function CheckInScreen({
  onSaveDone,
  initialDate,
}: {
  onSaveDone: () => void;
  initialDate?: string | null;
}) {
  const { t, lang } = useTranslation();
  const today = pragueDateKey();
  // `?edit=DATE` is the explicit "open the form" signal; a plain Today visit
  // opens a recorded day passively.
  const openedInEdit = useRef(initialDate != null);

  const [data, setData] = useState<CheckInData>(emptyCheckIn);
  const [currentDate, setCurrentDate] = useState(() => clampCheckInDate(initialDate));
  const [reloadNonce, setReloadNonce] = useState(0);
  // `loading` is derived, not stored: an effect that sets it synchronously
  // would cascade renders, and a stale `false` can never flash an empty form
  // over a stored day.
  const requestKey = `${currentDate}#${reloadNonce}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;
  const [loadError, setLoadError] = useState<CheckInError | null>(null);
  const [saveError, setSaveError] = useState<CheckInError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(initialDate != null);
  const [storedEntry, setStoredEntry] = useState<Entry | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lateNightHint, setLateNightHint] = useState(false);

  const [activityDefs, setActivityDefs] = useState<ActivityDef[]>([]);
  const [hiddenActivities, setHiddenActivities] = useState<ActivityDef[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [habitDefs, setHabitDefs] = useState<HabitDef[]>([]);
  const [habitError, setHabitError] = useState<string | null>(null);
  const [userId] = useState(() => readStoredSession()?.user?.id ?? "");

  const [scales, setScales] = useState<Scale[]>([]);
  const [scalesError, setScalesError] = useState<string | null>(null);
  const [scalesNonce, setScalesNonce] = useState(0);
  const [scalesLoadedNonce, setScalesLoadedNonce] = useState(-1);
  const scalesLoading = scalesLoadedNonce !== scalesNonce;

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const saveInFlight = useRef(false);
  const loadToken = useRef(0);
  const dateRef = useRef(currentDate);
  const lateNightChecked = useRef(false);
  const saveErrorRef = useRef<HTMLDivElement | null>(null);
  // Draft writes are arbitrated by a synchronous flag, never by the `saved`
  // state: a cleanup closure captured before the save must not resurrect it.
  const [draftWriter] = useState(() =>
    createDraftWriter(() =>
      typeof window === "undefined" ? null : window.localStorage
    )
  );

  // Any edit invalidates the "saved in this session" card and re-enables drafts.
  const updateData = useCallback(
    (updater: (current: CheckInData) => CheckInData) => {
      draftWriter.markEdited();
      setData(updater);
      setSaved(false);
    },
    [draftWriter]
  );

  const onPhotoSelected = useCallback(
    (url: string | null) => {
      draftWriter.markEdited();
      setPhotoCleared(url === null);
      setData((current) => ({
        ...current,
        photoPath: url,
        photoLegacy: url ? false : current.photoLegacy,
      }));
      setSaved(false);
    },
    [draftWriter]
  );

  useEffect(() => {
    dateRef.current = currentDate;
  }, [currentDate]);

  // ── Catalogue + session ──
  useEffect(() => {
    getHabits()
      .then((defs) => {
        if (defs.length > 0) setHabitDefs(defs);
      })
      .catch((error) => console.error("Failed to load habits:", error));
    getActivities()
      .then((defs) => {
        if (defs.length > 0) setActivityDefs(defs);
      })
      .catch((error) => console.error("Failed to load activities:", error));
    getHiddenActivities()
      .then((defs) => {
        if (defs.length > 0) setHiddenActivities(defs);
      })
      .catch(() => {});
  }, []);

  // ── Scales: read strictly; seed only when the account really has none ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await getScalesOrThrow();
        // A failed read throws before this point, so a network error can never
        // be mistaken for "no scales" and never triggers a seed.
        const list = existing.length === 0 ? await seedDefaultScales() : existing;
        if (!cancelled) {
          setScales(list);
          setScalesError(null);
        }
      } catch {
        if (!cancelled) setScalesError("checkin.scales_error");
      } finally {
        if (!cancelled) setScalesLoadedNonce(scalesNonce);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scalesNonce]);

  // ── Entry load ──
  useEffect(() => {
    const token = ++loadToken.current;
    const key = requestKey;

    loadCheckIn(currentDate, getEntryOrThrow).then((outcome) => {
      if (token !== loadToken.current) return;

      if (outcome.status === "failed") {
        // Never render an editable empty form over a stored day: a save would
        // overwrite it. Retry is the only way forward.
        setLoadError(outcome.error);
        setData(emptyCheckIn());
        setStoredEntry(null);
        setLoadedKey(key);
        return;
      }

      setLoadError(null);
      if (outcome.status === "entry") {
        const next = fromEntry(
          outcome.entry as unknown as Record<string, unknown>
        );
        setData(next);
        setStoredEntry(outcome.entry as Entry);
        setEditing(openedInEdit.current);
        // The row is the source of truth; a stale draft must not resurrect, and
        // a freshly loaded row is not an unsaved edit, so drafts stay off until
        // the user actually changes a field.
        draftWriter.markSaved(currentDate);
      } else {
        const draft = readDraft(localStorage, currentDate);
        setData(draft ?? emptyCheckIn());
        setStoredEntry(null);
        setEditing(true);
        draftWriter.markEdited();
        setDraftRestored(Boolean(draft && hasContent(draft)));
      }

      // Late-night step: only on a plain Today arrival, once, and only when
      // today has neither a recorded mood nor content.
      if (
        !lateNightChecked.current &&
        initialDate == null &&
        currentDate === today &&
        isLateNight() &&
        (outcome.status === "empty" ||
          !isRecordedMood((outcome.entry as Entry).mood))
      ) {
        const todayDraft = readDraft(localStorage, today);
        if (!todayDraft || !hasContent(todayDraft)) {
          lateNightChecked.current = true;
          setLateNightHint(true);
          setCurrentDate(shiftDateKey(today, -1));
          return;
        }
      }
      lateNightChecked.current = true;
      setLoadedKey(key);
    });
  }, [currentDate, requestKey, initialDate, today, draftWriter]);

  // ── Draft: local only, 1,200 ms, flushed on hide/unmount ──
  useEffect(() => {
    if (saved || loading || loadError) return;
    const timer = setTimeout(() => {
      draftWriter.flush(currentDate, data);
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, saved, loading, loadError, currentDate, draftWriter]);

  useEffect(() => {
    if (saved || loading || loadError) return;
    const flush = () => {
      draftWriter.flush(currentDate, data);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      // This cleanup still closes over the pre-save render when `saved` flips,
      // so the guard lives in the writer: a successful save always wins.
      flush();
    };
  }, [data, saved, loading, loadError, currentDate, draftWriter]);

  useEffect(() => {
    if (saveError) saveErrorRef.current?.focus();
  }, [saveError]);

  // ── Date navigation ──
  const navigateTo = useCallback(
    (next: string) => {
      const clamped = clampCheckInDate(next, today);
      if (clamped === currentDate) return;
      // Every per-day bit of state resets with the date; the load effect then
      // owns `data`, `storedEntry` and the mode. The draft guard is deliberately
      // untouched here: the old day's cleanup still runs, and it must keep
      // suppressing a draft for a day that was just saved.
      setSaveError(null);
      setLoadError(null);
      setSaved(false);
      setPhotoUploading(false);
      setPhotoCleared(false);
      setDraftRestored(false);
      setCurrentDate(clamped);
    },
    [currentDate, today]
  );

  const shiftDay = (offset: number) => {
    if (saving || photoUploading) return;
    const next = shiftDateKey(currentDate, offset);
    if (next > today) return;
    navigateTo(next);
  };

  const pickDate = (value: string) => {
    if (saving || photoUploading) return;
    if (!isValidDateKey(value)) return;
    navigateTo(value);
  };

  // ── Save ──
  const handleSave = async () => {
    if (loadError) return;
    const saveDate = currentDate;
    const payload = buildCheckInPayload(data, saveDate, {
      clearPhoto: photoCleared && !data.photoPath,
    });

    setSaveError(null);
    setSaving(true);
    try {
      const result = await saveCheckIn({
        gate: {
          loadFailed: Boolean(loadError),
          photoUploading,
          hasContent: hasContent(data),
        },
        inFlight: saveInFlight,
        payload,
        post: saveEntry,
      });

      if (result.status === "failed") {
        setSaveError(result.error);
        return;
      }
      if (result.status !== "saved") return;
      if (saveDate !== dateRef.current) return;

      // Use the server row, not the local draft: it carries the normalised
      // photo URL, weather keys and the read-only phone/AI fields.
      const savedData = fromEntry(
        result.entry as unknown as Record<string, unknown>
      );
      setData(savedData);
      setStoredEntry(result.entry as Entry);
      setSaved(true);
      setEditing(true);
      setPhotoCleared(false);
      // Clears the day's draft and blocks the pre-save flush closure from
      // writing it back when the `saved` state re-renders the effects.
      draftWriter.markSaved(saveDate);
      notifyDataChanged("entries");
      onSaveDone();
      checkAndUnlockAchievements({
        mood: savedData.mood,
        hasPhoto: Boolean(savedData.photoPath),
        hasScale: Object.values(savedData.scaleValues || {}).some(
          (value) => value > 0
        ),
      })
        .then((unlocked) => {
          if (unlocked.length > 0) console.log("🏆 Unlocked:", unlocked);
        })
        .catch(() => {});
      // Keep the existing product behaviour: a saved day gets an AI reflection
      // in the background. The section/dialog UI lands in a later phase.
      void requestReflection(savedData, saveDate);
    } finally {
      setSaving(false);
    }
  };

  async function requestReflection(
    entryData: CheckInData,
    requestDate: string
  ) {
    try {
      const session = readStoredSession();
      const resp = await fetch("/api/ai/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          user_id: userId || session?.user?.id || "",
          date: requestDate,
          lang,
          userName: session?.user?.user_metadata?.full_name || session?.user?.email || "",
          mood: entryData.mood,
          mood_emoji: entryData.moodEmoji,
          sleep_quality: entryData.sleepQuality,
          stress: entryData.stress,
          activities: entryData.activities,
          habits: entryData.habits,
          gratitude: filteredGratitude(entryData.gratitude),
          note: entryData.note,
          weather: entryData.weather,
          scale_values: positiveScaleValues(entryData.scaleValues),
          ...(entryData.phoneScreenTime != null
            ? { phone_screen_time: entryData.phoneScreenTime }
            : {}),
        }),
      });
      if (!resp.ok) {
        console.warn("Reflection not generated:", aiFailedError(resp.status).code);
        return;
      }
      const json = await resp.json().catch(() => null);
      const text =
        typeof json?.reflection === "string" ? json.reflection.trim() : "";
      if (!text) {
        console.warn("Reflection not generated:", aiEmptyError().code);
        return;
      }
      if (requestDate !== dateRef.current) return;
      setData((current) => ({ ...current, aiReflection: text }));
      await fetch("/api/save-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ date: requestDate, ai_reflection: text }),
      }).catch(() => {});
    } catch (error) {
      console.warn("Reflection request failed:", aiNetworkError(error).code);
    }
  }

  // ── Activity mutations ──
  const toggleActivity = (label: string) => {
    updateData((current) => ({
      ...current,
      activities: current.activities.includes(label)
        ? current.activities.filter((value) => value !== label)
        : [...current.activities, label],
    }));
  };

  const addActivity = async (input: {
    name: string;
    icon: string;
    category: string;
  }): Promise<string | null> => {
    const key = input.name.toLowerCase().replace(/\s+/g, "_");
    const created: ActivityDef = {
      key,
      label: input.name,
      icon: input.icon,
      category: input.category,
      color: "#6366f1",
      source: "custom",
    };
    setActivityDefs((previous) => [...previous, created]);
    setActivityError(null);

    if (!userId) return null;
    try {
      const response = await fetch("/api/manage-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getAccessToken()
            ? { Authorization: `Bearer ${getAccessToken()}` }
            : {}),
        },
        body: JSON.stringify({
          action: "add",
          userId,
          key,
          label: input.name,
          icon: input.icon,
          category: input.category,
        }),
      });
      if (!response.ok) {
        await response.json().catch(() => ({}));
        setActivityError("activities.error_save");
        return "activities.error_save";
      }
      return null;
    } catch {
      setActivityError("activities.error_network");
      return "activities.error_network";
    }
  };

  const removeActivity = (key: string) => {
    const removed = activityDefs.find((def) => def.key === key);
    setActivityDefs((previous) => previous.filter((def) => def.key !== key));
    if (removed) {
      setHiddenActivities((previous) => [...previous, removed]);
      updateData((current) => ({
        ...current,
        activities: current.activities.filter((label) => label !== removed.label),
      }));
    }
    if (!userId) return;
    fetch("/api/manage-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
      body: JSON.stringify({ action: "remove", userId, key }),
    }).catch(() => setActivityError("activities.error_remove_network"));
  };

  const restoreActivity = (key: string) => {
    const restored = hiddenActivities.find((def) => def.key === key);
    if (restored) {
      setActivityDefs((previous) => [...previous, restored]);
      setHiddenActivities((previous) =>
        previous.filter((def) => def.key !== key)
      );
    }
    if (!userId) return;
    fetch("/api/manage-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
      body: JSON.stringify({ action: "restore", userId, key }),
    }).catch(() => setActivityError("activities.error_restore_network"));
  };

  // ── Habit mutations ──
  const toggleHabit = (key: string, checked: boolean) => {
    updateData((current) => ({
      ...current,
      habits: { ...current.habits, [key]: checked },
    }));
  };

  const persistHabit = (
    action: "add" | "update",
    key: string,
    label: string,
    icon: string,
    isNegative: boolean
  ) => {
    if (!userId) return;
    fetch("/api/manage-habits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
      body: JSON.stringify({ action, userId, key, label, icon, is_negative: isNegative }),
    }).catch(() => setHabitError("habits.error_save"));
  };

  const addHabit = async (input: {
    name: string;
    icon: string;
    isNegative: boolean;
  }): Promise<string | null> => {
    const key = input.name.toLowerCase().replace(/\s+/g, "_");
    const habit: HabitDef = {
      key,
      label: input.name,
      icon: input.icon,
      category: "vlastní",
      color: "#6366f1",
      is_negative: input.isNegative,
      source: "custom",
    };
    setHabitDefs((previous) => [...previous, habit]);
    updateData((current) => ({
      ...current,
      habits: { ...current.habits, [key]: false },
    }));
    persistHabit("add", key, input.name, input.icon, input.isNegative);
    notifyDataChanged("habits");
    return null;
  };

  const updateHabit = async (
    key: string,
    input: { name: string; icon: string; isNegative: boolean }
  ): Promise<string | null> => {
    setHabitDefs((previous) =>
      previous.map((habit) =>
        habit.key === key
          ? {
              ...habit,
              label: input.name,
              icon: input.icon,
              is_negative: input.isNegative,
            }
          : habit
      )
    );
    persistHabit("update", key, input.name, input.icon, input.isNegative);
    notifyDataChanged("habits");
    return null;
  };

  const removeHabit = (key: string) => {
    setHabitDefs((previous) => previous.filter((habit) => habit.key !== key));
    updateData((current) => {
      const habits = { ...current.habits };
      delete habits[key];
      return { ...current, habits };
    });
    if (userId) {
      fetch("/api/manage-habits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getAccessToken()
            ? { Authorization: `Bearer ${getAccessToken()}` }
            : {}),
        },
        body: JSON.stringify({ action: "remove", userId, key }),
      }).catch(() => setHabitError("habits.error_save"));
    }
    notifyDataChanged("habits");
  };

  // ── Scales ──
  const changeScale = (scale: Scale, value: number) => {
    const clamped = Math.min(
      scale.max_value,
      Math.max(scale.min_value, Math.trunc(value))
    );
    updateData((current) => ({
      ...current,
      scaleValues: { ...current.scaleValues, [scale.id]: clamped },
    }));
  };

  const clearScale = (scale: Scale) => {
    // 0 (not a missing key) so `toPayload` can delete the mirrored row.
    updateData((current) => ({
      ...current,
      scaleValues: { ...current.scaleValues, [scale.id]: 0 },
    }));
  };

  // ── Render ──
  const stored =
    storedEntry && isRecordedMood(storedEntry.mood) ? storedEntry : null;

  return (
    <div className="space-y-4 pb-6">
      <CheckInHeader
        date={currentDate}
        today={today}
        lang={lang}
        disabled={saving || photoUploading}
        error={saveError?.code ?? null}
        errorRef={saveErrorRef}
        draftRestored={draftRestored}
        lateNightHint={lateNightHint}
        onShift={shiftDay}
        onPickDate={pickDate}
      />

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-[40vh] items-center justify-center text-[13px] text-[color:var(--text-2)]"
        >
          {t("common.loading")}
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="glass-card px-5 py-6 text-center"
        >
          <p className="text-sm text-red-200">{t(loadError.code)}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            className="mt-4 min-h-11 rounded-xl bg-indigo-500 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {t("checkin.error_retry")}
          </button>
        </div>
      ) : stored && !editing ? (
        <StoredDayView
          date={currentDate}
          entry={stored}
          habits={habitDefs}
          scales={scales}
          scalesError={scalesError}
          onRetry={() => setScalesNonce((value) => value + 1)}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <CheckInForm
          data={data}
          date={currentDate}
          setData={updateData}
          onPhotoSelected={onPhotoSelected}
          onPhotoUploading={setPhotoUploading}
          activities={activityDefs}
          hiddenActivities={hiddenActivities}
          activityError={activityError}
          onToggleActivity={toggleActivity}
          onAddActivity={addActivity}
          onRemoveActivity={removeActivity}
          onRestoreActivity={restoreActivity}
          habits={habitDefs}
          habitError={habitError}
          onToggleHabit={toggleHabit}
          onAddHabit={addHabit}
          onUpdateHabit={updateHabit}
          onRemoveHabit={removeHabit}
          scales={scales}
          scalesLoading={scalesLoading}
          scalesError={scalesError}
          onScaleChange={changeScale}
          onClearScale={clearScale}
          onRetryScales={() => setScalesNonce((value) => value + 1)}
          saving={saving}
          photoUploading={photoUploading}
          saved={saved}
          loadFailed={Boolean(loadError)}
          onSave={handleSave}
          onViewPhoto={setViewingPhoto}
        />
      )}

      {viewingPhoto ? (
        <PhotoViewer
          src={viewingPhoto}
          alt={t("checkin.photo_alt", { date: currentDate })}
          onClose={() => setViewingPhoto(null)}
        />
      ) : null}
    </div>
  );
}
