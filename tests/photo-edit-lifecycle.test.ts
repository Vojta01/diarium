import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhotoEditLifecycle,
  createStagedPhotoCleanup,
  finishPhotoUpload,
} from "../src/lib/checkin/photo-edit.ts";
import { stagedPhotoStoragePathFromUrl } from "../src/lib/checkin/photo.ts";

const DATE = "2026-11-07";
const OWNER = "user-1";
const ORIGIN = "https://project.supabase.co";
const STORED = `${ORIGIN}/storage/v1/object/public/diary-photos/${OWNER}/${DATE}.jpg`;
const STAGED_A = `${ORIGIN}/storage/v1/object/public/diary-photos/${OWNER}/${DATE}-upload-a.jpg`;
const STAGED_B = `${ORIGIN}/storage/v1/object/public/diary-photos/${OWNER}/${DATE}-upload-b.jpg`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("only same-owner, same-day unique staged objects qualify for cleanup", () => {
  assert.equal(
    stagedPhotoStoragePathFromUrl(STAGED_A, OWNER, DATE, ORIGIN),
    `${OWNER}/${DATE}-upload-a.jpg`
  );
  assert.equal(stagedPhotoStoragePathFromUrl(STORED, OWNER, DATE, ORIGIN), null);
  assert.equal(stagedPhotoStoragePathFromUrl(STAGED_A, "other-user", DATE, ORIGIN), null);
  assert.equal(stagedPhotoStoragePathFromUrl(STAGED_A, OWNER, "2026-11-06", ORIGIN), null);
  assert.equal(
    stagedPhotoStoragePathFromUrl(
      STAGED_A.replace(ORIGIN, "https://attacker.example"),
      OWNER,
      DATE,
      ORIGIN
    ),
    null
  );
  assert.equal(
    stagedPhotoStoragePathFromUrl(
      `${ORIGIN}/storage/v1/object/public/diary-photos/${OWNER}/${DATE}-nested%2Fother.jpg`,
      OWNER,
      DATE,
      ORIGIN
    ),
    null
  );
});

test("the lifecycle rejects staged URLs from another origin", () => {
  const lifecycle = createPhotoEditLifecycle(async () => {}, ORIGIN);
  assert.equal(
    lifecycle.track(
      OWNER,
      DATE,
      STAGED_A.replace(ORIGIN, "https://attacker.example")
    ),
    false
  );
});

test("abandonment deletes only registered staged uploads, never the stored photo", async () => {
  const deleted: Array<[string, string]> = [];
  const lifecycle = createPhotoEditLifecycle(async (url, date) => {
    deleted.push([url, date]);
  });

  lifecycle.track(OWNER, DATE, STAGED_A);
  await lifecycle.abandonDate(DATE);

  assert.deepEqual(deleted, [[STAGED_A, DATE]]);
  assert.equal(deleted.some(([url]) => url === STORED), false);
});

test("a save in flight holds cleanup; a successful save protects its staged object", async () => {
  const deleted: string[] = [];
  const lifecycle = createPhotoEditLifecycle(async (url) => {
    deleted.push(url);
  });
  lifecycle.track(OWNER, DATE, STAGED_A);

  const save = lifecycle.beginSave(OWNER, DATE, STAGED_A);
  assert.ok(save);
  await lifecycle.abandonDate(DATE);
  assert.deepEqual(deleted, []);

  await save.finish(true);
  assert.deepEqual(deleted, []);
});

test("a failed save is cleaned only after it settles and the edit is abandoned", async () => {
  const deleted: string[] = [];
  const lifecycle = createPhotoEditLifecycle(async (url) => {
    deleted.push(url);
  });
  lifecycle.track(OWNER, DATE, STAGED_A);

  const save = lifecycle.beginSave(OWNER, DATE, STAGED_A);
  assert.ok(save);
  await lifecycle.abandonDate(DATE);
  assert.deepEqual(deleted, []);

  await save.finish(false);
  assert.deepEqual(deleted, [STAGED_A]);
});

