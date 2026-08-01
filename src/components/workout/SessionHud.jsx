import Button from "../ui/Button.jsx";
import LiveText from "./LiveText.jsx";
import s from "./SessionHud.module.css";

export default function SessionHud({ repRef, timeLeftRef, mode, onFinish }) {
  return (
    <div className={s.hud}>
      {mode === "timed" && <LiveText ref={timeLeftRef} className={s.timeLeft} />}
      <LiveText ref={repRef} className={s.repCount} />
      <div className={s.row}>
        <Button variant="primary" onClick={onFinish}>
          {mode === "timed" ? "Stop" : "Finish set"}
        </Button>
      </div>
    </div>
  );
}
