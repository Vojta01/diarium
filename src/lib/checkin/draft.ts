/**
 * Local draft persistence.
 *
 * Drafts are a convenience, not a second save path: they never call the server
 * and they never contain photo bytes. A quota failure is reported as a boolean
 * so the form can stay usable instead of crashing.
 */
import type { CheckInData } from "../types.ts";
import { fromDraft, hasContent, toDraft } from "./model.ts";

export const DRAFT_PREFIX = "diarium_draft_";

export function draftKey(date: string): string {
  return `${DRAFT_PREFIX}${date}`;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readDraft(
  storage: DraftStorage,
  date: string
): CheckInData | null {
  try {
    const raw = storage.getItem(draftKey(date));
    if (!raw) return null;
    return fromDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Persist the draft, or remove it when the form has no content. Returns false
 * on a quota/security failure; the caller shows the draft-storage warning.
 */
export function writeDraft(
  storage: DraftStorage,
  date: string,
  data: CheckInData
): boolean {
  try {
    if (!hasContent(data)) {
      storage.removeItem(draftKey(date));
      return true;
    }
    storage.setItem(draftKey(date), JSON.stringify(toDraft(data)));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: DraftStorage, date: string): void {
  try {
    storage.removeItem(draftKey(date));
  } catch {
    // A missing/quota-blocked storage must not break saving.
  }
}

/**
 * The draft/save arbitration for one mounted screen.
 *
 * `saved` must not live in React state alone: the effect cleanup that runs when
 * the flag flips still closes over the previous render (`saved === false`), so
 * an unmount or dependency-change flush would recreate the draft that the save
 * just cleared. This writer keeps the flag synchronously, so `markSaved` wins
 * over any flush that was already scheduled with stale props.
 */
export interface DraftWriter {
  /** The form was edited after the last save; drafts may be written again. */
  markEdited(): void;
  /** A save succeeded: clear the day's draft and refuse flushes for that day. */
  markSaved(date: string): void;
  /** Write the snapshot unless that day was saved. Returns false when skipped. */
  flush(date: string, data: CheckInData): boolean;
}

export function createDraftWriter(
  /** Resolved lazily so the writer is safe to construct during SSR. */
  resolveStorage: () => DraftStorage | null
): DraftWriter {
  // The saved *day*, not a boolean: navigating away must keep suppressing the
  // old day's stale cleanup while still allowing a draft for the new day.
  let savedDate: string | null = null;

  return {
    markEdited() {
      savedDate = null;
    },
    markSaved(date: string) {
      savedDate = date;
      const storage = resolveStorage();
      if (storage) clearDraft(storage, date);
    },
    flush(date: string, data: CheckInData) {
      if (savedDate === date) return false;
      const storage = resolveStorage();
      if (!storage) return false;
      return writeDraft(storage, date, data);
    },
  };
}
