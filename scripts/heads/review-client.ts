import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { readHeadFile, type HeadFile } from '../../src/alps/headModel';
import { alpGrid, TRAITS } from '../../src/alps/alps';
import { buildModel } from '../../src/core/build';
import { analyze } from '../../src/core/analyze';
import { fitEyewear } from '../../src/core/eyewear';
import { key, kx, kz } from '../../src/core/tile';
import { COLOR_BY_ID, renderHex, mapColors } from '../../src/core/palette';
import { pieceGeometry, geoKey } from '../../src/viewer/geometry';
import type { Piece } from '../../src/core/parts';

declare global { interface Window { REVIEW_DATA: {models:HeadFile[];art: {name:string;palette:Record<string,string>;pixels:(string|null)[][];components:number}[];revision:string} } }
const data=window.REVIEW_DATA;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const headSelect=$<HTMLSelectElement>('head'),glassSelect=$<HTMLSelectElement>('glasses'),mode=$<HTMLSelectElement>('mode');
const search=$<HTMLInputElement>('search');
let selected=data.models.findIndex(m=>m.head==='wine-barrel');
let generation=0;
for(const [i,label] of TRAITS.find(t=>t.key==='glasses')!.names.entries()){const o=new Option(label,String(i));glassSelect.add(o);}
glassSelect.value='115';
function filter(){headSelect.replaceChildren();data.models.forEach((m,i)=>{if(m.head.includes(search.value.toLowerCase().replaceAll(' ','-')))headSelect.add(new Option(m.head.replaceAll('-',' '),String(i)));});headSelect.value=String(selected);}
search.oninput=()=>{filter();if(headSelect.options.length && headSelect.selectedIndex<0){headSelect.selectedIndex=0;void render();}};filter();
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edf2');
const camera=new THREE.PerspectiveCamera(32,1,.1,1000);
const stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=true;
scene.add(new THREE.HemisphereLight(0xffffff,0xb9bdc8,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-20,40,50);scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(30,15,-35);scene.add(fill);
let group=new THREE.Group();scene.add(group);
let radius=24,centre=new THREE.Vector3();
function angle(a:number,e=.27){camera.position.copy(centre).add(new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(radius*3.4));controls.target.copy(centre);controls.update();}
for(const [id,a,e]of [['front',0,0],['right',Math.PI/2,0],['back',Math.PI,0],['top',0,Math.PI/2-.001],['iso',-.65,.32]] as [string,number,number][])$(id).onclick=()=>angle(a,e);
new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(stage);
function clear(){scene.remove(group);group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});group=new THREE.Group();scene.add(group);}
const matrix=new THREE.Matrix4();
function addPieces(pieces:Piece[]){
 const buckets=new Map<string,Piece[]>();for(const p of pieces){const k=geoKey(p)+':'+p.c;const b=buckets.get(k)??[];b.push(p);buckets.set(k,b);}
 for(const ps of buckets.values()){
  const c=COLOR_BY_ID.get(ps[0].c),mat=new THREE.MeshStandardMaterial({color:c?renderHex(ps[0].c):'#888888',roughness:.55,metalness:0,transparent:!!c?.trans,opacity:c?.trans?.65:1});
  const mesh=new THREE.InstancedMesh(pieceGeometry(ps[0],true),mat,ps.length);
  ps.forEach((p,i)=>{matrix.makeTranslation(p.x+p.w/2,p.y*.4,-p.z-p.d/2);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();group.add(mesh);
 }
}
function sourcePieces(withGlasses:boolean):Piece[]{
 const model=readHeadFile(JSON.stringify(data.models[selected])).model;
 const rows=new Map<number,Map<number,number>>(),head=new Map<number,Set<number>>();
 const cache=new Map<string,number>();
 for(const v of model.voxels){const r=31-v.z,k=key(v.x,v.y-(model.front??0)),id=v.rgb.join(',')+!!v.clear;
  if(!cache.has(id))cache.set(id,mapColors([{rgb:v.rgb,count:999,clear:v.clear}],new Set())[0]);
  let cells=rows.get(r);if(!cells)rows.set(r,cells=new Map());cells.set(k,cache.get(id)!);let own=head.get(r);if(!own)head.set(r,own=new Set());own.add(k);
 }
 const grid=alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0});
 if(withGlasses)fitEyewear(analyze(grid),rows,head,1);
 const ps:Piece[]=[];
 for(const [r,cells]of rows)for(const [k,c]of cells)ps.push({x:kx(k),z:kz(k),y:(31-r)*2.5,w:1,d:1,h:2.5,c,kind:'brick',part:'voxel',group:'body'});
 return ps;
}
function art(){const a=data.art[selected],canvas=$<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,256,256);for(let r=0;r<32;r++)for(let x=0;x<32;x++){ctx.fillStyle=a.pixels[r][x]?a.palette[a.pixels[r][x]!]:((x+r)%2?'#e1e6ed':'#f0f3f7');ctx.fillRect(x*8,r*8,8,8);}}
async function render(){
 const mine=++generation;selected=+headSelect.value||0;const m=data.models[selected];
 $('name').textContent=m.head.replaceAll('-',' ');$('about').textContent=m.about??'';art();
 $('status').textContent='Building…';await new Promise(r=>requestAnimationFrame(r));if(mine!==generation)return;
 try{
  let ps:Piece[]=[];let status='';
  if(mode.value==='shape'||mode.value==='fit'){ps=sourcePieces(mode.value==='fit');status=`Exact source silhouette · ${m.slices.length} voxels deep · ${data.art[selected].components} artwork component${data.art[selected].components===1?'':'s'}.`;
  }else{
   const grid=alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0});
   const built=buildModel({...grid,headModel:readHeadFile(JSON.stringify(m)).model},mode.value==='xl'?'xl':'mini');ps=built.pieces;
   const c=built.checks;status=`${c.pieces.toLocaleString()} real pieces · ${c.floating} floating · ${c.collisions} collisions · ${c.com.inside?'balanced':'balance failed'}. Head: ${c.head?.parts} subassemblies. Eyewear: ${c.glasses?.parts} subassemblies.`;
  }
  clear();addPieces(ps);const bounds=new THREE.Box3().setFromObject(group);centre=bounds.getCenter(new THREE.Vector3());radius=Math.max(...bounds.getSize(new THREE.Vector3()).toArray())*.6;angle(-.65,.32);$('status').textContent=status;
  $('component-note').textContent=data.art[selected].components>1?'The artwork contains disconnected fragments. Physical builds may need supports.':'Sides and back are authored interpretations of the original art.';
 }catch(e){$('status').textContent=`Could not build: ${String(e)}`;}
}
headSelect.onchange=render;glassSelect.onchange=render;mode.onchange=render;
$('prev').onclick=()=>{selected=(selected+data.models.length-1)%data.models.length;search.value='';filter();void render();};
$('next').onclick=()=>{selected=(selected+1)%data.models.length;search.value='';filter();void render();};
$('download').onclick=()=>{const a=document.createElement('a');a.download=data.models[selected].head+'.json';const url=URL.createObjectURL(new Blob([JSON.stringify(data.models[selected],null,2)+'\n'],{type:'application/json'}));a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=data.models[selected].head+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);}loop();void render();
