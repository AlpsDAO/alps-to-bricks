// Build random trait combinations (Alps not minted yet) and report failures: npx tsx scripts/alps-random.ts <count> [mini|xl]
import { alpGrid } from '../src/alps/alps';
import imageData from '../src/alps/image-data.json';
import { buildModel, type SizeId } from '../src/core/build';

const count = +(process.argv[2] ?? 500), size = (process.argv[3] ?? 'mini') as SizeId;
let seedN = 12345;
const rand = (n: number) => { seedN = (seedN * 1103515245 + 12345) % 2 ** 31; return seedN % n; };
const { images, bgcolors } = imageData;
const fails: string[] = [];
const pcs: number[] = [];
for (let i = 0; i < count; i++) {
  const seed = { background: rand(bgcolors.length), body: rand(images.bodies.length), accessory: rand(images.accessories.length), head: rand(images.heads.length), glasses: rand(images.glasses.length) };
  const c = buildModel(alpGrid(seed), size).checks;
  pcs.push(c.pieces);
  if (c.floating || c.collisions || !c.com.inside) fails.push(`${JSON.stringify(seed)}: ${c.floating} floating, ${c.collisions} collisions, ${c.com.inside ? 'balanced' : 'tips'}`);
}
pcs.sort((a, b) => a - b);
console.log(`${size}: ${count} random, pieces min ${pcs[0]} median ${pcs[count >> 1]} max ${pcs[count - 1]}, ${fails.length} failing`);
fails.slice(0, 15).forEach(f => console.log('  ', f));
