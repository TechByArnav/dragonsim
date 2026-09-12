// Grid A* pathfinding over field collision rects. Pure TS (testable, worker-safe).
export interface Pt { x: number; y: number }
export interface Rect { cx: number; cy: number; hx: number; hy: number; id?: string; traversable?: boolean; costMult?: number }

export function dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Shared collider set (hubs, towers, depots, outposts) so clamping and grids agree.
export function colliderRects(): Rect[] {
  const hub = 47 / 2, twX = 45 / 2, twY = 49.25 / 2;
  return [
    { cx: -167.01, cy: 0, hx: hub, hy: hub, id: 'hubBlue' },
    { cx: 167.01, cy: 0, hx: hub, hy: hub, id: 'hubRed' },
    { cx: -303, cy: 0, hx: twX, hy: twY, id: 'towerBlue' },
    { cx: 303, cy: 0, hx: twX, hy: twY, id: 'towerRed' },
    { cx: -311, cy: 100, hx: 13.5, hy: 21, id: 'depotBlue' },
    { cx: 311, cy: -100, hx: 13.5, hy: 21, id: 'depotRed' },
    { cx: -300, cy: -140, hx: 20, hy: 18, id: 'outpostBlue' },
    { cx: 300, cy: 140, hx: 20, hy: 18, id: 'outpostRed' },
  ];
}

// Push a point outside every collider (+robot radius + margin). Never returns a point inside a hub/tower.
export function clampOutOfColliders(p: Pt, robotRadiusIn = 14.5, marginIn = 3): Pt {
  let { x, y } = p;
  for (const o of colliderRects()) {
    const ex = o.hx + robotRadiusIn + marginIn;
    const ey = o.hy + robotRadiusIn + marginIn;
    const dx = x - o.cx, dy = y - o.cy;
    if (Math.abs(dx) < ex && Math.abs(dy) < ey) {
      // push out along the smaller penetration axis
      if (ex - Math.abs(dx) < ey - Math.abs(dy)) x = o.cx + Math.sign(dx || 1) * ex;
      else y = o.cy + Math.sign(dy || 1) * ey;
    }
  }
  x = Math.max(-325.6 + robotRadiusIn, Math.min(325.6 - robotRadiusIn, x));
  y = Math.max(-158.85 + robotRadiusIn, Math.min(158.85 - robotRadiusIn, y));
  return { x, y };
}

export interface GridOpts {
  cellIn: number; // e.g. 6
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  obstacles: Rect[]; // collision rects (hubs, towers, depots, outposts). Bumps/trenches handled via cost, not block.
  robotRadiusIn: number;
  bumpRects?: Rect[]; // extra cost regions
}

export function buildBlocked(g: GridOpts): { nx: number; ny: number; blocked: Uint8Array; cost: Float32Array } {
  const nx = Math.max(4, Math.ceil((g.bounds.maxX - g.bounds.minX) / g.cellIn));
  const ny = Math.max(4, Math.ceil((g.bounds.maxY - g.bounds.minY) / g.cellIn));
  const blocked = new Uint8Array(nx * ny);
  const cost = new Float32Array(nx * ny).fill(1);
  const toCell = (x: number, y: number) => ({
    ix: Math.floor((x - g.bounds.minX) / g.cellIn),
    iy: Math.floor((y - g.bounds.minY) / g.cellIn),
  });
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = g.bounds.minX + (ix + 0.5) * g.cellIn;
      const y = g.bounds.minY + (iy + 0.5) * g.cellIn;
      for (const o of g.obstacles) {
        if (o.traversable) continue;
        const m = g.robotRadiusIn;
        if (Math.abs(x - o.cx) < o.hx + m && Math.abs(y - o.cy) < o.hy + m) {
          blocked[iy * nx + ix] = 1;
        }
      }
      for (const b of g.bumpRects ?? []) {
        if (Math.abs(x - b.cx) < b.hx && Math.abs(y - b.cy) < b.hy) cost[iy * nx + ix] = b.costMult ?? 1.6;
      }
      void toCell;
    }
  }
  return { nx, ny, blocked, cost };
}

function key(ix: number, iy: number, nx: number) { return iy * nx + ix; }

export interface PathResult { points: Pt[]; distanceIn: number; cells: number; reachable: boolean; reason?: string }

