# CONTRIBUTING — DragonSim (Team 422)

Local-first, single-team, MIT. Student-friendly: small PRs, evidence over precision.

## Setup
```bash
npm install
npm run dev
npm run test && npm run lint && npm run typecheck
```

## Rules
- Inches in data/sim; metric display only. Cite source + confidence on every number (`confirmed` / `estimated` / `user-entered` / `unknown` + `needsVerification`).
- Official FIRST docs win. Third-party video = `speculative`. Never present guesses as guarantees; show ranges.
- Keep `Context/` binaries out of git. Link annotations instead of copying assets.
- Single-team focus; keep estimates labeled, never presented as guarantees.
- Match repo style: Zustand store, pure sim functions with tests, Tailwind panels, R3F scene pieces.

## Adding data
- Field/rules: bump version in `data/field|rules`, note TU/markdown source, update tests.
- Robot/strategy: edit JSON + add fixture coverage in `src/sim/sim.test.ts`.

## PR checklist
- [ ] `npm run test && npm run lint && npm run typecheck` green
- [ ] Screenshots for 3D/UI changes
- [ ] Assumptions ledger updated; no false precision
- [ ] No binaries or API keys committed
