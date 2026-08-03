// localStorage-backed history. No network, no accounts, no export —
// deliberately, per the user's choice. Every localStorage call is guarded
// since Safari private mode throws on write rather than failing quietly.
import { dayKey, addDays } from "./dates.js";

const KEY_V2 = "pushup-counter/v2";
const KEY_V1 = "pushup-counter/v1"; // never deleted — the only rollback with no export

const DEFAULT_SETTINGS = {
  countdownEnabled: false,
  countdownSec: 60,
  vibration: true,
  signalSource: "auto",
};

function emptyStore() {
  return { version: 2, sets: [], legacyDays: [], settings: { ...DEFAULT_SETTINGS } };
}

/**
 * Pure migration: v2 blob if present and valid, else promote a v1 blob's
 * day-total rows into `legacyDays` (NOT `sets` — a v1 row already sums
 * every set from that day, so treating it as one set would fabricate a
 * best-single-set record). Never throws; any parse failure falls through
 * to the next source, and total failure returns an empty store without
 * writing anything.
 */
export function migrate(rawV2, rawV1) {
  try {
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.sets)) {
        return {
          version: 2,
          sets: parsed.sets,
          legacyDays: Array.isArray(parsed.legacyDays) ? parsed.legacyDays : [],
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        };
      }
    }
  } catch {
    // fall through
  }

  try {
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (parsed && Array.isArray(parsed.sessions)) {
        const legacyDays = parsed.sessions
          .filter((s) => typeof s?.date === "string" && Number.isFinite(s?.reps))
          .map(({ date, reps }) => ({ date, reps }));
        return { version: 2, sets: [], legacyDays, settings: { ...DEFAULT_SETTINGS } };
      }
    }
  } catch {
    // fall through
  }

  return emptyStore();
}

function load() {
  let rawV2 = null;
  let rawV1 = null;
  try {
    rawV2 = localStorage.getItem(KEY_V2);
  } catch {
    /* ignore */
  }
  try {
    rawV1 = localStorage.getItem(KEY_V1);
  } catch {
    /* ignore */
  }
  return migrate(rawV2, rawV1);
}

function save(store) {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(store));
    return true;
  } catch {
    return false; // storage full, disabled, or private mode
  }
}

/** Total reps per local day across both sets and legacy day-totals. */
export function dayTotals(store) {
  const totals = new Map();
  for (const day of store.legacyDays) {
    totals.set(day.date, (totals.get(day.date) ?? 0) + day.reps);
  }
  for (const set of store.sets) {
    totals.set(set.date, (totals.get(set.date) ?? 0) + set.reps);
  }
  return totals;
}

/** Current streak of consecutive local days with any recorded volume. */
export function currentStreak(store) {
  const totals = dayTotals(store);
  if (totals.size === 0) return 0;

  let cursor = new Date();
  // If today has nothing yet, start counting from yesterday so an
  // in-progress streak isn't shown as broken before the day is over.
  if (!totals.has(dayKey(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (totals.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Best single set, ignoring legacy day-totals entirely — the honest number. */
export function bestSet(store) {
  return store.sets.reduce((best, s) => (best == null || s.reps > best.reps ? s : best), null);
}

/** Best single day, including legacy rows — the old semantics, for comparison. */
export function bestDay(store) {
  let best = null;
  for (const [date, reps] of dayTotals(store)) {
    if (best == null || reps > best.reps) best = { date, reps };
  }
  return best;
}

export function todayTotal(store) {
  return dayTotals(store).get(dayKey()) ?? 0;
}

/** Individual sets, most recent first. */
export function recentSets(store, n = 20) {
  return [...store.sets].sort((a, b) => b.startedAt - a.startedAt).slice(0, n);
}

/** Sets grouped by local day, most recent day first, each day's sets most-recent-first. */
export function groupByDay(store) {
  const groups = new Map();
  for (const set of store.sets) {
    if (!groups.has(set.date)) groups.set(set.date, []);
    groups.get(set.date).push(set);
  }
  for (const list of groups.values()) list.sort((a, b) => b.startedAt - a.startedAt);
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, sets]) => ({ date, sets }));
}

/** GitHub-style contribution grid data: Map<dayKey, totalReps>. */
export function heatmapData(store) {
  return dayTotals(store);
}

/** Daily rep totals for the last `days` days, oldest first — for the line graph. */
export function dailySeries(store, days = 30) {
  const totals = dayTotals(store);
  const series = [];
  let cursor = addDays(new Date(), -(days - 1));
  for (let i = 0; i < days; i++) {
    const key = dayKey(cursor);
    series.push({ date: key, reps: totals.get(key) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return series;
}

export function loadStore() {
  return load();
}

export function recordSet({ exercise, reps, startedAt, endedAt, mode, targetMs = null }) {
  if (!(reps > 0)) return load();
  const store = load();
  store.sets.push({
    id: crypto.randomUUID(),
    exercise,
    reps,
    date: dayKey(new Date(startedAt)),
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    mode,
    targetMs,
  });
  save(store);
  return store;
}

export function getSettings() {
  return load().settings;
}

export function updateSettings(patch) {
  const store = load();
  store.settings = { ...store.settings, ...patch };
  save(store);
  return store;
}

/** Clears both the v2 store and the legacy v1 blob — explicit user intent only. */
export function clearAll() {
  try {
    localStorage.removeItem(KEY_V2);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(KEY_V1);
  } catch {
    /* ignore */
  }
  return emptyStore();
}
