# Escalating streak-flame icon for the live rep counter

## Handoff

**What the project is:** `pushup-counter` — a React 19 + Vite PWA at
`D:\projects\myprojects\pushup-counter`, deployed to GitHub Pages
(`chayapolsuriyajan-stack.github.io/pushup-counter`) via GitHub Actions on
every push to `main`. It uses the phone's front camera + MediaPipe pose
detection to count push-up reps in real time, with a self-calibrating signal
system (elbow angle, shoulder width, and 3 newer candidates), a countdown-set
mode, and a Home/Workout/History/Settings app shell themed on a supplied
"System Interface" design system (dark, olive-accent).

**What's staged (in order):**
1. Original vanilla-JS single-screen camera counter, shipped.
2. Full React + Vite rewrite: app shell, 4-tab nav, theming, Home dashboard
   (streak/heatmap/graph), History, Settings, countdown timer — shipped.
3. Two rounds of real-device mobile UI fixes (a responsive-grid bug that
   only showed up on the user's actual phone, then a full type/spacing
   rescale up to a literal 2x pass) — shipped.
4. Multi-signal rep-counting comparison: generalized the calibrator to 5
   named candidate signals, added a manual "Signal source" picker in
   Settings so the user can test each one's real-world accuracy, plus a
   root-cause fix for the calibrator locking onto setup-time jitter —
   5 tasks, each independently reviewed, final whole-branch review done,
   merged and deployed. Two Important findings from that review (Auto mode
   now races untested signals; cross-signal unit-comparison bug) were
   explicitly deferred by the user until their manual testing produces
   real data.
5. **This plan**: a decorative animated flame icon above the live rep count,
   requested after the user shared a Duolingo-style streak-flame reference
   image.

