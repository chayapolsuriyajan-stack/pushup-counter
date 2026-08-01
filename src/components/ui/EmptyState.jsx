import s from "./EmptyState.module.css";

export default function EmptyState({ title, children }) {
  return (
    <div className={s.wrap}>
      <div className={s.title}>{title}</div>
      {children && <div className={s.body}>{children}</div>}
    </div>
  );
}
