import {mkdirSync,writeFileSync} from 'node:fs';
import {readArt,generateHead} from './generate';
import {renderViews,renderArt} from '../lib/render';
import {HEAD_NAMES} from '../lib/heads';
mkdirSync('out/catalog',{recursive:true});
for(let i=0;i<HEAD_NAMES.length;i++){
 const art=readArt(i),m=generateHead(art),D=Math.max(...m.voxels.map(v=>v.y))+1;
 writeFileSync(`out/catalog/${art.name}.png`,renderViews(m.voxels,[32,D,32],{cell:4,iso:7}));
 writeFileSync(`out/catalog/${art.name}-art.png`,renderArt(art.pixels.map(row=>row.map(k=>k?art.palette[k].slice(1).match(/../g)!.map(h=>parseInt(h,16)) as [number,number,number]:null)),4));
 if(i%25===0)console.log(i,art.name);
}
