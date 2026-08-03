import { useState } from "react";
import { useStore } from "../store/useStore.js";
import Toggle from "../components/ui/Toggle.jsx";
import SegmentedControl from "../components/ui/SegmentedControl.jsx";
import Button from "../components/ui/Button.jsx";
import ListRow from "../components/ui/ListRow.jsx";
import s from "./SettingsPage.module.css";

const DURATIONS = [30, 60, 90, 120];

const SIGNAL_OPTIONS = [
  { value: "auto", label: "Auto", description: "Watches every signal, picks whichever tracks best" },
  { value: "angle", label: "Elbow angle", description: "Classic joint-bend measurement" },
  { value: "width", label: "Shoulder width", description: "Apparent shoulder-to-shoulder distance" },
  { value: "shoulderWrist", label: "Shoulder-to-wrist", description: "Vertical distance from shoulder to wrist" },
  { value: "noseY", label: "Nose position", description: "Vertical position of your nose in frame" },
  { value: "shoulderHip", label: "Shoulder-to-hip", description: "Vertical torso distance (form diagnostic, not really a rep signal)" },
];

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
        <div className={s.sectionTitle}>Signal source</div>
        <div className={s.signalList}>
          {SIGNAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={s.signalOption}
              onClick={() => updateSettings({ signalSource: opt.value })}
              aria-pressed={settings.signalSource === opt.value}
            >
              <ListRow
                title={opt.label}
                subtitle={opt.description}
                trailing={settings.signalSource === opt.value ? "✓" : null}
              />
            </button>
          ))}
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
