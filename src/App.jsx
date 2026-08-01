import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider } from "./store/StoreContext.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import HomePage from "./pages/HomePage.jsx";
import WorkoutPage from "./pages/WorkoutPage.jsx";
import PushupSessionPage from "./pages/PushupSessionPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          {/* Full-bleed camera session lives outside the shell: no bottom
              nav to accidentally tap mid-set, and leaving this route
              unmounts the page, which is what drives camera teardown. */}
          <Route path="/workout/pushup" element={<PushupSessionPage />} />

          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="workout" element={<WorkoutPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
