import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore.js";
import { currentStreak, bestSet, todayTotal, heatmapData, dailySeries } from "../lib/store.js";
import { getExercise } from "../lib/exercises.js";
import Card from "../components/ui/Card.jsx";
import MetricTile from "../components/ui/MetricTile.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Heatmap from "../components/charts/Heatmap.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import s from "./HomePage.module.css";

export default function HomePage() {
  const navigate = useNavigate();
  const { store } = useStore();
  const streak = currentStreak(store);
  const best = bestSet(store);
  const today = todayTotal(store);
  const hasAnyHistory = store.sets.length > 0 || store.legacyDays.length > 0;

  return (
    <div>
      <h1 className={s.title}>Push-up Counter</h1>

      <Button variant="primary" full large onClick={() => navigate(getExercise("pushup").route)}>
        Start push-ups
      </Button>

      <div className={s.grid} style={{ marginTop: "var(--space-3)" }}>
        <div className={`${s.statsRow} ${s.full}`}>
          <MetricTile value={today} label="Today" />
          <MetricTile value={best?.reps ?? 0} label="Best set" />
          <MetricTile value={streak} label="Day streak" />
        </div>

        <Card className={hasAnyHistory ? "" : s.full}>
          <div className={s.cardTitle}>Activity</div>
          {hasAnyHistory ? (
            <Heatmap repsByDay={heatmapData(store)} />
          ) : (
            <EmptyState title="No workouts yet">Your activity will show up here once you log a set.</EmptyState>
          )}
        </Card>

        {hasAnyHistory && (
          <Card>
            <div className={s.cardTitle}>Last 30 days</div>
            <LineChart series={dailySeries(store, 30)} />
          </Card>
        )}
      </div>
    </div>
  );
}
