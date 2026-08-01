import { buildHeatmapGrid } from "../../lib/dates.js";
import s from "./Heatmap.module.css";

const CELL = 11;
const GUTTER = 3;
const STEP = CELL + GUTTER;

// Level relative to the max seen in this grid (not a fixed absolute
// threshold) — the same approach GitHub's own contribution graph uses,
// since an absolute rep count means something different to everyone.
function levelFor(reps, maxReps) {
  if (reps <= 0 || maxReps <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((4 * reps) / maxReps)));
}

const LEVEL_OPACITY = { 1: 0.25, 2: 0.45, 3: 0.7, 4: 1 };

export default function Heatmap({ repsByDay, weeks = 12 }) {
  const columns = buildHeatmapGrid(repsByDay, weeks);
  const maxReps = Math.max(0, ...columns.flat().map((d) => d.reps));
  const width = columns.length * STEP;
  const height = 7 * STEP;

  return (
    <div className={s.wrap}>
      <svg className={s.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Workout activity heatmap">
        {columns.map((column, colIdx) =>
          column.map((day, rowIdx) => {
            if (day.isFuture) return null;
            const level = levelFor(day.reps, maxReps);
            const fill =
              level === 0
                ? "var(--surface-2)"
                : `color-mix(in srgb, var(--surface-accent) ${LEVEL_OPACITY[level] * 100}%, var(--surface-2))`;
            return (
              <rect
                key={day.date}
                className={s.cell}
                x={colIdx * STEP}
                y={rowIdx * STEP}
                width={CELL}
                height={CELL}
                rx="2"
                fill={fill}
              >
                <title>
                  {day.date}: {day.reps} rep{day.reps === 1 ? "" : "s"}
                </title>
              </rect>
            );
          }),
        )}
      </svg>
      <div className={s.legend}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={s.legendSwatch}
            style={{
              background:
                level === 0
                  ? "var(--surface-2)"
                  : `color-mix(in srgb, var(--surface-accent) ${LEVEL_OPACITY[level] * 100}%, var(--surface-2))`,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
