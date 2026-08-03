# Multi-Signal Rep-Counting Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user manually force the push-up counter onto one specific
candidate signal at a time (instead of only the automatic elbow-angle/
shoulder-width race), so they can do a real set per candidate and compare the
resulting count against their actual reps to find what's reliable for their
camera setup.

**Architecture:** `SignalCalibrator` (`src/lib/counter.js`) generalizes from
two hardcoded tracks (`_angle`, `_width`) to N named tracks driven by a
`SIGNAL_DEFS` config map, gains an optional `forcedSignal` constructor
argument that skips its "race all candidates" logic, and its `update()`/
`position()` methods move from positional `(angle, width, ...)` args to a
single `signals` object keyed by name. Three new pure landmark-based
extractor functions are added alongside the existing `apparentShoulderWidth`.
A new `settings.signalSource` field (persisted via the existing
`updateSettings`) drives a new Settings UI section and is threaded through
`usePoseSession` to pick `forcedSignal`.

**Tech Stack:** Vanilla ES modules for the pure `src/lib/` layer (no React),
Vitest for tests, React for the Settings UI and `usePoseSession` hook — all
matching the existing codebase, no new dependencies.

## Global Constraints

- `src/lib/counter.js` and its test file `src/lib/counter.test.js` are pure —
  no DOM, no React, no camera. Every function here must stay testable with
  plain JS objects.
- Existing `RepCounter` class is untouched by this plan — only
  `SignalCalibrator` changes.
- `calibrationWarmupMs` changes from `500` to `3000` (root-cause fix for
  locking onto setup-time jitter — see spec at
  `docs/superpowers/specs/2026-08-03-multi-signal-testing-design.md`).
- Signal names used throughout, exact strings: `"angle"`, `"width"`,
  `"shoulderWrist"`, `"noseY"`, `"shoulderHip"`.
- When a signal is manually forced (anything other than `"auto"`), the
  raw-angle bootstrap fallback in `usePoseSession`'s frame loop must be
  disabled — no counting happens until the forced signal itself calibrates.

---

### Task 1: Add new pure signal extractors + config thresholds to `counter.js`

**Files:**
- Modify: `src/lib/counter.js` (CONFIG object, add 3 new exported functions after `apparentShoulderWidth`)
- Test: `src/lib/counter.test.js` (new `describe` blocks)

**Interfaces:**
- Produces: `shoulderToWristVertical(landmarks, minVisibility)`,
  `noseVerticalPosition(landmarks, minVisibility)`,
  `shoulderToHipVertical(landmarks, minVisibility)` — each returns a number
  or `null`, same calling convention as the existing `apparentShoulderWidth`.
