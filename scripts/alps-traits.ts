// Every trait against every trait it can touch: head × glasses, head × body, head × accessory and
// body × accessory, with the other traits varied. About 108,000 Alps per size.
//   npx tsx scripts/alps-traits.ts <mini|xl> <shard> <shards> [lego]   → out/traits-<size>[-lego]-<shard>.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { alpGrid, type AlpSeed } from '../src/alps/alps';
import imageData from '../src/alps/image-data.json';
import { buildModel, type SizeId } from '../src/core/build';

const [size, shard, shards, lego] = [process.argv[2] as SizeId, +process.argv[3], +process.argv[4], process.argv[5] === 'lego'];
const { images, bgcolors } = imageData;
const n = { background: bgcolors.length, body: images.bodies.length, accessory: images.accessories.length, head: images.heads.length, glasses: images.glasses.length };
// the traits not being paired are spread over their whole range by a cheap hash of the pair
const pick = (a: number, b: number, salt: number, m: number) => (((a * 7919 + b * 104729 + salt * 1299709) >>> 0) % m);

export function* pairs(): Generator<AlpSeed> {
  for (let head = 0; head < n.head; head++) for (let glasses = 0; glasses < n.glasses; glasses++)
    yield { head, glasses, body: pick(head, glasses, 1, n.body), accessory: pick(head, glasses, 2, n.accessory), background: pick(head, glasses, 3, n.background) };
  for (let head = 0; head < n.head; head++) for (let body = 0; body < n.body; body++)
    yield { head, body, glasses: pick(head, body, 4, n.glasses), accessory: pick(head, body, 5, n.accessory), background: pick(head, body, 6, n.background) };
  for (let head = 0; head < n.head; head++) for (let accessory = 0; accessory < n.accessory; accessory++)
    yield { head, accessory, glasses: pick(head, accessory, 7, n.glasses), body: pick(head, accessory, 8, n.body), background: pick(head, accessory, 9, n.background) };
  for (let body = 0; body < n.body; body++) for (let accessory = 0; accessory < n.accessory; accessory++)
    yield { body, accessory, head: pick(body, accessory, 10, n.head), glasses: pick(body, accessory, 11, n.glasses), background: pick(body, accessory, 12, n.background) };
}

if (!Number.isNaN(shard)) {
  const fails: { seed: AlpSeed; floating: number; collisions: number; balanced: boolean }[] = [];
  let i = 0, done = 0, pieces = 0, maxPieces = 0;
  const t0 = Date.now();
  for (const seed of pairs()) {
    if (i++ % shards !== shard) continue;
    const c = buildModel(alpGrid(seed), size, lego ? { preferLego: true } : {}).checks;
    done++; pieces += c.pieces; maxPieces = Math.max(maxPieces, c.pieces);
    if (c.floating || c.collisions || !c.com.inside) fails.push({ seed, floating: c.floating, collisions: c.collisions, balanced: c.com.inside });
  }
  mkdirSync('out', { recursive: true });
  writeFileSync(`out/traits-${size}${lego ? '-lego' : ''}-${shard}.json`, JSON.stringify({ done, fails, avgPieces: Math.round(pieces / done), maxPieces, s: Math.round((Date.now() - t0) / 1000) }));
  console.log(`shard ${shard}: ${done} built, ${fails.length} failing, ${Math.round((Date.now() - t0) / 1000)} s`);
}
