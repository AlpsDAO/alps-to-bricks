// Build every Alp in both sizes and report the checks: npx tsx scripts/alps-all.ts [mini|xl] [ids…]
import seeds from '../src/alps/seeds.json';
import { alpGrid } from '../src/alps/alps';
import { buildModel, type SizeId } from '../src/core/build';

const args = process.argv.slice(2);
const sizes = (args.filter(a => a === 'mini' || a === 'xl') as SizeId[]);
const ids = args.filter(a => /^\d+$/.test(a)).map(Number);
const all = Object.entries(seeds as Record<string, number[]>).map(([id, s]) => ({ id: +id, seed: { background: s[0], body: s[1], accessory: s[2], head: s[3], glasses: s[4] } }));
for (const size of sizes.length ? sizes : (['mini', 'xl'] as SizeId[])) {
  const fails: string[] = [];
  const pcs: number[] = [], ms: number[] = [];
  for (const { id, seed } of all.filter(a => !ids.length || ids.includes(a.id))) {
    const t = performance.now();
    const m = buildModel(alpGrid(seed), size);
    ms.push(performance.now() - t);
    pcs.push(m.checks.pieces);
    const c = m.checks;
    if (c.floating || c.collisions || !c.com.inside) fails.push(`#${id}: ${c.floating} floating, ${c.collisions} collisions, ${c.com.inside ? 'balanced' : 'tips'}`);
    if (ids.length) console.log(`#${id} ${size}: ${c.pieces} pieces, ${m.steps.length} steps, ${m.bom.length} lots, ${m.dims.join('×')} cm, weak ${c.weak}, notes: ${m.notes.join(' | ')}`);
  }
  pcs.sort((a, b) => a - b);
  console.log(`${size}: ${pcs.length} Alps, pieces min ${pcs[0]} median ${pcs[pcs.length >> 1]} max ${pcs[pcs.length - 1]}, avg ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} ms, ${fails.length} failing`);
  fails.slice(0, 20).forEach(f => console.log('  ', f));
}
