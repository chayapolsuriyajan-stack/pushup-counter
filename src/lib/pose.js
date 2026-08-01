// All MediaPipe contact lives here. Swapping pose engines later means
// rewriting this file only — counter.js and the pages don't know or care.
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

// FilesetResolver.forVisionTasks() fetches the WASM fileset from a runtime
// directory URL that nothing statically imports, so Vite never bundles it —
// scripts/copy-mediapipe-wasm.mjs copies it into public/ instead.
const base = import.meta.env.BASE_URL;
const WASM_BASE = new URL(`${base}mediapipe/wasm`, location.href).href;
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

/** Frees the WASM heap + GPU context. Must be called on teardown, or every
 *  Home↔Workout round trip leaks ~6MB and a GPU context. */
export function closeLandmarker(landmarker) {
  landmarker?.close();
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

/** Caller owns and reuses this instance — constructing one per frame was a
 *  measurable per-frame allocation for no benefit. */
export function createDrawingUtils(canvasCtx) {
  return new DrawingUtils(canvasCtx);
}

export function drawSkeleton(drawingUtils, result, connectors) {
  for (const landmarks of result.landmarks ?? []) {
    drawingUtils.drawLandmarks(landmarks, { radius: 4 });
    drawingUtils.drawConnectors(landmarks, connectors);
  }
}

export { PoseLandmarker };
