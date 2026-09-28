// Alps: 32×32 pixel characters whose traits (the "seed") live on Ethereum. An Alp's picture is drawn
// from its seed with the same image data the token contract uses, so there's no image to read: the
// grid is exact.
import { PART, type GridStyle, type HeadShape, type PunkGrid, type Wrap } from '../core/detect';
import { hexToRgb, type RGB } from '../core/color';
import imageData from './image-data.json';
import traits3d from './traits3d.json';

export const GRID = 32;

export interface AlpSeed { background: number; body: number; accessory: number; head: number; glasses: number }

const TOKEN = '0xf59eB3e1957F120f7C135792830F900685536f52';
const RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'];

/** Paint one run-length-encoded trait image onto the grid (0 = transparent), noting which trait drew each pixel. */
function paint(cells: number[][], parts: number[][], part: number, hex: string) {
  const b = hex.slice(2).match(/../g)!.map(h => parseInt(h, 16));
  const [, top, right, , left] = b;
  let x = left, y = top;
  for (let i = 5; i + 1 < b.length; i += 2) {
    const [length, color] = [b[i], b[i + 1]];
    for (let n = 0; n < length; n++) {
      if (color !== 0) { cells[y][x] = color; parts[y][x] = part; }
      if (++x === right) { x = left; y++; }
    }
  }
}

/** How each trait is modelled in 3D, by name without its prefix ("head-console-handheld" → "console-handheld") */
const spec = traits3d as {
  // clear: colours of the head shown in see-through bricks (a stream of wine, a glass), as hex
  heads: Record<string, { shape: HeadShape; rods?: boolean; clear?: string[] }>;
  accessories: Record<string, { wrap: Wrap }>;
  bodies: Record<string, { wrap: Wrap }>;
};
const bare = (filename: string) => filename.replace(/^[a-z]+-/, '');
/** The head's name without its prefix, as hand-made head files are named: "console-handheld" */
export const headName = (seed: AlpSeed) => bare(imageData.images.heads[seed.head].filename);
export function styleOf(seed: AlpSeed): GridStyle {
  const { images } = imageData;
  const head = spec.heads[bare(images.heads[seed.head].filename)];
  return {
    head: head?.shape,
    rods: head?.rods,
    accessory: spec.accessories[bare(images.accessories[seed.accessory].filename)]?.wrap,
    body: spec.bodies[bare(images.bodies[seed.body].filename)]?.wrap,
  };
}

/** The Alp's pixels, in the same shape a detected Punk has. Colour indices point into `colors`. */
export function alpGrid(seed: AlpSeed, opts: { without?: ('glasses' | 'accessory')[] } = {}): PunkGrid {
  const pal = Array.from({ length: GRID }, () => Array(GRID).fill(0) as number[]);
  const parts = Array.from({ length: GRID }, () => Array(GRID).fill(-1) as number[]);
  const { images, palette, bgcolors } = imageData;
  paint(pal, parts, PART.body, images.bodies[seed.body].data);
  if (!opts.without?.includes('accessory')) paint(pal, parts, PART.accessory, images.accessories[seed.accessory].data);
  paint(pal, parts, PART.head, images.heads[seed.head].data);
  // what the head looks like under its glasses (every head is drawn whole, the glasses go on top)
  const headUnder = pal.map((row, r) => row.map((p, c) => (parts[r][c] === PART.head ? p : 0)));
  // without its glasses, a head shows its whole face: the starting point for modelling it
  if (!opts.without?.includes('glasses')) paint(pal, parts, PART.glasses, images.glasses[seed.glasses].data);
  // the head's see-through colours get their own entries, so the same colour elsewhere stays solid
  const clear = new Set(spec.heads[bare(images.heads[seed.head].filename)]?.clear ?? []);
  const index = new Map<string, number>();
  const colors: { rgb: RGB; count: number; clear?: boolean }[] = [];
  const indexOf = (p: number) => {
    let k = index.get(String(p));
    if (k === undefined) { k = colors.length; index.set(String(p), k); colors.push({ rgb: hexToRgb(`#${palette[p]}`), count: 0 }); }
    return k;
  };
  const cells = pal.map((row, r) => row.map((p, c) => {
    if (p === 0) return -1;
    const see = parts[r][c] === PART.head && clear.has(palette[p]);
    const id = see ? `${p}:clear` : String(p);
    let k = index.get(id);
    if (k === undefined) { k = colors.length; index.set(id, k); colors.push({ rgb: hexToRgb(`#${palette[p]}`), count: 0, ...(see ? { clear: true } : {}) }); }
    colors[k].count++;
    return k;
  }));
  const under = pal.map((row, r) => row.map((_, c) => (parts[r][c] === PART.glasses && headUnder[r][c] ? indexOf(headUnder[r][c]) : -1)));
  return { cells, colors, background: hexToRgb(`#${bgcolors[seed.background]}`), box: { x: 0, y: 0, size: GRID }, parts, under, style: styleOf(seed) };
}

