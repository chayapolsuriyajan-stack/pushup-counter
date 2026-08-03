import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { migrate, dayTotals, currentStreak, bestSet } from "./store.js";
import { dayKey } from "./dates.js";

describe("migrate", () => {
  it("promotes v1 sessions into legacyDays, leaving sets empty", () => {
    const rawV1 = JSON.stringify({
      sessions: [
        { date: "2026-07-28", reps: 40 },
        { date: "2026-07-29", reps: 55 },
      ],
    });
    const store = migrate(null, rawV1);
    expect(store.version).toBe(2);
    expect(store.sets).toEqual([]);
    expect(store.legacyDays).toEqual([
      { date: "2026-07-28", reps: 40 },
      { date: "2026-07-29", reps: 55 },
    ]);
  });

  it("passes through an existing v2 blob unchanged (idempotent)", () => {
    const v2 = {
      version: 2,
      sets: [{ id: "a", exercise: "pushup", reps: 20, date: "2026-08-01", startedAt: 1, endedAt: 2, durationMs: 1, mode: "free", targetMs: null }],
      legacyDays: [{ date: "2026-07-01", reps: 10 }],
      settings: { countdownEnabled: true, countdownSec: 45, vibration: false },
    };
    const first = migrate(JSON.stringify(v2), null);
    const second = migrate(JSON.stringify(first), null);
    expect(second).toEqual(first);
  });

  it("never throws on garbage input and returns an empty store", () => {
    for (const bad of [null, undefined, "", "{", "not json", "[]", "42", JSON.stringify({ sessions: "nope" })]) {
      expect(() => migrate(bad, bad)).not.toThrow();
      const store = migrate(bad, bad);
      expect(store.version).toBe(2);
      expect(store.sets).toEqual([]);
      expect(store.legacyDays).toEqual([]);
    }
  });

  it("falls back to v1 when the v2 blob is corrupt but v1 is valid", () => {
    const rawV1 = JSON.stringify({ sessions: [{ date: "2026-07-15", reps: 12 }] });
    const store = migrate("{not valid json", rawV1);
    expect(store.legacyDays).toEqual([{ date: "2026-07-15", reps: 12 }]);
  });

  it("fills in signalSource: \"auto\" as the default for settings missing it", () => {
    const v2 = {
      version: 2,
      sets: [],
      legacyDays: [],
      settings: { countdownEnabled: false, countdownSec: 60, vibration: true },
    };
    const store = migrate(JSON.stringify(v2), null);
    expect(store.settings.signalSource).toBe("auto");
  });
});

describe("dayTotals / currentStreak / bestSet", () => {
  function storeWith({ sets = [], legacyDays = [] }) {
    return { version: 2, sets, legacyDays, settings: {} };
  }

  it("dayTotals sums a legacy day and a same-date new set together", () => {
    const store = storeWith({
      legacyDays: [{ date: "2026-08-01", reps: 30 }],
      sets: [{ id: "a", exercise: "pushup", reps: 15, date: "2026-08-01", startedAt: 1, endedAt: 2, durationMs: 1, mode: "free", targetMs: null }],
    });
    expect(dayTotals(store).get("2026-08-01")).toBe(45);
  });

  it("bestSet ignores legacyDays entirely, even when a legacy day total is huge", () => {
    const store = storeWith({
      legacyDays: [{ date: "2026-07-01", reps: 500 }],
      sets: [{ id: "a", exercise: "pushup", reps: 20, date: "2026-08-01", startedAt: 1, endedAt: 2, durationMs: 1, mode: "free", targetMs: null }],
    });
    expect(bestSet(store)).toEqual(
      expect.objectContaining({ reps: 20 }),
    );
  });

  it("bestSet returns null when there are no sets at all", () => {
    expect(bestSet(storeWith({ legacyDays: [{ date: "2026-07-01", reps: 500 }] }))).toBeNull();
  });

  it("currentStreak over a legacy-only store matches the v1 semantics for the same dates", () => {
    // 3 consecutive days ending today, legacy-only (simulating a pre-migration user).
    const today = new Date();
    const y = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return dayKey(d);
    };
    const store = storeWith({
      legacyDays: [
        { date: y(0), reps: 10 },
        { date: y(1), reps: 10 },
        { date: y(2), reps: 10 },
      ],
    });
    expect(currentStreak(store)).toBe(3);
  });

  it("currentStreak counts from yesterday when today has no volume yet", () => {
    const today = new Date();
    const y = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return dayKey(d);
    };
    const store = storeWith({ legacyDays: [{ date: y(1), reps: 5 }, { date: y(2), reps: 5 }] });
    expect(currentStreak(store)).toBe(2);
  });
});

describe("dayKey — local time zone regression (the UTC bug fix)", () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Asia/Bangkok"; // GMT+7, matches the user's real time zone
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTZ;
  });

  it("files a late-night local workout under the correct local day, not UTC", () => {
    // 2026-08-01 23:30 UTC == 2026-08-02 06:30 Bangkok time.
    vi.setSystemTime(new Date("2026-08-01T23:30:00Z"));
    expect(dayKey(new Date())).toBe("2026-08-02");
  });

  it("files an early-morning local workout that would misfile under plain UTC", () => {
    // 2026-08-01 21:00 UTC == 2026-08-02 04:00 Bangkok time — the exact
    // window the old toISOString()-based todayStr() got wrong.
    vi.setSystemTime(new Date("2026-08-01T21:00:00Z"));
    expect(dayKey(new Date())).toBe("2026-08-02");
  });
});
