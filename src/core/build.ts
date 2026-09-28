// Punk grid -> buildable brick model (Mini or XL).
import { analyze, N, type Analysis, type PixelInfo } from './analyze';
import { hexToRgb, type RGB } from './color';
import type { VoxModel } from '../alps/vox';
import { checkModel, connections, grounded, type Checks } from './check';
import { PART, type HeadModel, type PunkGrid } from './detect';
import { BASE_GRAY, BLACK, COLOR_BY_ID, mapColors, TRANS_CLEAR } from './palette';
import { partId, partName, sizesFor, TILE_SIZES, type Kind, type Piece } from './parts';
import { key, kx, kz, tileLayer, type Layer, type TileOpts } from './tile';
import { availableAtLego, madeInColour } from './lego';

export type SizeId = 'mini' | 'xl';
/** how many pixels in from the outline a round head's back reaches full depth */
const ROUND_PX = 4;

export interface SizeSpec {
  id: SizeId;
  sx: number;               // studs per pixel (width)
  D: number;                // head depth in studs
  front: number;            // depth of the front colour, studs
  taper: [number, number];  // inset of the top two pixels of each column (rounder top)
  slab: number;             // depth of thin parts (brims, ears)
  frontSlab: number;        // depth of mouth accessories (pipes, cigarettes)
  wall: number;             // wall thickness when hollow
  chamfer: number;          // back corners cut
  rowLayers: { kind: Kind; h: number }[];
  /** optional: odd rows (counting from the bottom) use this instead, e.g. to alternate heights */
  rowLayersAlt?: { kind: Kind; h: number }[];
  baseLayers: { kind: Kind; h: number }[];
  baseMargin: { side: number; front: number; back: number };
  cantilever: number;       // longest overhang (studs) before a support column is added
  slopes: boolean;
  nameplate: [number, number] | null;
}

export const SIZES_SPEC: Record<SizeId, SizeSpec> = {
  mini: {
    id: 'mini', sx: 1, D: 8, front: 2, taper: [2, 1], slab: 4, frontSlab: 3, wall: 1, chamfer: 0,
    // rows alternate 1 brick (3 plates) and 2 plates: 2.5 plates = 8 mm on average, like a stud: square pixels
    rowLayers: [{ kind: 'brick', h: 3 }], rowLayersAlt: [{ kind: 'plate', h: 1 }, { kind: 'plate', h: 1 }],
    baseLayers: [{ kind: 'plate', h: 1 }, { kind: 'plate', h: 1 }],
    baseMargin: { side: 1, front: 2, back: 1 }, cantilever: 6, slopes: false, nameplate: [4, 1],
  },
  xl: {
    id: 'xl', sx: 2, D: 16, front: 2, taper: [4, 2], slab: 8, frontSlab: 4, wall: 2, chamfer: 0,
    rowLayers: [{ kind: 'brick', h: 3 }, { kind: 'plate', h: 1 }, { kind: 'plate', h: 1 }],
    baseLayers: [{ kind: 'brick', h: 3 }, { kind: 'brick', h: 3 }],
    baseMargin: { side: 2, front: 4, back: 2 }, cantilever: 12, slopes: true, nameplate: [6, 2],
  },
};

export interface BomLine { part: string; kind: Kind; name: string; color: number; colorName: string; hex: string; w: number; d: number; qty: number }

export interface Model {
  size: SizeId;
  pieces: Piece[];
  steps: number[][];
  bom: BomLine[];
  colors: Record<number, string>;
  checks: Checks;
  notes: string[];
  /** approximate size in cm: width, depth, height */
  dims: [number, number, number];
}

interface LayerRec { y: number; h: number; kind: Kind; cells: Layer; row: number | null; pieces: Piece[]; prefX: boolean }

export interface BuildOptions {
  /** only use parts LEGO sells (Pick a Brick), splitting the others into smaller ones */
  preferLego?: boolean;
}

