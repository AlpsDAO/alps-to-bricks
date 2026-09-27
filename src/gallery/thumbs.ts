// Still renders of a model for the trait review page. One WebGL renderer for the whole page: each model
// is put in the scene, shot from three sides, copied into a 2D strip canvas, then taken out again.
import * as THREE from 'three';
import type { Model } from '../core/build';
import { COLOR_BY_ID, renderHex, TRANS_CLEAR } from '../core/palette';
import { geoKey, pieceGeometry } from '../viewer/geometry';
import { SKY } from '../viewer/scene';
import { PL } from '../viewer/timeline';

/** The three shots of every tile, left to right in the strip. Angles in degrees, 0 = straight at the face. */
export const VIEWS = [
  { id: 'front', label: '¾ front', az: 35, el: 14 },
  { id: 'side', label: 'Side', az: 90, el: 10 },
  { id: 'back', label: 'Back', az: 180, el: 14 },
] as const;

const STUD = 0.17;   // stud height, in the same units as PL
const FILL = 0.9;    // how much of the frame the model fills

export class ThumbRenderer {
  /** The last model's three shots side by side (size × 3 wide). Reused: copy it or snapshot it (toBlob) before the next render. */
  readonly strip = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2000);
  /** lights, turned with the camera so every side is lit the way the front is */
  private rig = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private floor: THREE.Mesh;
  private bust = new THREE.Group();
  private mats = new Map<number, THREE.Material>();

  constructor(readonly size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.gl.setPixelRatio(1); this.gl.setSize(size, size, false);
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.05;
    this.scene.background = SKY.clone();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.4));
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.8); fill.position.set(-25, 12, 10);
    this.rig.add(this.sun, fill);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.28, color: 0x1f4a6b }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true;
    this.scene.add(this.rig, this.floor, this.bust);
    this.strip.width = size * VIEWS.length; this.strip.height = size;
    this.ctx = this.strip.getContext('2d')!;
  }

  private mat(c: number): THREE.Material {
    let m = this.mats.get(c);
    if (!m) {
      const col = COLOR_BY_ID.get(c)!;
      m = col.trans
        ? new THREE.MeshPhysicalMaterial({ color: renderHex(c), roughness: 0.05, transparent: true, opacity: c === TRANS_CLEAR ? 0.35 : 0.8, depthWrite: c !== TRANS_CLEAR })
        : new THREE.MeshStandardMaterial({ color: renderHex(c), roughness: 0.32, metalness: 0 });
      this.mats.set(c, m);
    }
    return m;
  }

  /** Shoot the model from each of VIEWS into `strip`, and return it. */
  render(m: Model): HTMLCanvasElement {
    const P = m.pieces;
    // placed like the live viewer: centred on the base, front face towards +z
    const base = P.filter(p => p.group === 'base');
    const cx = (Math.min(...base.map(p => p.x)) + Math.max(...base.map(p => p.x + p.w))) / 2;
    const cz = (Math.min(...base.map(p => p.z)) + Math.max(...base.map(p => p.z + p.d))) / 2;
    const byKey = new Map<string, number[]>();
    P.forEach((p, i) => { const k = geoKey(p) + '|' + p.c; byKey.set(k, [...(byKey.get(k) ?? []), i]); });
    const m4 = new THREE.Matrix4();
    for (const ids of byKey.values()) {
      const p0 = P[ids[0]];
      const mesh = new THREE.InstancedMesh(pieceGeometry(p0), this.mat(p0.c), ids.length);
      ids.forEach((i, j) => { const p = P[i]; mesh.setMatrixAt(j, m4.makeTranslation(p.x + p.w / 2 - cx, p.y * PL, -(p.z + p.d / 2) + cz)); });
      mesh.castShadow = !COLOR_BY_ID.get(p0.c)!.trans; mesh.receiveShadow = true; mesh.frustumCulled = false;
      this.bust.add(mesh);
    }

    const lo = new THREE.Vector3(Math.min(...P.map(p => p.x)) - cx, Math.min(...P.map(p => p.y)) * PL, cz - Math.max(...P.map(p => p.z + p.d)));
    const hi = new THREE.Vector3(Math.max(...P.map(p => p.x + p.w)) - cx, Math.max(...P.map(p => p.y + p.h)) * PL + STUD, cz - Math.min(...P.map(p => p.z)));
    const box = new THREE.Box3(lo, hi), centre = box.getCenter(new THREE.Vector3());
    const s = (hi.y - lo.y) / 42;   // lights and shadow sized like the booklet's
    this.sun.position.set(36 * s, 80 * s, 52 * s);
    Object.assign(this.sun.shadow.camera, { left: -40 * s, right: 40 * s, top: 50 * s, bottom: -20 * s, near: 1, far: 260 * s });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.floor.position.y = lo.y;

    // one distance for all three shots, so they share a scale
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z).sub(centre));
    const tan = Math.tan((this.camera.fov * Math.PI) / 360) * FILL;
    const dirs = VIEWS.map(v => {
      const a = (v.az * Math.PI) / 180, e = (v.el * Math.PI) / 180;
      return { a, dir: new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)) };
    });
    let dist = 0;
    for (const { dir } of dirs) {
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
      const up = new THREE.Vector3().crossVectors(dir, right);
      // a corner at depth z (towards the camera) and offset x fits once dist ≥ z + |x| / tan
      for (const c of corners) {
        const z = c.dot(dir);
        dist = Math.max(dist, z + Math.abs(c.dot(right)) / tan, z + Math.abs(c.dot(up)) / tan);
      }
    }

    this.ctx.clearRect(0, 0, this.strip.width, this.strip.height);
    dirs.forEach(({ a, dir }, i) => {
      this.camera.position.copy(centre).addScaledVector(dir, dist);
      this.camera.lookAt(centre);
      this.rig.rotation.y = a;
      this.gl.render(this.scene, this.camera);
      this.ctx.drawImage(this.gl.domElement, i * this.size, 0);
    });

    for (const o of [...this.bust.children]) (o as THREE.InstancedMesh).dispose();   // geometry and materials are shared
    this.bust.clear();
    return this.strip;
  }
}
