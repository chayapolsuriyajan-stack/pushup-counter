// All MediaPipe contact lives here. Swapping pose engines later means
// rewriting this file only — counter.js and app.js don't know or care.
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/vision_bundle.mjs";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/**
 * Create and warm up a PoseLandmarker. Tries the GPU delegate first (fast
 * on Android Chrome and modern iOS Safari); falls back to CPU if GPU init
 * fails, which covers older/locked-down Safari.
 */
export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  const baseOptions = {
    modelAssetPath: MODEL_URL,
  };

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch (err) {
    console.warn("GPU delegate failed, falling back to CPU:", err);
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { ...baseOptions, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }
}

/** Open the front camera. Throws if permission is denied or no camera exists. */
export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

/** Run one detection pass. Returns the raw MediaPipe result, or null if not ready. */
export function detectFrame(landmarker, videoEl, timestampMs) {
  if (videoEl.readyState < 2) return null;
  return landmarker.detectForVideo(videoEl, timestampMs);
}

export function drawSkeleton(canvasCtx, result, connectors) {
  const drawingUtils = new DrawingUtils(canvasCtx);
  for (const landmarks of result.landmarks ?? []) {
    drawingUtils.drawLandmarks(landmarks, { radius: 4 });
    drawingUtils.drawConnectors(landmarks, connectors);
  }
}

export { PoseLandmarker };
