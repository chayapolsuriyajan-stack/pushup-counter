// Local-time date helpers. The v1 store used `toISOString().slice(0,10)`,
// which is UTC — at GMT+7 any workout before 07:00 local filed to the
// previous day, silently corrupting streaks. Everything here operates in
// the browser's local time zone instead.

/** "YYYY-MM-DD" in local time, not UTC. */
export function dayKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(d, delta) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

export function parseDayKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Builds a GitHub-style contribution grid: `weeks` columns of 7 days each,
 * ending on the current week, Monday at the top of each column. Each cell
 * carries its date key and total reps that day (0 if none).
 */
export function buildHeatmapGrid(repsByDay, weeks = 12) {
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  // Align the grid so every column starts Monday and the last column's
  // bottom row is the Sunday of the current week.
  const end = addDays(today, 6 - todayDow);
  const gridStart = addDays(end, -(weeks * 7) + 1);

  const columns = [];
  let cursor = gridStart;
  for (let w = 0; w < weeks; w++) {
    const column = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      column.push({ date: key, reps: repsByDay.get(key) ?? 0, isFuture: cursor > today });
      cursor = addDays(cursor, 1);
    }
    columns.push(column);
  }
  return columns;
}