export function buildModel(grid: PunkGrid, size: SizeId, overrides: Partial<SizeSpec> & BuildOptions = {}): Model {
  const S = { ...SIZES_SPEC[size], ...overrides };
  // only parts that exist in that colour; with "only parts LEGO sells", only the ones LEGO sells
  const allow = overrides.preferLego ? availableAtLego : madeInColour;
  const A = analyze(grid);
  const notes = [...A.notes];
  // the base takes the Alp's background colour; the nameplate stands out from it
  const baseColor = grid.background ? mapColors([{ rgb: grid.background, count: 999 }], new Set())[0] : BLACK;
  const plateColor = baseColor === BASE_GRAY ? BLACK : BASE_GRAY;
  const { sx, D } = S;

  // ---------- 1. pixels -> stud cells, one map per pixel row ----------
  const { rows, rTop, rBot, rowCells, supportCell } = voxelize(grid, A, S);

  // ---------- 2. long overhangs get a clear support column ----------
  let columns = 0;
  for (let r = rBot - 1; r >= rTop; r--) {
    const cells = rowCells.get(r)!;
    for (let iter = 0; iter < 20; iter++) {
      const below = rowCells.get(r + 1)!;
      const dist = new Map<number, number>(), q: number[] = [];
      for (const k of cells.keys()) if (below.has(k)) { dist.set(k, 0); q.push(k); }
      for (let i = 0; i < q.length; i++) {
        const k = q[i], x = kx(k), z = kz(k);
        for (const n of [key(x + 1, z), key(x - 1, z), key(x, z + 1), key(x, z - 1)]) if (cells.has(n) && !dist.has(n)) { dist.set(n, dist.get(k)! + 1); q.push(n); }
      }
      let far: number | null = null, fd = S.cantilever;
      for (const k of cells.keys()) { const d = dist.get(k) ?? Infinity; if (d > fd && d !== Infinity) { fd = d; far = k; } }
      if (far === null) {
        break;
      }
      // column under the far end, aligned to the pixel grid, down to the first solid row
      const X = Math.floor(kx(far) / sx) * sx, Z = Math.min(D - sx, Math.floor(kz(far) / sx) * sx);
      const foot: number[] = [];
      for (let i = 0; i < sx; i++) for (let j = 0; j < sx; j++) if (cells.has(key(X + i, Z + j))) foot.push(key(X + i, Z + j));
      for (let rr = r + 1; rr <= rBot; rr++) {
        const rc = rowCells.get(rr)!;
        if (foot.every(k => rc.has(k))) break;
        for (const k of foot) if (!rc.has(k)) { rc.set(k, TRANS_CLEAR); supportCell.add(`${rr}:${k}`); }
      }
      columns++;
    }
  }
  if (columns) notes.push(`${columns} clear support column${columns > 1 ? 's' : ''} added under long overhangs.`);

  // ---------- 3. base, sized so the centre of mass sits well inside ----------
  // the base covers the footprint of the bottom three rows (jaw included)
  const bottom = [rBot, rBot - 1, rBot - 2].flatMap(r => [...(rowCells.get(r)?.keys() ?? [])]);
  let bx0 = Math.min(...bottom.map(kx)) - S.baseMargin.side, bx1 = Math.max(...bottom.map(kx)) + S.baseMargin.side;
  let bz0 = -S.baseMargin.front, bz1 = D - 1 + S.baseMargin.back;
  {
    let m = 0, cx = 0, cz = 0;
    for (const cells of rowCells.values()) for (const k of cells.keys()) { m++; cx += kx(k) + 0.5; cz += kz(k) + 0.5; }
    cx /= m; cz /= m;
    const need = 2 * sx;
    if (cx - bx0 < need) bx0 = Math.floor(cx - need); if (bx1 + 1 - cx < need) bx1 = Math.ceil(cx + need);
    if (cz - bz0 < need) bz0 = Math.floor(cz - need); if (bz1 + 1 - cz < need) bz1 = Math.ceil(cz + need);
  }
  const baseCells = new Set<number>();
  for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) baseCells.add(key(x, z));

  // ---------- 4. hollow inside, and which cells can be seen ----------
  const present = (r: number, k: number) => (r > rBot ? baseCells.has(k) : rowCells.get(r)?.has(k) ?? false);
  const hollow = new Map<number, Set<number>>();
  for (const r of rows) {
    const h = new Set<number>(), cells = rowCells.get(r)!;
    for (const [k, c] of cells) {
      if (c === TRANS_CLEAR || COLOR_BY_ID.get(c)?.trans || !present(r - 2, k)) continue;
      const x = kx(k), z = kz(k);
      if (z < S.front) continue;   // the front colour is never hollowed out
      let ok = true;
      for (let rr = r - 1; rr <= r + 1 && ok; rr++) for (let dx = -S.wall; dx <= S.wall && ok; dx++) for (let dz = -S.wall; dz <= S.wall && ok; dz++) if (!present(rr, key(x + dx, z + dz))) ok = false;
      if (ok) h.add(k);
    }
    hollow.set(r, h);
  }
  const opaque = (r: number, k: number) => {
    if (r > rBot) return baseCells.has(k);
    const c = rowCells.get(r)?.get(k);
    return c !== undefined && !COLOR_BY_ID.get(c)?.trans;
  };
  const layerCells = (r: number): Layer => {
    const out: Layer = new Map(), cells = rowCells.get(r)!, h = hollow.get(r)!;
    for (const [k, c] of cells) {
      if (h.has(k)) continue;
      const x = kx(k), z = kz(k);
      const vis = !!COLOR_BY_ID.get(c)?.trans
        || [key(x + 1, z), key(x - 1, z), key(x, z + 1), key(x, z - 1)].some(n => !opaque(r, n));
      out.set(k, { c, vis });
    }
    return out;
  };

  // ---------- 5. layers: bricks wherever the model allows, plates for the rest ----------
  // Every pixel row keeps its exact height so pixels stay square: Mini rows alternate 3 and 2 plates
  // (8 mm on average, a stud's width), XL rows are 5 plates (16 mm, two studs). Bricks are stacked every
  // 3 plates through the whole height, whatever row they fall in: a stud cell takes a brick where the
  // three plate levels it spans show one colour (or can't be seen), and plates only where they don't,
  // mostly where the front changes colour from one row to the next. Fewest pieces, square pixels.
  const topRows = headwearRows(A.px, A.skin, rTop);
  const groupOf = (L: LayerRec): Piece['group'] => (L.row === null ? 'base' : topRows.has(L.row) ? 'top' : 'body');
  const occupied = (L: LayerRec) => new Set(L.pieces.flatMap(p => { const o: number[] = []; for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) o.push(key(p.x + i, p.z + j)); return o; }));
  const levelRow: number[] = [];   // plate level (from 0 at the base's top) -> pixel row
  for (let r = rBot; r >= rTop; r--) {
    const own = S.rowLayersAlt && (rBot - r) % 2 === 1 ? S.rowLayersAlt : S.rowLayers;
    for (let i = 0, h = own.reduce((a, q) => a + q.h, 0); i < h; i++) levelRow.push(r);
  }
  const H = levelRow.length;
  const rowCellsCache = new Map<number, Layer>();
  const levelCells = (y: number): Layer => {
    const r = levelRow[y];
    if (!rowCellsCache.has(r)) rowCellsCache.set(r, layerCells(r));
    return rowCellsCache.get(r)!;
  };
  /** the brick a stud cell can take across plate levels y..y+2, or null if it needs plates there */
  const brickCell = (y: number, k: number): { c: number; vis: boolean } | null => {
    let seen = -1, any = -1;
    for (let i = 0; i < 3; i++) {
      const cell = levelCells(y + i).get(k);
      if (!cell) return null;
      any = cell.c;
      if (cell.vis || COLOR_BY_ID.get(cell.c)?.trans) { if (seen >= 0 && seen !== cell.c) return null; seen = cell.c; }
    }
    return { c: seen >= 0 ? seen : any, vis: seen >= 0 };
  };
  // Where to start each brick level: going up, either lay a brick level here (3 plates tall) or a single
  // plate level. Chosen for the fewest pieces overall, counting layer cells, with plates squeezed in
  // among bricks counted a little dearer as they come out small. Busy rows keep bricks aligned to them;
  // plain stretches run bricks straight through.
  // 'free' places brick levels anywhere; 'rows' only at the start of a row tall enough for one (a brick,
  // then plates to finish the row), the fallback for the rare model that free stacking can't hold
  const brickLevels = (mode: 'free' | 'rows'): boolean[] => {
    const brickAt: boolean[] = Array(H).fill(false);
    if (mode === 'rows') {
      for (let y = 0; y < H; y++) if ((y === 0 || levelRow[y - 1] !== levelRow[y]) && levelRow[y + 2] === levelRow[y]) brickAt[y] = true;
      return brickAt;
    }
    const best = Array(H + 1).fill(0), pick = Array(H).fill(false);
    for (let y = H - 1; y >= 0; y--) {
      const plate = levelCells(y).size + best[y + 1];
      let brick = Infinity;
      if (y + 3 <= H) {
        let bricks = 0, rest = 0;
        for (const k of levelCells(y).keys()) if (brickCell(y, k)) bricks++;
        for (let i = 0; i < 3; i++) rest += levelCells(y + i).size - bricks;
        brick = bricks + 1.5 * rest + best[y + 3];
      }
      pick[y] = brick < plate; best[y] = Math.min(brick, plate);
    }
    for (let y = 0; y < H;) { if (pick[y]) { brickAt[y] = true; y += 3; } else y++; }
    return brickAt;
  };
  const baseBottom = -S.baseLayers.reduce((a, l) => a + l.h, 0);
  const makeLayers = (brickAt: boolean[], platesAt: Set<string>, repairNotes: string[]): LayerRec[] => {
    const layers: LayerRec[] = [];
    let y = baseBottom;
    S.baseLayers.forEach((l, i) => {
      const cells: Layer = new Map();
      for (const k of baseCells) {
        const x = kx(k), z = kz(k);
        cells.set(k, { c: baseColor, vis: x === bx0 || x === bx1 || z === bz0 || z === bz1 });
      }
      layers.push({ y, h: l.h, kind: l.kind, cells, row: null, pieces: [], prefX: i % 2 === 0 }); y += l.h;
    });
    let flip = false;
    for (let y0 = 0; y0 < H;) {
      const span = brickAt[y0] ? 3 : 1;
      const bricks: Layer = new Map();
      if (span === 3) for (const k of levelCells(y0).keys()) {
        if (platesAt.has(`${y0}:${k}`)) continue;
        const b = brickCell(y0, k);
        if (b) bricks.set(k, b);
      }
      // each level runs its pieces the other way from the one below, so joints never line up
      flip = !flip;
      if (bricks.size) layers.push({ y: y0, h: 3, kind: 'brick', cells: bricks, row: levelRow[y0], pieces: [], prefX: flip });
      for (let yy = y0; yy < y0 + span; yy++) {
        const plates: Layer = new Map();
        for (const [k, cell] of levelCells(yy)) if (!bricks.has(k)) plates.set(k, cell);
        if (plates.size) layers.push({ y: yy, h: 1, kind: 'plate', cells: plates, row: levelRow[yy], pieces: [], prefX: yy === y0 ? flip : (yy - y0) % 2 === 1 ? !flip : flip });
      }
      y0 += span;
    }
    // bottom up: each layer rests on the pieces that end right under it
    const ends = new Map<number, Set<number>>();
    for (const L of layers) {
      L.pieces = tileLayer(L.cells, { kind: L.kind, y: L.y, h: L.h, prefX: L.prefX, sizes: sizesFor(L.kind), below: L.y === baseBottom ? null : ends.get(L.y) ?? new Set(), group: groupOf(L), allow });
      const top = L.y + L.h, set = ends.get(top) ?? new Set<number>();
      occupied(L).forEach(k => set.add(k)); ends.set(top, set);
    }
    // ---------- 6. repair anything that doesn't hold ----------
    repair(layers, repairNotes, groupOf, allow);
    return layers;
  };
  // Where something can't be held (a detail beside another colour, a corner hanging over nothing), the
  // bricks around it in that brick level are swapped for plates, which can reach sideways to what holds
  const stack = (mode: 'free' | 'rows') => {
  const brickAt = brickLevels(mode);
  const slotOf: number[] = Array(H).fill(-1);
  for (let y = 0; y < H; y++) if (brickAt[y]) for (let i = 0; i < 3; i++) slotOf[y + i] = y;
  const platesAt = new Set<string>();
  let repairNotes: string[] = [];
  let layers = makeLayers(brickAt, platesAt, repairNotes);
  for (let round = 0; round < 12; round++) {
    const ps = layers.flatMap(L => L.pieces), { adj } = connections(ps), g = grounded(ps, adj);
    let more = 0;
    for (const L of layers) if (L.row !== null && L.y >= 0 && slotOf[L.y] >= 0) for (const p of L.pieces) {
      if (g[ps.indexOf(p)]) continue;
      const y0 = slotOf[L.y];
      for (let x = p.x - 2; x < p.x + p.w + 2; x++) for (let z = p.z - 2; z < p.z + p.d + 2; z++) {
        const k = `${y0}:${key(x, z)}`;
        if (!platesAt.has(k)) { platesAt.add(k); more++; }
      }
    }
    if (!more) break;
    repairNotes = [];
    layers = makeLayers(brickAt, platesAt, repairNotes);
  }
  const ps = layers.flatMap(L => L.pieces), loose = grounded(ps, connections(ps).adj).filter(v => !v).length;
  return { layers, repairNotes, platesAt, loose };
  };
  let st = stack('free');
  if (st.loose) { const rowsAligned = stack('rows'); if (rowsAligned.loose < st.loose) st = rowsAligned; }
  const { layers, platesAt } = st;
  notes.push(...st.repairNotes);
  if (platesAt.size) notes.push(`${platesAt.size} stud${platesAt.size > 1 ? 's' : ''} built from plates instead of bricks so details interlock.`);

  // ---------- 7. smooth tops: tiles where nothing sits on top ----------
  const tops: Piece[] = [];
  const occ = new Map(layers.map(L => [L, occupied(L)] as const));
  layers.forEach((L, i) => {
    const top = L.y + L.h;
    const above = layers.filter(M => M.y === top);
    const inside = top >= 0 && top < H ? hollow.get(levelRow[top]) ?? new Set<number>() : new Set<number>();
    const exposed: Layer = new Map();
    for (const [k, cell] of L.cells) if (!inside.has(k) && !above.some(M => M.cells.has(k) || occ.get(M)!.has(k))) exposed.set(k, { c: cell.c, vis: true });
    if (!exposed.size) return;
    if (L.row === null && S.nameplate && top === 0) {
      const [w, d] = S.nameplate, cx0 = Math.round((Math.min(...bottom.map(kx)) + Math.max(...bottom.map(kx)) + 1 - w) / 2);
      const z0 = -Math.ceil((S.baseMargin.front + d) / 2);
      let ok = true;
      for (let i2 = 0; i2 < w; i2++) for (let j = 0; j < d; j++) if (!exposed.has(key(cx0 + i2, z0 + j))) ok = false;
      if (ok && (!allow || allow('tile', w, d, plateColor))) {
        for (let i2 = 0; i2 < w; i2++) for (let j = 0; j < d; j++) exposed.delete(key(cx0 + i2, z0 + j));
        tops.push({ x: cx0, z: z0, y: top, h: 1, w, d, c: plateColor, kind: 'tile', part: partId('tile', w, d), group: 'base', nameplate: true });
      }
    }
    tops.push(...tileLayer(exposed, { kind: 'tile', y: top, h: 1, prefX: i % 2 === 1, sizes: TILE_SIZES, group: groupOf(L), allow }));
  });

  // ---------- 8. steps, parts list, checks ----------
  const pieces: Piece[] = [...layers.flatMap(L => L.pieces), ...tops];
  // one step per layer; tiles and slopes go with the layer at their height
  const layerYs = [...new Set(pieces.map(p => p.y))].sort((a, b) => a - b);
  const stepOf = pieces.map(p => layerYs.indexOf(p.y));
  // a piece that hangs under another (nothing holds it from below yet) is
  // added right after the piece that holds it, in that piece's step
  const { adj } = connections(pieces);
  const deferred = new Set<number>();
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    pieces.forEach((p, i) => {
      if (stepOf[i] === 0) return;
      const nb = [...adj[i].keys()];
      if (nb.some(j => pieces[j].y < p.y && stepOf[j] <= stepOf[i])) return;
      const up = nb.filter(j => pieces[j].y > p.y).map(j => stepOf[j]);
      if (!up.length) return;
      const s = Math.min(...up);
      if (s > stepOf[i]) { stepOf[i] = s; deferred.add(i); changed = true; }
    });
    if (!changed) break;
  }
  const byStep: number[][] = layerYs.map(() => []);
  pieces.forEach((_, i) => byStep[stepOf[i]].push(i));
  const sortedSteps = byStep.filter(s => s.length).map(s => s.sort((a, b) => {
    const da = deferred.has(a) ? 1 : 0, db = deferred.has(b) ? 1 : 0;
    if (da !== db) return da - db;
    const pa = pieces[a], pb = pieces[b];
    return (da ? pb.y - pa.y : pa.y - pb.y) || pa.z - pb.z || pa.x - pb.x;
  }));

  const checks = checkModel(pieces);
  if (checks.floating) notes.push(`${checks.floating} piece${checks.floating > 1 ? 's are' : ' is'} not connected to the base.`);
  const bomMap = new Map<string, BomLine>();
  for (const p of pieces) {
    const k = `${p.part}|${p.c}`, col = COLOR_BY_ID.get(p.c)!;
    const line = bomMap.get(k) ?? { part: p.part, kind: p.kind, name: partName(p.kind, p.w, p.d), color: p.c, colorName: col.name, hex: col.hex, w: Math.min(p.w, p.d), d: Math.max(p.w, p.d), qty: 0 };
    line.qty++; bomMap.set(k, line);
  }
  const bom = [...bomMap.values()].sort((a, b) => a.colorName.localeCompare(b.colorName) || a.kind.localeCompare(b.kind) || a.w - b.w || a.d - b.d);
  const colors: Record<number, string> = {};
  for (const p of pieces) colors[p.c] = COLOR_BY_ID.get(p.c)!.hex;
  const xs = pieces.flatMap(p => [p.x, p.x + p.w]), zs = pieces.flatMap(p => [p.z, p.z + p.d]), ys = pieces.flatMap(p => [p.y, p.y + p.h]);
  const dims: [number, number, number] = [(Math.max(...xs) - Math.min(...xs)) * 0.8, (Math.max(...zs) - Math.min(...zs)) * 0.8, (Math.max(...ys) - Math.min(...ys)) * 0.32].map(v => Math.round(v)) as [number, number, number];
  return { size, pieces, steps: sortedSteps, bom, colors, checks, notes, dims };
}

