import s from "./CalibrationBar.module.css";

const SIGNAL_LABELS = {
  angle: "elbow",
  width: "shoulder-width",
  shoulderWrist: "shoulder-to-wrist",
  noseY: "nose position",
  shoulderHip: "shoulder-to-hip",
};

export default function CalibrationBar({ trackRef, dotRef, zoneStyle, calibrationSignal }) {
  const visible = calibrationSignal != null;
  return (
    <div className={visible ? s.bar : `${s.bar} ${s.hidden}`} style={zoneStyle}>
      <div ref={trackRef} className={s.track}>
        <div className={`${s.zone} ${s.zoneUp}`} />
        <div className={`${s.zone} ${s.zoneDown}`} />
        <div ref={dotRef} className={s.dot} />
      </div>
      <div className={s.label}>tracking: {SIGNAL_LABELS[calibrationSignal] ?? ""}</div>
    </div>
  );
}
