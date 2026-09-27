import { describe, expect, it } from 'vitest';
import { alpGrid, GRID } from '../src/alps/alps';
import { alp, ALPS } from './alps';

describe('Alp pixels', () => {
  it('draws Alp 277 exactly: its console head, skoggles and striped body', () => {
    const g = alp(277);
    expect(g.cells.length).toBe(GRID);
    expect(g.cells.every(r => r.length === GRID)).toBe(true);
    const filled = g.cells.flat().filter(v => v >= 0).length;
    expect(filled).toBe(471);
    // the head's top-left corner and the body's bottom row
    expect(g.cells[3][7]).toBeGreaterThanOrEqual(0);
    expect(g.cells[2][7]).toBe(-1);
    expect(g.cells[31].filter(v => v >= 0).length).toBe(13);
    expect(g.background).toEqual([0x01, 0x81, 0x46]);
  });
  it('every Alp reaches the bottom edge, like the body always does', () => {
    for (const { id, grid } of ALPS) expect(grid.cells[GRID - 1].filter(v => v >= 0).length, `Alp ${id}`).toBeGreaterThan(8);
  });
  it('colour counts add up to the filled pixels', () => {
    const g = alpGrid({ background: 0, body: 0, accessory: 0, head: 0, glasses: 0 });
    expect(g.colors.reduce((a, c) => a + c.count, 0)).toBe(g.cells.flat().filter(v => v >= 0).length);
  });
});
