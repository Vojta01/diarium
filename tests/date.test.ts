import assert from "node:assert/strict";
import test from "node:test";

import { PRAGUE_TIME_ZONE, pragueDateKey } from "../src/lib/date.ts";

test("uses the canonical Europe/Prague time zone", () => {
  assert.equal(PRAGUE_TIME_ZONE, "Europe/Prague");
});

test("returns the Prague calendar date after midnight, not the UTC date", () => {
  assert.equal(pragueDateKey(new Date("2026-11-06T23:30:00Z")), "2026-11-07");
  assert.equal(pragueDateKey(new Date("2026-11-06T22:59:59Z")), "2026-11-06");
  assert.equal(pragueDateKey(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
});

test("handles the spring DST transition", () => {
  // 2026-03-29 02:00 CET jumps to 03:00 CEST.
  assert.equal(pragueDateKey(new Date("2026-03-29T00:30:00Z")), "2026-03-29");
  assert.equal(pragueDateKey(new Date("2026-03-29T22:30:00Z")), "2026-03-30");
});

test("handles the autumn DST transition", () => {
  // 2026-10-25 03:00 CEST falls back to 02:00 CET.
  assert.equal(pragueDateKey(new Date("2026-10-25T00:30:00Z")), "2026-10-25");
  assert.equal(pragueDateKey(new Date("2026-10-25T23:30:00Z")), "2026-10-26");
});

test("formats the key as zero-padded YYYY-MM-DD", () => {
  assert.match(pragueDateKey(new Date("2026-01-05T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(pragueDateKey(new Date("2026-01-05T12:00:00Z")), "2026-01-05");
});
