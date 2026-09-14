# DragonSim architecture — files and what they do

```
dragonsim/
├── index.html                  entry, fonts, title
├── package.json                scripts: dev / build / preview / test / lint / typecheck / dist
├── vite.config.ts              relative base (Pages + file:// friendly), worker format
├── tailwind.config.js          phosphor-terminal tokens (DESIGN.md)
├── electron/                   desktop shell (main.js loads dist/, preload.js)
├── .github/workflows/pages.yml Pages deploy on push to main
├── docs/                       USER-GUIDE / COMPONENTS / REFERENCE / ARCHITECTURE (this file)
├── DESIGN.md                   visual system spec
├── data/field|rules|robots|strategies|context|scenarios|exports
└── src/
    ├── main.tsx / App.tsx      bootstrap, home ⇄ workspace switch
    ├── index.css               theme, buttons, panels, code windows
    ├── store.ts                Zustand state (see REFERENCE.md for fields)
    ├── types.d.ts              asset declarations (*.md?raw)
    ├── lib/
    │   ├── units.ts            inches-canonical conversions + formatting
    │   ├── persist.ts          IndexedDB scenarios, JSON/CSV export, print
    │   └── markdown.tsx        tiny md→JSX renderer for the Docs view
    ├── sim/  (pure, tested, worker-safe)
    │   ├── motion.ts           trapezoidal profiles → best/realistic/conservative
    │   ├── nav.ts              grid A*, colliders, clampOutOfColliders
    │   ├── scoring.ts          HUB windows, active-only FUEL, tower, RP progress
    │   ├── strategy.ts         presets → timestamped aggregate timelines
    │   ├── playthrough.ts      presets → 160 s 3D scripts (holds, repositions, shots)
    │   ├── shots.ts            deterministic hit/jam hashes
    │   ├── montecarlo.ts       seeded distributions + sensitivity deltas
    │   ├── heatmap.ts          travel-time field evaluation
    │   └── *.test.ts           29 tests: schema, motion, nav, HUB logic, shots, paths
    ├── three/
    │   ├── FieldScene.tsx      carpet, elements, guardrails, heat/path overlays, cameras
    │   ├── DetailedRobot.tsx   procedural robot + hopper fill + GLB override
    │   └── Playthrough.tsx     robots, trails, ball flights, flashes, player bar
    └── pages/
        ├── Home.tsx            landing + inline user guide + doc cards + sources
        ├── Workspace.tsx       rail, viewport, right panel (1-2-3), timeline
        ├── RobotsView.tsx      archetype picker + per-parameter editor
        ├── AnalyticsView.tsx   radar, forecast, cycles, sensitivity, exports
        ├── ContextView.tsx     asset catalog, tags, annotations, review table
        ├── DocsView.tsx        tabbed rendering of docs/*.md
        └── SavedSettings.tsx   scenarios, advanced coefficients, rules overrides
```

## Data flow

`data/*.json` → `sim/*` pure functions → `store.ts` selections →
`Workspace` KPIs + `three/*` visualization. Nothing flows upward: the 3D layer
never writes simulation state; the playthrough consumes the same windows and
rates as the score panel, which is why what you watch matches what you read.

## Test map

- `field.test.ts` — schema, footprint, scoring defaults
- `sim.test.ts` — profiles, A* validity, HUB alternation, tower points,
  seeded MC, shot determinism/rates, scenario round-trip
- `playthrough.test.ts` — monotonic clock, no-dither, no-penetration,
  slot separation, full-program span, shots-only-while-active, determinism

## Build & deploy

`npm run dev` (127.0.0.1:5173) → `test` → `lint` → `typecheck` → `build`
(`dist/`, relative paths) → push to `main` → Pages action deploys;
`npm run dist` wraps `dist/` in Electron. `Context/` binaries and
`node_modules/` never commit (see `.gitignore`).
