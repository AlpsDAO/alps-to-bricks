// Small symbols that must survive colour matching: the A on every goggle clip (rows 12–14, columns 7–9)
// and the 🤘 in every gnargles bridge (rows 11–14, columns 15–17). npx tsx scripts/alps-symbols.ts
import imageData from '../src/alps/image-data.json';
import { alpGrid } from '../src/alps/alps';
import { analyze } from '../src/core/analyze';
import { COLOR_BY_ID } from '../src/core/palette';

const { images } = imageData;
const head = images.heads.findIndex(i => i.filename === 'head-box');
let lost = 0;
images.glasses.forEach((gl, g) => {
  const grid = alpGrid({ background: 0, body: 0, accessory: 0, head: Math.max(0, head), glasses: g });
  const A = analyze(grid);
  const brick = (r: number, c: number) => (A.px[r][c] ? A.px[r][c]!.color : -1);
  const art = (r: number, c: number) => grid.cells[r][c];
  const gnargles = gl.filename.includes('gnargles');
  // pairs of pixels that differ in the art and must differ in bricks
  const pairs: [number, number, number, number][] = gnargles ? [[11, 15, 11, 14], [13, 16, 13, 15], [14, 17, 14, 16]] : [[12, 8, 12, 7], [13, 7, 13, 8], [14, 9, 14, 8]];
  const bad = pairs.filter(([r1, c1, r2, c2]) => art(r1, c1) !== art(r2, c2) && brick(r1, c1) === brick(r2, c2));
  if (bad.length) { lost++; console.log(`${gl.filename}: symbol lost (${bad.map(([r, c]) => COLOR_BY_ID.get(brick(r, c))?.name).join(', ')})`); }
});
console.log(`${lost} of ${images.glasses.length} glasses lose their symbol`);
