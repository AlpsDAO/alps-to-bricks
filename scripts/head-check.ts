// Check a hand-made head: npx tsx scripts/head-check.ts <head name or number> [path/to/model.json|.vox]
// Reads src/alps/heads/<name>.json (or .vox, or the file given), lists anything wrong with it, builds
// it on 12 Alps (every glasses family, different bodies) in Mini and XL, and draws it to
// out/heads/<name>/: model.png (the model from every side), mini.png and xl.png (one of the builds).
// Exits with an error if the file has problems or any build doesn't hold together. See HEADS.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { alpGrid } from '../src/alps/alps';
import { buildModel } from '../src/core/build';
import { PART } from '../src/core/detect';
import { brickVoxels, findHead, loadHeadModel, modelVoxels, seedLink, testSeeds } from './lib/heads';
import { renderViews } from './lib/render';

const [arg, file] = process.argv.slice(2);
if (!arg) { console.log('Usage: npx tsx scripts/head-check.ts <head name or number> [model file]'); process.exit(1); }
const { name, index } = findHead(arg);
const loaded = loadHeadModel(name, file);
if (!loaded) { console.log(`No model for ${name}: add src/alps/heads/${name}.json (see HEADS.md), or give a file.`); process.exit(1); }
const { model, path, problems } = loaded;
const dir = `out/heads/${name}`;
mkdirSync(dir, { recursive: true });

// the art the model has to carry: every pixel of the head should have a voxel
const art = alpGrid(testSeeds(index)[0], { without: ['glasses', 'accessory'] });
const covered = new Set(model.voxels.map(v => `${31 - v.z},${v.x}`));
const missing: string[] = [];
art.cells.forEach((row, r) => row.forEach((v, c) => { if (v >= 0 && art.parts![r][c] === PART.head && !covered.has(`${r},${c}`)) missing.push(`(${r},${c})`); }));
if (missing.length) problems.push(`${missing.length} pixel${missing.length > 1 ? 's' : ''} of the art ha${missing.length > 1 ? 've' : 's'} no voxel (row, column): ${missing.slice(0, 12).join(' ')}${missing.length > 12 ? ' …' : ''}. The builder adds them flat at the front; model them instead.`);
// seen from the front, the model must be the art: no voxels where the head's art is empty
const artAt = new Set<string>();
art.cells.forEach((row, r) => row.forEach((v, c) => { if (v >= 0 && art.parts![r][c] === PART.head) artAt.add(`${r},${c}`); }));
const extra = [...new Set(model.voxels.filter(v => !artAt.has(`${31 - v.z},${v.x}`)).map(v => `(${31 - v.z},${v.x})`))];
if (extra.length) problems.push(`${extra.length} (row, column) position${extra.length > 1 ? 's have' : ' has'} voxels where the art is empty, so they'd show from the front and change the Alp: ${extra.slice(0, 12).join(' ')}${extra.length > 12 ? ' …' : ''}`);
// the head sits in rows 0–20, above the body, unless its art goes lower (the barrel's stream of wine)
const artRows = new Set(art.cells.flatMap((row, r) => (row.some((v, c) => v >= 0 && art.parts![r][c] === PART.head) ? [r] : [])));
const outside = model.voxels.filter(v => v.x < 0 || v.x > 31 || v.z < 0 || v.z > 31 || (31 - v.z > 20 && !artRows.has(31 - v.z)));
if (outside.length) problems.push(`${outside.length} voxel${outside.length > 1 ? 's' : ''} outside the head's space: keep to columns 0–31 and rows 0–20 (lower only where the head's art goes lower)`);
const depth = Math.max(...model.voxels.map(v => v.y + 1));

console.log(`${name} (#${index}) · ${path} · ${model.voxels.length} voxels, ${depth} deep${model.front ? `, front ${model.front} ahead of the torso` : ''}`);
for (const p of problems) console.log(`  ⚠ ${p}`);

writeFileSync(`${dir}/model.png`, renderViews(modelVoxels(model), [32, Math.max(8, depth), 32]));
let failing = 0;
const apart = { head: 0, glasses: 0 };
for (const size of ['mini', 'xl'] as const) {
  const rows: string[] = [];
  testSeeds(index).forEach((seed, i) => {
    const m = buildModel({ ...alpGrid(seed), headModel: model }, size), c = m.checks;
    const ok = c.floating === 0 && c.collisions === 0 && c.com.inside;
    if (!ok) failing++;
    if (c.head && c.head.parts > 1) apart.head++;
    if (c.glasses && c.glasses.parts > 1) apart.glasses++;
    const alone = `head ${c.head?.parts === 1 ? 'in one piece' : `in ${c.head?.parts ?? 0} parts`}, glasses ${c.glasses?.parts === 1 ? 'in one piece' : `in ${c.glasses?.parts ?? 0} parts`}`;
    rows.push(`${ok ? '✓' : '✗'} ${c.pieces} pieces, ${alone}${ok ? '' : ` · ${c.floating} floating, ${c.collisions} collisions${c.com.inside ? '' : ', tips over'}`} · ${seedLink(seed)}`);
    if (i === 0) { const { voxels, dims } = brickVoxels(m); writeFileSync(`${dir}/${size}.png`, renderViews(voxels, dims, { cell: size === 'xl' ? 3 : 5, iso: size === 'xl' ? 4 : 7, zScale: 0.4 })); }
  });
  console.log(`  ${size}:`); rows.forEach(r => console.log(`    ${r}`));
}
console.log(`  drawings: ${dir}/model.png, ${dir}/mini.png, ${dir}/xl.png`);
if (apart.head) console.log(`  ⚠ the head doesn't hold together on its own in ${apart.head} of 24 builds: give its details a solid core to hang from`);
if (apart.glasses) console.log(`  (the glasses come apart on their own in ${apart.glasses} builds: that's the builder's side, not the head's)`);
if (problems.length || failing) { console.log(`✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}, ${failing} build${failing === 1 ? '' : 's'} not holding together`); process.exit(1); }
console.log('✓ good to go');
