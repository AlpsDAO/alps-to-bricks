import { describe, expect, it } from 'vitest';
import { alpGrid, GRID, seedFromParam, seedToParam, type AlpSeed } from '../src/alps/alps';
import imageData from '../src/alps/image-data.json';
import { analyze } from '../src/core/analyze';
import { buildModel, headVoxels } from '../src/core/build';
import { readVox, writeVox } from '../src/alps/vox';
import { PART } from '../src/core/detect';
import { BLACK, COLOR_BY_ID } from '../src/core/palette';
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

describe('every glasses symbol survives colour matching', () => {
  // the A on each goggle clip (rows 12–14, columns 7–9) and the 🤘 in each gnargles bridge (rows 11–14,
  // columns 15–17): where the art has two colours, the bricks must too
  const { images } = imageData;
  it('all 200 glasses', () => {
    images.glasses.forEach((gl, g) => {
      const grid = alpGrid({ background: 0, body: 0, accessory: 0, head: 0, glasses: g }), A = analyze(grid);
      const pairs = gl.filename.includes('gnargles') ? [[11, 15, 11, 14], [13, 16, 13, 15], [14, 17, 14, 16]] : [[12, 8, 12, 7], [13, 7, 13, 8], [14, 9, 14, 8]];
      for (const [r1, c1, r2, c2] of pairs) {
        if (grid.cells[r1][c1] === grid.cells[r2][c2]) continue;
        expect(A.px[r1][c1]!.color, gl.filename).not.toBe(A.px[r2][c2]!.color);
      }
    });
  });
});

describe('round the sides', () => {
  const cellsAt = (id: number, size: 'mini' | 'xl') => buildModel(alp(id), size);
  it('goggles show their A on both sides of the strap, and gnargles arms hook down behind the ears', () => {
    const A = analyze(alp(277));
    expect(A.glasses?.kind).toBe('strap');
    expect(A.glasses?.glyph?.color).not.toBe(A.glasses?.color);
    expect(analyze(alp(12)).glasses?.kind).toBe('arms');
    // both build solid with the strap / arms painted on
    for (const id of [277, 12]) expect(cellsAt(id, 'mini').checks.floating).toBe(0);
  });
  it('shapes heads by what they are: boxes full depth, round heads rounded at the back, flat ones shallow', () => {
    const depth = (id: number) => { const m = cellsAt(id, 'xl'); return Math.max(...m.pieces.filter(p => p.y > 60).map(p => p.z + p.d)); };
    expect(alp(277).style?.head).toBe('box');
    expect(alp(192).style?.head).toBe('flat');
    expect(depth(192)).toBeLessThan(depth(277));
  });
  it('wraps patterns round the torso, but keeps prints on the front', () => {
    expect(alp(277).style?.accessory).toBe('around');
    expect(alp(146).style?.accessory).toBe('front');
    const back = (id: number) => { const A = analyze(alp(id)); return new Set(A.px.slice(21).flat().filter(p => p && p.part === PART.accessory).map(p => p!.fillBack)); };
    expect(back(277).size).toBeGreaterThan(1);   // stripes and checks carry on round the back
    expect(back(146).size).toBe(1);              // a print: the back is the body's colour
  });
});

describe('fewest pieces, square pixels', () => {
  it('keeps every pixel row its exact height (XL: 5 plates, Mini: 3 and 2 alternating)', () => {
    for (const size of ['mini', 'xl'] as const) {
      const m = buildModel(alp(277), size), g = alp(277);
      const rows = g.cells.filter(row => row.some(v => v >= 0)).length;
      const top = Math.max(...m.pieces.filter(p => p.kind !== 'tile').map(p => p.y + p.h));
      expect(top, size).toBe(size === 'xl' ? rows * 5 : Math.ceil(rows / 2) * 3 + Math.floor(rows / 2) * 2);
    }
  });
  it('builds mostly from bricks in XL', () => {
    const m = buildModel(alp(277), 'xl');
    expect(m.pieces.filter(p => p.kind === 'brick').length).toBeGreaterThan(m.pieces.filter(p => p.kind === 'plate').length);
  });
});

describe('hand-made heads (.vox)', () => {
  it('exports a head and builds the same model back from it', () => {
    const g = alp(277);
    const file = writeVox(headVoxels(g)), back = readVox(file);
    expect(back.voxels.length).toBeGreaterThan(1000);
    // Authored geometry now has externally fitted eyewear, so its piece count need
    // not equal the legacy automatic model. The geometry and a solid build must survive.
    expect(back.voxels).toHaveLength(headVoxels(g).voxels.length);
    expect(buildModel({ ...g, headModel: back }, 'mini').checks.floating).toBe(0);
    const xl = buildModel({ ...g, headModel: back }, 'xl').checks;
    expect(xl.floating).toBe(0);
  });
  it('keeps the front pixel-exact whatever colour the model has there', () => {
    const g = alpGrid({ background: 0, body: 0, accessory: 0, head: 57, glasses: 115 }, { without: ['glasses'] }), m = headVoxels(g);
    const painted = { ...m, voxels: m.voxels.map(v => ({ ...v, rgb: [255, 0, 255] as [number, number, number] })) };
    const front = buildModel({ ...g, headModel: painted }, 'mini').pieces.filter(p => p.z === 0 && p.y > 40);
    const auto = buildModel(g, 'mini').pieces.filter(p => p.z === 0 && p.y > 40);
    expect(new Set(front.map(p => p.c))).toEqual(new Set(auto.map(p => p.c)));
  });
});

describe('the wine barrel', () => {
  // Alp 148 wears it: an upright barrel with hoops and staves, a tap on the right and wine pouring down
  const g = alp(148), A = analyze(g);
  it('is a cylinder: round at the front too, deepest in the middle, thin at the sides', () => {
    expect(g.style?.head).toBe('cylinder');
    const m = buildModel(g, 'mini');
    expect(m.checks.floating).toBe(0);
    // the front of the barrel's middle row starts further forward in the centre than at the edges
    const row = m.pieces.filter(p => p.y >= 40 && p.y < 44 && p.kind !== 'tile');
    const frontAt = (x: number) => Math.min(...row.filter(p => p.x <= x && x < p.x + p.w).map(p => p.z));
    expect(frontAt(15)).toBeLessThan(frontAt(8));
  });
  it('shows its staves and hoops round the back, not a single colour', () => {
    const back = new Set(A.px.slice(3, 21).flat().filter(p => p && p.part === PART.head && p.role === 'body').map(p => p!.fillBack));
    expect(back.size).toBeGreaterThan(2);
  });
  it('pours the wine in see-through red rods from the tap to the ground', () => {
    const m = buildModel(g, 'xl');
    const wine = m.pieces.filter(p => COLOR_BY_ID.get(p.c)?.name === 'Trans-Red');
    expect(wine.length).toBeGreaterThan(20);
    expect(Math.min(...wine.map(p => p.y))).toBeLessThanOrEqual(0);        // reaches the base
    expect(Math.max(...wine.map(p => Math.max(p.w, p.d)))).toBeLessThanOrEqual(2);   // a stream, not a wall
  });
});
