/** Eyewear fitted to authored geometry. The frame sits in FRONT of the head; mounting tabs replace
 * small contact regions. Straps/arms follow the actual head depth outside its surface. */
import type { Analysis } from './analyze';
import { PART } from './detect';
import { key, kx, kz } from './tile';

type Rows = Map<number, Map<number, number>>;
type Owned = Map<number, Set<number>>;
export function fitEyewear(A: Analysis, rows: Rows, head: Owned, sx: number): Owned {
  const frame: Owned = new Map();
  const pixels: [number,number][]=[];
  for(let r=0;r<32;r++)for(let x=0;x<32;x++)if(A.px[r][x]?.part===PART.glasses&&!A.px[r][x]?.depthFrom)pixels.push([r,x]);
  if(!pixels.length)return frame;
  const headDepths=pixels.flatMap(([r,x])=>[...(head.get(r)??[])].filter(k=>Math.floor(kx(k)/sx)===x).map(kz));
  const allDepths=[...head.values()].flatMap(s=>[...s].map(kz));
  const contact=headDepths.length?Math.min(...headDepths):allDepths.length?Math.min(...allDepths):0;
  const plane=contact-2*sx;
  const tally=new Map<number,number>();
  for(const [r,x]of pixels){const c=A.px[r][x]!.color;tally.set(c,(tally.get(c)??0)+1);}
  const frameColour=[...tally].sort((a,b)=>b[1]-a[1])[0][0];
  const add=(r:number,x:number,z:number,c:number)=>{
    const k=key(x,z);if(head.get(r)?.has(k))return; // glasses never cut into the authored head
    let cells=rows.get(r);if(!cells)rows.set(r,cells=new Map());
    let own=frame.get(r);if(!own)frame.set(r,own=new Set());
    cells.set(k,c);own.add(k);
  };
  for(const [r,x]of pixels)for(let dx=0;dx<sx;dx++)for(let dz=0;dz<2*sx;dz++)add(r,x*sx+dx,plane+dz,dz<sx?A.px[r][x]!.color:frameColour);
  // Discreet depth-wise mounting tabs behind the upper/lower frame rim. These engage
  // the head's vertical studs (side-to-side touching alone is not a brick connection).
  // The tab uses the frame backing colour and replaces only its stud contact region.
  const framePixels=new Set(pixels.map(([r,x])=>`${r},${x}`));
  for(const [r,x] of pixels) {
    if(framePixels.has(`${r-1},${x}`)&&framePixels.has(`${r+1},${x}`))continue;
    for(let dx=0;dx<sx;dx++) {
      const X=x*sx+dx, zs=[...(head.get(r)??[])].filter(k=>kx(k)===X).map(kz);
      if(!zs.length)continue;
      const touch=Math.min(...zs);
      // Long tabs would become visible shelves behind curved or hollow heads.
      if(touch-contact>3*sx)continue;
      for(let z=plane+sx;z<touch+sx;z++){head.get(r)?.delete(key(X,z));add(r,X,z,frameColour);}
    }
  }
  const G=A.glasses;if(!G)return frame;
  for(const r of G.rows){
    const own=head.get(r);if(!own?.size)continue;
    // Largest connected cross-section is the wearing surface. A nearby tap, antenna or
    // floating fragment is not a reason to route the entire strap out to that detail.
    const remaining=new Set(own),components:number[][]=[];
    while(remaining.size){const q=[remaining.values().next().value!];remaining.delete(q[0]);for(let i=0;i<q.length;i++){const x=kx(q[i]),z=kz(q[i]);for(const k of [key(x-1,z),key(x+1,z),key(x,z-1),key(x,z+1)])if(remaining.delete(k))q.push(k);}components.push(q);}
    const core=components.sort((a,b)=>b.length-a.length)[0];
    const byDepth=new Map<number,number[]>();for(const k of core){const z=kz(k),xs=byDepth.get(z)??[];xs.push(kx(k));byDepth.set(z,xs);}
    const front=Math.min(...byDepth.keys()),back=Math.max(...byDepth.keys());
    const fx=pixels.filter(p=>p[0]===r).flatMap(([,x])=>[x*sx,x*sx+sx-1]);if(!fx.length)continue;
    const ends=[Math.min(...fx),Math.max(...fx)];
    const last=G.kind==='arms' ? front+Math.max(sx,Math.floor((back-front+1)*.68)) : back+sx;
    for(const side of [0,1]){
      let prev=ends[side];
      for(let z=plane+sx;z<=last;z++){
        const zs=Math.max(front,Math.min(back,z)),xs=byDepth.get(zs)??byDepth.get(front)!;
        const edge=side===0?Math.min(...xs)-sx:Math.max(...xs)+1;
        // Leave the frame straight backwards until the head reaches the strap.
        // Pulling immediately toward a sphere's narrow front point makes an inward
        // V-shaped shelf instead of a strap along the temples.
        const mid=(front+back)/2;
        const x=z<=mid ? (side===0?Math.min(ends[side],edge):Math.max(ends[side],edge)) : edge;
        const j=Math.floor((z-contact)/sx), glyphRow=r-G.rows[0];
        const color=G.glyph&&j>=0&&j<3&&G.glyph.pattern[glyphRow]?.[j]?G.glyph.color:G.color;
        for(let xx=Math.min(prev,x);xx<=Math.max(prev,x)+sx-1;xx++)add(r,xx,z,color);
        // A one-stud-deep concealed mounting rail engages studs above/below the belt.
        // External side contact alone cannot connect LEGO bricks. Only the side skin is
        // replaced; the head behind the front frame remains complete.
        if(z>=front && z<=back)for(let dx=0;dx<sx;dx++) {
          const anchor=side===0?Math.min(...xs)+dx:Math.max(...xs)-dx;
          head.get(r)?.delete(key(anchor,z)); add(r,anchor,z,G.color);
        }
        prev=x;
      }
      if(G.kind==='arms')for(let rr=r+1;rr<=Math.min(31,r+2);rr++)for(let dx=0;dx<sx;dx++)for(let dz=0;dz<sx;dz++)add(rr,prev+dx,last-dz,G.color);
    }
    if(G.kind==='strap') {
      const xs=byDepth.get(back)!;
      for(let z=back+1;z<=back+sx;z++)for(let x=Math.min(...xs)-sx;x<=Math.max(...xs)+sx;x++)add(r,x,z,G.color);
    }
  }
  return frame;
}
