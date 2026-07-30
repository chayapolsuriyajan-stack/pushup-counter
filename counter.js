// Pure rep-counting logic. No DOM, no camera — just angles in, state out.
// Tune these against your real body and camera distance.
export const CONFIG = {
  downEnterAngle: 90,   // elbow angle must drop below this to register the bottom
  upEnterAngle: 160,    // elbow angle must rise above this to complete the rep
  minRepMs: 400,        // reject anything faster than this as jitter/noise
  minVisibility: 0.6,   // ignore landmarks the model isn't confident about
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

  /** Feed one elbow-angle sample (degrees) at time `now` (ms). */
  update(angle, now) {
    if (angle == null) return this.reps;
    const { downEnterAngle, upEnterAngle, minRepMs } = this.config;

    if (this.state === "UP" && angle < downEnterAngle) {
      this.state = "DOWN";
    } else if (this.state === "DOWN" && angle > upEnterAngle) {
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
