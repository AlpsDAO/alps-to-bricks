// Hand-made heads: a MagicaVoxel model at src/alps/heads/<head name>.vox (e.g. console-handheld.vox)
// replaces that head's automatic shape. Browser only (it uses Vite's file globbing).
import type { PunkGrid } from '../core/detect';
import { headName, type AlpSeed } from './alps';
import { readVox } from './vox';

const files = import.meta.glob('./heads/*.vox', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

/** The grid with its hand-made head attached, if there is one for this head. */
export async function withHeadModel(grid: PunkGrid, seed: AlpSeed): Promise<PunkGrid> {
  const load = files[`./heads/${headName(seed)}.vox`];
  if (!load) return grid;
  try {
    const res = await fetch(await load());
    return { ...grid, headModel: readVox(await res.arrayBuffer()) };
  } catch {
    return grid;   // the automatic head is always there to fall back on
  }
}

export const hasHeadModel = (seed: AlpSeed) => !!files[`./heads/${headName(seed)}.vox`];
