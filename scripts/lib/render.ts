// Draw voxels to PNG without a browser, so a script (or an AI agent) can look at a model: straight-on
// views (front, right side, back, left side, top) and two isometric views, with simple shading.
// Units: x = column (left to right, seen from the front), y = depth (0 = front), z = height (0 = bottom).
import { PNG } from 'pngjs';

export interface Voxel { x: number; y: number; z: number; rgb: [number, number, number] }

/** min and max without spreading (big models have more points than the call stack allows) */
const range = (xs: number[]) => { let lo = Infinity, hi = -Infinity; for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; } return [lo, hi]; };

const shade = (rgb: [number, number, number], k: number): [number, number, number] => rgb.map(v => Math.max(0, Math.min(255, Math.round(v * k)))) as [number, number, number];

class Canvas {
  png: PNG;
  constructor(public w: number, public h: number, bg: [number, number, number] = [236, 240, 244]) {
    this.png = new PNG({ width: w, height: h });
    for (let i = 0; i < w * h; i++) this.png.data.set([...bg, 255], i * 4);
  }
  set(x: number, y: number, rgb: [number, number, number]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.png.data.set([...rgb, 255], (y * this.w + x) * 4);
  }
  rect(x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, rgb);
  }
  blit(src: Canvas, ox: number, oy: number) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const o = (y * src.w + x) * 4; this.set(ox + x, oy + y, [src.png.data[o], src.png.data[o + 1], src.png.data[o + 2]]); }
  }
}

/** A straight-on view: the nearest voxel along each line of sight, darker the further back it is. */
function elevation(vox: Voxel[], view: 'front' | 'right' | 'back' | 'left' | 'top', cell: number, dims: [number, number, number], zScale = 1): Canvas {
  const [X, Y, Z] = dims;
  const [W, H] = view === 'top' ? [X, Y] : view === 'front' || view === 'back' ? [X, Z] : [Y, Z];
  // heights in plates are drawn at their real proportion (a plate is 0.4 of a stud)
  const ch = view === 'top' ? cell : cell * zScale;
  const c = new Canvas(W * cell, Math.ceil(H * ch));
  const best = new Map<number, { d: number; v: Voxel }>();
  for (const v of vox) {
    let u = 0, w = 0, d = 0;
    if (view === 'front') { u = v.x; w = Z - 1 - v.z; d = v.y; }
    else if (view === 'back') { u = X - 1 - v.x; w = Z - 1 - v.z; d = Y - 1 - v.y; }
    else if (view === 'right') { u = v.y; w = Z - 1 - v.z; d = X - 1 - v.x; }
    else if (view === 'left') { u = Y - 1 - v.y; w = Z - 1 - v.z; d = v.x; }
    else { u = v.x; w = v.y; d = Z - 1 - v.z; }
    const k = w * W + u, b = best.get(k);
    if (!b || d < b.d) best.set(k, { d, v });
  }
  const depth = view === 'top' ? Z : view === 'front' || view === 'back' ? Y : X;
  for (const [k, { d, v }] of best) { const r = Math.floor(k / W); c.rect((k % W) * cell, Math.floor(r * ch), cell, Math.max(1, Math.floor((r + 1) * ch) - Math.floor(r * ch)), shade(v.rgb, 1 - 0.45 * (d / Math.max(1, depth)))); }
  // a faint grid every 8 voxels
  if (zScale === 1) {
    for (let i = 0; i <= W; i += 8) for (let y = 0; y < H * cell; y++) c.set(i * cell, y, [200, 205, 212]);
    for (let j = 0; j <= H; j += 8) for (let x = 0; x < W * cell; x++) c.set(x, j * cell, [200, 205, 212]);
  }
  return c;
}

/** Fill a convex polygon (screen points) with one colour. */
function poly(c: Canvas, pts: [number, number][], rgb: [number, number, number], outline?: [number, number, number]) {
  const [x0, x1] = range(pts.map(p => p[0])), [y0, y1] = range(pts.map(p => p[1]));
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (Math.abs(cross) < 1e-9) continue;
      if (!sign) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  };
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (inside(x + 0.5, y + 0.5)) c.set(x, y, rgb);
  }
  if (outline) for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let t = 0; t <= n; t++) c.set(Math.round(ax + ((bx - ax) * t) / n), Math.round(ay + ((by - ay) * t) / n), outline);
  }
}

