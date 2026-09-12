// Units: inches canonical for FRC fidelity. Metric display only.
export const IN_PER_M = 39.37007874;
export const LB_PER_KG = 2.20462262;
export const inToM = (inch: number) => inch / IN_PER_M;
export const mToIn = (m: number) => m * IN_PER_M;
export const inToCm = (inch: number) => inch * 2.54;
export const cmToIn = (cm: number) => cm / 2.54;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const fmtIn = (inch: number, digits = 1) => `${inch.toFixed(digits)} in`;
export const fmtBoth = (inch: number, digits = 1) =>
  `${inch.toFixed(digits)} in (${inToCm(inch).toFixed(1)} cm)`;
export function assertFinite(n: number, name: string) {
  if (!Number.isFinite(n)) throw new Error(`Non-finite ${name}: ${n}`);
  return n;
}
