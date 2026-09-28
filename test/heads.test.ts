// Every hand-made head (src/alps/heads, see HEADS.md) reads cleanly, matches its art from the front, and
// builds solid wearing every family of glasses, in Mini and XL.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { alpGrid } from '../src/alps/alps';
import { buildModel } from '../src/core/build';
import { PART } from '../src/core/detect';
import { findHead, loadHeadModel, testSeeds } from '../scripts/lib/heads';

const [shard, shards] = (process.env.HEAD_SHARD ?? '0/1').split('/').map(Number);
if (!Number.isInteger(shards) || shards < 1 || !Number.isInteger(shard) || shard < 0 || shard >= shards) throw new Error('HEAD_SHARD must be index/count');
const files = readdirSync('src/alps/heads').filter(f => /\.(json|vox)$/.test(f)).sort().filter((_,i) => i % shards === shard);

describe('hand-made heads', () => {
  it('are each named after a head', () => {
    for (const f of files) expect(() => findHead(f.replace(/\.(json|vox)$/, '')), f).not.toThrow();
  });
  for (const f of files) {
    const name = f.replace(/\.(json|vox)$/, '');
    it(`${name}: reads cleanly, is its art from the front, and builds solid`, () => {
      const { index } = findHead(name);
      const loaded = loadHeadModel(name)!;
      expect(loaded.problems, loaded.problems.join('; ')).toEqual([]);
      const art = alpGrid(testSeeds(index)[0], { without: ['glasses', 'accessory'] });
      const artAt = new Set<string>();
      art.cells.forEach((row, r) => row.forEach((v, c) => { if (v >= 0 && art.parts![r][c] === PART.head) artAt.add(`${r},${c}`); }));
      const front = new Set(loaded.model.voxels.map(v => `${31 - v.z},${v.x}`));
      expect([...front].filter(k => !artAt.has(k)), 'voxels where the art is empty').toEqual([]);
      expect([...artAt].filter(k => !front.has(k)), 'art pixels with no voxel').toEqual([]);
      // Silhouette equality alone would miss mirrored or incorrectly painted faces.
      const nearest = new Map<string, typeof loaded.model.voxels[number]>();
      for (const v of loaded.model.voxels) {
        const k = `${31-v.z},${v.x}`;
        if (!nearest.has(k) || v.y < nearest.get(k)!.y) nearest.set(k, v);
      }
      for (const [k,v] of nearest) {
        const [r,c] = k.split(',').map(Number);
        expect(v.rgb, `${name} front RGB at ${k}`).toEqual(art.colors[art.cells[r][c]].rgb);
      }
      const width = Math.max(...loaded.model.voxels.map(v=>v.x))-Math.min(...loaded.model.voxels.map(v=>v.x))+1;
      expect(Math.max(...loaded.model.voxels.map(v=>v.y))+1, 'depth exceeds width').toBeLessThanOrEqual(width);

      for (const size of ['mini', 'xl'] as const) for (const seed of testSeeds(index)) {
        const c = buildModel({ ...alpGrid(seed), headModel: loaded.model }, size).checks;
        const why = `${size} ${JSON.stringify(seed)}`;
        expect(c.floating, why).toBe(0);
        expect(c.collisions, why).toBe(0);
        expect(c.com.inside, why).toBe(true);
      }
    }, 300_000);
  }
});
