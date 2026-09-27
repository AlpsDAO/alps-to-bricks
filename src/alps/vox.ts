// MagicaVoxel .vox files, for hand-modelled heads: read one to replace a head's automatic shape, or
// write a head's automatic shape out as a starting point for modelling it.
//
// Layout of an Alp head model: x = pixel column (0–31, left to right as you look at the Alp), y = depth
// in pixels (0 = the front), z = height (0 = the bottom pixel row, 31 = the top). One voxel per pixel;
// Mini builds one stud per voxel, XL two. The front (y = 0) always shows the Alp's own pixels, whatever
// colour the model has there: models shape the sides, back and depth.
import type { RGB } from '../core/color';

export interface VoxModel {
  size: [number, number, number];
  voxels: { x: number; y: number; z: number; rgb: RGB }[];
}

const id = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** Read the first model of a .vox file (other chunks, like materials and scene graphs, are skipped). */
export function readVox(data: ArrayBuffer | Uint8Array): VoxModel {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (id(b, 0) !== 'VOX ') throw new Error('Not a MagicaVoxel .vox file');
  let size: [number, number, number] | null = null;
  let raw: { x: number; y: number; z: number; i: number }[] | null = null;
  let palette: RGB[] | null = null;
  // MAIN holds everything as children: walk the chunks after its 12-byte header
  for (let o = 8 + 12; o + 12 <= b.length;) {
    const name = id(b, o), content = v.getInt32(o + 4, true), children = v.getInt32(o + 8, true), c = o + 12;
    if (name === 'SIZE' && !size) size = [v.getInt32(c, true), v.getInt32(c + 4, true), v.getInt32(c + 8, true)];
    else if (name === 'XYZI' && !raw) {
      const n = v.getInt32(c, true);
      raw = Array.from({ length: n }, (_, k) => ({ x: b[c + 4 + 4 * k], y: b[c + 5 + 4 * k], z: b[c + 6 + 4 * k], i: b[c + 7 + 4 * k] }));
    } else if (name === 'RGBA') palette = Array.from({ length: 256 }, (_, k) => [b[c + 4 * k], b[c + 4 * k + 1], b[c + 4 * k + 2]] as RGB);
    o = c + content + children;
  }
  if (!size || !raw) throw new Error('The .vox file has no model');
  // colour index i points at palette entry i - 1; without an RGBA chunk MagicaVoxel's default palette
  // applies, which we can't reproduce here, so such voxels read as grey
  const rgbOf = (i: number): RGB => palette?.[i - 1] ?? [160, 165, 169];
  return { size, voxels: raw.map(r => ({ x: r.x, y: r.y, z: r.z, rgb: rgbOf(r.i) })) };
}

/** Write one model as a .vox file (version 150), with a palette of the colours it uses. */
export function writeVox(m: VoxModel): Uint8Array {
  const colours: string[] = [];
  const index = (rgb: RGB) => {
    const k = rgb.join(',');
    let i = colours.indexOf(k);
    if (i < 0) { if (colours.length === 255) throw new Error('A .vox palette holds at most 255 colours'); i = colours.length; colours.push(k); }
    return i + 1;
  };
  const xyzi = new Uint8Array(4 + 4 * m.voxels.length);
  new DataView(xyzi.buffer).setInt32(0, m.voxels.length, true);
  m.voxels.forEach((p, k) => xyzi.set([p.x, p.y, p.z, index(p.rgb)], 4 + 4 * k));
  const rgba = new Uint8Array(256 * 4);
  colours.forEach((k, i) => { const [r, g, b] = k.split(',').map(Number); rgba.set([r, g, b, 255], 4 * i); });
  const sizeC = new Uint8Array(12);
  m.size.forEach((n, i) => new DataView(sizeC.buffer).setInt32(4 * i, n, true));
  const chunk = (name: string, content: Uint8Array, children = new Uint8Array(0)) => {
    const out = new Uint8Array(12 + content.length + children.length);
    out.set([...name].map(ch => ch.charCodeAt(0)), 0);
    const dv = new DataView(out.buffer);
    dv.setInt32(4, content.length, true); dv.setInt32(8, children.length, true);
    out.set(content, 12); out.set(children, 12 + content.length);
    return out;
  };
  const kids = [chunk('SIZE', sizeC), chunk('XYZI', xyzi), chunk('RGBA', rgba)];
  const body = new Uint8Array(kids.reduce((a, k) => a + k.length, 0));
  kids.reduce((o, k) => { body.set(k, o); return o + k.length; }, 0);
  const main = chunk('MAIN', new Uint8Array(0), body);
  const file = new Uint8Array(8 + main.length);
  file.set([86, 79, 88, 32], 0);   // "VOX "
  new DataView(file.buffer).setInt32(4, 150, true);
  file.set(main, 8);
  return file;
}
