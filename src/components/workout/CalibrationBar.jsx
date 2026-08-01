import s from "./CalibrationBar.module.css";

export default function CalibrationBar({ trackRef, dotRef, zoneStyle, calibrationSignal }) {
  const visible = calibrationSignal != null;
  return (
    <div className={visible ? s.bar : `${s.bar} ${s.hidden}`} style={zoneStyle}>
      <div ref={trackRef} className={s.track}>
        <div className={`${s.zone} ${s.zoneUp}`} />
        <div className={`${s.zone} ${s.zoneDown}`} />
        <div ref={dotRef} className={s.dot} />
      </div>
      <div className={s.label}>
        tracking: {calibrationSignal === "angle" ? "elbow" : calibrationSignal === "width" ? "shoulder-width" : ""}
      </div>
    </div>
  );
}
