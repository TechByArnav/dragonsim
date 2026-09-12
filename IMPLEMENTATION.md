# IMPLEMENTATION — DragonSim

## Architecture
- **UI:** React 18 + Vite 5 + Tailwind. `Home` (marketing + truth snapshot) → `Workspace` (rail + viewport + right KPIs + bottom timeline).
- **3D:** Three.js via React Three Fiber + Drei. `FieldScene` (carpet 651.2×317.7, grid 24in, center/starting lines, low-poly HUB/BUMP/TRENCH/TOWER/DEPOT/OUTPOST, InstancedMesh FUEL, CanvasTexture heatmap, A* path line, origin/dest markers, measure line). `DetailedRobot` (procedural PBR: bumpers, chassis, swerve ×4, intake, shooter hood, climber, hopper FUEL) + optional user GLB (`useGLTF` + `Clone`; collision stays footprint-based). Quality: `dpr≤2`, single shadow light; Debug toggles wireframe collision volumes.
- **State:** Zustand `useApp` (view, alliance, autoWinner, robotId + overrides, strategies, origin/dest, units, debug/labels/heatmap, coefficients, seed). Deterministic; no async store.
- **Sim (pure TS, worker-safe):** `motion.ts` (trapezoid/triangular + turn + curve/traction/congestion/defense/driver → best/realistic/conservative), `nav.ts` (grid A* + cost layers; bumps cost 1.6, trenches pass under), `scoring.ts` (Table 6-3 windows + active-only FUEL + tower + RP), `strategy.ts` (preset → timestamped cycles with inactive-hold accounting), `montecarlo.ts` (mulberry32, accuracy/jam/traffic/climb draws, p10/50/90, one-at-a-time sensitivity), `heatmap.ts` (sync grid evaluation; worker-ready).
- **Workers:** heatmap + MC factored as pure functions so they can move to `new Worker()` without refactor; current build runs sync at coarse 12in (2×2 fill) to stay dependency-free, memoised. Upgrade path documented below.
- **Storage:** `idb` (scenarios/results/annotations) + localStorage annotations + JSON/CSV export + print. `Context/` binaries git-ignored.

## Data schemas
- `field.json`: meta{version, rulesVersion TU22, units inch, origin center +X→Red}, footprint, zones, elements{hubs(47×47, hex 41.7 @72h, 158.6 from wall), bumps(73×44.4×6.513 15°), trenches(65.65×47×40.25, clear 50.34×22.25), depots(42×27), towers(49.25×45×78.25, rungs 27/45/63), outposts(chute 31.8×7 @28.1, ~25, corral 35.8×37.6), fuel(⌀5.91, 0.448–0.5 lb)}, starts×6, waypoints, scoringTargets, walls. Every dim: {value, source, confidence, needsVerification?}.
- `rules.json`: periods (AUTO 20, TRANS 10, 4×25 SHIFTS, END 30, settle 3s), hubTable both AUTO-winner branches, fuelStaging 504, points{1/1, 15, 10/20/30}, RP tiers{100/360/50, 240/360/50, 360/500/50}, robotLimits{115 lb, 110in, 30in, +12in, R107 30in}.
- `robot`: drivetrain/footprint/clearance/mass/vmax/amax/brake/omega/turnAccel/maneuver/battery/traction/intake{rate,fail}/storage/index/release/spinUp/accuracy{close,mid,long}/jam/cycleReliability/climb{levels,setup,pSuccess}/mechRisk/driverMod/autoCompat + source/confidence.
- `strategy`: id/phase/purpose/route/acquire/score/abandon/cutoff/poor/robots.
- `scenario`: {fieldVersion, rulesVersion, robot+overrides, strategies, coeffs, seed, result}.

## Math / assumptions
- `trapezoidTime(d,v,a,dec)`: cruise if d≥dAcc+dDec else triangular vPeak=√(d/(1/2a+1/2dec)). Turn: |θ|/ω + ½ ramp (cap 0.4s). Realistic adds curve 0.12s/90° (+maneuver adj), traction fraction, congestion/defense seconds; driver ×1.06; conservative ×1.18+0.25s.
- Nav: occupancy from rects + robot radius; A* 8-conn with corner costs; unreachable masked (never rendered as valid).
- Cycle: carry=min(storage, 8+3·intakeRate); collect=carry/rate·(1+2·fail); score=spinUp+carry/release; travel from motion; inactive arrivals held (fuel 0, lost time ledgered).
- Scoring: windows [0,30)+ENDGAME[130,163); SHIFTS alternate per winner; tie→red-first deterministic (seeded random upgrade path). FUEL pts only when active; tower per Table 6-4.
- MC: per-cycle accuracy jitter ±0.05, jam halves yield, 25% traffic +0–2s (time folded into yield proxy in v1), climb Bernoulli on EV. Sensitivity: Δpts for −1s cycle (via throughput), 85→70 acc, 95→70 climb @20pt.

## Web Worker upgrade
Move `computeHeatmapSync` + `runMonteCarlo` into `src/workers/*.ts?worker` with Comlink; post {grid, robot, origin} → transferable Float32Array. Current sync path is the fallback.

## Deploy
- Web: `vite build` (base './') → `dist/` → GH Pages action. Desktop: `npm run dist` → electron-builder (electron/main.js loads dist/index.html over file://). No env vars; no `.env` needed.

## Known gaps
BUMP/TRENCH/DEPOT/OUTPOST XY from reference dims; AprilTag poses not yet in scene; AndyMark-vs-welded delta; R107 vs climber packaging; HUB-exit distribution; tie-break randomness seed plumbing.