/** Pixels → stud cells, one map per pixel row (cell → brick colour), with clear supports marked. */
function voxelize(grid: PunkGrid, A: Analysis, S: SizeSpec) {
  const { sx, D } = S;
  const rows = [...Array(N).keys()].filter(r => A.px[r].some(Boolean));
  const rTop = rows[0], rBot = rows[rows.length - 1];
  const range = new Map<string, [number, number]>();
  // a flat head reaches the middle of the depth, where the supports and bridges holding details sit
  const headShape = grid.style?.head ?? 'round', flatBack = Math.floor(D / 2);
  // the middle of the depth, one pixel thick: where rods run and a cylinder's sides are
  const zc = (D - 1) / 2;
  const mid = (): [number, number] => { const a = sx === 1 ? Math.round(zc) : Math.floor(zc + 0.5 - sx / 2); return [a, a + sx - 1]; };
  // a cylinder's rows are ellipses across their width: deepest in the middle, thin at the sides
  const rowSpan = new Map<number, [number, number]>();
  if (headShape === 'cylinder') for (let r = 0; r < N; r++) {
    const cs = [...Array(N).keys()].filter(c => { const p = A.px[r][c]; return !!p && p.role === 'body' && (p.part === PART.head || p.part === PART.glasses); });
    if (cs.length) rowSpan.set(r, [cs[0], cs[cs.length - 1]]);
  }
  const cylinder = (r: number, c: number): [number, number] | null => {
    const span = rowSpan.get(r); if (!span) return null;
    const half = (span[1] - span[0] + 1) / 2, u = Math.max(-1, Math.min(1, (c + 0.5 - span[0] - half) / half)), s = Math.sqrt(1 - u * u);
    const z0 = Math.round(zc - zc * s), z1 = Math.round(zc + zc * s);
    return z1 - z0 + 1 >= sx ? [z0, z1] : mid();
  };
  const rangeOf = (r: number, c: number, p: PixelInfo): [number, number] => {
    const onHead = p.part === PART.head || p.part === PART.glasses;
    if (headShape === 'cylinder' && onHead && (p.role === 'body' || p.anchor === 'front')) { const cy = cylinder(r, c); if (cy) return cy; }
    if (p.anchor === 'rod') return mid();
    // the front is always flat: the Alp, pixel for pixel. Behind it, the head takes its shape
    if (p.role === 'body' && onHead) {
      if (headShape === 'box') return [0, D - 1];
      if (headShape === 'flat') return [0, flatBack];
      // round: the back curves in towards the outline, like a quarter circle over the last few pixels
      const k = Math.min(p.edge, ROUND_PX) / ROUND_PX;
      return [0, Math.max(S.front, Math.round((D - 1) * Math.sqrt(1 - (1 - k) ** 2)))];
    }
    if (p.role === 'body') {
      const inset = p.fromTop < 2 ? S.taper[p.fromTop] : 0;
      return [0, D - 1 - inset];
    }
    const z0 = Math.round((D - S.slab) / 2); void r; void c;
    // a flat head's thin bits stay within its depth
    if (headShape === 'flat' && (p.part === PART.head || p.part === PART.glasses)) return [0, flatBack];
    // thin bits of the glasses: flat on the front, and deep enough to reach the middle, where thin head
    // parts resting on them sit
    if (p.anchor === 'front') return [0, Math.max(S.frontSlab, z0 + S.slab) - 1];
    return [z0, z0 + S.slab - 1];
  };
  for (const r of rows) for (let c = 0; c < N; c++) { const p = A.px[r][c]; if (p && !p.depthFrom) range.set(`${r},${c}`, rangeOf(r, c, p)); }
  for (const r of rows) for (let c = 0; c < N; c++) {
    const p = A.px[r][c]; if (!p || !p.depthFrom) continue;
    const t = range.get(`${p.depthFrom[0]},${p.depthFrom[1]}`) ?? rangeOf(r, c, p);
    if (p.role === 'stalk') { const m = Math.floor((t[0] + t[1] + 1) / 2); range.set(`${r},${c}`, [Math.min(m, t[1] - sx + 1), t[1]]); }
    // a support column overlaps the bridge (stalk) it may stand on or hold up: both meet at the middle
    else if (p.role === 'support') { const m = Math.floor((t[0] + t[1] + 1) / 2); range.set(`${r},${c}`, [Math.max(t[0], m - Math.floor(sx / 2)), Math.max(t[0], m - Math.floor(sx / 2)) + sx - 1]); }
    else range.set(`${r},${c}`, p.role === 'protrusion' ? t : rangeOf(r, c, p));
  }
  const rowCells = new Map<number, Map<number, number>>();   // row -> cell -> colour
  const supportCell = new Set<string>();                     // `${row}:${cell}` clear supports
  for (const r of rows) {
    const cells = new Map<number, number>();
    for (let c = 0; c < N; c++) {
      const p = A.px[r][c]; if (!p) continue;
      const [z0, z1] = range.get(`${r},${c}`)!;
      for (let z = z0; z <= z1; z++) {
        // thin parts show their colour through and through, except the glasses: their colour stays on the
        // front edge, with the strap, arm or head behind it like the rest of the face
        const colr = p.role === 'support' ? TRANS_CLEAR : (p.role !== 'body' && p.anchor !== 'front') || z <= z0 + S.front - 1 ? p.color : z < D / 2 ? p.fill : p.fillBack;
        for (let i = 0; i < sx; i++) { cells.set(key(c * sx + i, z), colr); if (p.role === 'support') supportCell.add(`${r}:${key(c * sx + i, z)}`); }
      }
    }
    // round the two back corners
    for (let z = D - S.chamfer; z < D; z++) {
      const xs = [...cells.keys()].filter(k => kz(k) === z).map(kx);
      if (!xs.length) continue;
      const lo = Math.min(...xs), hi = Math.max(...xs);
      for (const x of xs) if (x < lo + S.chamfer || x > hi - S.chamfer) cells.delete(key(x, z));
    }
    rowCells.set(r, cells);
  }
  // the head's cells in each row: the solid head and the glasses (loose details beside it, like rings
  // and drips, keep their colour, which the pieces holding them rely on), or a hand-made head's voxels
  const clearRgb = new Set(grid.colors.filter(c => c.clear).map(c => c.rgb.join(',')));
  const headCells = grid.headModel ? useHeadModel(grid.headModel, A, rowCells, sx, clearRgb) : new Map<number, Set<number>>();
  if (!grid.headModel) for (const [r, cells] of rowCells) {
    const own = new Set<number>();
    for (const k of cells.keys()) {
      const p = A.px[r]?.[Math.floor(kx(k) / sx)];
      if (p && !p.depthFrom && (p.part === PART.glasses || (p.part === PART.head && p.role === 'body'))) own.add(k);
    }
    headCells.set(r, own);
  }
  if (A.glasses) wearGlasses(A.glasses, rowCells, headCells, sx, D);

  return { rows, rTop, rBot, rowCells, supportCell };
}

