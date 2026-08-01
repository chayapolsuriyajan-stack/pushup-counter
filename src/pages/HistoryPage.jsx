import { useStore } from "../store/useStore.js";
import { groupByDay } from "../lib/store.js";
import ListRow from "../components/ui/ListRow.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import s from "./HistoryPage.module.css";

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function HistoryPage() {
  const { store } = useStore();
  const byDay = groupByDay(store);
  const legacyByDate = new Map(store.legacyDays.map((d) => [d.date, d.reps]));

  // Union of every date that has either individual sets or a legacy
  // day-total, most recent first.
  const allDates = [...new Set([...byDay.map((d) => d.date), ...legacyByDate.keys()])].sort((a, b) =>
    a < b ? 1 : -1,
  );

  if (allDates.length === 0) {
    return (
      <div>
        <h1 className={s.title}>History</h1>
        <EmptyState title="No sets logged yet">Finish a set and it'll show up here.</EmptyState>
      </div>
    );
  }

  const setsByDate = new Map(byDay.map((d) => [d.date, d.sets]));

  return (
    <div>
      <h1 className={s.title}>History</h1>
      {allDates.map((date) => {
        const sets = setsByDate.get(date) ?? [];
        const legacyReps = legacyByDate.get(date);
        return (
          <div key={date} className={s.day}>
            <div className={s.dayHeader}>{date}</div>
            {legacyReps != null && (
              <ListRow title="Day total" badge="Pre-v2 · day total" trailing={`${legacyReps} reps`} />
            )}
            {sets.map((set) => (
              <ListRow
                key={set.id}
                title={`${set.reps} reps`}
                subtitle={
                  set.mode === "timed" ? `${formatTime(set.startedAt)} · ${set.targetMs / 1000}s countdown` : formatTime(set.startedAt)
                }
                trailing={`${(set.durationMs / 1000).toFixed(0)}s`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
