import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateHead, readArt } from '../scripts/heads/generate';
import { HEAD_NAMES } from '../scripts/lib/heads';
import { writeHeadFile } from '../src/alps/headModel';
import { recipes } from '../scripts/heads/recipes';

it('ships exactly the sculptures produced by the editable recipes', () => {
  for (const [i, name] of HEAD_NAMES.entries()) {
    const generated = writeHeadFile(generateHead(readArt(i)), name, recipes[name].about);
    expect(readFileSync(`src/alps/heads/${name}.json`, 'utf8'), name).toBe(generated);
  }
}, 60_000);

it('keeps the cow muzzle in front of a complete skull, without a pink rear face', () => {
  const model = generateHead(readArt(HEAD_NAMES.indexOf('cow')));
  const line = model.voxels.filter(v => v.x === 16 && v.z === 31 - 18).sort((a,b) => a.y-b.y);
  expect(line.length).toBeGreaterThan(4);
  expect(line[0].rgb).not.toEqual(line.at(-1)!.rgb);
  expect(line.at(-1)!.rgb).toEqual([244,244,244]);
});

it('gives the horizontal paper roll a recessed core and curved cross-section', () => {
  const model = generateHead(readArt(HEAD_NAMES.indexOf('toiletpaper')));
  const row = (r: number) => model.voxels.filter(v => v.x === 15 && v.z === 31-r);
  expect(row(8).length).toBeLessThan(row(11).length);
  expect(row(13).some(v => v.y === 6)).toBe(false);
  expect(row(13).some(v => v.y === 0)).toBe(true);
});
