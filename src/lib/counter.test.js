import { describe, it, expect } from "vitest";
import { SignalCalibrator, RepCounter, CONFIG, NORMALIZED_CONFIG, shoulderToWristVertical, noseVerticalPosition, shoulderToHipVertical } from "./counter.js";

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
      cal.update({ angle: 60 + triangle(frame, 60) * (170 - 60) }, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
  });

  it("locks onto 'width' given a clean width-only swing", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 200; frame++) {
      t += 33;
      cal.update({ width: 0.15 + triangle(frame, 60) * (0.35 - 0.15) }, t);
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
      cal.update({ angle, width }, t);
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
      cal.update({ angle }, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal._tracks.get("angle").min).toBeGreaterThan(50);
  });

  it("picks the signal with the bigger observed swing", () => {
    const cal = new SignalCalibrator(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 100; frame++) {
      t += 33;
      const tri = triangle(frame, 60);
      cal.update({ angle: 60 + tri * (170 - 60), width: 0.2 + tri * 0.05 }, t); // angle swings 110, width swings 0.05
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
  });

  it("returns null from position() when the locked signal is missing, without throwing", () => {
    const cal = new SignalCalibrator(CONFIG);
    const counter = new RepCounter(CONFIG);
    let t = 0;
    for (let frame = 0; frame < 100; frame++) {
      t += 33;
      cal.update({ angle: 60 + triangle(frame, 60) * (170 - 60) }, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("angle");
    counter.config = NORMALIZED_CONFIG;

    expect(() => {
      for (let frame = 0; frame < 20; frame++) {
        t += 33;
        cal.update({ angle: null }, t); // arm occluded
        counter.update(cal.position({ angle: null }), t);
      }
    }).not.toThrow();
    expect(cal.position({ angle: null })).toBeNull();
  });

  it("with a forced signal, locks only onto that signal even if another would win the auto-race", () => {
    const cal = new SignalCalibrator(CONFIG, "width");
    let t = 0;
    for (let frame = 0; frame < 100; frame++) {
      t += 33;
      const tri = triangle(frame, 60);
      // angle swings much bigger (110) than width (0.05) — auto mode would pick angle.
      cal.update({ angle: 60 + tri * (170 - 60), width: 0.2 + tri * 0.05 }, t);
    }
    expect(cal.locked).toBe(true);
    expect(cal.signal).toBe("width");
  });

  it("respects the 3s warmup gate identically whether forced or auto", () => {
    const cal = new SignalCalibrator(CONFIG, "angle");
    let t = 0;
    for (let frame = 0; frame < 200; frame++) {
      t += 20; // 20ms/frame -> 4000ms total, but warmup check happens per-call
      cal.update({ angle: 60 + triangle(frame, 60) * (170 - 60) }, t);
      if (t < CONFIG.calibrationWarmupMs) {
        expect(cal.locked).toBe(false);
      }
    }
    expect(cal.locked).toBe(true);
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
      cal.update({ angle }, t);

      if (cal.locked && !calibrationApplied) {
        calibrationApplied = true;
        counter.config = NORMALIZED_CONFIG;
        const pos = cal.position({ angle });
        if (pos != null) {
          if (pos < NORMALIZED_CONFIG.downEnter) counter.state = "DOWN";
          else if (pos > NORMALIZED_CONFIG.upEnter) counter.state = "UP";
        }
      }

      if (cal.locked) {
        counter.update(cal.position({ angle }), t);
      } else {
        counter.update(angle, t); // bootstrap path, raw CONFIG thresholds
      }
    }

    // ~400 frames at 33ms/60-frame period ≈ 6.6 reps of motion.
    expect(counter.reps).toBeGreaterThanOrEqual(5);
  });
});

describe("shoulderToWristVertical", () => {
  it("returns the vertical distance for the more-visible side", () => {
    const landmarks = [];
    landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.9 }; // left shoulder
    landmarks[15] = { x: 0.35, y: 0.6, visibility: 0.9 }; // left wrist
    landmarks[12] = { x: 0.6, y: 0.3, visibility: 0.1 }; // right shoulder (occluded)
    landmarks[16] = { x: 0.65, y: 0.6, visibility: 0.1 }; // right wrist (occluded)
    expect(shoulderToWristVertical(landmarks, 0.6)).toBeCloseTo(0.3, 5);
  });

  it("returns null when neither side is visible enough", () => {
    const landmarks = [];
    landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.2 };
    landmarks[15] = { x: 0.35, y: 0.6, visibility: 0.2 };
    landmarks[12] = { x: 0.6, y: 0.3, visibility: 0.1 };
    landmarks[16] = { x: 0.65, y: 0.6, visibility: 0.1 };
    expect(shoulderToWristVertical(landmarks, 0.6)).toBeNull();
  });

  it("returns null when the wrist is visible but the paired shoulder is not", () => {
    const landmarks = [];
    landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.2 }; // left shoulder occluded
    landmarks[15] = { x: 0.35, y: 0.6, visibility: 0.9 }; // left wrist clearly visible
    landmarks[12] = { x: 0.6, y: 0.3, visibility: 0.1 }; // right shoulder occluded
    landmarks[16] = { x: 0.65, y: 0.6, visibility: 0.1 }; // right wrist occluded
    expect(shoulderToWristVertical(landmarks, 0.6)).toBeNull();
  });
});

describe("noseVerticalPosition", () => {
  it("returns the nose landmark's y coordinate", () => {
    const landmarks = [];
    landmarks[0] = { x: 0.5, y: 0.22, visibility: 0.95 };
    expect(noseVerticalPosition(landmarks, 0.6)).toBeCloseTo(0.22, 5);
  });

  it("returns null when the nose is below the visibility threshold", () => {
    const landmarks = [];
    landmarks[0] = { x: 0.5, y: 0.22, visibility: 0.3 };
    expect(noseVerticalPosition(landmarks, 0.6)).toBeNull();
  });

  it("returns null when the nose landmark is missing", () => {
    expect(noseVerticalPosition([], 0.6)).toBeNull();
  });
});

describe("shoulderToHipVertical", () => {
  it("returns the vertical distance between shoulder and hip midpoints", () => {
    const landmarks = [];
    landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.9 };
    landmarks[12] = { x: 0.6, y: 0.32, visibility: 0.9 };
    landmarks[23] = { x: 0.42, y: 0.7, visibility: 0.9 };
    landmarks[24] = { x: 0.58, y: 0.72, visibility: 0.9 };
    // shoulderMidY = 0.31, hipMidY = 0.71
    expect(shoulderToHipVertical(landmarks, 0.6)).toBeCloseTo(0.4, 5);
  });

  it("returns null when any of the four landmarks is below the visibility threshold", () => {
    const landmarks = [];
    landmarks[11] = { x: 0.4, y: 0.3, visibility: 0.9 };
    landmarks[12] = { x: 0.6, y: 0.32, visibility: 0.9 };
    landmarks[23] = { x: 0.42, y: 0.7, visibility: 0.1 }; // occluded hip
    landmarks[24] = { x: 0.58, y: 0.72, visibility: 0.9 };
    expect(shoulderToHipVertical(landmarks, 0.6)).toBeNull();
  });
});
