import assert from "node:assert/strict";
import test from "node:test";

import {
  createDraftWriter,
  draftKey,
  readDraft,
  type DraftStorage,
} from "../src/lib/checkin/draft.ts";
import { emptyCheckIn } from "../src/lib/checkin/model.ts";

const DATE = "2026-11-06";

function memoryStorage(): DraftStorage & { dump(): Map<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => map,
  };
}

function filled() {
  const data = emptyCheckIn();
  data.mood = 4;
  data.note = "Dnes jsem běhal.";
  return data;
}

test("a successful save clears the draft and beats a stale unmount flush", () => {
  const storage = memoryStorage();
  const writer = createDraftWriter(() => storage);

  // The flush effect captured this closure while `saved` was still false.
  const staleUnmountFlush = () => writer.flush(DATE, filled());

  assert.equal(staleUnmountFlush(), true);
  assert.ok(storage.getItem(draftKey(DATE)));

  writer.markSaved(DATE);
  assert.equal(readDraft(storage, DATE), null);

  // The cleanup that runs as `saved` flips to true still closes over the
  // pre-save render; it must not resurrect the draft it just cleared.
  assert.equal(staleUnmountFlush(), false);
  assert.equal(storage.getItem(draftKey(DATE)), null);
  assert.equal(readDraft(storage, DATE), null);
});

test("editing after a save resumes draft writes for the new content", () => {
  const storage = memoryStorage();
  const writer = createDraftWriter(() => storage);

  writer.flush(DATE, filled());
  writer.markSaved(DATE);
  assert.equal(storage.getItem(draftKey(DATE)), null);

  writer.markEdited();
  const edited = filled();
  edited.note = "Později jsem četl.";
  assert.equal(writer.flush(DATE, edited), true);

  const restored = readDraft(storage, DATE);
  assert.equal(restored?.note, "Později jsem četl.");
});

test("markSaved clears only its own day and keeps other drafts", () => {
  const storage = memoryStorage();
  const writer = createDraftWriter(() => storage);
  const other = "2026-11-05";

  writer.flush(DATE, filled());
  writer.flush(other, filled());
  writer.markSaved(DATE);

  assert.equal(storage.getItem(draftKey(DATE)), null);
  assert.ok(storage.getItem(draftKey(other)));
});

test("navigating away keeps the saved day suppressed but drafts the new day", () => {
  const storage = memoryStorage();
  const writer = createDraftWriter(() => storage);
  const other = "2026-11-05";

  writer.flush(DATE, filled());
  writer.markSaved(DATE);

  // The unmount/date-change cleanup still carries DATE; it must not recreate
  // the draft. A different day is a different form and may be drafted.
  assert.equal(writer.flush(DATE, filled()), false);
  assert.equal(readDraft(storage, DATE), null);
  assert.equal(writer.flush(other, filled()), true);
  assert.ok(storage.getItem(draftKey(other)));
});

test("an empty form removes the draft instead of storing a blank one", () => {
  const storage = memoryStorage();
  const writer = createDraftWriter(() => storage);

  writer.flush(DATE, filled());
  assert.ok(storage.getItem(draftKey(DATE)));

  assert.equal(writer.flush(DATE, emptyCheckIn()), true);
  assert.equal(storage.getItem(draftKey(DATE)), null);
});

test("a quota failure is reported, not thrown, and saving stays possible", () => {
  const writer = createDraftWriter(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  }));

  assert.equal(writer.flush(DATE, filled()), false);
  // The save path itself is independent of draft storage.
  writer.markSaved(DATE);
  assert.equal(writer.flush(DATE, filled()), false);
});

test("no storage (SSR) is a silent skip", () => {
  const writer = createDraftWriter(() => null);
  assert.equal(writer.flush(DATE, filled()), false);
  writer.markSaved(DATE);
  assert.equal(writer.flush(DATE, filled()), false);
});