/** Whatever glasses the Alp wears, round whatever head it has: the strap (or arms) runs round the head's
 * surface right behind the front, the strap's clip shows its A on both sides, and gnargles' arms hook
 * down behind the ears. Only the head's surface is painted, never its front: that's the pixel art. */
function wearGlasses(G: NonNullable<Analysis['glasses']>, rowCells: Map<number, Map<number, number>>, headCells: Map<number, Set<number>>, sx: number, D: number) {
  const zGlyph = Math.max(1, sx), ears = Math.floor(D / 2) - 1;
  const surface = (r: number, pick: (x: number, z: number, behind: number, side: boolean) => number | null) => {
    const cells = rowCells.get(r), own = headCells.get(r);
    if (!cells || !own?.size) return;
    const front = new Map<number, number>();   // column -> its front-most z
    for (const k of own) front.set(kx(k), Math.min(front.get(kx(k)) ?? Infinity, kz(k)));
    const rowFront = Math.min(...front.values());
    for (const k of own) {
      const x = kx(k), z = kz(k);
      if (z === front.get(x)) continue;
      const side = !cells.has(key(x - 1, z)) || !cells.has(key(x + 1, z));
      if (!side && cells.has(key(x, z + 1))) continue;   // inside: nobody sees it
      const colour = pick(x, z, z - rowFront, side);
      if (colour !== null) cells.set(k, colour);
    }
  };
  for (const r of G.rows) surface(r, (_x, _z, behind, side) => {
    if (G.kind === 'arms' && behind > ears) return null;
    const j = Math.floor((behind - zGlyph) / sx);
    return G.glyph && side && j >= 0 && j < 3 && G.glyph.pattern[r - G.rows[0]][j] ? G.glyph.color : G.color;
  });
  if (G.kind === 'arms') for (const r of [G.rows[0] + 1, G.rows[0] + 2]) surface(r, (_x, _z, behind, side) => (side && behind > ears - sx && behind <= ears ? G.color : null));
}

