import { describe,expect,it } from 'vitest';
import { alpGrid } from '../src/alps/alps';
import { analyze } from '../src/core/analyze';
import { fitEyewear } from '../src/core/eyewear';
import { key,kx,kz } from '../src/core/tile';
import { PART } from '../src/core/detect';
import { findHead,loadHeadModel,testSeeds } from '../scripts/lib/heads';

describe('eyewear fitted to authored heads',()=>{
 for(const name of ['wine-barrel','console-handheld','index-card','faberge'])for(const glasses of [115,0]){
  it(`${name}: frame stays flat, in front, with depth fitted to the wearing surface (${glasses})`,()=>{
   const {index}=findHead(name), model=loadHeadModel(name)!.model;
   const A=analyze(alpGrid({...testSeeds(index)[0],glasses}));
   const rows=new Map<number,Map<number,number>>(),own=new Map<number,Set<number>>();
   for(const v of model.voxels){const r=31-v.z,k=key(v.x,v.y-(model.front??0));if(!rows.has(r)){rows.set(r,new Map());own.set(r,new Set());}rows.get(r)!.set(k,1);own.get(r)!.add(k);}
   const art:[number,number][]=[];
   A.px.forEach((row,r)=>row.forEach((p,x)=>{if(p?.part===PART.glasses&&!p.depthFrom)art.push([r,x]);}));
   const contacts=art.flatMap(([r,x])=>[...(own.get(r)??[])].filter(k=>kx(k)===x).map(kz));
   const contact=Math.min(...contacts);
   const frame=fitEyewear(A,rows,own,1);
   for(const [r,x]of art){
    const at=[...(frame.get(r)??[])].filter(k=>kx(k)===x).map(kz);
    expect(Math.min(...at)).toBe(contact-2);
    expect(rows.get(r)!.get(key(x,contact-2))).toBe(A.px[r][x]!.color);
   }
   expect([...frame.values()].every(s=>s.size>0)).toBe(true);
   if(A.glasses?.kind==='strap'){
    const row=A.glasses.rows[1];
    expect(Math.max(...[...frame.get(row)!].map(kz))).toBeGreaterThan(Math.max(...[...own.get(row)!].map(kz)));
   }
  });
 }
});
