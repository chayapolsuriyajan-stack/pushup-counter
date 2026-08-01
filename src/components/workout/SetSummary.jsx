import Button from "../ui/Button.jsx";
import s from "./SetSummary.module.css";

export default function SetSummary({ summary, isBest, onAnotherSet, onDone }) {
  return (
    <div className={s.wrap}>
      <div className={s.label}>Set complete</div>
      <div className={s.reps}>{summary.reps}</div>
      <div className={s.label}>reps{summary.mode === "timed" ? ` in ${summary.targetMs / 1000}s` : ""}</div>
      {isBest && summary.reps > 0 && <div className={s.best}>New best set</div>}
      <div className={s.actions}>
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
        <Button variant="primary" onClick={onAnotherSet}>
          Another set
        </Button>
      </div>
    </div>
  );
}
