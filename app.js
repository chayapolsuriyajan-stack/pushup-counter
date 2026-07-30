import { createPoseLandmarker, startCamera, detectFrame, drawSkeleton, PoseLandmarker } from "./pose.js";
import { RepCounter, CONFIG, jointAngle, pickVisibleArm } from "./counter.js";
import { recordSession, getScoreboard } from "./store.js";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const repCountEl = document.getElementById("rep-count");
const permissionMessage = document.getElementById("permission-message");
const debugReadout = document.getElementById("debug-readout");

const cameraScreen = document.getElementById("camera-screen");
const scoreboardScreen = document.getElementById("scoreboard-screen");
const startOverlay = document.getElementById("start-overlay");
document.getElementById("scoreboard-btn").addEventListener("click", showScoreboard);
document.getElementById("back-btn").addEventListener("click", showCamera);
document.getElementById("finish-btn").addEventListener("click", finishSet);
document.getElementById("start-btn").addEventListener("click", handleStart);

const counter = new RepCounter(CONFIG);
let wakeLock = null;

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

  function frame() {
    const result = detectFrame(landmarker, video, performance.now());
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (result && result.landmarks?.length && result.worldLandmarks?.length) {
      drawSkeleton(overlayCtx, result, PoseLandmarker.POSE_CONNECTIONS);

      const arm = pickVisibleArm(result.worldLandmarks[0], result.landmarks[0], CONFIG.minVisibility);
      if (arm) {
        const angle = jointAngle(arm.shoulder, arm.elbow, arm.wrist);
        debugReadout.textContent = `elbow ${Math.round(angle ?? 0)}° · state ${counter.state}`;
        const before = counter.reps;
        counter.update(angle, performance.now());
        if (counter.reps > before) {
          repCountEl.textContent = String(counter.reps);
          vibrate(60);
        }
      } else {
        debugReadout.textContent = "no confident arm visible";
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
