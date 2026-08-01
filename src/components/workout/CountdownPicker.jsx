import SegmentedControl from "../ui/SegmentedControl.jsx";
import Button from "../ui/Button.jsx";
import s from "./CountdownPicker.module.css";

const DURATIONS = [30, 60, 90, 120];

export default function CountdownPicker({ mode, targetSec, onChangeMode, onChangeTarget, onStart }) {
  return (
    <div className={s.wrap}>
      <div className={s.group}>
        <div className={s.title}>Set type</div>
        <SegmentedControl
          options={[
            { value: "free", label: "Free" },
            { value: "timed", label: "Countdown" },
          ]}
          value={mode}
          onChange={onChangeMode}
        />
      </div>

      {mode === "timed" && (
        <div className={s.group}>
          <div className={s.title}>Duration</div>
          <SegmentedControl
            options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
            value={targetSec}
            onChange={onChangeTarget}
          />
        </div>
      )}

      <Button variant="primary" large onClick={onStart}>
        Start
      </Button>
    </div>
  );
}