export function astar(start: Pt, goal: Pt, g: GridOpts): PathResult {
  const { nx, ny, blocked, cost } = buildBlocked(g);
  const sIx = Math.floor((start.x - g.bounds.minX) / g.cellIn);
  const sIy = Math.floor((start.y - g.bounds.minY) / g.cellIn);
  const gIx = Math.floor((goal.x - g.bounds.minX) / g.cellIn);
  const gIy = Math.floor((goal.y - g.bounds.minY) / g.cellIn);
  const inB = (ix: number, iy: number) => ix >= 0 && iy >= 0 && ix < nx && iy < ny;
  if (!inB(sIx, sIy) || !inB(gIx, gIy)) return { points: [], distanceIn: 0, cells: 0, reachable: false, reason: 'Start or goal outside field bounds' };
  if (blocked[key(sIx, sIy, nx)]) return { points: [], distanceIn: 0, cells: 0, reachable: false, reason: 'Start inside collision volume' };
  if (blocked[key(gIx, gIy, nx)]) return { points: [], distanceIn: 0, cells: 0, reachable: false, reason: 'Goal inside collision volume (illegal target)' };

  const open: { ix: number; iy: number; f: number }[] = [{ ix: sIx, iy: sIy, f: 0 }];
  const came = new Map<number, number>();
  const gs = new Float64Array(nx * ny).fill(Infinity);
  gs[key(sIx, sIy, nx)] = 0;
  const h = (ix: number, iy: number) => Math.hypot(ix - gIx, iy - gIy);
  const closed = new Uint8Array(nx * ny);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  let guard = nx * ny * 4;
  while (open.length && guard-- > 0) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.ix, cur.iy, nx);
    if (closed[ck]) continue;
    closed[ck] = 1;
    if (cur.ix === gIx && cur.iy === gIy) { found = true; break; }
    for (const [dx, dy, mult] of dirs) {
      const nx2 = cur.ix + dx, ny2 = cur.iy + dy;
      if (!inB(nx2, ny2)) continue;
      const nk = key(nx2, ny2, nx);
      if (blocked[nk] || closed[nk]) continue;
      const step = mult * g.cellIn * cost[nk];
      const ng = gs[ck] + step;
      if (ng < gs[nk]) {
        gs[nk] = ng;
        came.set(nk, ck);
        open.push({ ix: nx2, iy: ny2, f: ng + h(nx2, ny2) * g.cellIn });
      }
    }
  }
  if (!found) return { points: [], distanceIn: 0, cells: 0, reachable: false, reason: 'No path around modeled obstacles' };
  // reconstruct
  const cells: { ix: number; iy: number }[] = [];
  let c = key(gIx, gIy, nx);
  const s = key(sIx, sIy, nx);
  while (c !== s) { cells.push({ ix: c % nx, iy: Math.floor(c / nx) }); const p = came.get(c); if (p === undefined) break; c = p; }
  cells.push({ ix: sIx, iy: sIy });
  cells.reverse();
  // smooth: keep every Nth + endpoints
  const pts: Pt[] = cells.filter((_, i) => i % 2 === 0 || i === cells.length - 1).map(({ ix, iy }) => ({
    x: g.bounds.minX + (ix + 0.5) * g.cellIn,
    y: g.bounds.minY + (iy + 0.5) * g.cellIn,
  }));
  pts[0] = { ...start }; pts[pts.length - 1] = { ...goal };
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return { points: pts, distanceIn: d, cells: cells.length, reachable: true };
}

export function fieldGridFromConstants(cellIn = 6, robotFootprintIn = 29): GridOpts {
  // Mirrors data/field/rebuilt-2026.field.json collision set (hubs+towers+depots+outposts block; bumps cost).
  const hub = 47 / 2, twX = 45 / 2, twY = 49.25 / 2;
  return {
    cellIn,
    bounds: { minX: -325.6, maxX: 325.6, minY: -158.85, maxY: 158.85 },
    robotRadiusIn: robotFootprintIn / 2,
    obstacles: [
      { cx: -167.01, cy: 0, hx: hub, hy: hub, id: 'hubBlue' },
      { cx: 167.01, cy: 0, hx: hub, hy: hub, id: 'hubRed' },
      { cx: -303, cy: 0, hx: twX, hy: twY, id: 'towerBlue' },
      { cx: 303, cy: 0, hx: twX, hy: twY, id: 'towerRed' },
      { cx: -311, cy: 100, hx: 13.5, hy: 21, id: 'depotBlue' },
      { cx: 311, cy: -100, hx: 13.5, hy: 21, id: 'depotRed' },
      { cx: -300, cy: -140, hx: 20, hy: 18, id: 'outpostBlue' },
      { cx: 300, cy: 140, hx: 20, hy: 18, id: 'outpostRed' },
    ],
    bumpRects: [
      { cx: -167.01, cy: -70, hx: 22.2, hy: 36.5, costMult: 1.6 },
      { cx: -167.01, cy: 70, hx: 22.2, hy: 36.5, costMult: 1.6 },
      { cx: 167.01, cy: -70, hx: 22.2, hy: 36.5, costMult: 1.6 },
      { cx: 167.01, cy: 70, hx: 22.2, hy: 36.5, costMult: 1.6 },
    ],
  };
}
