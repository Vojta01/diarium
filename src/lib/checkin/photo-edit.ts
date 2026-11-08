/**
 * Photo replacement is a two-phase edit.
 *
 * Picking a photo uploads it to a NEW object; the entry row is untouched until
 * Save. Abandoning the edit (date change, cancellation, unmount) removes only
 * owner-scoped, unique staged objects. Active saves hold cleanup until their
 * result is known, and cleanup verifies that the URL is not the row's current
 * photo before touching Storage.
 */
import {
  isStoredPhotoUrl,
  photoStoragePathFromUrl,
  stagedPhotoStoragePathFromUrl,
} from "./photo.ts";

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

export type StagedPhotoCleanup = (
  url: string,
  date: string
) => Promise<unknown>;

export interface StagedPhotoCleanupDependencies {
  /** The currently authenticated owner, resolved from the client session. */
  getOwner: () => Promise<string | null>;
  /** Must throw if the row cannot be read; unknown is not safe to delete. */
  readCurrentPhoto: (ownerId: string, date: string) => Promise<string | null>;
  /** Remove exactly one validated path from the existing photo bucket. */
  remove: (ownerId: string, path: string) => Promise<unknown>;
  /** Supabase project origin used to reject foreign URLs. */
  expectedOrigin: string;
}

/**
 * Create the secure cleanup callback used for uncommitted uploads. It fails
 * closed on auth/read errors, rejects originals and foreign owners, and checks
 * the current row immediately before removal to protect a save whose response
 * may have been lost.
 */
export function createStagedPhotoCleanup(
  dependencies: StagedPhotoCleanupDependencies
): (url: string, date: string) => Promise<boolean> {
  return async (url, date) => {
    let ownerId: string | null;
    try {
      ownerId = await dependencies.getOwner();
    } catch {
      return false;
    }
    if (!ownerId) return false;

    const path = stagedPhotoStoragePathFromUrl(
      url,
      ownerId,
      date,
      dependencies.expectedOrigin
    );
    if (!path) return false;

    let currentPhoto: string | null;
    try {
      currentPhoto = await dependencies.readCurrentPhoto(ownerId, date);
    } catch {
      // A failed read is not proof that the staged URL is unused.
      return false;
    }
    if (photoStoragePathFromUrl(currentPhoto) === path) return false;

    await dependencies.remove(ownerId, path);
    return true;
  };
}

interface StagedUpload {
  ownerId: string;
  date: string;
  url: string;
  abandoned: boolean;
  committed: boolean;
  /** The server may still commit after the client lost the response. */
  uncertain: boolean;
  saves: number;
  cleaning: boolean;
}

export interface PhotoSaveLease {
  /** Call exactly once when the save settles; unknown preserves the object. */
  finish(outcome: boolean | "unknown"): Promise<void>;
}

/**
 * Tracks staged uploads in one mounted check-in. A cleanup request is deferred
 * while a save for that URL is pending; a successful save permanently protects
 * its object. An ambiguous network failure also keeps the object because the
 * server may still commit it after the client loses the response. The injected
 * cleanup callback remains the security boundary.
 */
export function createPhotoEditLifecycle(
  cleanup: StagedPhotoCleanup,
  expectedOrigin?: string
) {
  const staged = new Map<string, StagedUpload>();
  const keyFor = (ownerId: string, url: string) => `${ownerId}\u0000${url}`;

  const cleanupIfSafe = (item: StagedUpload): Promise<void> => {
    if (
      !item.abandoned ||
      item.committed ||
      item.uncertain ||
      item.saves > 0 ||
      item.cleaning
    ) {
      return Promise.resolve();
    }

    item.cleaning = true;
    return Promise.resolve()
      .then(() => cleanup(item.url, item.date))
      .then(() => undefined, () => undefined)
      .finally(() => {
        staged.delete(keyFor(item.ownerId, item.url));
      });
  };

  return {
    /** Register only a well-formed unique upload under the current owner/day. */
    track(ownerId: string, date: string, url: string): boolean {
      if (!ownerId.trim()) return false;
      if (
        !stagedPhotoStoragePathFromUrl(url, ownerId, date, expectedOrigin)
      ) {
        return false;
      }
      const key = keyFor(ownerId, url);
      const existing = staged.get(key);
      if (existing) return !existing.abandoned && !existing.cleaning;
      staged.set(key, {
        ownerId,
        date,
        url,
        abandoned: false,
        committed: false,
        uncertain: false,
        saves: 0,
        cleaning: false,
      });
      return true;
    },

    /** Mark one superseded/cancelled upload for best-effort cleanup. */
    discard(ownerId: string, date: string, url: string): Promise<void> {
      const item = staged.get(keyFor(ownerId, url));
      if (!item || item.date !== date || item.committed) {
        return Promise.resolve();
      }
      item.abandoned = true;
      return cleanupIfSafe(item);
    },

    /** Hold an upload during POST so unmount cannot delete a committed photo. */
    beginSave(
      ownerId: string,
      date: string,
      url: string | null
    ): PhotoSaveLease | null {
      if (!url) return null;
      const key = keyFor(ownerId, url);
      const item = staged.get(key);
      if (
        !item ||
        item.date !== date ||
        item.abandoned ||
        item.committed ||
        item.cleaning
      ) {
        return null;
      }

      item.saves += 1;
      let settled = false;
      return {
        finish: (outcome) => {
          if (settled) return Promise.resolve();
          settled = true;
          item.saves -= 1;
          if (outcome === "unknown") item.uncertain = true;
          if (outcome === true) {
            item.committed = true;
            staged.delete(key);
          }
          return cleanupIfSafe(item);
        },
      };
    },

    /** Abandon every staged upload associated with a calendar date. */
    abandonDate(date: string): Promise<void> {
      const pending: Promise<void>[] = [];
      for (const item of staged.values()) {
        if (item.date !== date || item.committed) continue;
        item.abandoned = true;
        pending.push(cleanupIfSafe(item));
      }
      return Promise.all(pending).then(() => undefined);
    },

    /** Abandon all outstanding uploads when the check-in is removed. */
    abandonAll(): Promise<void> {
      const pending: Promise<void>[] = [];
      for (const item of staged.values()) {
        if (item.committed) continue;
        item.abandoned = true;
        pending.push(cleanupIfSafe(item));
      }
      return Promise.all(pending).then(() => undefined);
    },
  };
}

/**
 * Resolve an upload after the async request completes. If the picker has been
 * cancelled, its date changed, or its component unmounted, delete the returned
 * staged object instead of attaching it to form state.
 */
export async function finishPhotoUpload(options: {
  date: string;
  upload: () => Promise<string>;
  isCurrent: () => boolean;
  onStage: (url: string) => void;
  cleanup: StagedPhotoCleanup;
}): Promise<"staged" | "discarded"> {
  const url = await options.upload();
  if (!isStoredPhotoUrl(url)) throw new Error("Photo upload returned an invalid URL");

  if (!options.isCurrent()) {
    try {
      await options.cleanup(url, options.date);
    } catch {
      // Cleanup is best-effort; cancellation must not surface as upload failure.
    }
    return "discarded";
  }

  options.onStage(url);
  return "staged";
}
