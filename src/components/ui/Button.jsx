import s from "./Button.module.css";

export default function Button({
  variant = "primary", // "primary" | "accent" | "ghost" | "danger"
  full = false,
  large = false,
  className = "",
  ...props
}) {
  const classes = [s.btn, s[variant], full && s.full, large && s.large, className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...props} />;
}
