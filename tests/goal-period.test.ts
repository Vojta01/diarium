import assert from "node:assert/strict";
import test from "node:test";

import { goalPeriodRange } from "../src/lib/goal-period.ts";

test("includes today's entry right after Prague midnight (UTC is still yesterday)", () => {
  // 2026-11-06T23:30Z is 2026-11-07 00:30 in Prague (CET, UTC+1).
  const week = goalPeriodRange("week", new Date("2026-11-06T23:30:00Z"));
  assert.deepEqual(week, { start: "2026-10-31", end: "2026-11-07" });

  const month = goalPeriodRange("month", new Date("2026-11-06T23:30:00Z"));
  assert.deepEqual(month, { start: "2026-10-07", end: "2026-11-07" });
});

test("keeps the previous Prague day just before midnight", () => {
  // 22:59:59Z is 23:59:59 in Prague, still 6 November.
  assert.deepEqual(goalPeriodRange("week", new Date("2026-11-06T22:59:59Z")), {
    start: "2026-10-30",
    end: "2026-11-06",
  });
});

test("week range crosses the spring DST transition without losing a day", () => {
  // Clocks jump forward on 2026-03-29; a 7-day window still spans 8 date keys.
  const range = goalPeriodRange("week", new Date("2026-03-29T10:00:00Z"));
  assert.deepEqual(range, { start: "2026-03-22", end: "2026-03-29" });
});

test("week range crosses the autumn DST transition without duplicating a day", () => {
  // Clocks fall back on 2026-10-25.
  const range = goalPeriodRange("week", new Date("2026-10-25T10:00:00Z"));
  assert.deepEqual(range, { start: "2026-10-18", end: "2026-10-25" });
});

test("month range follows the Prague calendar month at New Year midnight", () => {
  // 2025-12-31T23:30Z is already 2026-01-01 00:30 in Prague.
  assert.deepEqual(goalPeriodRange("month", new Date("2025-12-31T23:30:00Z")), {
    start: "2025-12-01",
    end: "2026-01-01",
  });
});
