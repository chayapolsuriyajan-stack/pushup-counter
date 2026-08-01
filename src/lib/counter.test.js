import { describe, it, expect } from "vitest";
import { SignalCalibrator, RepCounter, CONFIG, NORMALIZED_CONFIG } from "./counter.js";

// Triangle wave helper: 0..1..0 over `period` frames.
function triangle(frame, period) {
  const cyclePos = (frame % period) / period;
  return cyclePos < 0.5 ? cyclePos * 2 : 2 - cyclePos * 2;
}

describe("SignalCalibrator", () => {
  it("locks onto 'angle' given a clean angle-only swing", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 200; frame++) {
      t += 33;
      cal.update(60 + triangle(frame, 60) * (170 - 60), null, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
  });

  it("locks onto 'width' given a clean width-only swing", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 200; frame++) {
      t += 33;
      cal.update(null, 0.15 + triangle(frame, 60) * (0.35 - 0.15), t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("width");
  });

  it("never locks in when both signals swing below their minimum thresholds", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 300; frame++) {
      t += 33;
      const angle = 120 + Math.sin(frame * 0.3) * 5; // ~10deg swing, under minSwingAngleDeg(40)
      const width = 0.2 + Math.sin(frame * 0.3) * 0.005; // under minSwingWidthFrac(0.02)
      cal.update(angle, width, t);
    }
    expect(cal.locked).toBe(false);
  });

  it("rejects a single-frame noise spike without corrupting the calibrated min", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 120; frame++) {
      t += 33;
      let angle = 60 + triangle(frame, 60) * (170 - 60);
      if (frame === 90) angle = 5; // wild single-frame misdetection
      cal.update(angle, null, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal._angle.min).toBeGreaterThan(50);
  });

  it("picks the signal with the bigger observed swing", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 100; frame++) {
      t += 33;
      const tri = triangle(frame, 60);
      cal.update(60 + tri * (170 - 60), 0.2 + tri * 0.05, t); // angle swings 110, width swings 0.05
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
  });

  it("returns null from position() when the locked signal is missing, without throwing", () => {
    const cal = new SignalCalibrator(CONFIG);
    const counter = new RepCounter(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 60; frame++) {
      t += 33;
      cal.update(60 + triangle(frame, 60) * (170 - 60), null, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
    counter.config = NORMALIZED_CONFIG;

    expect(() => {
      for (let frame = 0; frame < 20; frame++) {
        t += 33;
        cal.update(null, null, t); // arm occluded
        counter.update(cal.position(null, null), t);
      }
    }).not.toThrow();
    expect(cal.position(null, null)).toBeNull();
  });
});

describe("RepCounter + SignalCalibrator, full pipeline", () => {
  it("bootstraps on raw angle, then switches to normalized counting after lock-in", () => {
    const cal = new SignalCalibrator(CONFIG);
    const counter = new RepCounter(CONFIG);
    let t = 0;
    let calibrationApplied = false;

    for (let frame = 0; frame < 400; frame++) {
      t += 33;
      const angle = 60 + triangle(frame, 60) * (170 - 60);
      cal.update(angle, null, t);

      if (cal.locked && !calibrationApplied) {
        calibrationApplied = true;
        counter.config = NORMALIZED_CONFIG;
        const pos = cal.position(angle, null);
        if (pos != null) {
          if (pos < NORMALIZED_CONFIG.downEnter) counter.state = "DOWN";
          else if (pos > NORMALIZED_CONFIG.upEnter) counter.state = "UP";
        }
      }

      if (cal.locked) {
        counter.update(cal.position(angle, null), t);
      } else {
        counter.update(angle, t); // bootstrap path, raw CONFIG thresholds
      }
    }

    // ~400 frames at 33ms/60-frame period ≈ 6.6 reps of motion.
    expect(counter.reps).toBeGreaterThanOrEqual(5);
  });
});
