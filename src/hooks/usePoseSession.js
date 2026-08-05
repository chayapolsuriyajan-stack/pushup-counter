import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPoseLandmarker,
  closeLandmarker,
  startCamera,
  detectFrame,
  createDrawingUtils,
  drawSkeleton,
  PoseLandmarker,
} from "../lib/pose.js";
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
import { requestWakeLock, releaseWakeLock } from "./useWakeLock.js";

function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}:${String(rem).padStart(2, "0")}` : String(rem);
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

/**
 * Owns the camera + pose-detection loop for one push-up set. The rAF loop
 * runs at 30-60fps, so it lives entirely in refs — routing it through React
 * state would thrash. Only discrete events (a rep landing, calibration
 * locking in, the set finishing) surface as state.
 *
 * `mode`: "free" (stop manually) | "timed" (auto-stops after `targetSec`).
 *
 * `active` (not `phase`) is what drives the camera-lifecycle effect. This
 * split matters: once the camera/model are ready, `phase` moves from
 * "starting" to "running" purely for display, but that transition must NOT
 * re-trigger the setup effect — if it did, the camera would tear down and
 * restart in a loop the instant it finished starting.
 */
export function usePoseSession({
  mode = "free",
  targetSec = 60,
  vibrationEnabled = true,
  signalSource = "auto",
} = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const repRef = useRef(null); // DOM node showing the live count — written directly, not via state
  const trackRef = useRef(null); // calibration bar track, for measuring height
  const dotRef = useRef(null); // calibration bar dot — position written directly
  const timeLeftRef = useRef(null); // countdown text node — written directly, same reasoning as repRef
  const flameRef = useRef(null); // streak-flame icon — --flame-t/data-burst written directly, same reasoning as repRef

  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const drawUtilsRef = useRef(null);
  const rafRef = useRef(0);
  const wakeLockRef = useRef(null);
  const counterRef = useRef(new RepCounter(CONFIG));
  const calibratorRef = useRef(new SignalCalibrator(CONFIG, signalSource === "auto" ? null : signalSource));
  const calibrationAppliedRef = useRef(false);
  const trackHeightRef = useRef(0);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const deadlineRef = useRef(null);
  const expiryTimerRef = useRef(0);
  const cleanupListenersRef = useRef(() => {});
  const settingsRef = useRef({ vibrationEnabled });
  settingsRef.current.vibrationEnabled = vibrationEnabled;
  const signalSourceRef = useRef(signalSource);
  signalSourceRef.current = signalSource;

  const [active, setActive] = useState(false); // drives the camera-lifecycle effect
  const [phase, setPhase] = useState("idle"); // idle | starting | running | finished | error — display only
  const [errorMessage, setErrorMessage] = useState(null);
  const [calibrationSignal, setCalibrationSignal] = useState(null); // null | "angle" | "width"
  const [summary, setSummary] = useState(null);

  const vibrateIfEnabled = useCallback((ms) => {
    if (settingsRef.current.vibrationEnabled) vibrate(ms);
  }, []);

  /** Called synchronously from the Start button's onClick — the click
   *  itself is what satisfies Chrome's user-activation requirement for
   *  navigator.vibrate(), so this must run before any await, in the same
   *  task as the click. */
  const start = useCallback(() => {
    vibrate(1);
    counterRef.current = new RepCounter(CONFIG);
    const forcedSignal = signalSourceRef.current === "auto" ? null : signalSourceRef.current;
    calibratorRef.current = new SignalCalibrator(CONFIG, forcedSignal);
    calibrationAppliedRef.current = false;
    setCalibrationSignal(null);
    setSummary(null);
    setErrorMessage(null);
    if (repRef.current) repRef.current.textContent = "0";
    if (timeLeftRef.current) timeLeftRef.current.textContent = formatSeconds(targetSec);
    if (dotRef.current) dotRef.current.style.transform = "translate(-50%, 0px)";
    if (flameRef.current) {
      flameRef.current.style.setProperty("--flame-t", 0);
      flameRef.current.removeAttribute("data-burst");
    }
    setPhase("starting");
    setActive(true);
  }, [targetSec]);

  const finishInternal = useCallback(
    (reason) => {
      const reps = counterRef.current.reps;
      const endedAt = Date.now();
      setSummary({
        reps,
        startedAt: startedAtRef.current,
        endedAt,
        durationMs: endedAt - startedAtRef.current,
        mode,
        targetMs: mode === "timed" ? targetSec * 1000 : null,
        reason, // "manual" | "timeout"
      });
      setPhase("finished");
      setActive(false);
    },
    [mode, targetSec],
  );

  const finish = useCallback(() => finishInternal("manual"), [finishInternal]);

  const updateBarDot = useCallback((position) => {
    if (position == null || !trackHeightRef.current || !dotRef.current) return;
    const py = -position * trackHeightRef.current;
    dotRef.current.style.transform = `translate(-50%, ${py}px)`;
  }, []);

  const registerRep = useCallback(
    (before, now) => {
      if (counterRef.current.reps > before) {
        const reps = counterRef.current.reps;
        if (repRef.current) repRef.current.textContent = String(reps);
        if (flameRef.current) {
          flameRef.current.style.setProperty("--flame-t", Math.min(1, reps / 20));
          // Remove -> reflow -> re-add so the @keyframes burst restarts even
          // on back-to-back reps, where the attribute would otherwise be set
          // to the same value twice and never retrigger.
          flameRef.current.removeAttribute("data-burst");
          void flameRef.current.offsetWidth;
          flameRef.current.setAttribute("data-burst", "1");
        }
        vibrateIfEnabled(60);
      }
      if (mode === "timed" && deadlineRef.current != null && now >= deadlineRef.current) {
        finishInternal("timeout");
      }
    },
    [mode, vibrateIfEnabled, finishInternal],
  );

  // Measures the calibration bar's track height so the dot's transform can
  // be computed without a forced layout read inside the 60fps frame loop.
  // ResizeObserver (not a plain `resize` listener) is what catches the
  // display:none -> visible transition when calibration locks in — a plain
  // resize listener never fires on that transition, which left the dot
  // permanently stuck at height 0 in an earlier version of this app.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => {
      trackHeightRef.current = el.clientHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase]);

  // Defensive initial paint: the StartGate overlay covers this HUD until
  // the first tap, but set real text now rather than relying solely on
  // that overlay to hide an empty node.
  useEffect(() => {
    if (repRef.current) repRef.current.textContent = "0";
    if (timeLeftRef.current) timeLeftRef.current.textContent = formatSeconds(targetSec);
    if (flameRef.current) flameRef.current.style.setProperty("--flame-t", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    cancelledRef.current = false;

    function onVisibility() {
      if (document.visibilityState === "visible") {
        requestWakeLock().then((wl) => {
          if (!cancelledRef.current) wakeLockRef.current = wl;
        });
      }
    }

    (async () => {
      let stream;
      try {
        stream = await startCamera(videoRef.current);
      } catch (err) {
        if (!cancelledRef.current) {
          console.error("Camera error:", err);
          setErrorMessage(
            "Camera access is needed to count reps. Check your browser's site permissions and reload.",
          );
          setPhase("error");
          setActive(false);
        }
        return;
      }
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      wakeLockRef.current = await requestWakeLock();
      if (cancelledRef.current) {
        releaseWakeLock(wakeLockRef.current);
        wakeLockRef.current = null;
        return;
      }
      document.addEventListener("visibilitychange", onVisibility);

      let landmarker;
      try {
        landmarker = await createPoseLandmarker();
      } catch (err) {
        if (!cancelledRef.current) {
          console.error("Pose model error:", err);
          setErrorMessage("Could not load the pose model. Check your connection and reload.");
          setPhase("error");
          setActive(false);
        }
        return;
      }
      if (cancelledRef.current) {
        closeLandmarker(landmarker);
        return;
      }
      landmarkerRef.current = landmarker;
      drawUtilsRef.current = createDrawingUtils(canvasRef.current.getContext("2d"));

      startedAtRef.current = Date.now();
      if (mode === "timed") {
        const nowMs = performance.now();
        deadlineRef.current = nowMs + targetSec * 1000;
        // Backstop: a backgrounded tab freezes rAF, so the in-loop deadline
        // check alone would never fire until the user looks at the phone
        // again. This fires regardless of tab visibility.
        expiryTimerRef.current = window.setTimeout(() => {
          if (!cancelledRef.current) finishInternal("timeout");
        }, targetSec * 1000 + 50);
      } else {
        deadlineRef.current = null;
      }

      function resizeCanvas() {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        canvas.width = video.videoWidth || canvas.clientWidth;
        canvas.height = video.videoHeight || canvas.clientHeight;
      }
      videoRef.current.addEventListener("loadedmetadata", resizeCanvas);
      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();
      cleanupListenersRef.current = () => {
        videoRef.current?.removeEventListener("loadedmetadata", resizeCanvas);
        window.removeEventListener("resize", resizeCanvas);
      };

      function frame() {
        const now = performance.now();
        const result = detectFrame(landmarkerRef.current, videoRef.current, now);
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (result?.landmarks?.length && result?.worldLandmarks?.length && ctx) {
          drawSkeleton(drawUtilsRef.current, result, PoseLandmarker.POSE_CONNECTIONS);

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

          if (calibrator.locked) {
            if (!calibrationAppliedRef.current) {
              calibrationAppliedRef.current = true;
              counter.config = NORMALIZED_CONFIG;
              setCalibrationSignal(calibrator.signal);

              // Re-sync state to the CURRENT reading so switching
              // measurement basis never fires a phantom rep or eats a real
              // one at the exact instant of lock-in.
              const initialPos = calibrator.position(signals);
              if (initialPos != null) {
                if (initialPos < NORMALIZED_CONFIG.downEnter) counter.state = "DOWN";
                else if (initialPos > NORMALIZED_CONFIG.upEnter) counter.state = "UP";
              }
            }

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
        }

        if (mode === "timed" && deadlineRef.current != null && timeLeftRef.current) {
          timeLeftRef.current.textContent = formatSeconds((deadlineRef.current - now) / 1000);
        }

        rafRef.current = requestAnimationFrame(frame);
      }
      rafRef.current = requestAnimationFrame(frame);
      setPhase("running"); // display-only transition; does not re-trigger this effect
    })();

    return () => {
      cancelledRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      clearTimeout(expiryTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cleanupListenersRef.current();
      if (videoRef.current) videoRef.current.srcObject = null;
      closeLandmarker(landmarkerRef.current);
      landmarkerRef.current = null;
      drawUtilsRef.current = null;
      releaseWakeLock(wakeLockRef.current);
      wakeLockRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      deadlineRef.current = null;
    };
  }, [active, mode, targetSec, finishInternal, registerRep, updateBarDot]);

  return {
    videoRef,
    canvasRef,
    repRef,
    trackRef,
    dotRef,
    timeLeftRef,
    flameRef,
    phase,
    errorMessage,
    calibrationSignal,
    summary,
    zoneStyle: {
      "--up-zone-frac": `${(1 - NORMALIZED_CONFIG.upEnter) * 100}%`,
      "--down-zone-frac": `${NORMALIZED_CONFIG.downEnter * 100}%`,
    },
    start,
    finish,
  };
}
