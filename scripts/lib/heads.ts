// Node helpers for modelling heads (see HEADS.md): find a head, load its hand-made model, pick Alps to
// test it on, and turn models and builds into voxels to draw.
import { existsSync, readFileSync } from 'node:fs';
import { hexToRgb } from '../../src/core/color';
import imageData from '../../src/alps/image-data.json';
import { type AlpSeed } from '../../src/alps/alps';
import { readHeadFile } from '../../src/alps/headModel';
import { readVox } from '../../src/alps/vox';
import type { HeadModel } from '../../src/core/detect';
import type { Model } from '../../src/core/build';
import { COLOR_BY_ID, renderHex } from '../../src/core/palette';
import type { Voxel } from './render';

const { images, bgcolors } = imageData;
export const HEAD_NAMES = images.heads.map(h => h.filename.replace(/^head-/, ''));

/** A head by name ("wine-barrel") or index ("244"). */
export function findHead(arg: string): { index: number; name: string } {
  const index = /^\d+$/.test(arg) ? +arg : HEAD_NAMES.indexOf(arg.replace(/^head-/, '').replace(/\.(json|vox)$/, ''));
  if (index < 0 || index >= HEAD_NAMES.length) throw new Error(`No head called "${arg}". Heads: ${HEAD_NAMES.slice(0, 8).join(', ')}, … (${HEAD_NAMES.length})`);
  return { index, name: HEAD_NAMES[index] };
}

export const modelPath = (name: string, ext: 'json' | 'vox') => `src/alps/heads/${name}.${ext}`;

/** The hand-made model for a head, if there is one (or the given file), with anything wrong with it. */
export function loadHeadModel(name: string, file?: string): { model: HeadModel; path: string; problems: string[] } | null {
  const path = file ?? (existsSync(modelPath(name, 'json')) ? modelPath(name, 'json') : existsSync(modelPath(name, 'vox')) ? modelPath(name, 'vox') : null);
  if (!path) return null;
  if (path.endsWith('.vox')) return { model: readVox(readFileSync(path)), path, problems: [] };
  const { model, file: f, problems } = readHeadFile(readFileSync(path, 'utf8'));
  if (f.head !== undefined && f.head !== name) problems.unshift(`"head" says "${f.head}" but the file is for "${name}"`);
  return { model, path, problems };
}

const byFamily = (family: string) => images.glasses.findIndex(g => g.filename.startsWith(`glasses-${family}`));
/** Alps to try a head on: one pair of glasses from every family, plain and busy bodies, every background. */
export function testSeeds(head: number): AlpSeed[] {
  const families = ['skoggles', 'snoggles', 'noggles', 'inuit', 'snowgoggles', 'gnargles'].map(byFamily);
  return families.flatMap((glasses, i) => [0, 1].map(j => ({
    head, glasses,
    body: (i * 5 + j * 11) % images.bodies.length,
    accessory: (i * 29 + j * 67 + 3) % images.accessories.length,
    background: (i + j * 3) % bgcolors.length,
  })));
}

export const modelVoxels = (m: HeadModel): Voxel[] => m.voxels.map(v => ({ x: v.x, y: v.y, z: v.z, rgb: v.rgb }));

/** A built model as voxels: one per stud and plate, coloured as the bricks look. */
export function brickVoxels(m: Model): { voxels: Voxel[]; dims: [number, number, number] } {
  const voxels: Voxel[] = [];
  let minX = Infinity, minZ = Infinity, minY = Infinity;
  for (const p of m.pieces) { minX = Math.min(minX, p.x); minZ = Math.min(minZ, p.z); minY = Math.min(minY, p.y); }
  for (const p of m.pieces) {
    const rgb = hexToRgb(COLOR_BY_ID.get(p.c) ? renderHex(p.c) : '#888888');
    for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) for (let h = 0; h < p.h; h++) {
      voxels.push({ x: p.x - minX + i, y: p.z - minZ + j, z: p.y - minY + h, rgb });
    }
  }
  const dims: [number, number, number] = [0, 0, 0];
  for (const v of voxels) { dims[0] = Math.max(dims[0], v.x + 1); dims[1] = Math.max(dims[1], v.y + 1); dims[2] = Math.max(dims[2], v.z + 1); }
  return { voxels, dims };
}

export const seedLink = (s: AlpSeed) => `https://bricks.alps.wtf/?seed=${[s.background, s.body, s.accessory, s.head, s.glasses].join('-')}`;
