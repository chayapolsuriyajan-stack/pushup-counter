import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";
import s from "./AppShell.module.css";

export default function AppShell() {
  return (
    <>
      <div className={s.content}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}
