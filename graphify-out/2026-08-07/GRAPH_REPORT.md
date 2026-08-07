# Graph Report - pushup-counter  (2026-08-01)

## Corpus Check
- 42 files · ~8,732 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 167 nodes · 315 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00a1e91b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- store.js
- main
- SignalCalibrator
- RepCounter
- counter.js
- handleStart
- BottomNav.jsx
- SignalCalibrator
- copy-mediapipe-wasm.mjs

## God Nodes (most connected - your core abstractions)
1. `usePoseSession()` - 11 edges
2. `SignalCalibrator` - 11 edges
3. `HomePage()` - 9 edges
4. `useStore()` - 9 edges
5. `dayKey()` - 8 edges
6. `dayTotals()` - 7 edges
7. `currentStreak()` - 7 edges
8. `scripts` - 6 edges
9. `Button()` - 6 edges
10. `RepCounter` - 6 edges

## Surprising Connections (you probably didn't know these)
- `PushupSessionPage()` --calls--> `usePoseSession()`  [EXTRACTED]
  src/pages/PushupSessionPage.jsx → src/hooks/usePoseSession.js
- `recordSet()` --calls--> `dayKey()`  [EXTRACTED]
  src/lib/store.js → src/lib/dates.js
- `HomePage()` --calls--> `getExercise()`  [EXTRACTED]
  src/pages/HomePage.jsx → src/lib/exercises.js
- `PushupSessionPage()` --calls--> `bestSet()`  [EXTRACTED]
  src/pages/PushupSessionPage.jsx → src/lib/store.js
- `HistoryPage()` --calls--> `useStore()`  [EXTRACTED]
  src/pages/HistoryPage.jsx → src/store/useStore.js

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.14
Nodes (21): Heatmap(), LEVEL_OPACITY, levelFor(), LineChart(), Card(), MetricTile(), addDays(), buildHeatmapGrid() (+13 more)

### Community 1 - "store.js"
Cohesion: 0.15
Nodes (17): formatSeconds(), usePoseSession(), vibrate(), releaseWakeLock(), requestWakeLock(), apparentShoulderWidth(), CONFIG, jointAngle() (+9 more)

### Community 2 - "main"
Cohesion: 0.15
Nodes (13): Button(), SegmentedControl(), Toggle(), CalibrationBar(), CameraStage(), CountdownPicker(), DURATIONS, LiveText (+5 more)

### Community 3 - "SignalCalibrator"
Cohesion: 0.18
Nodes (11): App(), AppShell(), BottomNav(), EmptyState(), ListRow(), EXERCISES, getExercise(), groupByDay() (+3 more)

### Community 4 - "RepCounter"
Cohesion: 0.11
Nodes (17): devDependencies, vite, @vitejs/plugin-react, vitest, name, private, scripts, build (+9 more)

### Community 5 - "counter.js"
Cohesion: 0.15
Nodes (13): @fontsource/inter, @fontsource/jetbrains-mono, @mediapipe/tasks-vision, dependencies, @fontsource/inter, @fontsource/jetbrains-mono, @mediapipe/tasks-vision, react (+5 more)

### Community 6 - "handleStart"
Cohesion: 0.27
Nodes (9): getSettings(), load(), loadStore(), recordSet(), save(), updateSettings(), PushupSessionPage(), StoreContext (+1 more)

### Community 7 - "BottomNav.jsx"
Cohesion: 0.29
Nodes (5): HistoryIcon(), HomeIcon(), SettingsIcon(), WorkoutIcon(), TABS

### Community 9 - "copy-mediapipe-wasm.mjs"
Cohesion: 0.50
Nodes (3): dest, root, src

## Knowledge Gaps
- **26 isolated node(s):** `name`, `private`, `type`, `version`, `dev` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SignalCalibrator` connect `SignalCalibrator` to `store.js`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `usePoseSession()` connect `store.js` to `main`, `handleStart`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1431451612903226 - nodes in this community are weakly interconnected._
- **Should `main` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Should `RepCounter` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._