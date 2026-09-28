// Hand-made heads: src/alps/heads/<head name>.json (see HEADS.md) or .vox (MagicaVoxel), e.g.
// wine-barrel.json, replacing that head's automatic shape. Browser only (it uses Vite's file globbing).
import type { PunkGrid } from '../core/detect';
import { headName, type AlpSeed } from './alps';
import { readHeadFile } from './headModel';
import { readVox } from './vox';

const json = import.meta.glob('./heads/*.json', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const vox = import.meta.glob('./heads/*.vox', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

/** The grid with its hand-made head attached, if there is one for this head. */
export async function withHeadModel(grid: PunkGrid, seed: AlpSeed): Promise<PunkGrid> {
  const name = headName(seed);
  try {
    const text = json[`./heads/${name}.json`];
    if (text) return { ...grid, headModel: readHeadFile(await text()).model };
    const url = vox[`./heads/${name}.vox`];
    if (url) return { ...grid, headModel: readVox(await (await fetch(await url())).arrayBuffer()) };
  } catch {
    // the automatic head is always there to fall back on
  }
  return grid;
}

export const hasHeadModel = (seed: AlpSeed) => !!(json[`./heads/${headName(seed)}.json`] || vox[`./heads/${headName(seed)}.vox`]);
