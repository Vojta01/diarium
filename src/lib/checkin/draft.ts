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
