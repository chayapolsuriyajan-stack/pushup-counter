import { NavLink } from "react-router-dom";
import HomeIcon from "../icons/HomeIcon.jsx";
import WorkoutIcon from "../icons/WorkoutIcon.jsx";
import HistoryIcon from "../icons/HistoryIcon.jsx";
import SettingsIcon from "../icons/SettingsIcon.jsx";
import s from "./BottomNav.module.css";

const TABS = [
  { to: "/", label: "Home", Icon: HomeIcon, end: true },
  { to: "/workout", label: "Workout", Icon: WorkoutIcon },
  { to: "/history", label: "History", Icon: HistoryIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function BottomNav() {
  return (
    <nav className={s.nav}>
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive ? `${s.item} ${s.itemActive}` : s.item)}
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? `${s.iconWrap} ${s.iconWrapActive}` : s.iconWrap}>
                <Icon />
              </span>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
