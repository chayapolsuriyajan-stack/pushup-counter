import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePoseSession } from "../hooks/usePoseSession.js";
import { useStore } from "../store/useStore.js";
import { bestSet } from "../lib/store.js";
import CameraStage from "../components/workout/CameraStage.jsx";
import CalibrationBar from "../components/workout/CalibrationBar.jsx";
import CountdownPicker from "../components/workout/CountdownPicker.jsx";
import SessionHud from "../components/workout/SessionHud.jsx";
import SetSummary from "../components/workout/SetSummary.jsx";
import hudStyles from "../components/workout/SessionHud.module.css";
import s from "./PushupSessionPage.module.css";

export default function PushupSessionPage() {
  const navigate = useNavigate();
  const { store, recordSet } = useStore();
  const [mode, setMode] = useState(store.settings.countdownEnabled ? "timed" : "free");
  const [targetSec, setTargetSec] = useState(store.settings.countdownSec);
  const [justRecorded, setJustRecorded] = useState(null); // {summary, isBest} — set once per finished summary

  const session = usePoseSession({ mode, targetSec, vibrationEnabled: store.settings.vibration });

  // Persist exactly once per finished set, in an effect rather than during
  // render — recordSet is a real side effect (localStorage write + context
  // update), and calling it directly in the render body would double-fire
  // under StrictMode's intentional double-render, double-recording the set.
  useEffect(() => {
    if (!session.summary) return;
    const priorBest = bestSet(store);
    recordSet({
      exercise: "pushup",
      reps: session.summary.reps,
      startedAt: session.summary.startedAt,
      endedAt: session.summary.endedAt,
      mode: session.summary.mode,
      targetMs: session.summary.targetMs,
    });
    setJustRecorded({
      summary: session.summary,
      isBest: priorBest == null || session.summary.reps > priorBest.reps,
    });
    // store/recordSet intentionally excluded: this must run once per new
    // summary object, not on every store update recordSet itself causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.summary]);

  return (
    <div className={s.screen}>
      <button className={s.exitBtn} onClick={() => navigate("/workout")} aria-label="Exit">
        ×
      </button>

      <CameraStage videoRef={session.videoRef} canvasRef={session.canvasRef} />
      <CalibrationBar
        trackRef={session.trackRef}
        dotRef={session.dotRef}
        zoneStyle={session.zoneStyle}
        calibrationSignal={session.calibrationSignal}
      />

      {session.errorMessage && <div className={hudStyles.banner}>{session.errorMessage}</div>}

      {(session.phase === "idle" || session.phase === "error") && (
        <CountdownPicker
          mode={mode}
          targetSec={targetSec}
          onChangeMode={setMode}
          onChangeTarget={setTargetSec}
          onStart={session.start}
        />
      )}

      {session.phase === "finished" && justRecorded && (
        <SetSummary
          summary={session.summary}
          isBest={justRecorded.isBest}
          onAnotherSet={session.start}
          onDone={() => navigate("/workout")}
        />
      )}

      <SessionHud repRef={session.repRef} timeLeftRef={session.timeLeftRef} mode={mode} onFinish={session.finish} />
    </div>
  );
}
