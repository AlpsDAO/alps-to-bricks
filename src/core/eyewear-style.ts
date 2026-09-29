import type { Analysis } from './analyze';
import { PART } from './detect';

/** Shape edits are shared by every colourway in a family. Depth zero is the artwork face. */
export interface EyewearStyleEdit { row: number; x: number; depth: number; filled: boolean }
/** Recolouring a cell applies to the selected colourway only. */
export interface EyewearStyleColor { row: number; x: number; depth: number; color: number }
export interface EyewearStyleCell { row: number; x: number; depth: number; color: number }
export const eyewearFamily = (filename: string) => filename.split('-')[1];
const cellKey = (r: number, x: number, d: number) => `${r},${x},${d}`;

export function eyewearFront(A: Analysis, shape: EyewearStyleEdit[] = [], colors: EyewearStyleColor[] = []): EyewearStyleCell[] {
  const base: { row: number; x: number; color: number }[] = [];
  const tally = new Map<number, number>();
  for (let row = 0; row < 32; row++) for (let x = 0; x < 32; x++) {
    const p = A.px[row][x];
    if (p?.part !== PART.glasses || p.depthFrom) continue;
    base.push({ row, x, color: p.color });
    tally.set(p.color, (tally.get(p.color) ?? 0) + 1);
  }
  const backing = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (backing === undefined) return [];
  const cells = new Map<string, EyewearStyleCell>();
  for (const p of base) for (let depth = 0; depth < 2; depth++)
    cells.set(cellKey(p.row, p.x, depth), { row: p.row, x: p.x, depth, color: depth ? backing : p.color });
  for (const e of shape) {
    if (!valid(e.row, e.x, e.depth)) continue;
    const k = cellKey(e.row, e.x, e.depth);
    if (!e.filled) { cells.delete(k); continue; }
    const nearest = base.reduce((a, b) =>
      Math.abs(b.row - e.row) + Math.abs(b.x - e.x) < Math.abs(a.row - e.row) + Math.abs(a.x - e.x) ? b : a, base[0]);
    cells.set(k, { row: e.row, x: e.x, depth: e.depth, color: e.depth ? backing : nearest?.color ?? backing });
  }
  for (const e of colors) if (valid(e.row, e.x, e.depth)) {
    const cell = cells.get(cellKey(e.row, e.x, e.depth));
    if (cell) cell.color = e.color;
  }
  return [...cells.values()];
}

export function valid(row: number, x: number, depth: number): boolean {
  return Number.isInteger(row) && row >= 0 && row < 32 && Number.isInteger(x) && x >= 0 && x < 32 &&
    Number.isInteger(depth) && depth >= 0 && depth <= 24;
}
