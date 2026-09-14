# DragonSim core components — in detail

## 1. Field model (`data/field/rebuilt-2026.field.json`)

The single source of truth for geometry, versioned (`1.0.0`, rules `TU22`).
Origin at field center, **inches** internally (`+X` toward the red wall,
`+Y` across, `+Z` up); metric is display-only. Footprint 651.2 × 317.7 in.
Verified from the manual: HUB 47×47 with a 41.7 in hex opening 72 in up and 4
base exits; BUMP 73×44.4×6.5 in at 15°; TRENCH clearance 50.34 wide × 22.25
high; DEPOT 42×27; TOWER rungs at 27/45/63 in; FUEL ⌀5.91 in, 0.448–0.500 lb.
Every dimension carries `source` + `confidence`; lateral XY placements derived
from reference (parenthetical, untoleranced) drawing dimensions are flagged
`needsVerification`. Collision set: HUBs, towers, depots, outposts block;
BUMPs cost 1.6×; trenches are drivable underneath.

## 2. Rules model (`data/rules/rebuilt-2026.rules.json`)

Match clock (AUTO 20s, TRANSITION 10s, four 25s SHIFTS, ENDGAME 30s, +3s
settling), the HUB-alternation table (AUTO winner's HUB sits out SHIFT 1, then
alternates; FMS randomizes ties), points (active FUEL 1/1, inactive 0; tower 15
AUTO L1, 10/20/30 TELEOP), ranking thresholds (100/360/50 regional), robot
limits (115 lb, 110 in perimeter, 30 in height, +12 in extension), and the
official shooting rule **G407: only score while in your ALLIANCE ZONE** — a
launch is legal only with BUMPERS partially or fully inside your own zone
(MAJOR FOUL per launch otherwise; bulk scoring from neutral risks a card under
G211). DragonSim enforces it geometrically: releases must originate on your
side of the ROBOT STARTING LINE (±167.01 in, ~14 in bumper tolerance), so
mid-field attempts first drive to the alliance-side HUB apron at the cost of
real travel time.

## 3. Robots (`data/robots/archetypes.json`)

Six baselines — Sprinter, Balanced All-Rounder (Team 422 default), Hauler,
Sniper, Warden, Climber — each exposing ~25 parameters (drivetrain limits,
intake/index/release rates, spin-up, per-zone accuracy, jam probability,
storage, climb levels/setup/success, mass, maneuverability, battery derate).
All defaults are `baseline-estimate`, editable per-parameter in Robots, with
overrides kept separate so Reset restores the baseline. A detailed procedural
3D model (swerve modules, intake, shooter hood, climber, hopper FUEL that fills
and empties) stands in for the robot; teams may import a GLB to replace the
body while collision stays footprint-based.

## 4. Motion model (`src/sim/motion.ts`)

Trapezoidal/triangular velocity profiles from vmax/accel/brake — never
distance ÷ vmax — plus turn cost from angular velocity, curvature penalty,
traction factor, congestion/defense seconds, and driver-noise multiplier.
Every route reports best / realistic (expected) / conservative seconds with the
assumptions listed. Deterministic: same inputs, same output.

## 5. Pathfinding (`src/sim/nav.ts`)

Grid A* over the collision set with bump-cost regions, in inches, worker-safe
(no DOM/Three imports). Illegal targets (inside a HUB, off-field) are rejected
with a reason — never drawn as valid. `clampOutOfColliders` rescues clicked
points by pushing them out along the shallowest axis. The playthrough expands
every leg through A*, so animated robots drive around obstacles exactly like
the timed routes.

## 6. Strategies (`data/strategies/presets.json`, `src/sim/strategy.ts`)

Thirteen presets across AUTO / TELEOP / ENDGAME, each with purpose, route,
acquire/score behavior, abandon rule, endgame cutoff, failure modes, and
compatible archetypes. The engine gates every score by HUB state: fuel arriving
while inactive scores 0 and is ledgered as lost time, not hidden.

## 7. Scoring — why an estimate, and how it is calculated

**Why an estimate.** Four things no simulator can know exactly: your robot's
true rates (defaults are engineering guesses until measured), traffic and
defense (modeled as penalties, not predicted opponents), randomness (misses,
jams, climb success are draws, not certainties), and field variance (FUEL
scatter ±24, carpet wear, HUB processing). So DragonSim reports Low / Expected
/ High (p10 / mean / p90) instead of one number.

**How it is calculated, step by step.**
1. AUTO fuel = 8 preloaded × close-range accuracy, rounded (both HUBs active).
2. TELEOP cycles come from the strategy timeline: carry = min(storage,
   8 + 3 × intake rate); collect time = carry ÷ rate × (1 + 2 × fail rate);
   score time = spin-up + carry ÷ release rate; travel from the motion model.
3. Each score event is stamped on the match clock and checked against the HUB
   windows: active → fuel × accuracy counts at 1 pt; inactive → 0 pts, logged
   as `teleInactiveAttempted` (shown as hold time in 3D).
4. Misses = attempted − made; jam losses = cycles × jam probability × storage ÷ 2.
5. Tower points from the selected climb level and period (15 AUTO L1;
   10/20/30 TELEOP), with success probability applied in Monte Carlo.
6. Total = fuel points + tower points. Best ≈ total × 1.12, Conservative ≈
   total × 0.82; Monte Carlo (seeded, 100–2000 runs varying accuracy, jams,
   traffic, climb) gives the p10/p50/p90 distribution and the sensitivity
   deltas ("−1 s cycle ≈ +X pts").

## 8. Playthrough (`src/sim/playthrough.ts` + `src/three/Playthrough.tsx`)

A pure, tested builder turns the strategy into a 160-second script on the real
match clock: AUTO preloads, TELEOP cycles with real travel/dwell seconds,
holds through inactive windows (re-checking, never shooting while off),
holds through inactive windows (re-checking, never shooting while off),
G407 reposition legs when a release would fall outside the ALLIANCE ZONE, and
endgame climbs.
Shot outcomes are deterministic hashes of (cycle, slot, accuracy), so scrubbing
is stable. The 3D layer renders hopper fill, arcing true-size FUEL, green `+N`
/ red `MISS` / orange `JAM` flashes, per-slot trails, and a caption bar with
phase, countdown, live score, and a color legend.

## 9. Uncertainty, persistence, and the Context Library

Monte Carlo (`src/sim/montecarlo.ts`, seeded mulberry32) produces the forecast
bands; the assumptions ledger in the side panel lists every default and
override. Scenarios persist to IndexedDB with JSON/CSV export and printing.
The Context Library catalogs the local official assets (manual, drawings, STEP,
videos), tags them, and links annotations to parameters — so any number can be
traced back to its evidence and confidence.
