import s from "./Card.module.css";

export default function Card({ children, className = "", ...props }) {
  return (
    <div className={`${s.card} ${className}`} {...props}>
      {children}
    </div>
  );
}
