# DragonSim — 3D FRC Robot + Strategy Simulator for REBUILT

Independent, unofficial, local-first engineering decision-support tool built for **FRC Team 422 — Mech Tech Dragons** (Maggie L. Walker Governor's School, Richmond VA). Not affiliated with or endorsed by FIRST.

## Features
- Dimensionally grounded 3D REBUILT field (651.2×317.7 in, HUB/BUMP/TRENCH/TOWER/DEPOT/OUTPOST, AprilTag-aware layout)
- 6 editable robot archetypes + single-team placeholder; detailed procedural robot + optional GLB import
- Trapezoidal motion model, A* pathfinding, click-to-time, 6-mode travel-time heatmaps
- AUTO/TELEOP/Endgame strategy presets with **active-HUB gating** (inactive FUEL = 0 pts + visible lost time)
- Transparent scoring (1pt active FUEL, 15 AUTO L1, 10/20/30 TELEOP, RP 100/360/50) + best/expected/conservative ranges
- Seeded Monte Carlo, sensitivity, assumptions ledger, timeline, radar/cycle/distribution charts
- Context Library (traceability), IndexedDB saved scenarios, JSON/CSV export, printable report

## System requirements
Desktop/laptop, modern browser with WebGL (Chrome/Edge/Firefox). Node 20 + npm for dev. No API keys, no backend.

## Quick start
```bash
npm install
npm run dev
```
Open http://127.0.0.1:5173 (or http://localhost:5173).

## Build / preview / desktop / pages
```bash
npm run build     # relative-base dist/ (works for file:// + GH Pages)
npm run preview   # serve dist at 127.0.0.1:4173
npm run dist      # Electron desktop package (requires electron devDeps)
```
GitHub Pages: push to `main` → `.github/workflows/pages.yml` builds `dist/` and deploys. For project sites no base-path change is needed (relative `./`).

## Context-folder setup
Your local `Context/` holds official binaries (kept out of git by default):
`2026GameManual.pdf`, `2026-field-dimension-dwgs.pdf`, `2026-field-dwg-game-specific.pdf`, `FE-2026- ...step`, 2× 720p MP4s.
In-app **Context Library** catalogs, tags (field/rules/strategy/measurement/cad/mechanism), annotates, and links measurements to field/robot params. Sample placeholders live in `data/context/`; never commit private videos/images — add patterns to `.gitignore`.

## Field + rules sourcing
- Authority: Game Manual TU22 + FE-2026 Rev B (Feb 26 2026) + game-specific package + Onshape STEP. Manual imperial values win over rounded metric.
- Inches internally; metric display only. Parenthetical drawing dims = reference (no tolerance) → flagged `needsVerification`.
- Update path: drop new manual/drawings in `Context/`, bump `data/field/*.field.json` + `data/rules/*.rules.json` versions, re-run tests.

## Add a prototype robot / archetype / strategy
- Prototype (single-team): Robots → tune the team placeholder → annotate source frame in Context Library → Save Scenario. Confidence flips from `baseline-estimate` to `user-entered`.
- Archetype: edit `data/robots/archetypes.json` (schema in IMPLEMENTATION.md).
- Strategy: edit `data/strategies/presets.json` (purpose/route/acquire/abandon/cutoff/poor/robots).

## Interpreting estimates
Always ranges, never guarantees. Expected = realistic physics + penalties; Best = clean runs; Conservative = mistakes + defense. Monte Carlo seed makes runs reproducible. Largest drivers listed in Analytics → Sensitivity. Inactive-HUB time is shown as lost, not hidden.

## Limitations + disclaimer
Kinematic (not dynamic) sim; defense = penalty slider; HUB-exit scatter uniform; returned-FUEL infinite-ish with congestion factor; BUMP/TRENCH/DEPOT/OUTPOST XY estimated from reference dims; R107 30-in vertical limit needs Q&A re-check; AndyMark-vs-welded delta not yet measured (Chesapeake = AndyMark). Validate on-field before cutting metal.

## Data / privacy
Local-only: IndexedDB + localStorage + file export. No telemetry, no backend, no keys.

## Documentation

- `docs/USER-GUIDE.md` — one page: what DragonSim does + the 5-minute flow (also on the homepage and in-app under Docs).
- `docs/COMPONENTS.md` — each core component in detail, including why the score is an estimate and exactly how it is calculated.
- `docs/REFERENCE.md` — API calls (none), LLM calls (none), data schemas, state variables, tuning knobs.
- `docs/ARCHITECTURE.md` — every file, what it does, data flow, tests, deploy.

## Project structure
```
data/field|rules|robots|strategies|context|scenarios|exports
src/lib|sim|store|three|pages|components
electron/  .github/workflows/pages.yml
```

## Testing
```bash
npm run test       # vitest: schema, units, motion, nav validity, HUB logic, tower pts, seeded MC, fixtures
npm run lint
npm run typecheck
```

## Attribution
FIRST, FIRST Robotics Competition, FRC, and REBUILT are trademarks of FIRST. DragonSim is independent and unofficial. Field truth © FIRST official docs; do not redistribute FIRST PDFs/CAD. Team branding: Mech Tech Dragons green-dragon mark is an original interpretation of the attached angular logo (do not copy school logos without permission).
