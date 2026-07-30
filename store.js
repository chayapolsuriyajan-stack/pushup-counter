// localStorage-backed scoreboard. No network, no accounts, no export —
// deliberately, per the user's choice. Every call is guarded since Safari
// private mode throws on write rather than failing quietly.
const KEY = "pushup-counter/v1";

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, local-enough for daily use
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { sessions: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sessions)) return { sessions: [] };
    return parsed;
  } catch {
    return { sessions: [] };
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage full, disabled, or private mode
  }
}

/** Record a finished session. Multiple sessions same day accumulate. */
export function recordSession(reps) {
  if (reps <= 0) return load();
  const data = load();
  const date = todayStr();
  const existing = data.sessions.find((s) => s.date === date);
  if (existing) {
    existing.reps += reps;
  } else {
    data.sessions.push({ date, reps });
  }
  save(data);
  return data;
}

/** Current streak of consecutive days with at least one session, ending today or yesterday. */
export function currentStreak(data = load()) {
  const dates = new Set(data.sessions.map((s) => s.date));
  if (dates.size === 0) return 0;

  const cursor = new Date();
  // If today has no session yet, start counting from yesterday so an
  // in-progress streak isn't shown as broken before the day is over.
  if (!dates.has(todayStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function bestSession(data = load()) {
  return data.sessions.reduce((max, s) => Math.max(max, s.reps), 0);
}

export function todayTotal(data = load()) {
  const date = todayStr();
  const s = data.sessions.find((s) => s.date === date);
  return s ? s.reps : 0;
}

export function recentSessions(data = load(), n = 10) {
  return [...data.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n);
}

export function getScoreboard() {
  const data = load();
  return {
    best: bestSession(data),
    today: todayTotal(data),
    streak: currentStreak(data),
    recent: recentSessions(data),
  };
}
