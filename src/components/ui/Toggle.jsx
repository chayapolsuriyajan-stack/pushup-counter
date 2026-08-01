import s from "./Toggle.module.css";

export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={s.track}
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={s.thumb} />
    </button>
  );
}
