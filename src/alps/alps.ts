// Alps: 32×32 pixel characters whose traits (the "seed") live on Ethereum. An Alp's picture is drawn
// from its seed with the same image data the token contract uses, so there's no image to read: the
// grid is exact.
import type { PunkGrid } from '../core/detect';
import { hexToRgb, type RGB } from '../core/color';
import imageData from './image-data.json';

export const GRID = 32;

export interface AlpSeed { background: number; body: number; accessory: number; head: number; glasses: number }

const TOKEN = '0xf59eB3e1957F120f7C135792830F900685536f52';
const RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'];

/** Paint one run-length-encoded trait image onto the grid (0 = transparent). */
function paint(cells: number[][], hex: string) {
  const b = hex.slice(2).match(/../g)!.map(h => parseInt(h, 16));
  const [, top, right, , left] = b;
  let x = left, y = top;
  for (let i = 5; i + 1 < b.length; i += 2) {
    const [length, color] = [b[i], b[i + 1]];
    for (let n = 0; n < length; n++) {
      if (color !== 0) cells[y][x] = color;
      if (++x === right) { x = left; y++; }
    }
  }
}

/** The Alp's pixels, in the same shape a detected Punk has. Colour indices point into `colors`. */
export function alpGrid(seed: AlpSeed): PunkGrid {
  const pal = Array.from({ length: GRID }, () => Array(GRID).fill(0) as number[]);
  const { images, palette, bgcolors } = imageData;
  paint(pal, images.bodies[seed.body].data);
  paint(pal, images.accessories[seed.accessory].data);
  paint(pal, images.heads[seed.head].data);
  paint(pal, images.glasses[seed.glasses].data);
  const index = new Map<number, number>();
  const colors: { rgb: RGB; count: number }[] = [];
  const cells = pal.map(row => row.map(p => {
    if (p === 0) return -1;
    let k = index.get(p);
    if (k === undefined) { k = colors.length; index.set(p, k); colors.push({ rgb: hexToRgb(`#${palette[p]}`), count: 0 }); }
    colors[k].count++;
    return k;
  }));
  return { cells, colors, background: hexToRgb(`#${bgcolors[seed.background]}`), box: { x: 0, y: 0, size: GRID } };
}

/** Trait names, e.g. "head-console-handheld" → "Console handheld". */
export function traitNames(seed: AlpSeed) {
  const name = (f: string) => { const s = f.replace(/^[a-z]+-/, '').replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
  const { images } = imageData;
  return {
    head: name(images.heads[seed.head].filename),
    glasses: name(images.glasses[seed.glasses].filename),
    body: name(images.bodies[seed.body].filename),
    accessory: name(images.accessories[seed.accessory].filename),
  };
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