test("an ambiguous network save keeps its staged object after abandonment", async () => {
  const deleted: string[] = [];
  const lifecycle = createPhotoEditLifecycle(async (url) => {
    deleted.push(url);
  });
  lifecycle.track(OWNER, DATE, STAGED_A);

  const save = lifecycle.beginSave(OWNER, DATE, STAGED_A);
  assert.ok(save);
  await lifecycle.abandonDate(DATE);
  await save.finish("unknown");

  assert.deepEqual(deleted, []);
});

test("a failed save remains retryable while the edit is active", async () => {
  const deleted: string[] = [];
  const lifecycle = createPhotoEditLifecycle(async (url) => {
    deleted.push(url);
  });
  lifecycle.track(OWNER, DATE, STAGED_A);

  const firstSave = lifecycle.beginSave(OWNER, DATE, STAGED_A);
  assert.ok(firstSave);
  await firstSave.finish(false);
  const retry = lifecycle.beginSave(OWNER, DATE, STAGED_A);
  assert.ok(retry);
  await retry.finish(true);
  await lifecycle.abandonDate(DATE);

  assert.deepEqual(deleted, []);
});

test("rapid same-day replacement cleans the superseded staged upload only", async () => {
  const deleted: string[] = [];
  const lifecycle = createPhotoEditLifecycle(async (url) => {
    deleted.push(url);
  });
  lifecycle.track(OWNER, DATE, STAGED_A);
  lifecycle.track(OWNER, DATE, STAGED_B);
  await lifecycle.discard(OWNER, DATE, STAGED_A);

  assert.deepEqual(deleted, [STAGED_A]);
  await lifecycle.abandonDate(DATE);
  assert.deepEqual(deleted, [STAGED_A, STAGED_B]);
});

test("an upload finishing after cancellation is deleted and never staged", async () => {
  const upload = deferred<string>();
  const deleted: Array<[string, string]> = [];
  const staged: string[] = [];
  let active = true;

  const pending = finishPhotoUpload({
    date: DATE,
    upload: () => upload.promise,
    isCurrent: () => active,
    onStage: (url) => staged.push(url),
    cleanup: async (url, date) => {
      deleted.push([url, date]);
    },
  });
  active = false;
  upload.resolve(STAGED_A);

  assert.equal(await pending, "discarded");
  assert.deepEqual(staged, []);
  assert.deepEqual(deleted, [[STAGED_A, DATE]]);
});

test("the staged cleanup callback is owner-scoped and verifies the current row", async () => {
  const removals: string[] = [];
  const cleanup = createStagedPhotoCleanup({
    getOwner: async () => OWNER,
    readCurrentPhoto: async () => STORED,
    remove: async (_ownerId, path) => {
      removals.push(path);
    },
    expectedOrigin: ORIGIN,
  });

  await cleanup(STAGED_A, DATE);
  await cleanup(STORED, DATE);
  await cleanup(
    `${ORIGIN}/storage/v1/object/public/diary-photos/other-user/${DATE}-upload-x.jpg`,
    DATE
  );

  assert.deepEqual(removals, [`${OWNER}/${DATE}-upload-a.jpg`]);
});

test("staged cleanup keeps a current photo and fails closed when row read fails", async () => {
  const removals: string[] = [];
  const currentlySaved = createStagedPhotoCleanup({
    getOwner: async () => OWNER,
    readCurrentPhoto: async () => STAGED_A,
    remove: async (_ownerId, path) => {
      removals.push(path);
    },
    expectedOrigin: ORIGIN,
  });
  const unreadable = createStagedPhotoCleanup({
    getOwner: async () => OWNER,
    readCurrentPhoto: async () => {
      throw new Error("read failed");
    },
    remove: async (_ownerId, path) => {
      removals.push(path);
    },
    expectedOrigin: ORIGIN,
  });

  await currentlySaved(STAGED_A, DATE);
  await unreadable(STAGED_B, DATE);
  assert.deepEqual(removals, []);
});

test("staged cleanup refuses deletion when the current owner cannot be resolved", async () => {
  const removals: string[] = [];
  const cleanup = createStagedPhotoCleanup({
    getOwner: async () => null,
    readCurrentPhoto: async () => null,
    remove: async (_ownerId, path) => {
      removals.push(path);
    },
    expectedOrigin: ORIGIN,
  });

  await cleanup(STAGED_A, DATE);
  assert.deepEqual(removals, []);
});
