import s from "./SegmentedControl.module.css";

export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div className={s.group} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          data-active={opt.value === value}
          className={s.option}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
