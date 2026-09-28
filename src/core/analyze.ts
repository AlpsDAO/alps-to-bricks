// Pixel-level understanding of an Alp: which pixels form the solid head and body,
// which stick out (antennae, stems, glasses arms), which float and need a
// support, and which colour each pixel shows on the sides and back of the bust.
import { PART, type PunkGrid } from './detect';
import { mapColors } from './palette';
import { BLACK, COLOR_BY_ID, TRANS_CLEAR } from './palette';

export const N = 32;
/** Alps' bodies start on this row; everything above is the head (and its glasses) */
const BODY_TOP = 21;
export type Role = 'body' | 'protrusion' | 'support' | 'stalk';

export interface PixelInfo {
  color: number;            // brick colour shown on the front
  role: Role;
  /** thin parts: a slab in the middle of the depth, flat on the front (glasses), or a rod one pixel deep */
  anchor: 'center' | 'front' | 'rod';
  /** body pixels: how many pixels of the same column sit above this one (0 = column top) */
  fromTop: number;
  fill: number;             // colour of the inside/sides, front half
  fillBack: number;         // colour of the inside/sides, back half
  /** for supports and floating details: the pixel whose depth they copy */
  depthFrom?: [number, number];
  /** which trait drew it (PART), -1 if unknown */
  part: number;
  /** pixels to the nearest edge of the silhouette (1 = on the edge), for rounding the back */
  edge: number;
}

/** How the glasses carry on round the head: goggles have a strap all the way round, with the A of their
 * clip on both sides; gnargles have arms along the sides that hook down behind the ears */
export interface GlassesDecor {
  kind: 'strap' | 'arms';
  rows: number[];
  color: number;
  glyph?: { color: number; pattern: number[][] };
}

export interface Analysis {
  px: (PixelInfo | null)[][];
  /** brick colour of each Punk colour */
  brickOf: number[];
  skin: number;
  glasses: GlassesDecor | null;
  notes: string[];
}

