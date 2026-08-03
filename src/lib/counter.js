// Pure rep-counting logic. No DOM, no camera — just a signal in, state out.
// Tune these against your real body and camera distance.
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

// Thresholds for the post-calibration phase, once a signal has been
// normalized to 0 (down) .. 1 (up). Mirrors the original 90/160 out of a
// ~180 degree range (50%/89%), nudged to 85% so a rep doesn't require
// hitting the literal extreme of the observed range.
export const NORMALIZED_CONFIG = {
  downEnter: 0.5,
  upEnter: 0.85,
  minRepMs: CONFIG.minRepMs,
  minVisibility: CONFIG.minVisibility,
};

/**
 * Angle (in degrees) at `b` formed by points a-b-c, e.g. shoulder-elbow-wrist.
 * Points are {x, y, z} in metres (MediaPipe worldLandmarks).
 */
export function jointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.hypot(v1.x, v1.y, v1.z);
  const mag2 = Math.hypot(v2.x, v2.y, v2.z);
  if (mag1 === 0 || mag2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Two-state rep counter (UP / DOWN) with hysteresis: the gap between
 * downEnterAngle and upEnterAngle means no rep can be counted while the
 * angle sits in between, which is what makes small jitter harmless.
 */
export class RepCounter {
  constructor(config = CONFIG) {
    this.config = config;
    this.state = "UP";
    this.reps = 0;
    this.lastRepAt = 0;
  }

  reset() {
    this.state = "UP";
    this.reps = 0;
    this.lastRepAt = 0;
  }

  /** Feed one sample (raw angle in degrees, or a normalized 0..1 position) at time `now` (ms). */
  update(value, now) {
    if (value == null) return this.reps;
    const { downEnter, upEnter, minRepMs } = this.config;

    if (this.state === "UP" && value < downEnter) {
      this.state = "DOWN";
    } else if (this.state === "DOWN" && value > upEnter) {
      if (now - this.lastRepAt >= minRepMs) {
        this.reps += 1;
        this.lastRepAt = now;
      }
      this.state = "UP";
    }
    return this.reps;
  }
}

/**
 * Pick the elbow (left or right) with the higher visibility score, since a
 * side-on camera occludes one arm. Returns {shoulder, elbow, wrist} world
 * landmarks, or null if neither side is confident enough.
 */
export function pickVisibleArm(worldLandmarks, landmarks, minVisibility) {
  const sides = [
    { shoulder: 11, elbow: 13, wrist: 15 }, // left
    { shoulder: 12, elbow: 14, wrist: 16 }, // right
  ];
  let best = null;
  let bestVis = -1;
  for (const side of sides) {
    const vis = landmarks[side.elbow]?.visibility ?? 0;
    if (vis > bestVis) {
      bestVis = vis;
      best = side;
    }
  }
  if (!best || bestVis < minVisibility) return null;
  return {
    shoulder: worldLandmarks[best.shoulder],
    elbow: worldLandmarks[best.elbow],
    wrist: worldLandmarks[best.wrist],
  };
}

/**
 * Alternative signal for head-on camera placements, where elbow angle
 * foreshortens badly: apparent shoulder width in normalised 2D image
 * coordinates. As the torso approaches the camera (bottom of a push-up
 * done facing the phone) this grows; as it retreats, it shrinks. Distance
 * scale is setup-dependent (phone distance varies) — SignalCalibrator
 * normalizes it against its own observed range rather than any fixed scale.
 */
export function apparentShoulderWidth(landmarks, minVisibility) {
  const l = landmarks[11];
  const r = landmarks[12];
  if (!l || !r) return null;
  if (
    minVisibility != null &&
    ((l.visibility ?? 0) < minVisibility || (r.visibility ?? 0) < minVisibility)
  ) {
    return null;
  }
  return Math.hypot(l.x - r.x, l.y - r.y);
}

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
    const shoulderVis = landmarks[side.shoulder]?.visibility ?? 0;
    const wristVis = landmarks[side.wrist]?.visibility ?? 0;
    const vis = Math.min(shoulderVis, wristVis);
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