/** A hand-made head (src/alps/heads, see HEADS.md) replaces the automatic one: its voxels become the
 * head's cells, one pixel = one voxel = sx studs each way. The front-most voxel of every pixel shows the
 * Alp's own pixel (head or glasses), and every pixel of the art is there even if the model left it out. */
function useHeadModel(m: HeadModel, A: Analysis, rowCells: Map<number, Map<number, number>>, sx: number, clearRgb: Set<string>): Map<number, Set<number>> {
  const brick = new Map<string, number>();
  // see-through where the model says so, or in the colours this head shows see-through (the barrel's wine)
  const colourOf = (rgb: RGB, clear = false) => {
    const k = `${rgb.join(',')}${clear || clearRgb.has(rgb.join(',')) ? ':clear' : ''}`;
    if (!brick.has(k)) brick.set(k, mapColors([{ rgb, count: 999, clear: k.endsWith(':clear') }], new Set())[0]);
    return brick.get(k)!;
  };
  const onHead = (r: number, c: number) => { const p = A.px[r]?.[c]; return !!p && !p.depthFrom && (p.part === PART.head || p.part === PART.glasses); };
  // out with the automatic head…
  for (const [r, cells] of rowCells) for (const k of [...cells.keys()]) if (onHead(r, Math.floor(kx(k) / sx))) cells.delete(k);
  // …in with the model's voxels (y = 0 is the torso's front; `front` moves the head forward)
  const vox = new Map<string, { y: number; colour: number }[]>();   // "r,c" -> voxels front to back
  for (const v of m.voxels) {
    const r = N - 1 - v.z, c = v.x;
    if (r < 0 || r >= N || c < 0 || c >= N) continue;
    const list = vox.get(`${r},${c}`) ?? [];
    list.push({ y: v.y - (m.front ?? 0), colour: colourOf(v.rgb, v.clear) });
    vox.set(`${r},${c}`, list);
  }
  // every pixel of the art shows, at the front of its row if the model has nothing there
  for (let r = 0; r < N; r++) {
    const ys = [...vox.entries()].filter(([k]) => +k.split(',')[0] === r).flatMap(([, l]) => l.map(v => v.y));
    const rowFront = ys.length ? Math.min(...ys) : -(m.front ?? 0);
    for (let c = 0; c < N; c++) if (onHead(r, c) && !vox.has(`${r},${c}`)) vox.set(`${r},${c}`, [{ y: rowFront, colour: A.px[r][c]!.color }]);
  }
  const headCells = new Map<number, Set<number>>();
  for (const [rc, list] of vox) {
    const [r, c] = rc.split(',').map(Number);
    list.sort((a, b) => a.y - b.y);
    let cells = rowCells.get(r);
    if (!cells) rowCells.set(r, cells = new Map());
    const own = headCells.get(r) ?? new Set<number>();
    list.forEach((v, i) => {
      const colour = i === 0 && A.px[r][c] ? A.px[r][c]!.color : v.colour;
      for (let z = v.y * sx; z < (v.y + 1) * sx; z++) for (let i2 = 0; i2 < sx; i2++) { const k = key(c * sx + i2, z); cells!.set(k, colour); own.add(k); }
    });
    headCells.set(r, own);
  }
  return headCells;
}

