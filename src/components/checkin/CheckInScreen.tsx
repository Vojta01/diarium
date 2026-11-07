"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAccessToken,
  getActivities,
  getEntryOrThrow,
  getHiddenActivities,
  getHabits,
  patchEntry,
  saveEntry,
  deleteCheckInPhoto,
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
} from "@/lib/checkin/model";
import { buildCheckInPayload } from "@/lib/checkin/payload";
import { saveCheckIn } from "@/lib/checkin/save";
import { loadCheckIn } from "@/lib/checkin/load";
import {
  buildReflectionRequest,
  reflectionPatch,
} from "@/lib/checkin/readonly";
import { fetchGoalProgress } from "@/lib/goals-data";
import type { GoalProgressData } from "@/lib/goal-progress";
import type { Goal } from "@/lib/goals";
import {
  clampCheckInDate,
  isLateNight,
  isValidDateKey,
} from "@/lib/checkin/dates";
import { createDraftWriter, readDraft } from "@/lib/checkin/draft";
import {
  definitionKey,
  isDuplicateDefinition,
  mutateCatalogue,
} from "@/lib/checkin/catalogue";
import { photoSaveIntent } from "@/lib/checkin/photo-edit";
import {
  aiEmptyError,
  aiFailedError,
  aiNetworkError,
  aiPersistError,
  isCheckInError,
  type CheckInError,
} from "@/lib/checkin/errors";

import { CheckInForm } from "./CheckInForm";
import { CheckInHeader } from "./CheckInHeader";
import { StoredDayView } from "./StoredDayView";
import { PhotoViewer } from "./dialogs/PhotoViewer";
import { PostSaveReflectionDialog } from "./dialogs/PostSaveReflectionDialog";

/** JSON POST headers for the catalogue routes, with the session token if any. */
function authJsonHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Check-in orchestrator: date, load token, modes, save, draft and the
 * activity/habit/scale mutations. It renders no section internals — those live
 * in `sections/*` and are ordered by `CHECKIN_SECTION_ORDER`.
 *
 * Phase 2B renders the full Android beta5 order: mood → note, then the
 * read-only goals, screen-time and AI-reflection sections.
 */
