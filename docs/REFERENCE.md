# DragonSim technical reference — calls, models, and variables

## External API calls: none

DragonSim makes **zero network calls at runtime**. No backend, no telemetry, no
model APIs, no map tiles, no CDN assets required after first load (fonts load
from Google Fonts with system fallbacks). All simulation, storage (IndexedDB +
localStorage), and rendering are local. GitHub Pages hosting and the
`electron/` desktop shell are deployment targets, not runtime dependencies.

## LLM calls: none

No language-model or hosted-AI calls exist anywhere in the codebase. Forecasts
come from the deterministic motion/path/scoring models plus seeded Monte Carlo
(`src/sim/montecarlo.ts`), all auditable in source and covered by tests.

## Data inputs (local JSON, versioned)

| File | Contents | Key fields |
|------|----------|------------|
| `data/field/rebuilt-2026.field.json` | Field truth, v1.0.0 / TU22 | `footprint`, `zones`, `elements.{hubs,bumps,trenches,depots,towers,outposts,fuel}`, `starts`, `waypoints`, `walls` |
| `data/rules/rebuilt-2026.rules.json` | Match + scoring rules | `match.segments`, `match.hubTable`, `fuelStaging`, `points`, `rankingPoints`, `robotLimits`, `towerCriteria`, `shootingPolicy` (G407) |
| `data/robots/archetypes.json` | 6 robot baselines | per robot: `vmaxInPerSec`, `amaxInPerSec2`, `brakeInPerSec2`, `omegaDegPerSec`, `intakeRatePerSec`, `intakeFail`, `storage`, `releaseRatePerSec`, `spinUpSec`, `accuracy.{close,mid,long}`, `jamProb`, `climb.{levels,setupSec,pSuccess}`, `massLb`, `maneuver`, `batteryDerate`, `confidence`, `source` |
| `data/strategies/presets.json` | 13 strategy presets | `phase`, `purpose`, `route`, `acquire`, `abandon`, `cutoffSec`, `poorWhen`, `robots` |
| `data/context/catalog.sample.json` | Context Library shape | sample only; real binaries stay git-ignored |

## Major variables (Zustand store, `src/store.ts`)

| Variable | Type | Meaning |
|----------|------|---------|
| `view` | union | `home, field, robots, strategies, simulate, analytics, context, saved, settings, docs` |
| `alliance` / `autoWinner` | union | viewed alliance; who won AUTO (drives HUB alternation) |
| `robotId` / `robotOverrides` | string / map | selected archetype; user edits layered on top |
| `allianceMode` / `allianceRobots` / `allianceRoles` | bool / 3-tuples | 3-robot planning, per-slot archetype + role |
| `strategyId` / `teleStrategyId` / `endgameId` | string | AUTO / TELEOP / endgame presets |
| `origin` / `dest` | inches XY | route query endpoints |
| `zone` | union | `close, mid, long` shooting zone |
| `climbLevel` | 0–3 | planned climb (0 = skip) |
| `congestion` / `defense` | seconds | traffic + disruption penalties per leg |
| `gridIn` | inches | A* cell size (4–16; coarser = faster) |
| `mcRuns` / `seed` | number | Monte Carlo runs + reproducibility seed |
| `simpleMode` / `debug` / `labels` / `heatmap` / `heatMode` | flags | UI density + overlays |
| `quality` | union | `low, balanced, high` graphics tier (dpr, shadows, ball count; Low for crash-prone laptops) |
| `units` | union | `imperial` (canonical) / `metric` (display) |
| `glbUrl` / `docsPage` | misc | optional robot model override; docs tab |

## Simulation knobs and their effects

| Knob | Where | Effect |
|------|-------|--------|
| `batteryDerate` (0.8–1) | motion | scales vmax/accel/brake |
| `driverNoise` (~0.06) | motion | realistic = base × 1.06 |
| conservative | motion | realistic × 1.18 + 0.25 s |
| bump cost 1.6× | nav | routes prefer trench/flat lanes |
| `settleSec` 3 s | scoring | post-period + post-deactivation counting tail |
| G407 zone rule | playthrough | releases outside the ALLIANCE ZONE reroute to the apron (visible Reposition legs); `inAllianceZone` / `legalShotSpot` in `sim/playthrough.ts` |
| RP thresholds 100/360/50 | scoring | progress bars, tier-switchable |

## Compute model

A*, motion, scoring, Monte Carlo, and heatmaps are pure functions with no I/O,
safe to move into Web Workers as-is. The 3D playthrough path builder
(`src/sim/playthrough.ts`) is likewise pure and fully unit-tested; only the
thin `three/Playthrough.tsx` wrapper touches React state.
