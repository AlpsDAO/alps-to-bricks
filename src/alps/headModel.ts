// Hand-made heads as plain text (src/alps/heads/<head name>.json), easy to write and review by hand or
// by a script: the head as slices from the front to the back, each slice a 32×32 grid of characters
// ('.' is empty), with a palette naming each character's colour. See HEADS.md for the full brief.
import type { RGB } from '../core/color';
import type { HeadModel } from '../core/detect';

export interface HeadFile {
  /** the head's name, as its trait file is called without "head-" (e.g. "wine-barrel") */
  head: string;
  /** what it is and how it's modelled, in a sentence or two */
  about?: string;
  /** voxels the head's front sits ahead of the torso's front (0 = flush, the default) */
  front?: number;
  /** character → colour, as hex ("#aaa6a4" or "aaa6a4") */
  palette: Record<string, string>;
  /** characters built in see-through bricks (a stream of wine, glass), e.g. ["e"] */
  clear?: string[];
  /** front to back (slice 0 is the front); each slice is 32 rows top to bottom, of 32 columns left to right */
  slices: string[][];
}

export const MAX_SLICES = 24;
const SIZE = 32;
const EMPTY = new Set(['.', ' ']);

/** Read a head file into voxels, with every problem listed rather than the first one thrown. */
export function readHeadFile(text: string): { model: HeadModel; file: HeadFile; problems: string[] } {
  const problems: string[] = [];
  let file: HeadFile;
  try { file = JSON.parse(text); } catch (e) { throw new Error(`Not valid JSON: ${(e as Error).message}`); }
  if (!file || typeof file !== 'object') throw new Error('The file should be a JSON object');
  if (typeof file.head !== 'string') problems.push('"head" should be the head\'s name, e.g. "wine-barrel"');
  if (!Array.isArray(file.slices) || !file.slices.length) throw new Error('"slices" should be a list of slices, front first');
  if (file.slices.length > MAX_SLICES) problems.push(`${file.slices.length} slices: at most ${MAX_SLICES}`);
  if (file.front !== undefined && (!Number.isInteger(file.front) || file.front < 0 || file.front >= file.slices.length)) problems.push('"front" should be a whole number of voxels, 0 or more');
  const palette = new Map<string, RGB>();
  for (const [ch, hex] of Object.entries(file.palette ?? {})) {
    const h = String(hex).replace(/^#/, '');
    if (ch.length !== 1 || EMPTY.has(ch)) { problems.push(`palette key "${ch}" should be one character, not "." or a space`); continue; }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) { problems.push(`palette "${ch}": "${hex}" isn't a 6-digit hex colour`); continue; }
    palette.set(ch, [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB);
  }
  const clear = new Set(Array.isArray(file.clear) ? file.clear : []);
  for (const ch of clear) if (!palette.has(ch)) problems.push(`"clear" lists "${ch}", which isn't in the palette`);
  const voxels: HeadModel['voxels'] = [];
  file.slices.forEach((slice, y) => {
    if (!Array.isArray(slice) || slice.length !== SIZE) { problems.push(`slice ${y}: should be ${SIZE} rows, has ${Array.isArray(slice) ? slice.length : 'none'}`); return; }
    slice.forEach((row, r) => {
      if (typeof row !== 'string' || row.length !== SIZE) { problems.push(`slice ${y}, row ${r}: should be ${SIZE} characters, has ${typeof row === 'string' ? row.length : 'none'}`); return; }
      [...row].forEach((ch, c) => {
        if (EMPTY.has(ch)) return;
        const rgb = palette.get(ch);
        if (!rgb) { problems.push(`slice ${y}, row ${r}, column ${c}: "${ch}" isn't in the palette`); return; }
        voxels.push({ x: c, y, z: SIZE - 1 - r, rgb, ...(clear.has(ch) ? { clear: true } : {}) });
      });
    });
  });
  return { model: { voxels, front: file.front ?? 0 }, file, problems: [...new Set(problems)].slice(0, 40) };
}

const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Write voxels as a head file (a starting point to edit). */
export function writeHeadFile(model: HeadModel, head: string, about?: string): string {
  const depth = Math.max(1, ...model.voxels.map(v => v.y + 1));
  const hexOf = (rgb: RGB) => rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  const keys = new Map<string, string>();
  const clearHex = new Set(model.voxels.filter(v => v.clear).map(v => hexOf(v.rgb)));
  for (const v of model.voxels) { const h = hexOf(v.rgb); if (!keys.has(h)) keys.set(h, KEYS[keys.size] ?? '?'); }
  const slices = Array.from({ length: depth }, () => Array.from({ length: SIZE }, () => Array(SIZE).fill('.') as string[]));
  for (const v of model.voxels) slices[v.y][SIZE - 1 - v.z][v.x] = keys.get(hexOf(v.rgb))!;
  const palette = Object.fromEntries([...keys].map(([h, k]) => [k, `#${h}`]));
  // one row of a slice per line keeps the grids readable and diffs small
  const lines = ['{', `  "head": ${JSON.stringify(head)},`];
  if (about) lines.push(`  "about": ${JSON.stringify(about)},`);
  if (model.front) lines.push(`  "front": ${model.front},`);
  lines.push(`  "palette": ${JSON.stringify(palette)},`);
  if (clearHex.size) lines.push(`  "clear": ${JSON.stringify([...clearHex].map(h => keys.get(h)))},`);
  lines.push('  "slices": [');
  slices.forEach((slice, i) => {
    lines.push('    [');
    slice.forEach((row, r) => lines.push(`      ${JSON.stringify(row.join(''))}${r < slice.length - 1 ? ',' : ''}`));
    lines.push(`    ]${i < slices.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]', '}');
  return lines.join('\n') + '\n';
}
