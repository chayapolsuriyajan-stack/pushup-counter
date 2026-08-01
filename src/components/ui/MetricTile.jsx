import s from "./MetricTile.module.css";

export default function MetricTile({ value, label }) {
  return (
    <div className={s.tile}>
      <div className={s.value}>{value}</div>
      <div className={s.label}>{label}</div>
    </div>
  );
}
