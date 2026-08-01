# Graph Report - pushup-counter  (2026-08-01)

## Corpus Check
- 4 files · ~3,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 60 nodes · 102 edges · 7 communities (4 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef154981`
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

## God Nodes (most connected - your core abstractions)
1. `main()` - 12 edges
2. `SignalCalibrator` - 10 edges
3. `getScoreboard()` - 8 edges
4. `recordSession()` - 6 edges
5. `RepCounter` - 5 edges
6. `todayStr()` - 4 edges
7. `finishSet()` - 3 edges
8. `handleStart()` - 3 edges
9. `jointAngle()` - 3 edges
10. `pickVisibleArm()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `finishSet()` --calls--> `recordSession()`  [EXTRACTED]
  app.js → store.js
- `showScoreboard()` --calls--> `getScoreboard()`  [EXTRACTED]
  app.js → store.js
- `main()` --calls--> `jointAngle()`  [EXTRACTED]
  app.js → counter.js
- `main()` --calls--> `pickVisibleArm()`  [EXTRACTED]
  app.js → counter.js
- `main()` --calls--> `apparentShoulderWidth()`  [EXTRACTED]
  app.js → counter.js

## Import Cycles
- None detected.

## Communities (7 total, 3 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.11
Nodes (14): calibrationBar, calibrationDot, calibrationTrack, calibrator, cameraScreen, counter, overlay, overlayCtx (+6 more)

### Community 1 - "store.js"
Cohesion: 0.36
Nodes (10): showScoreboard(), bestSession(), currentStreak(), getScoreboard(), load(), recentSessions(), recordSession(), save() (+2 more)

### Community 2 - "main"
Cohesion: 0.27
Nodes (9): main(), requestWakeLock(), resizeOverlay(), showBanner(), apparentShoulderWidth(), createPoseLandmarker(), detectFrame(), drawSkeleton() (+1 more)

### Community 5 - "counter.js"
Cohesion: 0.40
Nodes (4): CONFIG, jointAngle(), NORMALIZED_CONFIG, pickVisibleArm()

## Knowledge Gaps
- **14 isolated node(s):** `video`, `overlay`, `overlayCtx`, `repCountEl`, `permissionMessage` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SignalCalibrator` connect `SignalCalibrator` to `app.js`, `counter.js`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Why does `RepCounter` connect `RepCounter` to `app.js`, `counter.js`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `getScoreboard()` connect `store.js` to `app.js`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `video`, `overlay`, `overlayCtx` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._