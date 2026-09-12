// Heatmap + Monte Carlo in Web Workers (inline via Vite ?worker). Fallback to main thread.
import { fieldGridFromConstants, astar } from '../sim/nav';
import { estimateSegment } from '../sim/motion';

export function computeHeatmapSync(opts: {
  origin: { x: number; y: number }; cellIn: number; mode: string;
  robot: { vmaxInPerSec: number; amaxInPerSec2: number; brakeInPerSec2: number; omegaDegPerSec: number; turnAccelDegPerSec2: number; batteryDerate: number; maneuver: number; footprintIn: { x: number; y: number } };
}): { nx: number; ny: number; times: number[]; min: number; max: number } {
  const grid = fieldGridFromConstants(opts.cellIn, Math.max(opts.robot.footprintIn.x, opts.robot.footprintIn.y));
  const nx = Math.ceil((grid.bounds.maxX - grid.bounds.minX) / opts.cellIn);
  const ny = Math.ceil((grid.bounds.maxY - grid.bounds.minY) / opts.cellIn);
  const times: number[] = new Array(nx * ny).fill(NaN);
  const modeAdd = opts.mode === 'congested' ? 2.5 : opts.mode === 'defended' ? 4.0 : opts.mode === 'theoretical' ? -0.6 : 0;
  for (let iy = 0; iy < ny; iy += 2) {
    for (let ix = 0; ix < nx; ix += 2) {
      const x = grid.bounds.minX + (ix + 0.5) * opts.cellIn;
      const y = grid.bounds.minY + (iy + 0.5) * opts.cellIn;
      const r = astar(opts.origin, { x, y }, grid);
      let t = NaN;
      if (r.reachable) {
        const s = estimateSegment(r.distanceIn, 30, {
          vmaxInPerSec: opts.robot.vmaxInPerSec, amaxInPerSec2: opts.robot.amaxInPerSec2,
          brakeInPerSec2: opts.robot.brakeInPerSec2, omegaDegPerSec: opts.robot.omegaDegPerSec,
          turnAccelDegPerSec2: opts.robot.turnAccelDegPerSec2, batteryDerate: opts.robot.batteryDerate,
          congestionSec: opts.mode === 'theoretical' ? 0 : 0.6, driverNoise: opts.mode === 'theoretical' ? 0 : 0.06,
          curvatureFactor: 0.12 + (1 - opts.robot.maneuver) * 0.15,
        });
        t = (opts.mode === 'theoretical' ? s.bestSec : s.realisticSec) + Math.max(0, modeAdd);
      }
      // fill 2x2 block
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const jx = ix + dx, jy = iy + dy;
        if (jx < nx && jy < ny) times[jy * nx + jx] = t;
      }
    }
  }
  const valid = times.filter((v) => Number.isFinite(v));
  return { nx, ny, times, min: Math.min(...valid), max: Math.max(...valid) };
}