/** Trait names, e.g. "head-console-handheld" → "Console handheld". */
const traitName = (f: string) => { const s = f.replace(/^[a-z]+-/, '').replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
export function traitNames(seed: AlpSeed) {
  const { images } = imageData;
  return {
    head: traitName(images.heads[seed.head].filename),
    glasses: traitName(images.glasses[seed.glasses].filename),
    body: traitName(images.bodies[seed.body].filename),
    accessory: traitName(images.accessories[seed.accessory].filename),
  };
}

/** Every trait an Alp can have, for designing your own: in the order they're picked */
export const TRAITS: { key: keyof AlpSeed; label: string; names: string[] }[] = [
  { key: 'head', label: 'Head', names: imageData.images.heads.map(i => traitName(i.filename)) },
  { key: 'glasses', label: 'Glasses', names: imageData.images.glasses.map(i => traitName(i.filename)) },
  { key: 'body', label: 'Body', names: imageData.images.bodies.map(i => traitName(i.filename)) },
  { key: 'accessory', label: 'Accessory', names: imageData.images.accessories.map(i => traitName(i.filename)) },
  // the same names the Playground uses
  { key: 'background', label: 'Background', names: ['Bluebird sky', 'Evergreen', 'Night', 'Slate', 'Yellow snow', 'Cool', 'Warm'] },
];

export const randomSeed = (): AlpSeed =>
  Object.fromEntries(TRAITS.map(t => [t.key, Math.floor(Math.random() * t.names.length)])) as unknown as AlpSeed;

/** A seed in a link, in the contract's order: ?seed=background-body-accessory-head-glasses */
const ORDER: (keyof AlpSeed)[] = ['background', 'body', 'accessory', 'head', 'glasses'];
export const seedToParam = (s: AlpSeed) => ORDER.map(k => s[k]).join('-');
export function seedFromParam(p: string): AlpSeed | null {
  const v = p.split('-').map(Number);
  if (v.length !== 5 || v.some(n => !Number.isInteger(n) || n < 0)) return null;
  const seed = Object.fromEntries(ORDER.map((k, i) => [k, v[i]])) as unknown as AlpSeed;
  return TRAITS.every(t => seed[t.key] < t.names.length) ? seed : null;
}

async function ethCall(data: string): Promise<string> {
  let last: unknown;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: TOKEN, data }, 'latest'] }),
      });
      const json = await res.json();
      if (typeof json.result === 'string' && json.result.length > 2) return json.result;
      last = json.error;
    } catch (e) { last = e; }
  }
  throw new Error(`Couldn't reach Ethereum (${String((last as Error)?.message ?? last)})`);
}

/** How many Alps exist: Alps are numbered from 0, so the latest is this minus one. */
export async function alpCount(): Promise<number> {
  return parseInt(await ethCall('0x18160ddd'), 16);
}

const seedCache = new Map<number, AlpSeed>();
/** An Alp's seed, read from the token contract. */
export async function fetchSeed(id: number): Promise<AlpSeed> {
  const have = seedCache.get(id);
  if (have) return have;
  const h = (await ethCall(`0xf0503e80${id.toString(16).padStart(64, '0')}`)).slice(2);
  const [background, body, accessory, head, glasses] = [0, 1, 2, 3, 4].map(k => parseInt(h.slice(k * 64, (k + 1) * 64), 16));
  const seed = { background, body, accessory, head, glasses };
  // Alps that don't exist yet read back as all zeros
  if (Object.values(seed).every(v => v === 0) && id !== 0) throw new Error('not-minted');
  seedCache.set(id, seed);
  return seed;
}

/** A 32×32 canvas of the Alp on its background, for previews. */
export function drawAlp(canvas: HTMLCanvasElement, grid: PunkGrid) {
  const x = canvas.getContext('2d')!, k = canvas.width / GRID;
  const bg = grid.background;
  x.fillStyle = bg ? `rgb(${bg.join(',')})` : '#d5d7e1';
  x.fillRect(0, 0, canvas.width, canvas.height);
  grid.cells.forEach((row, r) => row.forEach((v, c) => {
    if (v < 0) return;
    x.fillStyle = `rgb(${grid.colors[v].rgb.join(',')})`;
    x.fillRect(c * k, r * k, k, k);
  }));
}