/** An isometric view from the front-left (or the back-right): three faces per voxel, far to near. */
function iso(vox: Voxel[], fromBack: boolean, s: number, zScale = 1): Canvas {
  // turn the model (a rotation, not a mirror) so the viewer sits at +x', +y', above
  const pts = vox.map(v => ({ x: fromBack ? v.x : -v.x, y: fromBack ? v.y : -v.y, z: v.z, rgb: v.rgb }));
  const hz = s * zScale;
  const P = (x: number, y: number, z: number): [number, number] => [(y - x) * s, ((x + y) * s) / 2 - z * hz];
  const all = pts.flatMap(p => [P(p.x, p.y, p.z), P(p.x + 1, p.y + 1, p.z), P(p.x + 1, p.y, p.z + 1), P(p.x, p.y + 1, p.z + 1)]);
  const [minX, maxX] = range(all.map(q => q[0])), [minY, maxY] = range(all.map(q => q[1]));
  const c = new Canvas(Math.ceil(maxX - minX) + 4, Math.ceil(maxY - minY) + 4);
  const at = new Set(pts.map(p => `${p.x},${p.y},${p.z}`));
  const Q = (x: number, y: number, z: number): [number, number] => { const [a, b] = P(x, y, z); return [a - minX + 2, b - minY + 2]; };
  pts.sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
  for (const { x, y, z, rgb } of pts) {
    const line = shade(rgb, 0.75);
    if (!at.has(`${x},${y},${z + 1}`)) poly(c, [Q(x, y, z + 1), Q(x + 1, y, z + 1), Q(x + 1, y + 1, z + 1), Q(x, y + 1, z + 1)], shade(rgb, 1.06), line);
    if (!at.has(`${x},${y + 1},${z}`)) poly(c, [Q(x, y + 1, z), Q(x + 1, y + 1, z), Q(x + 1, y + 1, z + 1), Q(x, y + 1, z + 1)], shade(rgb, 0.86), line);
    if (!at.has(`${x + 1},${y},${z}`)) poly(c, [Q(x + 1, y, z), Q(x + 1, y + 1, z), Q(x + 1, y + 1, z + 1), Q(x + 1, y, z + 1)], shade(rgb, 0.68), line);
  }
  return c;
}

export interface ViewsOptions { cell?: number; iso?: number; zScale?: number; title?: string }

/** Front, right, back, left and top views in a row, and the two isometric views under them. */
export function renderViews(vox: Voxel[], dims: [number, number, number], o: ViewsOptions = {}): Buffer {
  const cell = o.cell ?? 8;
  const els = (['front', 'right', 'back', 'left', 'top'] as const).map(v => elevation(vox, v, cell, dims, o.zScale));
  const isos = [iso(vox, false, o.iso ?? 12, o.zScale), iso(vox, true, o.iso ?? 12, o.zScale)];
  const gap = 16;
  const W = Math.max(els.reduce((a, e) => a + e.w + gap, gap), isos.reduce((a, e) => a + e.w + gap, gap));
  const H = gap + Math.max(...els.map(e => e.h)) + gap + Math.max(...isos.map(e => e.h)) + gap;
  const out = new Canvas(W, H, [250, 251, 252]);
  let x = gap;
  for (const e of els) { out.blit(e, x, gap); x += e.w + gap; }
  x = gap;
  const y = gap + Math.max(...els.map(e => e.h)) + gap;
  for (const e of isos) { out.blit(e, x, y); x += e.w + gap; }
  return PNG.sync.write(out.png);
}

/** The 2D art itself, big, on a checkerboard so empty pixels show as empty. */
export function renderArt(cells: ([number, number, number] | null)[][], scale = 16): Buffer {
  const n = cells.length, c = new Canvas(n * scale, n * scale);
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const rgb = cells[r][col] ?? ((r + col) % 2 ? [226, 230, 236] : [244, 246, 249]);
    c.rect(col * scale, r * scale, scale, scale, rgb as [number, number, number]);
  }
  for (let i = 0; i <= n; i += 4) for (let j = 0; j < n * scale; j++) { c.set(i * scale, j, [180, 186, 196]); c.set(j, i * scale, [180, 186, 196]); }
  return PNG.sync.write(c.png);
}