**Goals:** reliable rep counting across different camera placements (the
open thread from #4); a polished, energetic mobile UX that feels alive
during a set, not just functional.

**Next plan (after this one):** revisit the two deferred findings from #4
once the user has actually tested each signal on their phone and reports
back which ones count correctly — that data should drive whether Auto mode
gets restricted back to angle+width, and whether the swing-comparison needs
unit-normalizing.

## Context

The user shared a reference screenshot (a Duolingo-style "555 day streak"
screen: animated flame icon, big glowing number, week-view checkmarks) and
asked for a new icon plus a "reactive counter" that animates like fire when
its number increases.

Grilled to a precise scope: this applies only to the **live rep count shown
during a push-up set** (not the Home page's day-streak stat). The flame is a
**separate icon element**, not a glow effect applied to the number itself —
the plain rep-count digits stay completely unchanged. The icon does two
independent things: a quick per-rep flash/burst, and a slow escalating
grow-and-heat-up across the set that caps around 20 reps.

## Decisions

| Decision | Answer |
|---|---|
| Target | Live rep count during a set only (`SessionHud.jsx`) |
| Icon vs. glow | Separate flame icon; the number itself is untouched |
| Placement | Above the rep count, matching the reference layout |
| Per-rep behavior | Quick flash/burst (~360ms: scale up + brighten), every single rep |
| Cross-set behavior | Baseline size/glow/heat grows smoothly and continuously with rep count, capping at 20 reps |
| Technical approach | Lightweight CSS/SVG only — no canvas, no particles, no new dependencies |
| Architecture | Imperative ref-driven, matching the existing `repRef`/`dotRef` pattern — never through React state, since this lives inside the same rAF-loop-adjacent code path |

## Design

### New component: `src/components/workout/FlameIcon.jsx`

A `forwardRef` component whose JSX is **entirely static** (a two-layer SVG
flame silhouette, one always-opaque base layer + one hot layer that
crossfades in via `opacity: var(--flame-t)`). Because the children never
depend on props/state, React's re-render diff for this subtree is always a
no-op — the same safety property `LiveText.jsx` gets from having *no*
children, achieved here via "children that never change" instead, since this
component needs a real SVG shape rather than a bare text node.

All dynamic state is written directly onto the ref'd root node exactly like
`dotRef.current.style.transform = ...` already works elsewhere in this
codebase — never through props:
- `flameRef.current.style.setProperty("--flame-t", t)` — a 0..1 value driving
  baseline scale, drop-shadow glow radius/alpha, and the hot-layer's opacity.
- `flameRef.current.setAttribute("data-burst", "1")` (with a
  remove→reflow→re-add cycle, since a CSS animation won't restart just from
  setting an attribute to the same value twice) — retriggers a `@keyframes`
  burst on every rep, including back-to-back ones.

`t = Math.min(1, reps / 20)` is the escalating-growth formula: 0 reps → small
and dim; 20+ reps → biggest scale, widest/brightest glow, hot layer fully
opaque (reads as white-hot).

`FlameIcon.module.css` (new file) holds the gradient defs, the baseline
`transform`/`filter` driven by `var(--flame-t)`, and the `@keyframes
flameBurst`/`flameHotFlash` scoped to fire only on `[data-burst="1"]`
descendants — kept on a separate inner layer from the outer node's baseline
transform so the two effects never fight over the same CSS property.

### `usePoseSession.js` changes

- New `flameRef` alongside the existing `repRef`/`dotRef`/`timeLeftRef`.
- Reset to `--flame-t: 0` (and `data-burst` cleared) in `start()` and in the
  existing defensive-initial-paint effect, same places `repRef` already
  resets to `"0"`.
- Updated inside the existing `registerRep(before, now)` callback — the
  single call site that already fires exactly once per counted rep,
  alongside the current `repRef.current.textContent = ...` write. No new
  call site, no second source of truth.
- `flameRef` added to the hook's returned object.

### `SessionHud.jsx` / `.module.css` changes

Wrap the existing `<LiveText ref={repRef} .../>` in a new `.repWrap` flex
column, with `<FlameIcon ref={flameRef} .../>` placed above it. The existing
`.timeLeft`/`.repCount`/`.row` rules are untouched.

### `PushupSessionPage.jsx` changes

One line: forward `session.flameRef` into `SessionHud`, following the exact
existing pattern used for every other ref this page already passes through.

### Accessibility

`FlameIcon`'s root is `aria-hidden="true"` — purely decorative reinforcement
of the rep count, which remains the actual accessible number.
`prefers-reduced-motion: reduce` disables the per-rep `@keyframes` burst
outright and collapses the baseline-growth transition to instant (matching
`tokens.css`'s existing reduced-motion handling) — the escalating size/glow
*state* still shows, only the *motion* is removed.

### Performance

Nothing added here runs per-frame. `registerRep` fires at most a few times a
second (rep-rate, not frame-rate), and every write is either one
`style.setProperty` call, one attribute toggle, or CSS properties
(`transform`, `opacity`, `filter`) the browser already compositor-accelerates.
No new dependencies.

## Files to modify
- Create: `src/components/workout/FlameIcon.jsx`
- Create: `src/components/workout/FlameIcon.module.css`
- Modify: `src/hooks/usePoseSession.js` — new ref, reset points, `registerRep` write
- Modify: `src/components/workout/SessionHud.jsx` / `.module.css` — render + position
- Modify: `src/pages/PushupSessionPage.jsx` — forward the new ref (one line)

## Verification
1. `npm test` — this is a UI/animation-only change touching no pure
   `src/lib/` code; the existing 29 tests should be unaffected and must
   still pass.
2. `npm run build && npx vite preview`, browser-pane check: confirm the
   flame renders above the rep count, and manually drive `repRef`-style
   writes via devtools (or a real/simulated rep sequence) to confirm the
   flame visibly grows/brightens across ~20 reps and flashes on each one,
   including rapid consecutive reps (retrigger must not silently no-op).
3. Toggle `prefers-reduced-motion` in devtools and confirm the burst
   animation stops while the baseline glow state still reflects rep count.
4. Real-device check: does the flame stay legible and not visually clash
   with the rep count at actual phone size, and does it hold up performance
   is fine alongside the live camera feed.