const inside = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyze(g: PunkGrid): Analysis {
  const notes: string[] = [];
  // ---- colours ----
  const touching = new Set<string>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[1, 0], [0, 1]]) {
    const a = g.cells[r][c], b = inside(r + dr, c + dc) ? g.cells[r + dr][c + dc] : -1;
    if (a >= 0 && b >= 0 && a !== b) touching.add(a < b ? `${a},${b}` : `${b},${a}`);
  }
  // symbols drawn in a near shade of what's around them keep their own brick colour: the A on a goggle
  // clip (rows 12–14, columns 7–9) and the 🤘 in a gnargles bridge (rows 11–14, columns 15–17)
  const mustDiffer = new Set<string>();
  const symbol = (r0: number, r1: number, c0: number, c1: number) => {
    const ks = new Set<number>();
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (g.parts?.[r]?.[c] === PART.glasses) ks.add(g.cells[r][c]);
    const a = [...ks];
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) mustDiffer.add(a[i] < a[j] ? `${a[i]},${a[j]}` : `${a[j]},${a[i]}`);
  };
  symbol(12, 14, 7, 9);
  symbol(11, 14, 15, 17);
  const brickOf = mapColors(g.colors, touching, mustDiffer);
  const col = (r: number, c: number) => (g.cells[r][c] < 0 ? -1 : brickOf[g.cells[r][c]]);
  const sil = (r: number, c: number) => inside(r, c) && g.cells[r][c] >= 0;

  // ---- connected parts; floating details get a clear support ----
  const comp: number[][] = Array.from({ length: N }, () => Array(N).fill(-1));
  const comps: [number, number][][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!sil(r, c) || comp[r][c] >= 0) continue;
    const id = comps.length, list: [number, number][] = [[r, c]]; comp[r][c] = id;
    for (let i = 0; i < list.length; i++) for (const [dr, dc] of D4) {
      const rr = list[i][0] + dr, cc = list[i][1] + dc;
      if (sil(rr, cc) && comp[rr][cc] < 0) { comp[rr][cc] = id; list.push([rr, cc]); }
    }
    comps.push(list);
  }
  const main = comps.reduce((a, b, i) => (b.length > comps[a].length ? i : a), 0);
  const attached = comp.map(row => row.map(v => v === main));
  const support: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));
  const depthFrom = new Map<string, [number, number]>();
  const stalk = new Map<string, number>();   // sideways bridge pixel -> colour
  const bridgedInto = new Map<string, number>();   // the attached pixel a bridge reaches into -> its colour
  const detached = comps.map((l, i) => ({ l, i })).filter(o => o.i !== main)
    .sort((a, b) => Math.max(...b.l.map(p => p[0])) - Math.max(...a.l.map(p => p[0])));   // lowest first
  for (const { l } of detached) {
    // cheapest path through empty pixels to the attached part: down is cheap, up is dear
    const cost = Array.from({ length: N }, () => Array(N).fill(Infinity));
    const prev = new Map<string, [number, number] | null>();
    const q: [number, number, number][] = [];
    for (const [r, c] of l) { cost[r][c] = 0; prev.set(`${r},${c}`, null); q.push([0, r, c]); }
    let hit: [number, number] | null = null;
    while (q.length) {
      q.sort((a, b) => a[0] - b[0]);
      const [d, r, c] = q.shift()!;
      if (d > cost[r][c]) continue;
      if (attached[r][c]) { hit = [r, c]; break; }
      for (const [dr, dc] of D4) {
        const rr = r + dr, cc = c + dc;
        if (!inside(rr, cc)) continue;
        if (sil(rr, cc) && !attached[rr][cc] && !l.some(p => p[0] === rr && p[1] === cc)) continue;
        // an earlier support or bridge only holds things from above or below, never beside it
        if (dr === 0 && (support[rr][cc] || stalk.has(`${rr},${cc}`))) continue;
        const nd = d + (dr === 1 ? 1 : dr === -1 ? 2 : 3);
        if (nd < cost[rr][cc]) { cost[rr][cc] = nd; prev.set(`${rr},${cc}`, [r, c]); q.push([nd, rr, cc]); }
      }
    }
    if (!hit) continue;
    // path from the attached pixel back to the floating group
    const path: [number, number][] = [hit];
    let p = prev.get(`${hit[0]},${hit[1]}`) ?? null;
    while (p) { path.push(p); if (l.some(s => s[0] === p![0] && s[1] === p![1])) break; p = prev.get(`${p[0]},${p[1]}`) ?? null; }
    const detailColor = col(path[path.length - 1][0], path[path.length - 1][1]);
    let n = 0, stalks = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const [r, c] = path[i];
      // vertical runs are clear support blocks (studs hold them); a sideways
      // step must be one piece reaching across, so it takes the detail's colour
      const vertical = path[i - 1][1] === c && path[i + 1][1] === c;
      if (vertical) { support[r][c] = true; n++; } else { stalk.set(`${r},${c}`, detailColor); stalks++; }
      attached[r][c] = true; depthFrom.set(`${r},${c}`, hit);
    }
    for (const [r, c] of l) { attached[r][c] = true; depthFrom.set(`${r},${c}`, hit); }
    // the bridge enters the pixel it hangs from at the back, so that pixel's back takes the bridge's colour
    if (stalks) bridgedInto.set(`${hit[0]},${hit[1]}`, detailColor);
    const how = [n ? `${n} clear support block${n > 1 ? 's' : ''}` : '', stalks ? `a ${stalks}-pixel bridge set back behind it` : ''].filter(Boolean).join(' and ');
    notes.push(`${l.length} floating pixel${l.length > 1 ? 's' : ''} (row ${l[0][0] + 1}) held by ${how}.`);
  }

  // ---- body vs. thin parts: morphological opening with a 4×4 block ----
  const solid = (r: number, c: number) => inside(r, c) && attached[r][c] && !support[r][c] && !stalk.has(`${r},${c}`);
  const core: boolean[][] = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (!solid(r + i, c + j)) return false;
    return true;
  }));
  const body = (r: number, c: number) => {
    if (!solid(r, c)) return false;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (inside(r - i, c - j) && core[r - i][c - j]) return true;
    return false;
  };

  // ---- skin: the head's main colour, which shows on its sides and back ----
  const tally = new Map<number, number>();
  for (let r = 0; r < BODY_TOP; r++) for (let c = 0; c < N; c++) {
    if (!attached[r][c]) continue;
    const k = col(r, c);
    if (k < 0 || k === BLACK || COLOR_BY_ID.get(k)?.trans) continue;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const skin = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? brickOf[0];
  // the body's own colour (under any accessory), for the back of the torso
  const partOf = (r: number, c: number) => g.parts?.[r]?.[c] ?? -1;
  const bodyTally = new Map<number, number>();
  for (let r = BODY_TOP; r < N; r++) for (let c = 0; c < N; c++) if (partOf(r, c) === PART.body) bodyTally.set(col(r, c), (bodyTally.get(col(r, c)) ?? 0) + 1);
  const bodyColor = [...bodyTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // ---- glasses: Alps' goggles carry a pixel "A" on the strap clip (rows 12–14, columns 7–9), in the
  // strap's colour; the strap wraps the sides and back of the head at those rows. Noggles-style frames
  // ("gnargles") have a ⌐ arm there instead, which runs back along the sides to about the ears. ----
  const glassesPx = (r: number, c: number) => partOf(r, c) === PART.glasses;
  let decor: GlassesDecor | null = null;
  {
    const at = (i: number, j: number) => (glassesPx(12 + i, 7 + j) ? g.cells[12 + i][7 + j] : -2);
    const clip = at(0, 0), glyph = at(0, 1);
    const A = [[0, 1, 0], [1, 0, 1], [1, 0, 1]];
    if (clip >= 0 && glyph >= 0 && clip !== glyph && A.every((row, i) => row.every((v, j) => at(i, j) === (v ? glyph : clip)))) {
      decor = { kind: 'strap', rows: [12, 13, 14], color: brickOf[clip], glyph: { color: brickOf[glyph], pattern: A } };
    } else if (glassesPx(13, 7)) decor = { kind: 'arms', rows: [13], color: col(13, 7) };
  }
  const band = decor && { rows: decor.rows, color: decor.color, back: decor.kind === 'strap' };

  // outline pixels: black on the edge of the Punk, or thin black lines
  const lineBlack = (r: number, c: number) => {
    if (col(r, c) !== BLACK) return false;
    if (D4.some(([dr, dc]) => !sil(r + dr, c + dc))) return true;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && sil(r + dr, c + dc) && col(r + dr, c + dc) === BLACK) n++;
    return n <= 4;
  };
  // small details (highlights, eyes, lips: a few pixels) stay on the front face only
  const pixelsOf = new Map<number, number>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (sil(r, c)) pixelsOf.set(col(r, c), (pixelsOf.get(col(r, c)) ?? 0) + 1);
  const detail = (k: number) => (pixelsOf.get(k) ?? 0) <= 6;
  const fillable = (r: number, c: number) => solid(r, c) && !lineBlack(r, c) && !COLOR_BY_ID.get(col(r, c))?.trans && !detail(col(r, c));

  // Alps face the front, so thin parts (antennae, stems, glasses arms) sit in the middle of the depth
  // distance of every solid pixel to the outside of the silhouette, for rounded backs
  const edge: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  {
    const q: [number, number][] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!solid(r, c)) continue;
      if (D4.some(([dr, dc]) => !solid(r + dr, c + dc))) { edge[r][c] = 1; q.push([r, c]); }
    }
    for (let i = 0; i < q.length; i++) for (const [dr, dc] of D4) {
      const rr = q[i][0] + dr, cc = q[i][1] + dc;
      if (solid(rr, cc) && !edge[rr][cc]) { edge[rr][cc] = edge[q[i][0]][q[i][1]] + 1; q.push([rr, cc]); }
    }
  }
  // patterns that wrap round the torso (stripes, checks) carry on at the sides and back; prints stay on
  // the chest, with the body's colour round the sides and back
  const printed = (rr: number, cc: number) => g.style?.accessory === 'front' && partOf(rr, cc) === PART.accessory;

  const px: (PixelInfo | null)[][] = [];
  for (let r = 0; r < N; r++) {
    const row: (PixelInfo | null)[] = [];
    for (let c = 0; c < N; c++) {
      if (!attached[r][c]) { row.push(null); continue; }
      if (support[r][c]) {
        row.push({ color: TRANS_CLEAR, role: 'support', anchor: 'center', fromTop: 0, fill: TRANS_CLEAR, fillBack: TRANS_CLEAR, depthFrom: depthFrom.get(`${r},${c}`), part: -1, edge: 1 });
        continue;
      }
      if (stalk.has(`${r},${c}`)) {
        const k = stalk.get(`${r},${c}`)!;
        row.push({ color: k, role: 'stalk', anchor: 'center', fromTop: 0, fill: k, fillBack: k, depthFrom: depthFrom.get(`${r},${c}`), part: -1, edge: 1 });
        continue;
      }
      const part = partOf(r, c);
      const onHead = part === PART.head || part === PART.glasses;
      // the sides show a nearby colour of the same row; the glasses only show on the front (behind the
      // frame's front edge it's the head, apart from the strap or arms below)
      const sideOk = (rr: number, cc: number) => fillable(rr, cc) && !(onHead && partOf(rr, cc) === PART.glasses) && !(!onHead && printed(rr, cc));
      let fill = !onHead && bodyColor !== undefined ? bodyColor : skin;
      if (sideOk(r, c)) fill = col(r, c);
      else if (part !== PART.glasses && !printed(r, c)) {
        for (let d = 1; d < N; d++) {
          const order = c < N / 2 ? [c + d, c - d] : [c - d, c + d];
          const hit = order.find(cc => inside(r, cc) && sideOk(r, cc));
          if (hit !== undefined) { fill = col(r, hit); break; }
        }
      }
      // the back of the head shows the head's colour and the back of the torso the body's, not the face
      // or the accessory; without trait info the back shows what the front does
      let fillBack = onHead ? skin : (part === PART.body && g.style?.body === 'front') || printed(r, c) ? bodyColor ?? fill : fill;
      // the head carries on behind its glasses: the colour the art has under them
      const under = part === PART.glasses && (g.under?.[r]?.[c] ?? -1) >= 0 ? brickOf[g.under![r][c]] : -1;
      if (under >= 0) { fill = under; if (g.style?.head !== 'cylinder') fillBack = skin; }
      // a cylinder (a barrel, a mug) shows its own pattern all the way round: staves and hoops carry on
      // round the back, behind the glasses too
      if (onHead && g.style?.head === 'cylinder') {
        let k = part === PART.head ? col(r, c) : under;
        for (let d = 1; k < 0 && d < N; d++) for (const rr of [r - d, r + d]) if (k < 0 && inside(rr, c) && partOf(rr, c) === PART.head) k = col(rr, c);
        fill = fillBack = k >= 0 ? k : skin;
      }
      // the goggle strap (or the noggles' arms) along the sides, and the strap across the back
      if (onHead && band?.rows.includes(r)) { fill = band.color; if (band.back) fillBack = band.color; }
      fillBack = bridgedInto.get(`${r},${c}`) ?? fillBack;
      let fromTop = 0;
      while (r - fromTop - 1 >= 0 && solid(r - fromTop - 1, c)) fromTop++;
      const isBody = body(r, c);
      // thin bits of the glasses stay on the front, so the A logo and frames read flat
      const anchor = isBody ? 'center' : part === PART.glasses ? 'front' : part === PART.head && g.style?.rods ? 'rod' : 'center';
      row.push({ color: col(r, c), role: isBody ? 'body' : 'protrusion', anchor, fromTop, fill, fillBack, depthFrom: depthFrom.get(`${r},${c}`), part, edge: edge[r][c] || 1 });
    }
    px.push(row);
  }
  return { px, brickOf, skin, glasses: decor, notes };
}
