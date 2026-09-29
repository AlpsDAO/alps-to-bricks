import { describe, expect, it } from 'vitest';
import { alpGrid } from '../src/alps/alps';
import { analyze } from '../src/core/analyze';
import { eyewearFront } from '../src/core/eyewear-style';
import { fitEyewear } from '../src/core/eyewear';
import { key } from '../src/core/tile';

describe('shared eyewear sculpture', () => {
  it('shares shape edits across colourways while keeping colour edits variant-specific', () => {
    const aqua = analyze(alpGrid({ head: 0, glasses: 0, body: 0, accessory: 0, background: 0 }));
    const black = analyze(alpGrid({ head: 0, glasses: 3, body: 0, accessory: 0, background: 0 }));
    const common = eyewearFront(aqua).find(c => c.depth === 0 &&
      eyewearFront(black).some(b => b.depth === 0 && b.row === c.row && b.x === c.x))!;
    const shape = [{ row: common.row, x: common.x, depth: 0, filled: false },
      { row: common.row, x: common.x + 1, depth: 2, filled: true }];
    for (const A of [aqua, black]) {
      const cells = eyewearFront(A, shape);
      expect(cells.some(c => c.row === common.row && c.x === common.x && c.depth === 0)).toBe(false);
      expect(cells.some(c => c.row === common.row && c.x === common.x + 1 && c.depth === 2)).toBe(true);
    }
    const aquaColour = eyewearFront(aqua, shape, [{ row: common.row, x: common.x, depth: 1, color: 999 }]);
    expect(aquaColour.find(c => c.row === common.row && c.x === common.x && c.depth === 1)?.color).toBe(999);
    expect(eyewearFront(black, shape).find(c => c.row === common.row && c.x === common.x && c.depth === 1)?.color).not.toBe(999);
  });

  it('keeps an authored backing block in the fitted frame', () => {
    const A = analyze(alpGrid({ head: 0, glasses: 0, body: 0, accessory: 0, background: 0 }));
    const original = eyewearFront(A).find(c => c.depth === 0)!;
    const rows = new Map<number, Map<number, number>>();
    const head = new Map<number, Set<number>>();
    for (const c of eyewearFront(A).filter(c => c.depth === 0)) {
      const own = head.get(c.row) ?? new Set<number>();
      own.add(key(c.x, 4)); head.set(c.row, own);
      const row = rows.get(c.row) ?? new Map<number, number>();
      row.set(key(c.x, 4), 1); rows.set(c.row, row);
    }
    const shape = [{ row: original.row, x: original.x, depth: 0, filled: false }];
    const frame = fitEyewear(A, rows, head, 1, shape);
    expect(frame.get(original.row)?.has(key(original.x, 2))).toBe(false);
    expect(frame.get(original.row)?.has(key(original.x, 3))).toBe(true);
  });
});
