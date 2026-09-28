/** Regenerate authored head models: node --import tsx scripts/heads/generate.ts [name | all].
 * Uses original RLE artwork as the exact front and an explicit recipe for EVERY head.
 * Surfaces behind the art are interpretations, not recovered/official 3D geometry. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import imageData from '../../src/alps/image-data.json';
import type { RGB } from '../../src/core/color';
import type { HeadModel } from '../../src/core/detect';
import { writeHeadFile } from '../../src/alps/headModel';
import { recipes, type Shape, type Pattern } from './recipes';

export interface Art { name: string; pixels: (string | null)[][]; palette: Record<string, string>; bounds: [number,number,number,number] }
const hexRgb = (h: string): RGB => [0,2,4].map(i => parseInt(h.replace('#','').slice(i,i+2),16)) as RGB;
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function readArt(index: number): Art {
  const h = imageData.images.heads[index], b = h.data.slice(2).match(/../g)!.map(x=>parseInt(x,16));
  const pixels: Art['pixels'] = Array.from({length:32},()=>Array(32).fill(null));
  const palette: Art['palette'] = {}, byHex = new Map<string,string>();
  let x=b[4], r=b[1];
  for(let i=5;i<b.length;i+=2) for(let n=0;n<b[i];n++) {
    if(b[i+1]) { const h='#'+imageData.palette[b[i+1]]; if(!byHex.has(h)){const k=KEYS[byHex.size];byHex.set(h,k);palette[k]=h;} pixels[r][x]=byHex.get(h)!; }
    if(++x===b[2]){x=b[4];r++;}
  }
  const points=pixels.flatMap((row,r)=>row.flatMap((v,x)=>v ? [[x,r]] : []));
  return {name:h.filename.replace(/^head-/,''),pixels,palette,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
}
const mode = (items: string[]) => {
  const tally = new Map<string,number>(); for(const k of items)tally.set(k,(tally.get(k)??0)+1);
  return [...tally].sort((a,b)=>b[1]-a[1])[0]?.[0];
};
export function generateHead(art: Art): HeadModel {
  const recipe=recipes[art.name]; if(!recipe)throw Error(`Missing explicit recipe: ${art.name}`);
  const {pixels,palette}=art;
  const dominant = mode(pixels.flat().filter((k): k is string=>!!k));
  const resolve=(key?:string)=>key?.startsWith('#') ? key : palette[key??dominant];
  const D=Math.max(recipe.depth,...(recipe.details??[]).map(d=>d.depth+(d.at??0)));
  const voxels: HeadModel['voxels']=[];
  // A detail's bounds come from occupied pixels, not the nominal rectangle: local round forms
  // must not be centred in surrounding transparent space.
  const occupiedBounds=(rect: Art['bounds']):Art['bounds']=> {
    const pts=pixels.flatMap((row,r)=>row.flatMap((k,x)=>k && x>=rect[0]&&x<=rect[2]&&r>=rect[1]&&r<=rect[3] ? [[x,r]]:[]));
    return pts.length ? [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))] : rect;
  };
  // Body bounds exclude explicitly modelled stems, taps, handles, limbs etc.
  const bodyPts=pixels.flatMap((row,r)=>row.flatMap((k,x)=> k && !(recipe.details??[]).some(d=>!d.surface&&x>=d.rect[0]&&x<=d.rect[2]&&r>=d.rect[1]&&r<=d.rect[3]&&(!d.colors||d.colors.includes(k))) ? [[x,r]]:[]));
  let body: Art['bounds']=bodyPts.length ? [Math.min(...bodyPts.map(p=>p[0])),Math.min(...bodyPts.map(p=>p[1])),Math.max(...bodyPts.map(p=>p[0])),Math.max(...bodyPts.map(p=>p[1]))] : art.bounds;
  // Broad shape overrides (roof, cap, seat) should not collapse the main body's horizontal centre.
  if(body[2]-body[0]<3)body=art.bounds;
  if(recipe.bodyBounds)body=recipe.bodyBounds;
  const detailBounds=(recipe.details??[]).map(d=>occupiedBounds(d.rect));
  const rows = pixels.map(row=>mode(row.filter((k): k is string=>!!k))??dominant);
  const cx=(body[0]+body[2])/2;
  const skin=resolve(recipe.material);
  const colors=Object.values(palette);
  const dark=colors.reduce((a,b)=>hexRgb(a).reduce((a,b)=>a+b)<hexRgb(b).reduce((a,b)=>a+b)?a:b);
  const surface=(pattern: Pattern,x:number,r:number,y:number,bounds:Art['bounds'],base:string):string=> {
    const theta=Math.atan2((y-(D-1)/2)/(D/2),(x-cx)/Math.max(1,(body[2]-body[0]+1)/2));
    const stripe=Math.floor((theta+Math.PI)*8/Math.PI);
    if(pattern==='staves') {
      if(r===3)return x%4===0 ? palette.c : palette.d; // oak lid inside the original iron front rim
      if([7,8,15,16,20].includes(r))return palette.a;
      return Math.abs(Math.sin(theta*8))<0.27 ? palette.c : (stripe%2 ? palette.b : palette.d);
    }
    if(pattern==='faberge') {
      if([1,10,11,19].includes(r))return palette.a;
      if([12,20].includes(r))return palette.e;
      if(r<10 && ((stripe+r)%5===0 || (stripe-r+40)%5===0))return palette.a;
      if(r===7 && stripe%4===0)return palette.d;
      return palette.b;
    }
    if(pattern==='bands')return palette[rows[r]];
    if(pattern==='grain') {const col=mode(pixels.map(row=>row[x]).filter((k):k is string=>!!k)); return palette[col??dominant];}
    if(pattern==='earth') {
      const land=(Math.sin(theta*3 + r*.19)+Math.cos(theta*5-r*.41)+Math.sin(r*.77))>0.9;
      return land ? '#3de85a' : '#3084f5';
    }
    if(pattern==='seams') {
      const equator=Math.round((bounds[1]+bounds[3])/2);
      const seam=r===equator || Math.abs(Math.sin(theta*2))<.10;
      const seamColor=art.name==='baseball-gameball' ? '#ff6380' : art.name==='basketball' ? '#b5671b' : '#cbc9b8';
      return seam?seamColor:base;
    }
    if(pattern==='igloo') {
      return r%4===0 || (Math.floor((theta+Math.PI)*6/Math.PI)+(Math.floor(r/4)%2)*2)%5===0 ? (art.name==='igloo'?'#83c9ed':'#bd6045') : base;
    }
    if(pattern==='lobes')return Math.abs(Math.sin(theta*6+r*.12))<.18 ? '#'+hexRgb(base).map(v=>Math.round(v*.83).toString(16).padStart(2,'0')).join('') : base;
    if(pattern==='spots')return ((x*13+r*7+y*17)%53<3) ? (colors.find(c=>c!==base && c!==dark)??base) : base;
    if(pattern==='panels') {
      // Rear casing details only; no duplicated face, display, eye or logo.
      const bx0=bounds[0], bx1=bounds[2], r0=bounds[1], r1=bounds[3];
      const rear=y===D-1;
      const panel='#'+hexRgb(base).map(v=>Math.round(v*.7).toString(16).padStart(2,'0')).join('');
      if(rear && r>=r1-5 && r<=r1-2 && x>=bx0+3&&x<=bx1-3 && (r===r1-5 || r===r1-2 || x===bx0+3 || x===bx1-3))return panel;
      if(rear && r>=r0+3&&r<=r0+6 && x>bx0+3&&x<bx1-3 && x%3===0)return panel;
    }
    return base;
  };
  for(let r=0;r<32;r++)for(let x=0;x<32;x++) {
    const key=pixels[r][x];if(!key)continue;
    let relief=false;
    let bounds=body, shape:Shape=recipe.shape, depth=recipe.depth, at:number|undefined, material=skin, pattern:Pattern=recipe.pattern??'plain';
    for(let i=0;i<(recipe.details??[]).length;i++) {
      const d=recipe.details![i], b=d.rect;
      if(x>=b[0]&&x<=b[2]&&r>=b[1]&&r<=b[3]&&(!d.colors||d.colors.includes(key))) {
        relief=!!d.surface;
        bounds=detailBounds[i];shape=d.shape??'box';depth=d.depth;at=d.at;pattern=d.pattern??'plain';
        const regionKeys=pixels.slice(bounds[1],bounds[3]+1).flatMap(row=>row.slice(bounds[0],bounds[2]+1)).filter((k):k is string=>!!k);
        const casing=/screen|display|door|visor|key deck/.test(d.label);
        material=d.material ? resolve(d.material) : casing ? skin : palette[mode(regionKeys)??dominant];
      }
    }
    if(recipe.wrapColors?.includes(key))material=palette[key];
    let span=depth;
    const u=(x-(bounds[0]+bounds[2])/2)/Math.max(1,(bounds[2]-bounds[0]+1)/2);
    const v=(r-(bounds[1]+bounds[3])/2)/Math.max(1,(bounds[3]-bounds[1]+1)/2);
    if(shape==='round')span=Math.max(Math.min(3,depth), Math.round(depth*Math.sqrt(Math.max(0,1-u*u-v*v))));
    if(shape==='roll')span=Math.max(3,Math.round(depth*Math.sqrt(Math.max(0,1-v*v))));
    if(shape==='disc')span=Math.max(1,depth-(Math.abs(u)>.85 || Math.abs(v)>.85?1:0));
    if(shape==='wedge')span=Math.max(2,Math.round(depth*(1-Math.abs(v)*.8)));
    if(shape==='ridge')span=Math.max(2,Math.round(depth*(1-Math.abs(u)*.75)));
    if(shape==='lathe' || shape==='pyramid') {
      const rowXs=pixels[r].flatMap((k,c)=>k&&c>=bounds[0]&&c<=bounds[2] ? [c]:[]);
      const lo=Math.min(...rowXs),hi=Math.max(...rowXs), width=hi-lo+1;
      const ur=(x-(lo+hi)/2)/Math.max(1,width/2);
      const rowDepth=Math.min(depth,Math.max(1,Math.round(depth*width/(bounds[2]-bounds[0]+1))));
      span=shape==='pyramid' ? rowDepth : Math.max(1,Math.round(rowDepth*Math.sqrt(Math.max(0,1-ur*ur))));
    }
    if(shape==='tube') {
      // Distance from the 2D boundary rounds local wires, limbs and annular tubes.
      let distance=depth;
      for(let dr=-depth;dr<=depth;dr++)for(let dx=-depth;dx<=depth;dx++)if(!pixels[r+dr]?.[x+dx])distance=Math.min(distance,Math.hypot(dx,dr));
      span=Math.min(depth,Math.max(1,Math.round(2*distance)));
    }
    span=Math.min(depth,Math.max(1,span));
    const start=at??Math.floor((D-span)/2);
    let end=start+span;
    if(relief) {
      const bu=(x-(body[0]+body[2])/2)/Math.max(1,(body[2]-body[0]+1)/2);
      const bv=(r-(body[1]+body[3])/2)/Math.max(1,(body[3]-body[1]+1)/2);
      const core=Math.max(3,Math.round(recipe.depth*Math.sqrt(Math.max(0,1-bu*bu-bv*bv))));
      end=Math.max(end,Math.floor((D-core)/2)+core);
    }
    for(let y=start;y<end;y++) {
      // Horizontal core is recessed behind the exact visible paper artwork.
      if(art.name==='toiletpaper' && y>start && (r-13.5)**2+(y-6.5)**2<4)continue;
      if(art.name==='mug' && r>=8&&r<18 && x>body[0]+1&&x<body[2]-1 && y>start&&y<start+span-1)continue;
      if(art.name==='wine' && r<10 && y>start&&y<start+span-1)continue;
      // EXACT RGB artwork at the first occupied voxel. No palette quantisation until brick building.
      const hex=y===start ? palette[key] : surface(pattern,x,r,y,bounds,relief&&y>=start+span ? skin : material);
      voxels.push({x,y,z:31-r,rgb:hexRgb(hex),...((art.name==='wine-barrel'&&key==='e') || (art.name==='wine'&& (r<10 || y===start || y===start+span-1)) ? {clear:true}: {})});
    }
  }
  // Keep all authored slices non-negative and the head centred above the 8-voxel torso.
  return {voxels,front:Math.max(0,Math.floor((D-8)/2))};
}
export function projectionComponents(art: Art): number {
  const todo=new Set(art.pixels.flatMap((row,r)=>row.flatMap((v,x)=>v?[r*32+x]:[])));let n=0;
  while(todo.size){n++;const q=[todo.values().next().value!];todo.delete(q[0]);for(let i=0;i<q.length;i++){const x=q[i]%32,r=Math.floor(q[i]/32);for(const [dx,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){if(x+dx<0||x+dx>31||r+dr<0||r+dr>31)continue;const k=(r+dr)*32+x+dx;if(todo.delete(k))q.push(k);}}}
  return n;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const arg=process.argv[2]??'all';mkdirSync('src/alps/heads',{recursive:true});
  const names=imageData.images.heads.map(h=>h.filename.replace(/^head-/,''));
  if(Object.keys(recipes).some(n=>!names.includes(n)))throw Error('Unknown recipe name');
  if(arg!=='all'&&!names.includes(arg))throw Error(`Unknown head: ${arg}`);
  for(let i=0;i<names.length;i++)if(arg==='all'||arg===names[i]) {
    const art=readArt(i),model=generateHead(art);
    writeFileSync(`src/alps/heads/${art.name}.json`,writeHeadFile(model,art.name,recipes[art.name].about));
    console.log(`${art.name}: ${model.voxels.length} voxels; ${projectionComponents(art)} silhouette component(s)`);
  }
}