- Produces: `CONFIG.calibrationWarmupMs` now `3000` (was `500`);
  `CONFIG.minSwingShoulderWristFrac`, `CONFIG.maxJumpShoulderWristFrac`,
  `CONFIG.minSwingNoseYFrac`, `CONFIG.maxJumpNoseYFrac`,
  `CONFIG.minSwingShoulderHipFrac`, `CONFIG.maxJumpShoulderHipFrac`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/counter.test.js` (after the existing `import` line, before
the first `describe`):

```js
import { shoulderToWristVertical, noseVerticalPosition, shoulderToHipVertical } from "./counter.js";
```

Then append these `describe` blocks at the end of the file:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `shoulderToWristVertical`, `noseVerticalPosition`,
`shoulderToHipVertical` are not exported from `./counter.js`.

- [ ] **Step 3: Add the config thresholds and the three functions**

In `src/lib/counter.js`, replace the `CONFIG` object:

```js
export const CONFIG = {
  downEnter: 90,   // elbow angle must drop below this to register the bottom
  upEnter: 160,    // elbow angle must rise above this to complete the rep
  minRepMs: 400,   // reject anything faster than this as jitter/noise
  minVisibility: 0.6,   // ignore landmarks the model isn't confident about

  // SignalCalibrator tuning — see that class below.
  minSwingAngleDeg: 40,        // min observed elbow-angle swing before it can be trusted
  minSwingWidthFrac: 0.02,     // min observed shoulder-width swing before it can be trusted
  minSwingShoulderWristFrac: 0.03, // min observed shoulder-to-wrist swing before it can be trusted
  minSwingNoseYFrac: 0.02,         // min observed nose-Y swing before it can be trusted
  minSwingShoulderHipFrac: 0.02,   // min observed shoulder-to-hip swing before it can be trusted
  // 3s, not the original 500ms: 500ms was barely enough time to prop the
  // phone up, let alone get into position, so the calibrator could lock
  // onto pure setup-fumbling jitter before any real motion happened.
  calibrationWarmupMs: 3000,
  calibrationEmaAlpha: 0.25,   // smoothing factor for ordinary per-frame landmark jitter
  maxJumpAngleDeg: 60,         // reject a single-frame angle sample that jumps more than this
  maxJumpWidthFrac: 0.15,      // reject a single-frame width sample that jumps more than this
  maxJumpShoulderWristFrac: 0.2,   // reject a single-frame shoulder-wrist sample that jumps more than this
  maxJumpNoseYFrac: 0.15,          // reject a single-frame nose-Y sample that jumps more than this
  maxJumpShoulderHipFrac: 0.15,    // reject a single-frame shoulder-hip sample that jumps more than this
};
```

Then add these three functions immediately after `apparentShoulderWidth`
(before the `SignalCalibrator` class doc comment):

```js
/**
 * Alternative signal: vertical (image-Y) distance between shoulder and
 * wrist on whichever arm is more visible. The wrist stays planted on the
 * ground through a push-up while the shoulder rises and falls with the
 * elbow bend, so this is a direct 2D vertical motion rather than an
 * apparent-size/depth cue — a different failure mode than shoulder-width.
 * Assumed polarity: larger = arm more extended = "up". Unverified without
 * real footage; if this turns out backwards, flip the `invert` flag for
 * "shoulderWrist" in SIGNAL_DEFS below.
 */
export function shoulderToWristVertical(landmarks, minVisibility) {
  const sides = [
    { shoulder: 11, wrist: 15 }, // left
    { shoulder: 12, wrist: 16 }, // right
  ];
  let best = null;
  let bestVis = -1;
  for (const side of sides) {
    const vis = landmarks[side.wrist]?.visibility ?? 0;
    if (vis > bestVis) {
      bestVis = vis;
      best = side;
    }
  }
  if (!best || bestVis < minVisibility) return null;
  const shoulder = landmarks[best.shoulder];
  const wrist = landmarks[best.wrist];
  if (!shoulder || !wrist) return null;
  return Math.abs(shoulder.y - wrist.y);
}

/**
 * Alternative signal: vertical (image-Y) position of the nose. Isolates
 * just the up/down component of head motion during a push-up, with no
 * angle math or depth estimation involved.
 * Assumed polarity: unverified — see SIGNAL_DEFS below for the current guess.
 */
export function noseVerticalPosition(landmarks, minVisibility) {
  const nose = landmarks[0];
  if (!nose) return null;
  if (minVisibility != null && (nose.visibility ?? 0) < minVisibility) return null;
  return nose.y;
}

/**
 * Diagnostic signal, not really a rep-counting candidate: vertical distance
 * between shoulder and hip midpoints. In a strict plank push-up this
 * shouldn't change much (the torso stays rigid), so a big swing here says
 * more about form (sagging/piking) than about rep count.
 */