export function CheckInScreen({
  onSaveDone,
  onOpenGoals,
  onOpenOverview,
  initialDate,
}: {
  onSaveDone: () => void;
  /** Opens the Goals sub-screen; goals are managed there, never here. */
  onOpenGoals: () => void;
  /** The post-save dialog's close action lands on Overview. */
  onOpenOverview: () => void;
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
  const [postSaveOpen, setPostSaveOpen] = useState(false);
  /** True from the first edit until the next successful load/save. */
  const [dirty, setDirty] = useState(false);
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

  // Goals are a report for the selected date's calendar period; the check-in
  // never edits them. The key keeps "loading" derived so a failed read cannot
  // flash an empty-goals CTA over a slow one.
  const [goalRows, setGoalRows] = useState<GoalProgressData<Goal>[]>([]);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalsNonce, setGoalsNonce] = useState(0);
  const [goalsLoadedKey, setGoalsLoadedKey] = useState<string | null>(null);
  const goalsKey = `${currentDate}#${goalsNonce}`;
  const goalsLoading = goalsLoadedKey !== goalsKey;

  // Reflection state is owned here, not by the section: generation must survive
  // a section collapse and must be invalidated when the date changes.
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState<CheckInError | null>(null);
  const [reflectionCached, setReflectionCached] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const saveInFlight = useRef(false);
  const loadToken = useRef(0);
  const reflectionToken = useRef(0);
  const reflectionInFlight = useRef(false);
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
      setDirty(true);
      // The restored-draft / late-night banners describe the initial state;
      // once the user edits, they are stale.
      setDraftRestored(false);
      setLateNightHint(false);
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
      setDirty(true);
      setDraftRestored(false);
      setLateNightHint(false);
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

  // ── Goals: read-only progress for the selected date's calendar period ──
  useEffect(() => {
    let cancelled = false;
    const key = goalsKey;
    (async () => {
      try {
        const rows = await fetchGoalProgress(currentDate);
        if (cancelled) return;
        setGoalRows(rows);
        setGoalsError(null);
      } catch {
        // A failed read is not "no goals": keep the error and offer a retry.
        if (cancelled) return;
        setGoalRows([]);
        setGoalsError("checkin.goals_error");
      } finally {
        if (!cancelled) setGoalsLoadedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentDate, goalsKey]);

  // ── Entry load ──
  useEffect(() => {
    const token = ++loadToken.current;
    const key = requestKey;

    loadCheckIn(currentDate, getEntryOrThrow).then((outcome) => {
      if (token !== loadToken.current) return;
      // A freshly loaded row (or an empty form) is never an unsaved edit.
      setDirty(false);

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
      setDirty(false);
      setPhotoUploading(false);
      setPhotoCleared(false);
      setDraftRestored(false);
      setLateNightHint(false);
      setPostSaveOpen(false);
      // Invalidate an in-flight reflection: its response belongs to the old day
      // and must never be rendered (or patched) under the new date.
      reflectionToken.current += 1;
      reflectionInFlight.current = false;
      setReflectionLoading(false);
      setReflectionError(null);
      setReflectionCached(false);
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
    const photoIntent = photoSaveIntent({
      stored: storedEntry?.photo_path ?? null,
      staged: data.photoPath,
      cleared: photoCleared,
    });
    const payload = buildCheckInPayload(data, saveDate, {
      clearPhoto: photoIntent.clear_photo === true,
    });

    setSaveError(null);
    setSaving(true);
    try {
      const result = await saveCheckIn({
        gate: {
          loadFailed: Boolean(loadError),
          photoUploading,
          // Removing the only stored photo is a real edit even though the
          // remaining form is empty; otherwise the removal could never save.
          hasContent: hasContent(data) || photoIntent.clear_photo === true,
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

      // The row is the source of truth now. A replaced/cleared object may be
      // removed best-effort; a failed cleanup is only an orphan, never a
      // reason to roll back the save.
      if (photoIntent.cleanup) void deleteCheckInPhoto(photoIntent.cleanup);

      if (saveDate !== dateRef.current) return;

      // Use the server row, not the local draft: it carries the normalised
      // photo URL, weather keys and the read-only phone/AI fields.
      const savedData = fromEntry(
        result.entry as unknown as Record<string, unknown>
      );
      setData(savedData);
      setStoredEntry(result.entry as Entry);
      setSaved(true);
      setDirty(false);
      setEditing(true);
      setPhotoCleared(false);
      setDraftRestored(false);
      setLateNightHint(false);
      // The saved row may have changed a goal's count for this period.
      setGoalsNonce((value) => value + 1);
      setReflectionError(null);
      setReflectionCached(false);
      // Clears the day's draft and blocks the pre-save flush closure from
      // writing it back when the `saved` state re-renders the effects.
      draftWriter.markSaved(saveDate);
      notifyDataChanged("entries");
      onSaveDone();
      setPostSaveOpen(true);
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
      // A day with no reflection yet gets one in the background; the route
      // caches, so an existing reflection is never regenerated here. This is
      // the only automatic request: the dialog only displays its state.
      if (!savedData.aiReflection) {
        void requestReflection(saveDate, { afterSave: true });
      }
    } finally {
      setSaving(false);
    }
  };

  async function requestReflection(
    requestDate: string,
    options: { afterSave?: boolean } = {}
  ) {
    // A reflection reads the saved row. While a save is in flight the row is
    // still the previous version, so generating then would persist prose about
    // stale data. The section button is also inert, but this guard covers the
    // programmatic path. `afterSave` is the one legitimate call made before the
    // `saving` state has re-rendered; the row is already written by then.
    if (!options.afterSave && (saving || saveInFlight.current)) return;
    if (photoUploading) return;
    if (reflectionInFlight.current) return;
    if (requestDate !== dateRef.current) return;

    reflectionInFlight.current = true;
    const token = ++reflectionToken.current;
    setReflectionLoading(true);
    setReflectionError(null);
    setReflectionCached(false);

    try {
      const session = readStoredSession();
      // Identifiers only: the route reads the saved row and its history from
      // Supabase. Form fields (mood, note, activities, ...) never leave here.
      const requestBody = buildReflectionRequest({
        userId: userId || session?.user?.id || "",
        date: requestDate,
        lang,
        userName:
          session?.user?.user_metadata?.full_name ||
          session?.user?.email ||
          "",
      });
      const resp = await fetch("/api/ai/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(requestBody),
      });
      if (!resp.ok) throw aiFailedError(resp.status);

      const json = await resp.json().catch(() => null);
      const text =
        typeof json?.reflection === "string" ? json.reflection.trim() : "";
      if (!text) throw aiEmptyError();
      if (token !== reflectionToken.current) return;

      if (json?.cached === true) {
        // The endpoint returns the stored reflection instead of regenerating;
        // show it and say so rather than pretending a new text was written.
        setReflectionCached(true);
        applyReflection(text, requestDate);
        return;
      }

      const patch = reflectionPatch(requestDate, text);
      if (!patch) throw aiEmptyError();
      // Partial write only: date + ai_reflection. A failed patch leaves the old
      // text visible, so the section never shows a reflection that is not saved.
      const updated = await patchEntry(patch);
      if (token !== reflectionToken.current) return;
      applyReflection(text, requestDate);
      setStoredEntry(updated);
    } catch (error) {
      if (token !== reflectionToken.current) return;
      const mapped = isCheckInError(error)
        ? error.kind === "ai_failed" || error.kind === "signed_out"
          ? error
          : aiPersistError(error)
        : aiNetworkError(error);
      setReflectionError(mapped);
    } finally {
      if (token === reflectionToken.current) {
        setReflectionLoading(false);
        reflectionInFlight.current = false;
      }
    }
  }

  /** Show a server reflection without marking the form dirty. */
  const applyReflection = useCallback((text: string, forDate: string) => {
    if (forDate !== dateRef.current) return;
    setData((current) => ({ ...current, aiReflection: text }));
    setStoredEntry((current) =>
      current && current.date === forDate
        ? { ...current, ai_reflection: text }
        : current
    );
  }, []);

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
    const key = definitionKey(input.name);
    if (!userId) return "checkin.error_save_auth";
    if (isDuplicateDefinition(activityDefs, input.name)) {
      return "activities.error_duplicate";
    }
    setActivityError(null);

    const created: ActivityDef = {
      key,
      label: input.name,
      icon: input.icon,
      category: input.category,
      color: "#6366f1",
      source: "custom",
    };

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-activities", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({
            action: "add",
            userId,
            key,
            label: input.name,
            icon: input.icon,
            category: input.category,
          }),
        }),
      apply: (body) => {
        const returnedKey =
          body &&
          typeof body === "object" &&
          typeof (body as { key?: unknown }).key === "string"
            ? (body as { key: string }).key
            : key;
        setActivityDefs((previous) =>
          previous.some((def) => def.key === returnedKey)
            ? previous
            : [...previous, { ...created, key: returnedKey }]
        );
        notifyDataChanged("activities");
      },
      errorCode: "activities.error_save",
      networkCode: "activities.error_network",
    });
    if (failure) setActivityError(failure);
    return failure;
  };

  const removeActivity = async (key: string): Promise<string | null> => {
    const removed = activityDefs.find((def) => def.key === key);
    if (!userId) return "checkin.error_save_auth";
    setActivityError(null);

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-activities", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({ action: "remove", userId, key }),
        }),
      apply: () => {
        if (!removed) return;
        setActivityDefs((previous) => previous.filter((def) => def.key !== key));
        setHiddenActivities((previous) => [...previous, removed]);
        updateData((current) => ({
          ...current,
          activities: current.activities.filter(
            (label) => label !== removed.label
          ),
        }));
        notifyDataChanged("activities");
      },
      errorCode: "activities.error_remove",
      networkCode: "activities.error_remove_network",
    });
    if (failure) setActivityError(failure);
    return failure;
  };

  const restoreActivity = async (key: string): Promise<string | null> => {
    const restored = hiddenActivities.find((def) => def.key === key);
    if (!userId) return "checkin.error_save_auth";
    setActivityError(null);

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-activities", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({ action: "restore", userId, key }),
        }),
      apply: () => {
        if (!restored) return;
        setActivityDefs((previous) =>
          previous.some((def) => def.key === key)
            ? previous
            : [...previous, restored]
        );
        setHiddenActivities((previous) =>
          previous.filter((def) => def.key !== key)
        );
        notifyDataChanged("activities");
      },
      errorCode: "activities.error_restore",
      networkCode: "activities.error_restore_network",
    });
    if (failure) setActivityError(failure);
    return failure;
  };

  // ── Habit mutations ──
  const toggleHabit = (key: string, checked: boolean) => {
    updateData((current) => ({
      ...current,
      habits: { ...current.habits, [key]: checked },
    }));
  };

  const addHabit = async (input: {
    name: string;
    icon: string;
    isNegative: boolean;
  }): Promise<string | null> => {
    const key = definitionKey(input.name);
    if (!userId) return "checkin.error_save_auth";
    if (isDuplicateDefinition(habitDefs, input.name)) {
      return "habits.error_duplicate";
    }
    setHabitError(null);

    const habit: HabitDef = {
      key,
      label: input.name,
      icon: input.icon,
      category: "vlastní",
      color: "#6366f1",
      is_negative: input.isNegative,
      source: "custom",
    };

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-habits", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({
            action: "add",
            userId,
            key,
            label: input.name,
            icon: input.icon,
            is_negative: input.isNegative,
          }),
        }),
      apply: () => {
        // No `updateData` here: a new habit is a catalogue entry, not an
        // answered switch. Writing `{key: false}` would persist a false value
        // the user never touched.
        setHabitDefs((previous) =>
          previous.some((def) => def.key === key)
            ? previous
            : [...previous, habit]
        );
        notifyDataChanged("habits");
      },
      errorCode: "habits.error_save",
      networkCode: "habits.error_save",
    });
    if (failure) setHabitError(failure);
    return failure;
  };

  const updateHabit = async (
    key: string,
    input: { name: string; icon: string; isNegative: boolean }
  ): Promise<string | null> => {
    if (!userId) return "checkin.error_save_auth";
    if (isDuplicateDefinition(habitDefs, input.name, key)) {
      return "habits.error_duplicate";
    }
    setHabitError(null);

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-habits", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({
            action: "update",
            userId,
            key,
            label: input.name,
            icon: input.icon,
            is_negative: input.isNegative,
          }),
        }),
      apply: () => {
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
        notifyDataChanged("habits");
      },
      errorCode: "habits.error_save",
      networkCode: "habits.error_save",
    });
    if (failure) setHabitError(failure);
    return failure;
  };

  const removeHabit = async (key: string): Promise<string | null> => {
    if (!userId) return "checkin.error_save_auth";
    setHabitError(null);

    const failure = await mutateCatalogue({
      request: () =>
        fetch("/api/manage-habits", {
          method: "POST",
          headers: authJsonHeaders(),
          body: JSON.stringify({ action: "remove", userId, key }),
        }),
      apply: () => {
        setHabitDefs((previous) =>
          previous.filter((habit) => habit.key !== key)
        );
        // The definition is gone; its answer must go with it.
        updateData((current) => {
          const habits = { ...current.habits };
          delete habits[key];
          return { ...current, habits };
        });
        notifyDataChanged("habits");
      },
      errorCode: "habits.error_save",
      networkCode: "habits.error_save",
    });
    if (failure) setHabitError(failure);
    return failure;
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
  // A reflection can only be generated for a day that is already stored and
  // has something to reflect on; an empty shell row is not a check-in. A stored
  // reflection is enough on its own (it can be re-read/regenerated).
  const reflectionCanGenerate =
    Boolean(storedEntry) && (hasContent(data) || Boolean(data.aiReflection));

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
          photoCleared={photoCleared}
          hasStoredPhoto={Boolean(storedEntry?.photo_path)}
          saved={saved}
          loadFailed={Boolean(loadError)}
          dirty={dirty}
          goals={goalRows}
          goalsLoading={goalsLoading}
          goalsError={goalsError}
          onRetryGoals={() => setGoalsNonce((value) => value + 1)}
          onOpenGoals={onOpenGoals}
          reflectionLoading={reflectionLoading}
          reflectionError={reflectionError}
          reflectionCached={reflectionCached}
          reflectionCanGenerate={reflectionCanGenerate}
          onGenerateReflection={() => {
            if (reflectionCanGenerate && !dirty && !saving) {
              void requestReflection(currentDate);
            }
          }}
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

      {postSaveOpen ? (
        <PostSaveReflectionDialog
          reflection={data.aiReflection}
          loading={reflectionLoading}
          error={reflectionError}
          cached={reflectionCached}
          canGenerate={reflectionCanGenerate}
          onGenerate={() => {
            if (!saving) void requestReflection(currentDate);
          }}
          onClose={() => {
            setPostSaveOpen(false);
            onOpenOverview();
          }}
        />
      ) : null}
    </div>
  );
}
