/**
 * Photo replacement is a two-phase edit.
 *
 * Picking a photo uploads it to a NEW object; the entry row is untouched until
 * Save. Abandoning the edit (date change, tab switch, close) therefore leaves
 * both the stored row and its object intact. Only a successful save commits the
 * new URL and may clean up the previous object best-effort.
 */
import { isStoredPhotoUrl } from "./photo.ts";

export interface PhotoEditState {
  /** The URL currently stored on the row, or null. */
  stored: string | null;
  /** The URL staged by the picker, or null. */
  staged: string | null;
  /** The user removed the photo in this edit. */
  cleared: boolean;
}

export interface PhotoSaveIntent {
  photo_path?: string;
  clear_photo?: boolean;
  /** Previous object that may be deleted after a successful save. */
  cleanup: string | null;
}

export function beginPhotoEdit(stored: string | null): PhotoEditState {
  return {
    stored: isStoredPhotoUrl(stored) ? stored.trim() : null,
    staged: null,
    cleared: false,
  };
}

export function stagePhoto(state: PhotoEditState, url: string): PhotoEditState {
  if (!isStoredPhotoUrl(url)) return state;
  return { ...state, staged: url.trim(), cleared: false };
}

export function clearPhoto(state: PhotoEditState): PhotoEditState {
  return { ...state, staged: null, cleared: true };
}

/**
 * What Save should send, and which old object (if any) can be removed after the
 * row is written. An untouched edit sends nothing and cleans up nothing.
 */
export function photoSaveIntent(state: PhotoEditState): PhotoSaveIntent {
  const stored = state.stored;
  const staged = state.staged;

  if (staged) {
    return {
      photo_path: staged,
      cleanup: stored && stored !== staged ? stored : null,
    };
  }

  if (state.cleared && stored) {
    return { clear_photo: true, cleanup: stored };
  }

  return { cleanup: null };
}

/**
 * Abandoning an edit never touches the stored row/object. The staged object is
 * an orphan and may be removed best-effort.
 */
export function photoAbandonIntent(state: PhotoEditState): {
  cleanupStaged: string | null;
  cleanupStored: null;
} {
  return { cleanupStaged: state.staged, cleanupStored: null };
}
