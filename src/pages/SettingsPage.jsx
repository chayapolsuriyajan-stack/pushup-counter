import { useState } from "react";
import { useStore } from "../store/useStore.js";
import Toggle from "../components/ui/Toggle.jsx";
import SegmentedControl from "../components/ui/SegmentedControl.jsx";
import Button from "../components/ui/Button.jsx";
import s from "./SettingsPage.module.css";

const DURATIONS = [30, 60, 90, 120];

export default function SettingsPage() {
  const { store, updateSettings, clearAll } = useStore();
  const { settings } = store;
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleClear() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearAll();
    setConfirmingClear(false);
  }

  return (
    <div>
      <h1 className={s.title}>Settings</h1>

      <div className={s.section}>
        <div className={s.sectionTitle}>Countdown challenge</div>
        <div className={s.row}>
          <span className={s.rowLabel}>Default to countdown mode</span>
          <Toggle
            checked={settings.countdownEnabled}
            onChange={(v) => updateSettings({ countdownEnabled: v })}
            label="Default to countdown mode"
          />
        </div>
        {settings.countdownEnabled && (
          <div className={s.durationGroup}>
            <SegmentedControl
              options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
              value={settings.countdownSec}
              onChange={(v) => updateSettings({ countdownSec: v })}
            />
          </div>
        )}
      </div>

      <div className={s.section}>
        <div className={s.sectionTitle}>Feedback</div>
        <div className={s.row}>
          <span className={s.rowLabel}>Vibrate on each rep</span>
          <Toggle
            checked={settings.vibration}
            onChange={(v) => updateSettings({ vibration: v })}
            label="Vibrate on each rep"
          />
        </div>
      </div>

      <div className={s.section}>
        <div className={s.sectionTitle}>Data</div>
        <Button variant="danger" full onClick={handleClear}>
          {confirmingClear ? "Tap again to permanently clear all data" : "Clear all data"}
        </Button>
      </div>
    </div>
  );
}
