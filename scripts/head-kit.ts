// Everything about a head, to model it from: npx tsx scripts/head-kit.ts <head name or number | all>
// Writes out/heads/<name>/: art.png (the head alone, big), alp.png (on an Alp), pixels.txt (the art as
// text), current.json (its current model: hand-made if there is one, else automatic) and current.png
// (that model drawn from every side). See HEADS.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { alpGrid, styleOf, traitNames } from '../src/alps/alps';
import { writeHeadFile } from '../src/alps/headModel';
import { headVoxels } from '../src/core/build';
import { PART } from '../src/core/detect';
import seeds from '../src/alps/seeds.json';
import { findHead, HEAD_NAMES, loadHeadModel, modelVoxels, testSeeds } from './lib/heads';
import { renderArt, renderViews } from './lib/render';

const arg = process.argv[2];
if (!arg) { console.log('Usage: npx tsx scripts/head-kit.ts <head name or number | all | list>'); process.exit(1); }
if (arg === 'list') {
  // which heads to model first: the ones minted Alps wear most, then the rest
  const worn = new Map<number, number>();
  for (const s of Object.values(seeds as Record<string, number[]>)) worn.set(s[3], (worn.get(s[3]) ?? 0) + 1);
  const order = HEAD_NAMES.map((name, index) => ({ name, index, n: worn.get(index) ?? 0, done: !!loadHeadModel(name) }))
    .sort((a, b) => b.n - a.n || a.index - b.index);
  console.log(`${order.filter(h => h.done).length} of ${order.length} heads hand-made. Most worn first (✓ = hand-made):`);
  for (const h of order) console.log(`${h.done ? '✓' : ' '} ${String(h.n).padStart(2)} × ${h.name} (#${h.index})`);
  process.exit(0);
}
const heads = arg === 'all' ? HEAD_NAMES.map((name, index) => ({ name, index })) : [findHead(arg)];
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

for (const { name, index } of heads) {
  const dir = `out/heads/${name}`;
  mkdirSync(dir, { recursive: true });
  const seed = testSeeds(index)[0];
  // the head alone (no glasses, no body): its whole face, as drawn
  const bare = alpGrid(seed, { without: ['glasses', 'accessory'] });
  const art = bare.cells.map((row, r) => row.map((v, c) => (v >= 0 && bare.parts![r][c] === PART.head ? bare.colors[v].rgb : null)));
  writeFileSync(`${dir}/art.png`, renderArt(art, 16));
  const withAlp = alpGrid(seed);
  writeFileSync(`${dir}/alp.png`, renderArt(withAlp.cells.map(row => row.map(v => (v >= 0 ? withAlp.colors[v].rgb : withAlp.background))), 12));
  // the art as text: one character per pixel, with the palette
  const keys = new Map<string, string>();
  const hex = (rgb: number[]) => rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  const rows = art.map(row => row.map(p => { if (!p) return '.'; const h = hex(p); if (!keys.has(h)) keys.set(h, KEYS[keys.size]); return keys.get(h)!; }).join(''));
  const minted = Object.entries(seeds as Record<string, number[]>).filter(([, s]) => s[3] === index).map(([id]) => `#${id}`);
  const style = styleOf(seed);
  writeFileSync(`${dir}/pixels.txt`, [
    `head-${name} (head #${index})`,
    `current style: shape ${style.head ?? 'round'}${style.rods ? ', rods' : ''}`,
    `worn by minted Alps: ${minted.join(' ') || 'none yet'}`,
    '', 'rows top (0) to bottom (31), columns left (0) to right (31), "." = empty:', '',
    ...rows.map((row, r) => `${String(r).padStart(2)} ${row}`),
    '', 'palette:', ...[...keys].map(([h, k]) => `  ${k} #${h}`), '',
  ].join('\n'));
  // its current model, as the text format to start from
  const hand = loadHeadModel(name);
  const model = hand?.model ?? headVoxels(alpGrid(seed, { without: ['glasses'] }));
  writeFileSync(`${dir}/current.json`, writeHeadFile(model, name, hand ? `hand-made (${hand.path})` : 'automatic: a starting point'));
  const depth = Math.max(8, ...model.voxels.map(v => v.y + 1));
  writeFileSync(`${dir}/current.png`, renderViews(modelVoxels(model), [32, depth, 32]));
  const t = traitNames(seed);
  console.log(`${name} (#${index}, "${t.head}"): ${keys.size} colours, ${hand ? `hand-made model ${hand.path}` : 'automatic model'} · worn by ${minted.length} minted Alp${minted.length === 1 ? '' : 's'} → ${dir}/`);
}
