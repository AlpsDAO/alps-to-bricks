import { describe, expect, it } from 'vitest';
import { alpGrid, GRID, seedFromParam, seedToParam, type AlpSeed } from '../src/alps/alps';
import imageData from '../src/alps/image-data.json';
import { analyze } from '../src/core/analyze';
import { buildModel } from '../src/core/build';
import { PART } from '../src/core/detect';
import { BLACK } from '../src/core/palette';
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

describe('design links', () => {
  it('round-trips a seed through ?seed=', () => {
    const seed = { background: 1, body: 31, accessory: 128, head: 57, glasses: 125 };
    expect(seedToParam(seed)).toBe('1-31-128-57-125');
    expect(seedFromParam('1-31-128-57-125')).toEqual(seed);
  });
  it('rejects seeds out of range or malformed', () => {
    expect(seedFromParam('7-0-0-0-0')).toBeNull();      // 7 backgrounds: 0 to 6
    expect(seedFromParam('0-0-0-0-200')).toBeNull();    // 200 glasses: 0 to 199
    expect(seedFromParam('1-2-3')).toBeNull();
    expect(seedFromParam('a-b-c-d-e')).toBeNull();
  });
});

describe('goggles', () => {
  // Alp 277 wears skoggles: black strap, grey A on the clip at rows 12–14, columns 7–9
  const A = analyze(alp(277));
  it('the strap wraps the back of the head, the face does not show there', () => {
    for (const r of [12, 13, 14]) for (let c = 0; c < GRID; c++) {
      const p = A.px[r][c];
      if (p && (p.part === PART.head || p.part === PART.glasses)) expect(p.fillBack, `row ${r}`).toBe(BLACK);
    }
    // above and below the strap the back of the head is the head's colour
    expect(A.px[10][12]!.fillBack).toBe(A.skin);
    expect(A.px[16][12]!.fillBack).toBe(A.skin);
  });
  it('keeps the A logo flat on the front', () => {
    const m = buildModel(alp(154), 'mini');   // the shower head: the clip sticks out past the head
    expect(m.checks.floating).toBe(0);
    // every glasses pixel of the clip starts on the front plane (z = 0)
    const g = alp(154), front = new Set(m.pieces.filter(p => p.z === 0).flatMap(p => Array.from({ length: p.w }, (_, i) => p.x + i)));
    for (const c of [7, 8, 9]) expect(front.has(c), `column ${c}`).toBe(true);
    expect(g.parts![13][7]).toBe(PART.glasses);
  });
});

// Every trait at least once, in both sizes, the other traits varied (scripts/alps-traits.ts pairs
// every trait with every trait it can touch: about 108,000 Alps per size, too long for every run)
describe('every trait builds solid', () => {
  const { images, bgcolors } = imageData;
  const n = { head: images.heads.length, glasses: images.glasses.length, body: images.bodies.length, accessory: images.accessories.length, background: bgcolors.length };
  const vary = (i: number, salt: number, m: number) => ((i * 7919 + salt * 104729) >>> 0) % m;
  const seeds: AlpSeed[] = [];
  for (const key of ['head', 'glasses', 'body', 'accessory'] as const) for (let i = 0; i < n[key]; i++) {
    seeds.push({ head: vary(i, 1, n.head), glasses: vary(i, 2, n.glasses), body: vary(i, 3, n.body), accessory: vary(i, 4, n.accessory), background: vary(i, 5, n.background), [key]: i });
  }
  for (const size of ['mini', 'xl'] as const) {
    it(`${size}: ${seeds.length} Alps covering every trait`, () => {
      for (const seed of seeds) {
        const c = buildModel(alpGrid(seed), size).checks;
        const why = JSON.stringify(seed);
        expect(c.floating, why).toBe(0);
        expect(c.collisions, why).toBe(0);
        expect(c.com.inside, why).toBe(true);
      }
    }, 180_000);
  }
});
