# Multi-signal rep-counting comparison

## Context

The current `SignalCalibrator` (`src/lib/counter.js`) auto-races exactly two
candidate signals — elbow angle and apparent shoulder-width — and locks onto
whichever shows the bigger swing. In practice, at the user's head-on camera
placement, shoulder-width has proven unreliable: reported failure mode is
"counts and doubles while I'm still setting up (haven't moved yet), then
doesn't recognize real push-ups" once a set actually starts.

That failure pattern points at the calibrator locking onto trivial jitter
during setup — before the user has done any real motion — rather than at the
shoulder-width signal specifically. `calibrationWarmupMs` is only 500ms,
measured from the moment any pose data arrives (i.e., from the instant the
camera starts), which is barely enough time to prop the phone up, let alone
get into position. Once locked onto a garbage micro-range from incidental
sway, real full-depth reps don't map onto that range correctly.

Rather than keep guessing at a replacement signal, the user wants
infrastructure to manually force the counter onto one specific candidate
signal at a time, do a real set, and compare the resulting count against
their actual rep count — repeating per candidate until one proves reliable.

## Decisions

| Decision | Answer |
|---|---|
| Root-cause fix | Bump `calibrationWarmupMs` 500ms → 3000ms, bundled into this work — without it, every candidate would likely reproduce the same "counts while still" bug, making the comparison meaningless |
| Test methodology | Manual one-at-a-time signal selection in Settings; user does a full set per signal and compares the resulting count to their real count |
| New candidate signals | Shoulder-to-wrist vertical distance, nose vertical (Y) position, shoulder-to-hip vertical distance (the last framed as a form-diagnostic curiosity, not a serious rep-counting candidate) |
| Existing signals kept | Elbow angle, shoulder-width — both remain selectable, including for the existing "Auto" race behavior |

## Design

### 1. New pure signal extractors (`src/lib/counter.js`)

Same style as the existing `apparentShoulderWidth` — take normalized 2D
`landmarks` (+ `minVisibility`), return a number or `null`:

- `shoulderToWristVertical(landmarks, minVisibility)` — picks the more-visible
  arm (reusing the left/right visibility-comparison pattern from
  `pickVisibleArm`, but against 2D landmarks rather than world landmarks
  since this is an image-plane distance, not a 3D angle), returns
  `Math.abs(shoulder.y - wrist.y)`.
- `noseVerticalPosition(landmarks, minVisibility)` — returns `landmarks[0].y`
  directly (gated on `landmarks[0].visibility`).
- `shoulderToHipVertical(landmarks, minVisibility)` — midpoint of landmarks
  11/12 vs midpoint of 23/24, returns the absolute Y difference.

**Documented assumption, not a guarantee:** each signal's polarity (does a
larger raw value mean "up" or "down") is a best-effort physical inference,
not something verifiable without the user's actual camera feed. If a bar
moves backwards or a rep never completes during testing, that's the signal
found via testing to have flipped polarity — a one-line fix once reported,
not a sign the whole feature is broken.

### 2. `SignalCalibrator` generalized to N named signals

Currently hardcoded to exactly two tracks (`_angle`, `_width`) with
signal-specific branching (`this.signal === "angle" ? frac : 1 - frac`).
Refactor to a `SIGNAL_DEFS` map (per-signal `invert`, `minSwing`, `maxJump`),
with the calibrator holding a `Map` of named tracks instead of two fixed
fields. The existing per-track logic (EMA smoothing, outlier rejection via
`maxJump`, running min/max) is preserved verbatim — this is a
data-shape generalization, not a rewrite of the anti-jitter math that was
already carefully debugged.

**API change:** `update()` moves from positional `(angle, width, now)` to a
map `(signals, now)` where `signals` is `{angle, width, shoulderWrist, noseY,
shoulderHip}` (any subset; absent/null entries are simply not observed that
frame). The 12 existing tests are updated to the new call shape — their
assertions and scenarios are unchanged, only the call syntax.

**New constructor option: `forcedSignal`.** When provided, `_maybeLockIn`
skips the "compare every candidate's swing, keep the biggest" race and locks
onto that one named signal as soon as *its own* swing clears its threshold.
When no `forcedSignal` is given, behavior is identical to today (auto-race
across whichever signals were observed).

The 3s warmup gate (`calibrationWarmupMs`) runs *before* this branch and
applies identically whether forced or auto — it's the fix for the setup-time
false-lock bug, which has nothing to do with which signal is chosen, so it
protects every test run the same way.

### 3. Settings: new "Signal source" section

A new selectable list (Auto, Elbow angle, Shoulder width, Shoulder-to-wrist,
Nose position, Shoulder-hip) alongside the existing countdown/vibration
settings, persisted the same way (`updateSettings`).

### 4. `usePoseSession` wiring

- Reads `signalSource` from settings at session start; passes it as
  `forcedSignal` to `new SignalCalibrator(...)` (or omits it for "Auto").
- Extracts all raw candidate values every frame (cheap, pure functions) and
  feeds them into `calibrator.update(signals, now)` regardless of which are
  actually in play — the calibrator itself decides what to use.
- **When a signal is forced, the raw-angle bootstrap fallback is disabled.**
  Today, before calibration locks in, counting proceeds against raw elbow
  angle as a safety net. That's correct for "Auto" (there's no dedicated
  calibration screen, so counting must never stall) but wrong for a forced
  single-signal test — bootstrap counts would silently mix a different
  signal's results into the tally being tested, making the comparison
  meaningless. In forced mode, no counting happens until the forced signal
  itself calibrates and locks in.
- The existing `CalibrationBar` and "tracking: …" label need no changes —
  they already render generically off `calibrator.signal`/`calibrator.locked`
  regardless of which signal is active.

## Verification

1. Unit tests: port the 12 existing `SignalCalibrator` tests to the new
   `update(signals, now)` call shape (behavior assertions unchanged), plus
   new tests for: `forcedSignal` locks onto only the named signal even when
   a different signal would have won the auto-race; the 3s warmup delay is
   respected; each new extractor's null-handling (missing/low-visibility
   landmarks).
2. Manual device testing (the actual point of this feature): for each of the
   5 signals, select it in Settings, do a real set, compare the app's count
   to the real count, report back per-signal results.