export function shoulderToHipVertical(landmarks, minVisibility) {
  const ls = landmarks[11];
  const rs = landmarks[12];
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return null;
  if (
    minVisibility != null &&
    ((ls.visibility ?? 0) < minVisibility ||
      (rs.visibility ?? 0) < minVisibility ||
      (lh.visibility ?? 0) < minVisibility ||
      (rh.visibility ?? 0) < minVisibility)
  ) {
    return null;
  }
  const shoulderMidY = (ls.y + rs.y) / 2;
  const hipMidY = (lh.y + rh.y) / 2;
  return Math.abs(shoulderMidY - hipMidY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all new tests green, all 18 pre-existing tests still green
(they don't yet touch `SignalCalibrator`'s changed shape, which is Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/counter.js src/lib/counter.test.js
git commit -m "Add shoulder-wrist, nose-Y, and shoulder-hip signal extractors"
```

---

### Task 2: Generalize `SignalCalibrator` to N named signals with a `forcedSignal` mode

**Files:**
- Modify: `src/lib/counter.js` (replace the `SignalCalibrator` class, add `SIGNAL_NAMES`/`SIGNAL_DEFS`)
- Test: `src/lib/counter.test.js` (rewrite the `SignalCalibrator` describe block, add new tests)

**Interfaces:**
- Consumes: `CONFIG` (Task 1's shape, with the 3 new threshold fields).
- Produces: `SIGNAL_NAMES` (array of the 5 signal name strings, `"angle"`
  first, `"width"` second — order matters for tie-breaking, see below).
  `SIGNAL_DEFS` (object keyed by signal name, each entry
  `{ invert: boolean, minSwing: number, maxJump: number }`).
  `new SignalCalibrator(config, forcedSignal)` — `forcedSignal` optional,
  one of `SIGNAL_NAMES` or `null`/omitted for auto mode.
  `calibrator.update(signals, now)` — `signals` is an object that may
  contain any subset of `{ angle, width, shoulderWrist, noseY, shoulderHip }`,
  each a number or `null`/absent.
  `calibrator.position(signals)` — same `signals` shape, returns `0..1` or
  `null`.
  `calibrator.locked` (boolean), `calibrator.signal` (string name or `null`)
  — unchanged in meaning from before.

- [ ] **Step 1: Replace the existing `SignalCalibrator` tests with the new call shape**

The current `src/lib/counter.test.js` has a `describe("SignalCalibrator", ...)`
block and a `describe("RepCounter + SignalCalibrator, full pipeline", ...)`
block, both calling `cal.update(angle, width, now)` and
`cal.position(angle, width)` positionally. Replace both blocks entirely with:

```js
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
    for (let frame = 0; frame < 60; frame++) {
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
```

Note: the warmup test above uses `t += 20` per frame so 200 frames covers
4000ms — comfortably past the new 3000ms `calibrationWarmupMs`, giving the
swing (which completes well before frame 200, since the triangle period is
60 frames) time to clear the warmup gate before the test's final assertion.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `cal.update({angle: ...}, t)` doesn't match the current
positional `update(angle, width, now)` signature, and the two-argument
`SignalCalibrator(CONFIG, "width")` constructor and `cal._tracks` don't
exist yet.

- [ ] **Step 3: Replace the `SignalCalibrator` class**

In `src/lib/counter.js`, find this exact block (the current class, starting
at its doc comment and ending at its closing brace — this is the last thing
in the file):

```js
/**
 * Watches both the elbow-angle and shoulder-width signals, picks whichever
 * one shows a real range of motion, and calibrates its own min/max from
 * what it observes — so rep counting works whether the camera ends up
 * side-on (angle wins) or head-on (width wins), without any manual setup.
 *
 * Locks onto a signal exactly once per session and never re-evaluates the
 * choice, so the bar/counter can't flicker between two different physical
 * quantities mid-set.
 */
export class SignalCalibrator {
  constructor(config = CONFIG) {
    this.config = config;
    this.locked = false;
    this.signal = null; // "angle" | "width"
    this.startedAt = null;
    this._angle = this._freshTrack();
    this._width = this._freshTrack();
  }

  _freshTrack() {
    return { ema: null, min: null, max: null };
  }

  /** raw angle in degrees (or null), raw width 0..1 (or null), now = performance.now() */
  update(angle, width, now) {
    if (this.startedAt == null && (angle != null || width != null)) this.startedAt = now;

    if (this.locked) {
      const track = this.signal === "angle" ? this._angle : this._width;
      const raw = this.signal === "angle" ? angle : width;
      const maxJump = this.signal === "angle" ? this.config.maxJumpAngleDeg : this.config.maxJumpWidthFrac;
      if (raw != null) this._observe(track, raw, maxJump);
      return;
    }

    if (angle != null) this._observe(this._angle, angle, this.config.maxJumpAngleDeg);
    if (width != null) this._observe(this._width, width, this.config.maxJumpWidthFrac);
    this._maybeLockIn(now);
  }

  // Rejects a single-frame sample that jumps implausibly far from the last
  // smoothed value (a wild landmark misdetection, not real motion — a real
  // joint can't move that far in one ~33ms frame), then folds anything that
  // survives into a light EMA before updating the running min/max. Because
  // the outlier check happens on the raw sample *before* min/max ever sees
  // it, min/max can just track the smoothed extremes directly: no separate
  // "sustain for N frames" bookkeeping is needed, and — unlike an earlier
  // version of this — a session that starts already at one extreme (e.g.
  // arms extended, at rest, before the first push-up) doesn't get stuck
  // waiting for confirmation that can never come once nothing beats it.
  _observe(track, raw, maxJump) {
    if (track.ema != null && Math.abs(raw - track.ema) > maxJump) return;
    const alpha = this.config.calibrationEmaAlpha;
    track.ema = track.ema == null ? raw : track.ema + alpha * (raw - track.ema);
    track.min = track.min == null ? track.ema : Math.min(track.min, track.ema);
    track.max = track.max == null ? track.ema : Math.max(track.max, track.ema);
  }

  _swing(track) {
    return track.min != null && track.max != null ? track.max - track.min : 0;
  }

  _maybeLockIn(now) {
    if (this.startedAt == null) return;
    if (now - this.startedAt < this.config.calibrationWarmupMs) return;

    const angleSwing = this._swing(this._angle);
    const widthSwing = this._swing(this._width);
    const angleReady = angleSwing >= this.config.minSwingAngleDeg;
    const widthReady = widthSwing >= this.config.minSwingWidthFrac;
    if (!angleReady && !widthReady) return;

    if (angleReady && (!widthReady || angleSwing >= widthSwing)) {
      this._lockIn("angle", this._angle);
    } else {
      this._lockIn("width", this._width);
    }
  }

  _lockIn(signal, track) {
    const pad = (track.max - track.min) * 0.05;
    track.min -= pad;
    track.max += pad;
    this.signal = signal;
    this.locked = true;
  }

  /** Normalized position: 0 = bottom of calibrated range (down), 1 = top (up). null if not ready. */
  position(angle, width) {
    if (!this.locked) return null;
    const track = this.signal === "angle" ? this._angle : this._width;
    const raw = this.signal === "angle" ? angle : width;
    if (raw == null || track.min == null || track.max == null || track.max === track.min) return null;
    const frac = Math.min(1, Math.max(0, (raw - track.min) / (track.max - track.min)));
    return this.signal === "angle" ? frac : 1 - frac; // width is inverted: large width = close = down
  }
}
```

Replace it with:

```js
// Order matters for auto-race tie-breaking: when two signals tie exactly on
// observed swing, the first one in this list wins (mirrors the original
// hardcoded "angle wins ties" behavior).
export const SIGNAL_NAMES = ["angle", "width", "shoulderWrist", "noseY", "shoulderHip"];

export const SIGNAL_DEFS = {
  angle: { invert: false, minSwing: CONFIG.minSwingAngleDeg, maxJump: CONFIG.maxJumpAngleDeg },
  width: { invert: true, minSwing: CONFIG.minSwingWidthFrac, maxJump: CONFIG.maxJumpWidthFrac },
  shoulderWrist: {
    invert: false,
    minSwing: CONFIG.minSwingShoulderWristFrac,
    maxJump: CONFIG.maxJumpShoulderWristFrac,
  },
  noseY: { invert: true, minSwing: CONFIG.minSwingNoseYFrac, maxJump: CONFIG.maxJumpNoseYFrac },
  shoulderHip: {
    invert: false,
    minSwing: CONFIG.minSwingShoulderHipFrac,
    maxJump: CONFIG.maxJumpShoulderHipFrac,
  },
};

/**
 * Watches every candidate signal it's given and either (a) races them all
 * and locks onto whichever shows a real range of motion first — the
 * original "Auto" behavior — or (b) with a `forcedSignal`, calibrates only
 * that one, ignoring how the others behave. Manual forcing exists so a
 * single signal's real rep-counting accuracy can be tested in isolation,
 * without the auto-race silently picking a different one.
 *
 * Locks onto a signal exactly once per session and never re-evaluates the
 * choice, so the bar/counter can't flicker between two different physical
 * quantities mid-set.
 */
export class SignalCalibrator {
  constructor(config = CONFIG, forcedSignal = null) {
    this.config = config;
    this.forcedSignal = forcedSignal;
    this.locked = false;
    this.signal = null;
    this.startedAt = null;
    this._tracks = new Map(SIGNAL_NAMES.map((name) => [name, this._freshTrack()]));
  }

  _freshTrack() {
    return { ema: null, min: null, max: null };
  }

  /** signals: { angle?, width?, shoulderWrist?, noseY?, shoulderHip? } — any subset, null/absent = not observed this frame. */
  update(signals, now) {
    const anyValue = SIGNAL_NAMES.some((name) => signals[name] != null);
    if (this.startedAt == null && anyValue) this.startedAt = now;

    if (this.locked) {
      const raw = signals[this.signal];
      if (raw != null) {
        this._observe(this._tracks.get(this.signal), raw, SIGNAL_DEFS[this.signal].maxJump);
      }
      return;
    }

    const namesToObserve = this.forcedSignal ? [this.forcedSignal] : SIGNAL_NAMES;
    for (const name of namesToObserve) {
      const raw = signals[name];
      if (raw != null) {
        this._observe(this._tracks.get(name), raw, SIGNAL_DEFS[name].maxJump);
      }
    }
    this._maybeLockIn(now);
  }

  // Rejects a single-frame sample that jumps implausibly far from the last
  // smoothed value (a wild landmark misdetection, not real motion), then
  // folds anything that survives into a light EMA before updating the
  // running min/max.
  _observe(track, raw, maxJump) {
    if (track.ema != null && Math.abs(raw - track.ema) > maxJump) return;
    const alpha = this.config.calibrationEmaAlpha;
    track.ema = track.ema == null ? raw : track.ema + alpha * (raw - track.ema);
    track.min = track.min == null ? track.ema : Math.min(track.min, track.ema);
    track.max = track.max == null ? track.ema : Math.max(track.max, track.ema);
  }

  _swing(track) {
    return track.min != null && track.max != null ? track.max - track.min : 0;
  }

  _maybeLockIn(now) {
    if (this.startedAt == null) return;
    if (now - this.startedAt < this.config.calibrationWarmupMs) return;

    if (this.forcedSignal) {
      const track = this._tracks.get(this.forcedSignal);
      if (this._swing(track) >= SIGNAL_DEFS[this.forcedSignal].minSwing) {
        this._lockIn(this.forcedSignal, track);
      }
      return;
    }

    let winner = null;
    let winnerSwing = -1;
    for (const name of SIGNAL_NAMES) {
      const track = this._tracks.get(name);
      const swing = this._swing(track);
      if (swing >= SIGNAL_DEFS[name].minSwing && swing > winnerSwing) {
        winner = name;
        winnerSwing = swing;
      }
    }
    if (winner) this._lockIn(winner, this._tracks.get(winner));
  }

  _lockIn(signal, track) {
    const pad = (track.max - track.min) * 0.05;
    track.min -= pad;
    track.max += pad;
    this.signal = signal;
    this.locked = true;
  }

  /** Normalized position: 0 = bottom of calibrated range (down), 1 = top (up). null if not ready. */
  position(signals) {
    if (!this.locked) return null;
    const track = this._tracks.get(this.signal);
    const raw = signals[this.signal];
    if (raw == null || track.min == null || track.max == null || track.max === track.min) return null;
    const frac = Math.min(1, Math.max(0, (raw - track.min) / (track.max - track.min)));
    return SIGNAL_DEFS[this.signal].invert ? 1 - frac : frac;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests green, including the new `forcedSignal` and
warmup tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/counter.js src/lib/counter.test.js
git commit -m "Generalize SignalCalibrator to N named signals with a forcedSignal mode"
```

---

### Task 3: Add `signalSource` to the settings schema

**Files:**
- Modify: `src/lib/store.js:9` (the `DEFAULT_SETTINGS` constant)
- Test: `src/lib/store.test.js`

**Interfaces:**
- Produces: `DEFAULT_SETTINGS.signalSource` = `"auto"`. This flows through
  `migrate()`'s existing `{ ...DEFAULT_SETTINGS, ...parsed.settings }` merge
  (already forward-compatible — no other changes needed there) and through
  `updateSettings()` (already generic — no changes needed there either).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/store.test.js`, inside the existing
`describe("migrate", ...)` block (add as a new `it` alongside the others):

```js
  it("fills in signalSource: \"auto\" as the default for settings missing it", () => {
    const v2 = {
      version: 2,
      sets: [],
      legacyDays: [],
      settings: { countdownEnabled: false, countdownSec: 60, vibration: true },
    };
    const store = migrate(JSON.stringify(v2), null);
    expect(store.settings.signalSource).toBe("auto");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `store.settings.signalSource` is `undefined`.

- [ ] **Step 3: Add the field**

In `src/lib/store.js`, change:

```js
const DEFAULT_SETTINGS = { countdownEnabled: false, countdownSec: 60, vibration: true };
```

to:

```js
const DEFAULT_SETTINGS = {
  countdownEnabled: false,
  countdownSec: 60,
  vibration: true,
  signalSource: "auto",
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.js src/lib/store.test.js
git commit -m "Add signalSource setting, defaulting to auto"
```

---

### Task 4: Add the "Signal source" section to the Settings page

**Files:**
- Modify: `src/pages/SettingsPage.jsx`
- Modify: `src/pages/SettingsPage.module.css`

**Interfaces:**
- Consumes: `store.settings.signalSource` (Task 3), `updateSettings` (from
  `useStore()`, unchanged signature).
- Produces: no new exports — this is a leaf page component.

- [ ] **Step 1: Add the signal options list and a new section, above the "Data" section**

In `src/pages/SettingsPage.jsx`, add this constant near the top of the file,
right after `const DURATIONS = [30, 60, 90, 120];`:

```js
const SIGNAL_OPTIONS = [
  { value: "auto", label: "Auto", description: "Watches every signal, picks whichever tracks best" },
  { value: "angle", label: "Elbow angle", description: "Classic joint-bend measurement" },
  { value: "width", label: "Shoulder width", description: "Apparent shoulder-to-shoulder distance" },
  { value: "shoulderWrist", label: "Shoulder-to-wrist", description: "Vertical distance from shoulder to wrist" },
  { value: "noseY", label: "Nose position", description: "Vertical position of your nose in frame" },
  { value: "shoulderHip", label: "Shoulder-to-hip", description: "Vertical torso distance (form diagnostic, not really a rep signal)" },
];
```

Add this import alongside the existing ones at the top of the file:

```js
import ListRow from "../components/ui/ListRow.jsx";
```

Then, in the JSX, find this exact existing block (the "Data" section):

```jsx
      <div className={s.section}>
        <div className={s.sectionTitle}>Data</div>
        <Button variant="danger" full onClick={handleClear}>
          {confirmingClear ? "Tap again to permanently clear all data" : "Clear all data"}
        </Button>
      </div>
```

and insert the new section immediately BEFORE it (so the new section
renders between "Feedback" and "Data"), giving:

```jsx
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
```

- [ ] **Step 2: Add the `signalOption` button-reset styling**

In `src/pages/SettingsPage.module.css`, append:

```css
.signalList {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.signalOption {
  all: unset;
  display: block;
  cursor: pointer;
  width: 100%;
}
```

- [ ] **Step 3: Verify visually**

Run: `npm run build && npx vite preview --port 4300`

Navigate to `http://localhost:4300/pushup-counter/#/settings` in a browser
and confirm:
- A new "Signal source" section appears above "Data" with 6 rows.
- "Auto" shows a "✓" trailing mark by default (fresh `localStorage`).
- Clicking a different row moves the "✓" to that row.
- `localStorage.getItem("pushup-counter/v2")` (via devtools console) shows
  `settings.signalSource` updated to the clicked value.

Stop the preview server afterward.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SettingsPage.jsx src/pages/SettingsPage.module.css
git commit -m "Add Signal source selector to Settings"
```

---

### Task 5: Wire the forced signal through `usePoseSession` and the frame loop

**Files:**
- Modify: `src/hooks/usePoseSession.js`
- Modify: `src/pages/PushupSessionPage.jsx`
- Modify: `src/components/workout/CalibrationBar.jsx`

**Interfaces:**
- Consumes: `SIGNAL_NAMES`, `SIGNAL_DEFS` are NOT needed directly here (the
  calibrator handles them internally) — only the calibrator's new
  constructor shape and `update(signals, now)`/`position(signals)` shape
  from Task 2, plus the three new extractors from Task 1:
  `shoulderToWristVertical`, `noseVerticalPosition`, `shoulderToHipVertical`.
- Produces: `usePoseSession({ mode, targetSec, vibrationEnabled, signalSource })`
  — one new prop, `signalSource` (string, one of the `SIGNAL_OPTIONS` values
  from Task 4, defaulting to `"auto"` if omitted).

- [ ] **Step 1: Accept `signalSource` and pass it into the calibrator**

In `src/hooks/usePoseSession.js`, update the import line to also pull in the
three new extractors:

```js
import {
  RepCounter,
  CONFIG,
  NORMALIZED_CONFIG,
  SignalCalibrator,
  jointAngle,
  pickVisibleArm,
  apparentShoulderWidth,
  shoulderToWristVertical,
  noseVerticalPosition,
  shoulderToHipVertical,
} from "../lib/counter.js";
```

Change the hook's signature (currently
`export function usePoseSession({ mode = "free", targetSec = 60, vibrationEnabled = true } = {}) {`)
to:

```js
export function usePoseSession({
  mode = "free",
  targetSec = 60,
  vibrationEnabled = true,
  signalSource = "auto",
} = {}) {
```

Add a ref to track it (near the other refs, after `settingsRef`):

```js
  const signalSourceRef = useRef(signalSource);
  signalSourceRef.current = signalSource;
```

Change both places that construct a `SignalCalibrator` — the initial
`useRef` and the one inside `start()` — to pass the forced signal. First,
the initial ref:

```js
  const calibratorRef = useRef(new SignalCalibrator(CONFIG, signalSource === "auto" ? null : signalSource));
```

Then, inside `start()`, change:

```js
    calibratorRef.current = new SignalCalibrator(CONFIG);
```

to:

```js
    const forcedSignal = signalSourceRef.current === "auto" ? null : signalSourceRef.current;
    calibratorRef.current = new SignalCalibrator(CONFIG, forcedSignal);
```

- [ ] **Step 2: Extract the new raw signals every frame and build the `signals` map**

Inside the `frame()` function, replace:

```js
          const landmarks = result.landmarks[0];
          const width = apparentShoulderWidth(landmarks, CONFIG.minVisibility);
          const arm = pickVisibleArm(result.worldLandmarks[0], landmarks, CONFIG.minVisibility);
          const angle = arm ? jointAngle(arm.shoulder, arm.elbow, arm.wrist) : null;

          const calibrator = calibratorRef.current;
          const counter = counterRef.current;
          calibrator.update(angle, width, now);
```

with:

```js
          const landmarks = result.landmarks[0];
          const width = apparentShoulderWidth(landmarks, CONFIG.minVisibility);
          const arm = pickVisibleArm(result.worldLandmarks[0], landmarks, CONFIG.minVisibility);
          const angle = arm ? jointAngle(arm.shoulder, arm.elbow, arm.wrist) : null;
          const shoulderWrist = shoulderToWristVertical(landmarks, CONFIG.minVisibility);
          const noseY = noseVerticalPosition(landmarks, CONFIG.minVisibility);
          const shoulderHip = shoulderToHipVertical(landmarks, CONFIG.minVisibility);
          const signals = { angle, width, shoulderWrist, noseY, shoulderHip };

          const calibrator = calibratorRef.current;
          const counter = counterRef.current;
          calibrator.update(signals, now);
```

- [ ] **Step 3: Update the two `position()` calls and disable bootstrap when forced**

Replace:

```js
              const initialPos = calibrator.position(angle, width);
```

with:

```js
              const initialPos = calibrator.position(signals);
```

Replace:

```js
            const position = calibrator.position(angle, width);
            const before = counter.reps;
            counter.update(position, now);
            registerRep(before, now);
            updateBarDot(position);
          } else if (angle != null) {
            // Bootstrap safety net: raw angle against original CONFIG, so
            // counting never stalls while enough data is still gathered.
            const before = counter.reps;
            counter.update(angle, now);
            registerRep(before, now);
          }
```

with:

```js
            const position = calibrator.position(signals);
            const before = counter.reps;
            counter.update(position, now);
            registerRep(before, now);
            updateBarDot(position);
          } else if (angle != null && signalSourceRef.current === "auto") {
            // Bootstrap safety net: raw angle against original CONFIG, so
            // counting never stalls while enough data is still gathered.
            // Only in auto mode — a forced-signal test run must reflect
            // ONLY that signal's counts, or the comparison is meaningless.
            const before = counter.reps;
            counter.update(angle, now);
            registerRep(before, now);
          }
```

- [ ] **Step 4: Add `signalSource` to the effect's dependency array**

The camera-lifecycle `useEffect` currently ends with:

```js
  }, [active, mode, targetSec, finishInternal, registerRep, updateBarDot]);
```

This does not need to change — `signalSourceRef.current` is read inside the
frame loop via the ref (not a dependency), matching the existing pattern for
`vibrationEnabled` via `settingsRef`. `signalSource` is only actually consumed
at the moment `start()` constructs a fresh `SignalCalibrator`, which already
reads the current ref value at that point. No edit needed here — this step
exists to confirm you have NOT added `signalSource` to the array (it would
be a no-op at best, and risks the same restart-loop class of bug documented
in this file's own comments if `signalSource` combined with other state in
an unexpected way — the ref-based read is deliberate).

- [ ] **Step 5: Update `CalibrationBar` to label all five signals**

In `src/components/workout/CalibrationBar.jsx`, replace:

```jsx
      <div className={s.label}>
        tracking: {calibrationSignal === "angle" ? "elbow" : calibrationSignal === "width" ? "shoulder-width" : ""}
      </div>
```

with:

```jsx
      <div className={s.label}>tracking: {SIGNAL_LABELS[calibrationSignal] ?? ""}</div>
```

And add this constant above the component function (after the `import`
line):

```js
const SIGNAL_LABELS = {
  angle: "elbow",
  width: "shoulder-width",
  shoulderWrist: "shoulder-to-wrist",
  noseY: "nose position",
  shoulderHip: "shoulder-to-hip",
};
```

- [ ] **Step 6: Pass the setting through from `PushupSessionPage`**

In `src/pages/PushupSessionPage.jsx`, change:

```js
  const session = usePoseSession({ mode, targetSec, vibrationEnabled: store.settings.vibration });
```

to:

```js
  const session = usePoseSession({
    mode,
    targetSec,
    vibrationEnabled: store.settings.vibration,
    signalSource: store.settings.signalSource,
  });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests green (this task touches no pure `src/lib/` test
files, only React hook/component wiring, which this repo doesn't
unit-test — see Task 6 for the manual verification that covers this code).

- [ ] **Step 8: Build and smoke-test in a browser**

Run: `npm run build && npx vite preview --port 4300`

Navigate to `http://localhost:4300/pushup-counter/#/settings`, select a
non-"Auto" signal (e.g. "Shoulder-to-wrist"), then navigate to
`http://localhost:4300/pushup-counter/#/workout/pushup` and tap Start.
Camera access will be denied in a sandboxed/headless browser — that's
expected and fine; confirm via the browser console that no errors are
thrown before the camera-denied error surfaces (this validates the wiring
compiles and runs, not the live camera path — that requires the real
device, covered in Task 6). Stop the preview server afterward.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/usePoseSession.js src/pages/PushupSessionPage.jsx src/components/workout/CalibrationBar.jsx
git commit -m "Wire forced signal source from Settings through to the frame loop"
```

---

## Manual Verification (real device — not a coded task)

This feature's entire purpose is answered on the phone, not in a unit test.
After Task 5 is deployed:

1. Back up nothing extra — this doesn't touch the data model or migration.
2. For each of the 5 non-"Auto" options in Settings → Signal source:
   a. Select it.
   b. Go to Workout → Push-ups, tap Start, do a real set of a known rep count.
   c. Note the app's final count vs. your real count.
   d. Note what the "tracking: …" label and the calibration bar dot actually
      looked like during the set (did the dot move sensibly top-to-bottom
      matching down/up, or did it look inverted or erratic).
3. Report back per-signal: which counted correctly, which didn't, and for
   any signal whose bar visibly moved backwards (dot goes up when you go
   down), that's the "assumed polarity" flag from Task 1 needing a flip in
   `SIGNAL_DEFS`.
4. Also verify the root-cause fix: with any signal selected, prop the phone
   and wait ~5 seconds *without* starting a rep before your first push-up —
   confirm the counter does NOT increment during that idle window (this is
   what the 3000ms `calibrationWarmupMs` is protecting against).
