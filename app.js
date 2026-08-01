import { createPoseLandmarker, startCamera, detectFrame, drawSkeleton, PoseLandmarker } from "./pose.js";
import {
  RepCounter,
  CONFIG,
  NORMALIZED_CONFIG,
  SignalCalibrator,
  jointAngle,
  pickVisibleArm,
  apparentShoulderWidth,
} from "./counter.js";
import { recordSession, getScoreboard } from "./store.js";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const repCountEl = document.getElementById("rep-count");
const permissionMessage = document.getElementById("permission-message");
const calibrationBar = document.getElementById("calibration-bar");
const calibrationTrack = document.getElementById("calibration-track");
const calibrationDot = document.getElementById("calibration-dot");
const trackingLabel = document.getElementById("tracking-label");

const cameraScreen = document.getElementById("camera-screen");
const scoreboardScreen = document.getElementById("scoreboard-screen");
const startOverlay = document.getElementById("start-overlay");
document.getElementById("scoreboard-btn").addEventListener("click", showScoreboard);
document.getElementById("back-btn").addEventListener("click", showCamera);
document.getElementById("finish-btn").addEventListener("click", finishSet);
document.getElementById("start-btn").addEventListener("click", handleStart);

const counter = new RepCounter(CONFIG);
const calibrator = new SignalCalibrator(CONFIG);
let calibrationApplied = false;
let barTrackHeight = 0; // cached on resize, not read from the DOM every frame
let wakeLock = null;

// Zone band heights are set once from the same constants driving RepCounter,
// so the bar can never visually drift from what actually triggers a rep.
calibrationBar.style.setProperty("--up-zone-frac", `${(1 - NORMALIZED_CONFIG.upEnter) * 100}%`);
calibrationBar.style.setProperty("--down-zone-frac", `${NORMALIZED_CONFIG.downEnter * 100}%`);

function resizeCalibrationBar() {
  barTrackHeight = calibrationTrack?.clientHeight ?? 0;
}
window.addEventListener("resize", resizeCalibrationBar);
video.addEventListener("loadedmetadata", resizeCalibrationBar);

function showBanner(message) {
  permissionMessage.textContent = message;
  permissionMessage.classList.remove("hidden");
}

function vibrate(ms) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore — some browsers throw if called outside a user gesture
    }
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return; // Safari: silently unsupported
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
    console.warn("Wake lock failed:", err);
  }
}

function resizeOverlay() {
  overlay.width = video.videoWidth || overlay.clientWidth;
  overlay.height = video.videoHeight || overlay.clientHeight;
}

function finishSet() {
  const reps = counter.reps;
  recordSession(reps);
  counter.reset();
  repCountEl.textContent = "0";
}

function showScoreboard() {
  const s = getScoreboard();
  document.getElementById("stat-today").textContent = s.today;
  document.getElementById("stat-best").textContent = s.best;
  document.getElementById("stat-streak").textContent = s.streak;

  const list = document.getElementById("recent-list");
  list.innerHTML = "";
  for (const session of s.recent) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${session.date}</span><span>${session.reps} reps</span>`;
    list.appendChild(li);
  }

  cameraScreen.classList.add("hidden");
  scoreboardScreen.classList.remove("hidden");
}

function showCamera() {
  scoreboardScreen.classList.add("hidden");
  cameraScreen.classList.remove("hidden");
}

async function handleStart() {
  // Chrome only allows navigator.vibrate() after the page has seen a real
  // click — this is the click. It unlocks vibration for the rest of the
  // page's life, so later calls from the detection loop (no gesture of
  // their own) will actually fire.
  vibrate(1);
  startOverlay.classList.add("hidden");
  await main();
}

async function main() {
  try {
    await startCamera(video);
  } catch (err) {
    showBanner(
      "Camera access is needed to count reps. Check your browser's site permissions and reload.",
    );
    console.error("Camera error:", err);
    return;
  }

  await requestWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestWakeLock();
  });

  video.addEventListener("loadedmetadata", resizeOverlay);
  window.addEventListener("resize", resizeOverlay);
  resizeOverlay();

  let landmarker;
  try {
    landmarker = await createPoseLandmarker();
  } catch (err) {
    showBanner("Could not load the pose model. Check your connection and reload.");
    console.error("Pose model error:", err);
    return;
  }

  function registerRep(before) {
    if (counter.reps > before) {
      repCountEl.textContent = String(counter.reps);
      vibrate(60);
    }
  }

  function frame() {
    const now = performance.now();
    const result = detectFrame(landmarker, video, now);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (result && result.landmarks?.length && result.worldLandmarks?.length) {
      drawSkeleton(overlayCtx, result, PoseLandmarker.POSE_CONNECTIONS);

      const landmarks = result.landmarks[0];
      const width = apparentShoulderWidth(landmarks, CONFIG.minVisibility);
      const arm = pickVisibleArm(result.worldLandmarks[0], landmarks, CONFIG.minVisibility);
      const angle = arm ? jointAngle(arm.shoulder, arm.elbow, arm.wrist) : null;

      calibrator.update(angle, width, now);

      if (calibrator.locked) {
        if (!calibrationApplied) {
          calibrationApplied = true;
          counter.config = NORMALIZED_CONFIG;
          calibrationBar.classList.remove("hidden");
          trackingLabel.textContent = `tracking: ${calibrator.signal === "angle" ? "elbow" : "shoulder-width"}`;

          // Re-sync state to the CURRENT reading so switching measurement
          // basis never fires a phantom rep or silently eats a real one.
          const initialPos = calibrator.position(angle, width);
          if (initialPos != null) {
            if (initialPos < NORMALIZED_CONFIG.downEnter) counter.state = "DOWN";
            else if (initialPos > NORMALIZED_CONFIG.upEnter) counter.state = "UP";
          }
        }

        const position = calibrator.position(angle, width);
        const before = counter.reps;
        counter.update(position, now);
        registerRep(before);
        updateBarDot(position);
      } else if (angle != null) {
        // Bootstrap safety net: raw angle against the original CONFIG, so
        // counting never stalls while enough data is still being gathered.
        const before = counter.reps;
        counter.update(angle, now);
        registerRep(before);
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function updateBarDot(position) {
  if (position == null || !barTrackHeight) return; // leave dot at its last known spot
  // Dot is CSS-anchored at the track's bottom by default; translateY is
  // negative-going-up, so 0 (down) needs no shift and 1 (up) needs a full
  // track-height shift upward.
  const py = -position * barTrackHeight;
  calibrationDot.style.transform = `translate(-50%, ${py}px)`;
}
