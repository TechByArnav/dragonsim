# DragonSim in one page — what it is and how to use it

DragonSim is a local-first 3D simulator for the 2026 FRC game REBUILT, built for
Team 422. It answers three questions: **how long does a route take, how many
points does a plan score, and how sure are we?** Everything runs in your browser
with no account, no server, and no internet after first load.

## The 5-minute flow

1. **Open Simulator** from the homepage. You start in Simple mode on the 3D field.
2. **1 · Robots** — pick one of 6 archetypes (or tune the Team 422 placeholder).
   Turn on **3-robot alliance** to plan R1/R2/R3 with roles (scorer, support,
   climb, defense). Each robot gets its own color: lime, cyan, gold.
3. **2 · Plan** — pick a TELEOP strategy, a shooting zone (close/mid/long), and a
   climb level. Click a destination preset (Neutral pile, My HUB, Depot, Outpost)
   or click anywhere on the field to move the robot.
4. **▶ Play match** — the robots drive a full 160-second match (AUTO 0–20,
   TELEOP 20–160) with real travel times. Yellow balls arc into the HUB with a
   green `+N` flash on scores and a red `MISS` when they fall short. Cyan rings
   mark intakes, orange marks jams. Robots hold — visibly waiting — when their
   HUB is inactive.
5. **3 · Score** — read Low / Expected / High, then **See charts + export** for
   distributions, cycle bottlenecks, sensitivity, JSON/CSV export, and printing.

## Reading the field

- **Trails** in each robot's color show its whole route. **Pills** above robots
  name them. The **HUB ACTIVE / HUB OFF** chip follows the real alternating
  windows (decided by who wins AUTO).
- **The rules are real:** per G407 the robot only releases from inside its
  ALLIANCE ZONE — mid-field attempts first drive into range, and you will see
  a `Reposition` leg with the seconds it costs. Shooting while the HUB is off
  scores 0 and shows as a hold.

## The one rule for interpreting numbers

Every score is an **estimate with a range, never a guarantee**. Expected assumes
your parameters are right; Low/High (p10/p90) show what traffic, misses, jams,
and defense do to it. If you change nothing else, change one thing at a time and
re-run — the Sensitivity view tells you which knob matters most.