/** A head's automatic shape as a voxel model (Mini scale: one voxel per pixel), to start modelling from. */
export function headVoxels(grid: PunkGrid): VoxModel {
  // a hand-made head is exported as it is, to carry on from
  if (grid.headModel) return { size: [N, Math.max(...grid.headModel.voxels.map(v => v.y)) + 1, N], voxels: grid.headModel.voxels };
  const S = SIZES_SPEC.mini, A = analyze(grid), { rowCells } = voxelize({ ...grid, headModel: undefined }, A, S);
  const voxels: VoxModel['voxels'] = [];
  for (const [r, cells] of rowCells) for (const [k, c] of cells) {
    const p = A.px[r][kx(k)];
    if (!p || p.depthFrom || (p.part !== PART.head && p.part !== PART.glasses) || c === TRANS_CLEAR) continue;
    voxels.push({ x: kx(k), y: kz(k), z: N - 1 - r, rgb: hexToRgb(COLOR_BY_ID.get(c)!.hex), ...(COLOR_BY_ID.get(c)!.trans ? { clear: true } : {}) });
  }
  return { size: [N, S.D, N], voxels };
}

/** Rows at the top built as a separate sub-assembly (a Punk's hat). An Alp's head is one piece with its
 * face, so none are. */
function headwearRows(_px: (PixelInfo | null)[][], _skin: number, _rTop: number): Set<number> {
  return new Set();
}

