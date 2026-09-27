// Where a model's floating pieces are: npx tsx scripts/alps-debug.ts <id> [mini|xl]
import seeds from '../src/alps/seeds.json';
import { alpGrid } from '../src/alps/alps';
import { buildModel, type SizeId } from '../src/core/build';
import { COLOR_BY_ID } from '../src/core/palette';

const [id, size = 'mini'] = process.argv.slice(2);
const s = (seeds as Record<string, number[]>)[id];
const m = buildModel(alpGrid({ background: s[0], body: s[1], accessory: s[2], head: s[3], glasses: s[4] }), size as SizeId);
console.log(m.checks.pieces, 'pieces;', m.checks.floating, 'floating; notes:', m.notes);
const byY = new Map<number, string[]>();
for (const i of m.checks.floatingIds) {
  const p = m.pieces[i];
  byY.set(p.y, [...(byY.get(p.y) ?? []), `${p.kind} ${p.w}x${p.d} @x${p.x} z${p.z} ${COLOR_BY_ID.get(p.c)?.name}${p.support ? ' (support)' : ''}`]);
}
for (const [y, l] of [...byY].sort((a, b) => a[0] - b[0])) console.log(`y=${y}:`, l.join('; '));
