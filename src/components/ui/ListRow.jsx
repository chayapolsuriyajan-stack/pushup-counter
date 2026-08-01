import s from "./ListRow.module.css";

export default function ListRow({ title, subtitle, trailing, badge }) {
  return (
    <div className={s.row}>
      <div className={s.main}>
        <div className={s.title}>{title}</div>
        {subtitle && <div className={s.subtitle}>{subtitle}</div>}
        {badge && <div className={s.badge}>{badge}</div>}
      </div>
      {trailing != null && <div className={s.trailing}>{trailing}</div>}
    </div>
  );
}