/** Fix pieces that aren't connected to the base: re-tile around them, bridge from above, or add a support column. */
function repair(layers: LayerRec[], notes: string[], groupOf: (L: LayerRec) => Piece['group'], allow?: TileOpts['allow']) {
  const flat = () => layers.flatMap(L => L.pieces);
  const floatingCount = () => {
    const ps = flat(); const { adj } = connections(ps); const g = grounded(ps, adj);
    return { ps, g, n: g.filter(v => !v).length };
  };
  const cellsOf = (p: Piece) => { const o: number[] = []; for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) o.push(key(p.x + i, p.z + j)); return o; };
  const near = (p: Piece, q: Piece, m: number) => q.x < p.x + p.w + m && p.x < q.x + q.w + m && q.z < p.z + p.d + m && p.z < q.z + q.d + m;
  const gap = (p: Piece, q: Piece) => Math.max(0, q.x - p.x - p.w, p.x - q.x - q.w) + Math.max(0, q.z - p.z - p.d, p.z - q.z - q.d) + Math.abs(q.y - p.y) * 0.3;
  let pillars = 0;

  // layers are found by height: several can share one (bricks and plates side by side)
  const under = (y: number) => layers.filter(M => M.y + M.h === y);
  const over = (y: number) => layers.filter(M => M.y === y);
  const bottomY = Math.min(...layers.map(L => L.y));

  /** Try to attach floating piece P; returns true if fewer pieces float afterwards. */
  const attempt = (P: Piece, st: ReturnType<typeof floatingCount>): boolean => {
    const L = layers.find(M => M.pieces.includes(P))!;
    const groundedCells = (Ls: LayerRec[]) => {
      const out = new Set<number>();
      for (const M of Ls) M.pieces.forEach(p => { if (st.g[st.ps.indexOf(p)]) cellsOf(p).forEach(k => out.add(k)); });
      return out;
    };
    const retile = (M: LayerRec, priority: number[], below: Set<number>) => {
      const old = M.pieces;
      const region = old.filter(q => !q.support && near(P, q, 4));
      const cells: Layer = new Map();
      region.forEach(q => cellsOf(q).forEach(k => cells.set(k, M.cells.get(k)!)));
      const fresh = tileLayer(cells, { kind: M.kind, y: M.y, h: M.h, prefX: M.prefX, sizes: sizesFor(M.kind), below, priority, group: groupOf(M), allow });
      M.pieces = [...old.filter(q => !region.includes(q)), ...fresh];
      return () => { M.pieces = old; };
    };
    const all = (undos: (() => void)[]) => (undos.length ? () => undos.reverse().forEach(u => u()) : null);
    const pc = new Set(cellsOf(P));
    const tries: (() => (() => void) | null)[] = [
      // same layer: a piece covering P's cells that rests on grounded pieces below
      () => (L.y > bottomY ? retile(L, [...pc], groundedCells(under(L.y))) : null),
      // layers above: a piece over P that also sits on grounded pieces around it
      () => all(over(L.y + L.h).flatMap(M => {
        const pri = [...M.cells.keys()].filter(k => pc.has(k));
        if (!pri.length) return [];
        const g = groundedCells(under(M.y)); pc.forEach(k => g.delete(k));
        return [retile(M, pri, g)];
      })),
      // layers below: a grounded piece reaching under P
      () => all(under(L.y).flatMap(M => {
        const pri = [...M.cells.keys()].filter(k => pc.has(k));
        if (!pri.length || M.y <= bottomY) return [];
        return [retile(M, pri, groundedCells(under(M.y)))];
      })),
      // beside a grounded piece of another colour (a detail hanging off the side of a strand): set back
      // at the rear, one piece in P's colour reaches across into the neighbour
      () => {
        const zBack = Math.max(...[...pc].map(kz));
        const g = groundedCells([L]);
        const pair = [...pc].filter(k => kz(k) === zBack)
          .flatMap(k => [-1, 1].map(dx => [k, key(kx(k) + dx, zBack)] as const))
          .find(([, n]) => g.has(n) && !pc.has(n) && L.cells.has(n));
        if (!pair) return null;
        const [own, n] = pair, cells = L.cells;
        L.cells = new Map(cells);
        L.cells.set(n, { c: cells.get(own)!.c, vis: cells.get(n)!.vis });
        const undo = retile(L, [own], L.y > bottomY ? groundedCells(under(L.y)) : new Set());
        return () => { undo(); L.cells = cells; };
      },
    ];
    for (const t of tries) {
      const undo = t();
      if (!undo) continue;
      if (floatingCount().n < st.n) return true;
      undo();
    }
    // support column under P, one plate at a time down to the first piece
    const covers = (y: number, k: number) => layers.some(M => M.y <= y && y < M.y + M.h && M.pieces.some(q => q.y <= y && y < q.y + q.h && cellsOf(q).includes(k)));
    for (const k of pc) {
      const added: [LayerRec, Piece][] = [], made: LayerRec[] = [];
      let ok = false;
      for (let y = P.y - 1; y >= bottomY; y--) {
        if (covers(y, k)) { ok = true; break; }
        let M = layers.find(M2 => M2.y === y && M2.h === 1);
        if (!M) { M = { y, h: 1, kind: 'plate', cells: new Map(), row: L.row, pieces: [], prefX: false }; layers.push(M); made.push(M); }
        // an outline keeps going down in black; anything else gets a clear support
        const p: Piece = { x: kx(k), z: kz(k), y, h: 1, w: 1, d: 1, c: P.c === BLACK ? BLACK : TRANS_CLEAR, kind: 'plate', part: partId('plate', 1, 1), group: groupOf(L), support: true };
        M.pieces.push(p); added.push([M, p]);
      }
      if (ok && floatingCount().n < st.n) { pillars++; return true; }
      for (const [M, p] of added) M.pieces.splice(M.pieces.indexOf(p), 1);
      for (const M of made) layers.splice(layers.indexOf(M), 1);
    }
    return false;
  };

  for (let iter = 0; iter < 400; iter++) {
    const st = floatingCount();
    if (!st.n) break;
    // work outwards from the solid part: floating pieces closest to it first
    const solid = st.ps.filter((_, i) => st.g[i]);
    const loose = st.ps.filter((_, i) => !st.g[i])
      .map(P => ({ P, d: Math.min(...solid.filter(q => Math.abs(q.y - P.y) <= 6).map(q => gap(P, q)), 99) }))
      .sort((a, b) => a.d - b.d).slice(0, 12);
    if (!loose.some(({ P }) => attempt(P, st))) break;
  }
  if (pillars) notes.push(`${pillars} support stack${pillars > 1 ? 's' : ''} added under loose pieces.`);
}
