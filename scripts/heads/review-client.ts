import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { readHeadFile, type HeadFile } from '../../src/alps/headModel';
import { alpGrid, TRAITS } from '../../src/alps/alps';
import { buildModel } from '../../src/core/build';
import { analyze } from '../../src/core/analyze';
import { fitEyewear, applyEyewearEdits } from '../../src/core/eyewear';
import { eyewearFront, valid as validStyleCell, type EyewearStyleEdit, type EyewearStyleColor } from '../../src/core/eyewear-style';
import type { EyewearEdit } from '../../src/core/detect';
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
let sliceFocus=false;
const originals=structuredClone(data.models);
type Review={decision:'unreviewed'|'needs-work'|'approved';tags:string[];note:string;pins?:[number,number,number][]};
const review:Record<string,Review>={};
const edited:Record<string,HeadFile>={};
const eyewear:Record<string,EyewearEdit[]>={};
const styleShapes:Record<string,EyewearStyleEdit[]>={};
const styleColors:Record<string,EyewearStyleColor[]>={};
const styleLocks:Record<string,number>={};
const frontLayers=()=>styleLocks[styleKey()]??2;
const styleKey=()=>TRAITS.find(t=>t.key==='glasses')!.names[+glassSelect.value].split(' ')[0].toLowerCase();
const variantKey=()=>glassSelect.value;
const STORAGE='alps-head-workshop-v2';
const TAGS=['Silhouette','Depth','Colour','Face','Glasses fit','Supports','Other'];
const identity=()=>`${data.models[selected].head}::${glassSelect.value}`;
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({version:2,baseRevision:data.revision,reviews:review,models:edited,eyewear,styleShapes,styleColors,styleLocks}));$('edit-message').textContent='Saved on this device. Tap Save to GitHub to sync your edits.';}catch{$('edit-message').textContent='Browser storage is full or unavailable. Export review now to keep your changes.';}}
function acceptModel(name:string,value:unknown){if(!value||typeof value!=='object'||(value as HeadFile).head!==name)return false;try{const result=readHeadFile(JSON.stringify(value));if(result.problems.length)return false;return true;}catch{return false;}}
function acceptEyewear(value:unknown):value is EyewearEdit[]{return Array.isArray(value)&&value.length<50000&&value.every(e=>e&&Number.isInteger(e.row)&&e.row>=0&&e.row<32&&Number.isInteger(e.x)&&e.x>=0&&e.x<32&&Number.isInteger(e.depth)&&Math.abs(e.depth)<=64&&(e.color===null||Number.isInteger(e.color)&&COLOR_BY_ID.has(e.color)));}
function acceptStyleShape(value:unknown):value is EyewearStyleEdit[]{return Array.isArray(value)&&value.length<25000&&value.every(e=>e&&validStyleCell(e.row,e.x,e.depth)&&typeof e.filled==='boolean');}
function acceptStyleColors(value:unknown):value is EyewearStyleColor[]{return Array.isArray(value)&&value.length<25000&&value.every(e=>e&&validStyleCell(e.row,e.x,e.depth)&&Number.isInteger(e.color)&&COLOR_BY_ID.has(e.color));}
try{const saved=JSON.parse(localStorage.getItem(STORAGE)??'{}');if(saved?.version===2){for(const [name,value] of Object.entries(saved.models??{})){const i=data.models.findIndex(m=>m.head===name);if(i>=0&&acceptModel(name,value)){data.models[i]=value as HeadFile;edited[name]=value as HeadFile;}}for(const [id,value] of Object.entries(saved.reviews??{})){if(typeof value==='object'&&value&&['unreviewed','needs-work','approved'].includes((value as Review).decision))review[id]=value as Review;}for(const [id,value] of Object.entries(saved.eyewear??{}))if(acceptEyewear(value))eyewear[id]=value;for(const [id,value] of Object.entries(saved.styleShapes??{}))if(acceptStyleShape(value))styleShapes[id]=value;for(const [id,value] of Object.entries(saved.styleColors??{}))if(acceptStyleColors(value))styleColors[id]=value;for(const [id,value] of Object.entries(saved.styleLocks??{}))if(Number.isInteger(value)&&Number(value)>=2&&Number(value)<=8)styleLocks[id]=Number(value);}}catch{/* invalid browser cache: continue with bundled models */}
for(const [i,label] of TRAITS.find(t=>t.key==='glasses')!.names.entries()){const o=new Option(label,String(i));glassSelect.add(o);}
glassSelect.value='115';
const family=$<HTMLSelectElement>('family'),glassesNames=TRAITS.find(t=>t.key==='glasses')!.names;for(const name of [...new Set(glassesNames.map(n=>n.split(' ')[0]))])family.add(new Option(name,name.toLowerCase()));family.value=styleKey();family.onchange=()=>{const i=glassesNames.findIndex(n=>n.toLowerCase().startsWith(family.value+' '));if(i>=0){glassSelect.value=String(i);glassSelect.onchange?.(new Event('change'));}};
function filter(){headSelect.replaceChildren();data.models.forEach((m,i)=>{if(m.head.includes(search.value.toLowerCase().replaceAll(' ','-')))headSelect.add(new Option(m.head.replaceAll('-',' '),String(i)));});headSelect.value=String(selected);}
search.oninput=()=>{filter();if(headSelect.options.length&&headSelect.selectedIndex<0){selected=+headSelect.options[0].value;headSelect.value=String(selected);void render();}};filter();
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edf2');
const camera=new THREE.PerspectiveCamera(32,1,.1,1000);
const stage=$('stage');
const renderer=(()=>{try{return new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});}catch{return null;}})();
if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.append(renderer.domElement);}
else{const notice=document.createElement('div');notice.textContent='3D rendering needs WebGL. You can still review heads and paint depth slices here; open this page in a WebGL-enabled browser to edit directly in 3D.';stage.append(notice);stage.classList.add('unavailable');for(const id of ['pin','capture','edit3d','front','right','back','top','iso'])($<HTMLButtonElement>(id)).disabled=true;}
const controls=renderer?new OrbitControls(camera,renderer.domElement):null;if(controls){controls.enableDamping=true;controls.enablePan=true;}
scene.add(new THREE.HemisphereLight(0xffffff,0xb9bdc8,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-20,40,50);scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(30,15,-35);scene.add(fill);
let group=new THREE.Group();scene.add(group);
let radius=24,centre=new THREE.Vector3();
function angle(a:number,e=.27){camera.position.copy(centre).add(new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(radius*3.4));if(controls){controls.target.copy(centre);controls.update();}}
for(const [id,a,e]of [['front',0,0],['right',Math.PI/2,0],['back',Math.PI,0],['top',0,Math.PI/2-.001],['iso',-.65,.32]] as [string,number,number][])$(id).onclick=()=>angle(a,e);
function zoom(factor:number){if(!controls)return;const offset=camera.position.clone().sub(controls.target);const distance=THREE.MathUtils.clamp(offset.length()*factor,radius*.65,radius*14);camera.position.copy(controls.target).add(offset.setLength(distance));controls.update();}
$('zoom-in').onclick=()=>zoom(1/1.3);$('zoom-out').onclick=()=>zoom(1.3);
if(renderer)new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(stage);
function clear(){scene.remove(group);group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});group=new THREE.Group();scene.add(group);}
const matrix=new THREE.Matrix4();
function addPieces(pieces:Piece[],opacity=1){
 const buckets=new Map<string,Piece[]>();for(const p of pieces){const k=geoKey(p)+':'+p.c;const b=buckets.get(k)??[];b.push(p);buckets.set(k,b);}
 for(const ps of buckets.values()){
  const c=COLOR_BY_ID.get(ps[0].c),mat=new THREE.MeshStandardMaterial({color:c?renderHex(ps[0].c):'#888888',roughness:.55,metalness:0,transparent:opacity<1||!!c?.trans,opacity:(c?.trans?.65:1)*opacity,depthWrite:opacity===1});
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
 if(withGlasses){const frame=fitEyewear(analyze(grid),rows,head,1,styleShapes[styleKey()],styleColors[variantKey()],frontLayers());applyEyewearEdits(eyewear[identity()],rows,head,frame,1);}
 const ps:Piece[]=[];
 for(const [r,cells]of rows)for(const [k,c]of cells)ps.push({x:kx(k),z:kz(k),y:(31-r)*2.5,w:1,d:1,h:2.5,c,kind:'brick',part:'voxel',group:'body',glasses:!head.get(r)?.has(k)});
 return ps;
}
function standalonePieces():Piece[]{
 const A=analyze(alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0}));
 const cells=new Map<string,{row:number;x:number;depth:number;color:number}>();
 const putCell=(row:number,x:number,depth:number,color:number)=>{if(validStyleCell(row,x,depth))cells.set(`${row},${x},${depth}`,{row,x,depth,color});};
 for(const c of eyewearFront(A,styleShapes[styleKey()],styleColors[variantKey()]))putCell(c.row,c.x,c.depth,c.color);
 // Reference arms make the isolated style readable from the side. Final lengths follow each head.
 const front=[...cells.values()].filter(c=>c.depth===0),G=A.glasses;
 if(G)for(const row of G.rows){const xs=front.filter(c=>c.row===row).map(c=>c.x);if(!xs.length)continue;
  const left=Math.min(...xs),right=Math.max(...xs);
  for(let d=frontLayers();d<=10;d++){putCell(row,left,d,G.color);putCell(row,right,d,G.color);}
  if(G.kind==='strap')for(let x=left;x<=right;x++)putCell(row,x,10,G.color);
 }
 for(const e of styleShapes[styleKey()]??[]){if(!validStyleCell(e.row,e.x,e.depth))continue;const k=`${e.row},${e.x},${e.depth}`;if(!e.filled)cells.delete(k);else if(!cells.has(k)){const nearest=front.reduce((a,b)=>Math.abs(b.row-e.row)+Math.abs(b.x-e.x)<Math.abs(a.row-e.row)+Math.abs(a.x-e.x)?b:a,front[0]);putCell(e.row,e.x,e.depth,nearest?.color??G?.color??0);}}
 for(const e of styleColors[variantKey()]??[]){const c=cells.get(`${e.row},${e.x},${e.depth}`);if(c)c.color=e.color;}
 return [...cells.values()].map(c=>({x:c.x,z:c.depth,y:(31-c.row)*2.5,w:1,d:1,h:2.5,c:c.color,kind:'brick',part:'voxel',group:'body',glasses:true}));
}
function art(){const a=data.art[selected],canvas=$<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!,solo=mode.value==='glasses',grid=solo?alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0}):null;ctx.clearRect(0,0,256,256);for(let r=0;r<32;r++)for(let x=0;x<32;x++){let color:string|null=null;if(grid?.parts?.[r][x]===3){const rgb=grid.colors[grid.cells[r][x]].rgb;color='#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');}else if(!solo&&a.pixels[r][x])color=a.palette[a.pixels[r][x]!];ctx.fillStyle=color??((x+r)%2?'#e1e6ed':'#f0f3f7');ctx.fillRect(x*8,r*8,8,8);}$('art-caption').textContent=solo?'Original 32 × 32 eyewear artwork':'Original 32 × 32 head artwork';}
async function render(preserveView=false){
 const mine=++generation;selected=Number(headSelect.value)||0;const m=data.models[selected];
 $('name').textContent=mode.value==='glasses'?TRAITS.find(t=>t.key==='glasses')!.names[+glassSelect.value]:m.head.replaceAll('-',' ');$('about').textContent=mode.value==='glasses'?'Edit the frame by itself, then switch to Head + fitted eyewear to check each head. The front layers carry across this style family.':m.about??'';art();drawSlice();showReview();drawQueue();
 $('status').textContent='Building…';if(mode.value==='mini'||mode.value==='xl')await new Promise(r=>requestAnimationFrame(r));if(mine!==generation)return;
 try{
  let ps:Piece[]=[];let status='';
  if(mode.value==='glasses'){ps=standalonePieces();status=`${styleKey()} style · ${ps.length} blocks · ${frontLayers()} exact front layers shared across colourways; arms adapt to each head.`;}else if(mode.value==='shape'||mode.value==='fit'){ps=sourcePieces(mode.value==='fit');status=`Exact source silhouette · ${m.slices.length} voxels deep · ${data.art[selected].components} artwork component${data.art[selected].components===1?'':'s'}.`;
  }else{
   const grid=alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0});
   const built=buildModel({...grid,headModel:readHeadFile(JSON.stringify(m)).model,eyewearEdits:eyewear[identity()],eyewearStyle:styleShapes[styleKey()],eyewearStyleColors:styleColors[variantKey()],eyewearFrontLayers:frontLayers()},mode.value==='xl'?'xl':'mini');ps=built.pieces;
   const c=built.checks;status=`${c.pieces.toLocaleString()} real pieces · ${c.floating} floating · ${c.collisions} collisions · ${c.com.inside?'balanced':'balance failed'}. Head: ${c.head?.parts} subassemblies. Eyewear: ${c.glasses?.parts} subassemblies.`;
  }
  if(renderer){clear();if(mode.value==='glasses'&&edit3d){pickables.length=0;addEditableGlasses(ps,sliceFocus);}else if((mode.value==='shape'||mode.value==='fit')&&(edit3d||sliceFocus&&target.value==='head')){addEditableHead();if(mode.value==='fit'){const fitted=ps.filter(p=>p.glasses);if(target.value==='glasses')addEditableGlasses(fitted);else addPieces(fitted,sliceFocus&&target.value==='head'?.18:1);}}else addPieces(ps);const bounds=new THREE.Box3().setFromObject(group);centre=bounds.getCenter(new THREE.Vector3());radius=Math.max(...bounds.getSize(new THREE.Vector3()).toArray())*.6;if(!preserveView)angle(-.65,.32);} $('status').textContent=status;
  $('view-indicator').textContent=mode.value==='glasses'?(sliceFocus?`Glasses layer ${depth} · shared shape`:'Glasses only · pinch to zoom'):mode.value==='shape'||mode.value==='fit'?(sliceFocus&&target.value==='head'?`Slice ${depth} · bright blocks are this layer`:edit3d?'Tap blocks to edit':'Drag to rotate'):`${mode.value.toUpperCase()} build preview`;showPins();$('component-note').textContent=data.art[selected].components>1?'The artwork contains disconnected fragments. Physical builds may need supports.':'Sides and back are authored interpretations of the original art.';
 }catch(e){$('status').textContent=`Could not build: ${String(e)}`;}
}
headSelect.onchange=()=>{selected=+headSelect.value;depth=0;void render();};glassSelect.onchange=()=>{family.value=styleKey();$<HTMLInputElement>('front-layers').value=String(frontLayers());$('front-layers-value').textContent=String(frontLayers());void render();};mode.onchange=()=>{if(mode.value==='glasses')target.value='glasses';else if(target.value==='glasses'&&mode.value!=='fit')target.value='head';if(mode.value==='mini'||mode.value==='xl')set3d(false);target.onchange?.(new Event('change'));};
$('prev').onclick=()=>{selected=(selected+data.models.length-1)%data.models.length;search.value='';filter();void render();};
$('next').onclick=()=>{selected=(selected+1)%data.models.length;search.value='';filter();void render();};
$('download').onclick=()=>download(data.models[selected].head+'.json',data.models[selected]);
$('capture').onclick=()=>{if(!renderer)return;renderer.render(scene,camera);const a=document.createElement('a');a.download=data.models[selected].head+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
const tags=$('tags');
for(const tag of TAGS){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=tag;check.onchange=saveReview;label.append(check,document.createTextNode(tag));tags.append(label);}
function showReview(){const r=review[identity()]??{decision:'unreviewed',tags:[],note:''};$('pin-count').textContent=`${r.pins?.length??0} pinned area${r.pins?.length===1?'':'s'} for this pairing.`;$<HTMLSelectElement>('decision').value=r.decision;$<HTMLTextAreaElement>('note').value=r.note;for(const check of tags.querySelectorAll('input'))(check as HTMLInputElement).checked=r.tags.includes((check as HTMLInputElement).value);}
function saveReview(){review[identity()]={decision:$<HTMLSelectElement>('decision').value as Review['decision'],tags:[...tags.querySelectorAll('input:checked')].map(x=>(x as HTMLInputElement).value),note:$<HTMLTextAreaElement>('note').value.slice(0,5000),pins:review[identity()]?.pins??[]};persist();drawQueue();}
$<HTMLSelectElement>('decision').onchange=saveReview;$<HTMLTextAreaElement>('note').oninput=saveReview;
const artThumbs=data.art.map(a=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d')!;for(let y=0;y<32;y++)for(let x=0;x<32;x++){ctx.fillStyle=a.pixels[y][x]?a.palette[a.pixels[y][x]!]: '#f1f3f4';ctx.fillRect(x,y,1,1);}return c.toDataURL();});
function headStatus(name:string){return review[name+'::'+glassSelect.value]?.decision??'unreviewed';}
function drawQueue(){const root=$('queue');root.replaceChildren();const term=search.value.toLowerCase().replaceAll(' ','-'),f=$<HTMLSelectElement>('filter').value;data.models.forEach((m,i)=>{const status=headStatus(m.head);if(!m.head.includes(term)||(f!=='all'&&(f==='edited'?!edited[m.head]&&!eyewear[m.head+'::'+glassSelect.value]?.length:status!==f)))return;const b=document.createElement('button');b.type='button';b.className=i===selected?'current':'';const img=new Image();img.src=artThumbs[i];img.alt='';const title=document.createElement('strong');title.textContent=m.head.replaceAll('-',' ');const flag=document.createElement('em');flag.textContent=(edited[m.head]||eyewear[m.head+'::'+glassSelect.value]?.length?'✎ ':'')+({approved:'✓', 'needs-work':'Needs work',unreviewed:'·'}[status]);b.append(img,title,flag);b.onclick=()=>{selected=i;search.value='';filter();depth=0;void render();};root.append(b);});}
$<HTMLSelectElement>('filter').onchange=drawQueue;search.addEventListener('input',drawQueue);
function download(name:string,value:unknown){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function snapshot(){return {format:'alps-head-review',version:2,baseRevision:data.revision,exportedAt:new Date().toISOString(),reviews:review,models:edited,eyewear,styleShapes,styleColors,styleLocks};}
$('export-review').onclick=()=>download('alps-review-'+new Date().toISOString().slice(0,10)+'.json',snapshot());
$('import-review').onclick=()=>$<HTMLInputElement>('file').click();
$<HTMLInputElement>('file').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>25_000_000)throw Error('Review file is too large');const payload=JSON.parse(await file.text());const count=importSnapshot(payload);$('edit-message').textContent=`Imported ${count} edited heads and review decisions. Export again to share the combined result.`;}catch(err){$('edit-message').textContent=`Import failed: ${String(err)}`;}input.value='';};
function importSnapshot(payload:any,preferLocal=false):number{if(payload.format!=='alps-head-review'||payload.version!==2||typeof payload.models!=='object'||typeof payload.reviews!=='object')throw Error('Not a compatible review file');let count=0;for(const [name,value] of Object.entries(payload.models)){const i=data.models.findIndex(m=>m.head===name);if(i<0||!acceptModel(name,value))throw Error('Invalid head model: '+name);if(!preferLocal||!edited[name]){data.models[i]=value as HeadFile;edited[name]=value as HeadFile;count++;}}for(const [id,value] of Object.entries(payload.reviews)){if(!data.models.some(m=>id.startsWith(m.head+'::'))||!value||typeof value!=='object')continue;const r=value as Review;if(!['unreviewed','needs-work','approved'].includes(r.decision)||!Array.isArray(r.tags)||typeof r.note!=='string')continue;if(preferLocal&&review[id])continue;review[id]={decision:r.decision,tags:r.tags.filter(t=>TAGS.includes(t)),note:r.note.slice(0,5000),pins:Array.isArray(r.pins)?r.pins.filter(p=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n))).slice(0,30):[]};}for(const [id,value] of Object.entries(payload.eyewear??{})){if(!data.models.some(m=>id.startsWith(m.head+'::'))||!acceptEyewear(value))throw Error('Invalid eyewear edits: '+id);if(!preferLocal||!eyewear[id])eyewear[id]=value;}for(const [id,value] of Object.entries(payload.styleShapes??{})){if(!['gnargles','inuit','noggles','skoggles','snoggles','snowgoggles'].includes(id)||!acceptStyleShape(value))throw Error('Invalid eyewear style: '+id);if(!preferLocal||!styleShapes[id])styleShapes[id]=value;}for(const [id,value] of Object.entries(payload.styleColors??{})){if(!Number.isInteger(+id)||+id<0||+id>=glassSelect.options.length||!acceptStyleColors(value))throw Error('Invalid eyewear colours: '+id);if(!preferLocal||!styleColors[id])styleColors[id]=value;}for(const [id,value] of Object.entries(payload.styleLocks??{})){if(!['gnargles','inuit','noggles','skoggles','snoggles','snowgoggles'].includes(id)||!Number.isInteger(value)||Number(value)<2||Number(value)>8)throw Error('Invalid front layer count: '+id);if(!preferLocal||!styleLocks[id])styleLocks[id]=Number(value);}persist();depth=0;void render();return count;}
const GITHUB_API='/repos/AlpsDAO/alps-to-bricks';
const DRAFT_BRANCH='workshop-submissions';
let githubToken=sessionStorage.getItem('alps-workshop-token')??localStorage.getItem('alps-workshop-token')??'';
let pendingGithub:'save'|'load'='save';
function githubStatus(message:string){$('github-status').textContent=message;}
async function github(path:string,init:RequestInit={}){
 const response=await fetch('https://api.github.com'+path,{...init,credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+githubToken,'X-GitHub-Api-Version':'2022-11-28',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(typeof result.message==='string'?result.message:`GitHub returned ${response.status}`);(error as Error&{status:number}).status=response.status;throw error;}
 return result;
}
async function githubIdentity(){const user=await github('/user');if(!/^[a-z0-9-]{1,39}$/i.test(user.login))throw Error('Could not identify this GitHub account');return user.login as string;}
async function draftBranch(){try{return (await github(`${GITHUB_API}/git/ref/heads/${DRAFT_BRANCH}`)).object.sha as string;}catch(error){if((error as {status?:number}).status!==404)throw error;}
 const main=await github(`${GITHUB_API}/git/ref/heads/main`);
 try{await github(`${GITHUB_API}/git/refs`,{method:'POST',body:JSON.stringify({ref:'refs/heads/'+DRAFT_BRANCH,sha:main.object.sha})});}catch(error){if((error as {status?:number}).status!==422)throw error;}
 return (await github(`${GITHUB_API}/git/ref/heads/${DRAFT_BRANCH}`)).object.sha as string;
}
function encodeBase64(value:string){const bytes=new TextEncoder().encode(value);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);}
function decodeBase64(value:string){const binary=atob(value.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}
async function githubDraft(action:'save'|'load'){
 if(!githubToken){pendingGithub=action;$('github-auth').hidden=false;githubStatus('Connect your GitHub account once to '+action+' your draft.');return;}
 $<HTMLButtonElement>('save-github').disabled=true;$<HTMLButtonElement>('load-github').disabled=true;
 try{
  githubStatus(action==='save'?'Checking your GitHub draft…':'Loading your GitHub draft…');
  const login=await githubIdentity();await draftBranch();
  const path=`workshop-submissions/${login}.json`,url=`${GITHUB_API}/contents/${path}?ref=${DRAFT_BRANCH}`;
  let remote:{sha:string;content:string}|null=null;
  try{remote=await github(url);}catch(error){if((error as {status?:number}).status!==404)throw error;}
  const shaKey='alps-workshop-remote-sha-'+login;
  if(action==='load'){
   if(!remote)throw Error('No saved draft exists for this GitHub account yet.');
   if(remote.content.length>20_000_000)throw Error('Saved draft exceeds the workshop limit.');
   const payload=JSON.parse(decodeBase64(remote.content));
   const count=importSnapshot(payload,true);localStorage.setItem(shaKey,remote.sha);
   githubStatus(`Loaded your GitHub draft: ${count} edited heads and ${Object.keys(styleShapes).length} eyewear styles. Existing edits on this device were kept; missing edits were added.`);
  }else{
   if(remote&&remote.sha!==localStorage.getItem(shaKey))throw Error('A newer GitHub draft exists. Tap Load latest before saving, so it is not overwritten.');
   const content=encodeBase64(JSON.stringify(snapshot()));
   if(content.length>20_000_000)throw Error('This draft is too large for one GitHub save. Export it instead.');
   const result=await github(`${GITHUB_API}/contents/${path}`,{method:'PUT',body:JSON.stringify({message:'Save head workshop draft',content,branch:DRAFT_BRANCH,...(remote?{sha:remote.sha}:{})})});
   localStorage.setItem(shaKey,result.content.sha);githubStatus('Saved to your GitHub draft. Your local edits are still available on this phone.');
  }
 }catch(error){githubStatus(`GitHub ${action} failed: ${String(error)}. Your edits are still saved on this device.`);}
 finally{$<HTMLButtonElement>('save-github').disabled=false;$<HTMLButtonElement>('load-github').disabled=false;}
}
$('save-github').onclick=()=>void githubDraft('save');$('load-github').onclick=()=>void githubDraft('load');
$('connect-github').onclick=async()=>{
 const token=$<HTMLInputElement>('github-token').value.trim();if(!/^((github_pat_|ghp_)[A-Za-z0-9_]+)$/.test(token)){githubStatus('Paste a GitHub fine-grained token.');return;}
 githubToken=token;
 try{await githubIdentity();sessionStorage.setItem('alps-workshop-token',token);if($<HTMLInputElement>('remember-token').checked)localStorage.setItem('alps-workshop-token',token);else localStorage.removeItem('alps-workshop-token');$<HTMLInputElement>('github-token').value='';$('github-auth').hidden=true;void githubDraft(pendingGithub);}
 catch(error){githubToken='';githubStatus('Token was not accepted by GitHub: '+String(error));}
};
let depth=0,brush='.',tool:'paint'|'erase'|'recolor'|'pick'='paint',edit3d=false,painting=false;
const undo=new Map<string,string[]>(),redo=new Map<string,string[]>();
const eyewearUndo=new Map<string,string[]>(),eyewearRedo=new Map<string,string[]>();
const styleUndo=new Map<string,string[]>(),styleRedo=new Map<string,string[]>();
const target=$<HTMLSelectElement>('target');
target.onchange=()=>{const glasses=target.value==='glasses';if(!glasses&&mode.value==='glasses')mode.value='shape';$('head-editor').style.display=glasses&&mode.value!=='glasses'?'none':'';$('front-layers-control').hidden=mode.value!=='glasses';$('review-section').hidden=mode.value==='glasses';$('glasses-target-label').textContent=mode.value==='glasses'?'Eyewear style':'Eyewear for this pairing';$('slice-instruction').textContent=mode.value==='glasses'?'Paint this eyewear layer. The bright blocks above show the selected layer; faint blocks show the rest of the style. The front layers stay exact on every head.':'Paint this head layer. The bright blocks above show this slice; faint blocks show the rest of the head.';$<HTMLInputElement>('front-layers').value=String(frontLayers());$('front-layers-value').textContent=String(frontLayers());$('head-actions').style.display=glasses?'none':'';$('swatches').style.display=glasses?'none':'';$('swatch-label').style.display=glasses?'none':'';$('reset-glasses').style.display=glasses?'block':'none';$('add-color').style.display=glasses?'none':'';if(glasses){if(mode.value!=='glasses')mode.value='fit';sliceFocus=false;const piece=sourcePieces(true).find(p=>p.glasses);if(piece)$<HTMLInputElement>('new-color').value=renderHex(piece.c);}else sliceFocus=false;updateFocusButton();$('color-label').textContent=mode.value==='glasses'?'Colour for this variant':glasses?'Eyewear colour':'Custom head colour';$('reset-glasses').textContent=mode.value==='glasses'?'Reset this style and variant colours':'Reset eyewear edits for this pairing';if(renderer&&(mode.value==='glasses'||matchMedia('(max-width:700px)').matches&&(mode.value==='shape'||mode.value==='fit')))set3d(true);void render(true);};
const mobile=matchMedia('(max-width:700px)');
function placeEditor(){const editor=$('editor-section');if(mobile.matches){$('workbench').insertBefore(editor,$('workbench').querySelector('footer'));}else $('inspector').insertBefore(editor,$('share-section'));}
mobile.addEventListener('change',placeEditor);placeEditor();
$('queue-toggle').onclick=()=>{const open=$('queue').classList.toggle('open');$('queue-toggle').setAttribute('aria-expanded',String(open));$('queue-toggle').textContent=open?'Hide head list':'Browse all heads';};
function updateFocusButton(){const button=$('slice-focus');button.classList.toggle('active',sliceFocus);button.setAttribute('aria-pressed',String(sliceFocus));button.textContent=sliceFocus?'Viewing this slice in 3D':'Show this slice in 3D';}
$('slice-focus').onclick=()=>{sliceFocus=!sliceFocus;updateFocusButton();void render(true);};
function updateToolHelp(){const text=target.value==='glasses'?{paint:'Tap a frame block face to add beside it.',erase:'Tap an eyewear block to remove it.',recolor:'Choose a colour and tap an eyewear block to recolour it.',pick:'Tap an eyewear block to sample its colour.'}:{paint:'Choose a head colour and tap a face to add its neighbouring block.',erase:'Tap a head block to remove it.',recolor:'Choose a colour and tap a head block to recolour it.',pick:'Tap a block to sample its colour.'};$('tool-help').textContent=text[tool]+(edit3d?' Tap the dark button to rotate instead.':' Tap the dark button to edit directly on the model.');}
const paletteKeys='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%&*+=?~';
function current(){return data.models[selected];}
function setDepth(d:number,preview=true){if(preview&&(target.value==='head'||mode.value==='glasses')){sliceFocus=true;updateFocusButton();}depth=Math.max(0,Math.min(31,d));$<HTMLInputElement>('slice-depth').value=String(depth);$('depth-value').textContent=String(depth);$('depth-name').textContent=mode.value==='glasses'?(depth===0?'artwork face':depth===1?'backing':`arm layer ${depth}`):depth===0?'front':depth<current().slices.length?'inside shape':'new empty slice';drawSlice();if(preview&&sliceFocus&&(mode.value==='glasses'||target.value==='head'&&(mode.value==='shape'||mode.value==='fit')))void render(true);}
$('depth-prev').onclick=()=>setDepth(depth-1);$('depth-next').onclick=()=>setDepth(depth+1);$<HTMLInputElement>('slice-depth').oninput=e=>setDepth(+(e.target as HTMLInputElement).value);
function drawSlice(){if(!data.models[selected])return;if(mode.value==='glasses'){const c=$<HTMLCanvasElement>('slice'),ctx=c.getContext('2d')!,cells=standalonePieces().filter(p=>p.z===depth);const index=new Map(cells.map(p=>[`${p.x},${31-Math.round(p.y/2.5)}`,p.c]));for(let y=0;y<32;y++)for(let x=0;x<32;x++){const color=index.get(`${x},${y}`);ctx.fillStyle=color===undefined?((x+y)%2?'#e5e9ed':'#f3f5f6'):renderHex(color);ctx.fillRect(x*8,y*8,8,8);}drawGrid(ctx);return;}const c=$<HTMLCanvasElement>('slice'),ctx=c.getContext('2d')!,slice=current().slices[depth];for(let y=0;y<32;y++)for(let x=0;x<32;x++){const ch=slice?.[y]?.[x]??'.';ctx.fillStyle=current().palette[ch]??((x+y)%2?'#e5e9ed':'#f3f5f6');ctx.fillRect(x*8,y*8,8,8);}drawGrid(ctx);drawSwatches();}
function drawGrid(ctx:CanvasRenderingContext2D){ctx.strokeStyle='rgba(52,72,79,.22)';ctx.lineWidth=1;for(let i=0;i<=32;i++){ctx.beginPath();ctx.moveTo(i*8+.5,0);ctx.lineTo(i*8+.5,256);ctx.moveTo(0,i*8+.5);ctx.lineTo(256,i*8+.5);ctx.stroke();}}
function drawSwatches(){const node=$('swatches');node.replaceChildren();for(const [ch,hex] of Object.entries(current().palette)){const b=document.createElement('button');b.title=`${ch} ${hex}`;b.style.background=hex;b.className=brush===ch?'selected':'';b.onclick=()=>{brush=ch;if(tool==='erase'||tool==='pick')setTool('recolor');drawSwatches();};node.append(b);}if(!current().palette[brush])brush=Object.keys(current().palette)[0]??'.';}
function setTool(t:typeof tool){tool=t;for(const name of ['paint','erase','recolor','pick']){const active=name===t;$(name).classList.toggle('active',active);$(name).setAttribute('aria-pressed',String(active));}if(renderer&&mobile.matches&&(mode.value==='shape'||mode.value==='fit'||mode.value==='glasses')){const wasEditing=edit3d;set3d(true);if(!wasEditing)void render(true);}updateToolHelp();}
for(const t of ['paint','erase','recolor','pick'] as const)$(t).onclick=()=>setTool(t);
$('add-color').onclick=()=>{if(target.value==='glasses')return;const m=current(),hex=$<HTMLInputElement>('new-color').value.toLowerCase();const existing=Object.entries(m.palette).find(([,v])=>v.toLowerCase()===hex);if(existing){brush=existing[0];if(tool==='erase'||tool==='pick')setTool('recolor');drawSwatches();return;}const ch=[...paletteKeys].find(k=>!m.palette[k]);if(!ch){$('edit-message').textContent='Palette is full.';return;}checkpoint();m.palette[ch]=hex;brush=ch;if(tool==='erase'||tool==='pick')setTool('recolor');edited[m.head]=m;persist();drawSwatches();};
function checkpoint(){const name=current().head,stack=undo.get(name)??[];stack.push(JSON.stringify(current()));if(stack.length>50)stack.shift();undo.set(name,stack);redo.delete(name);}
function restore(from:Map<string,string[]>,to:Map<string,string[]>){const name=current().head,s=from.get(name);if(!s?.length)return;const dest=to.get(name)??[];dest.push(JSON.stringify(current()));to.set(name,dest);const next=JSON.parse(s.pop()!) as HeadFile;data.models[selected]=next;if(JSON.stringify(next)===JSON.stringify(originals[selected]))delete edited[name];else edited[name]=next;persist();void render(true);}
$('undo').onclick=()=>mode.value==='glasses'?restoreStyle(styleUndo,styleRedo):target.value==='glasses'?restoreEyewear(eyewearUndo,eyewearRedo):restore(undo,redo);$('redo').onclick=()=>mode.value==='glasses'?restoreStyle(styleRedo,styleUndo):target.value==='glasses'?restoreEyewear(eyewearRedo,eyewearUndo):restore(redo,undo);
$('reset-glasses').onclick=()=>{if(mode.value==='glasses'){styleCheckpoint();delete styleShapes[styleKey()];delete styleColors[variantKey()];delete styleLocks[styleKey()];persist();void render(true);return;}if(!eyewear[identity()]?.length)return;eyewearCheckpoint();delete eyewear[identity()];persist();void render(true);};
$('reset-head').onclick=()=>{const name=current().head;if(!edited[name])return;checkpoint();data.models[selected]=structuredClone(originals[selected]);delete edited[name];persist();void render(true);};
function put(x:number,d:number,z:number,ch:string){if(x<0||x>31||d<0||d>31||z<0||z>31)return false;const m=current();while(m.slices.length<=d)m.slices.push(Array(32).fill('.'.repeat(32)));const row=31-z,old=m.slices[d][row];if(old[x]===ch)return false;m.slices[d][row]=old.slice(0,x)+ch+old.slice(x+1);edited[m.head]=m;return true;}
function cellAt(x:number,y:number){const row=Math.floor(y/8),col=Math.floor(x/8);return {x:col,z:31-row};}
let previewQueued=false,changedStroke=false;function schedulePreview(){if(previewQueued)return;previewQueued=true;requestAnimationFrame(()=>{previewQueued=false;void render(true);});}
function applySlice(e:PointerEvent){if(!sliceFocus){sliceFocus=true;updateFocusButton();}const c=$<HTMLCanvasElement>('slice'),r=c.getBoundingClientRect(),{x,z}=cellAt((e.clientX-r.left)*256/r.width,(e.clientY-r.top)*256/r.height);if(x<0||x>31||z<0||z>31)return;if(mode.value==='glasses'){const p=standalonePieces().find(p=>p.x===x&&p.z===depth&&Math.round(p.y/2.5)===z);if(tool==='pick'){if(p)$<HTMLInputElement>('new-color').value=renderHex(p.c);setTool('recolor');return;}if(putStyle(31-z,x,depth,tool==='erase'?'erase':tool==='recolor'?'recolor':'paint')){changedStroke=true;drawSlice();schedulePreview();}return;}const old=current().slices[depth]?.[31-z]?.[x]??'.';if(tool==='pick'){if(current().palette[old]){brush=old;setTool('paint');drawSwatches();}return;}if(put(x,depth,z,tool==='erase'?'.':brush)){changedStroke=true;drawSlice();schedulePreview();}}
const sliceCanvas=$<HTMLCanvasElement>('slice');sliceCanvas.onpointerdown=e=>{if(tool!=='pick'){if(mode.value==='glasses')styleCheckpoint();else checkpoint();}painting=true;changedStroke=false;sliceCanvas.setPointerCapture(e.pointerId);applySlice(e);};sliceCanvas.onpointermove=e=>{if(painting)applySlice(e);};sliceCanvas.onpointerup=()=>{painting=false;if(changedStroke)persist();};sliceCanvas.onpointercancel=()=>{painting=false;if(changedStroke)persist();};
const pickables:THREE.InstancedMesh[]=[];
function addEditableHead(){pickables.length=0;const m=readHeadFile(JSON.stringify(current())).model,buckets=new Map<string,typeof m.voxels>();const focus=sliceFocus&&target.value==='head';for(const v of m.voxels){const hex='#'+v.rgb.map(c=>c.toString(16).padStart(2,'0')).join(''),active=!focus||v.y===depth,k=hex+':'+active;const b=buckets.get(k)??[];b.push(v);buckets.set(k,b);}for(const [label,vs] of buckets){const [hex,active]=label.split(':');const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.98,.98,.98),new THREE.MeshStandardMaterial({color:hex,roughness:.6,transparent:active==='false',opacity:active==='false'?.12:1,depthWrite:active!=='false'}),vs.length);const cells:{x:number;d:number;z:number}[]=[];vs.forEach((v,i)=>{matrix.makeTranslation(v.x+.5,v.z+.5,-(v.y-(m.front??0))-.5);mesh.setMatrixAt(i,matrix);cells.push({x:v.x,d:v.y,z:v.z});});mesh.userData.cells=cells;mesh.computeBoundingSphere();group.add(mesh);if(active==='true')pickables.push(mesh);}}

$<HTMLInputElement>('front-layers').onchange=e=>{const n=+(e.target as HTMLInputElement).value;if(n===frontLayers())return;styleCheckpoint();styleLocks[styleKey()]=n;$('front-layers-value').textContent=String(n);persist();void render(true);};
function styleCheckpoint(){const id=styleKey()+'::'+variantKey(),stack=styleUndo.get(id)??[];stack.push(JSON.stringify({shape:styleShapes[styleKey()]??[],colors:styleColors[variantKey()]??[],lock:frontLayers()}));if(stack.length>50)stack.shift();styleUndo.set(id,stack);styleRedo.delete(id);}
function restoreStyle(from:Map<string,string[]>,to:Map<string,string[]>){const id=styleKey()+'::'+variantKey(),stack=from.get(id);if(!stack?.length)return;const dest=to.get(id)??[];dest.push(JSON.stringify({shape:styleShapes[styleKey()]??[],colors:styleColors[variantKey()]??[],lock:frontLayers()}));to.set(id,dest);const next=JSON.parse(stack.pop()!) as {shape:EyewearStyleEdit[];colors:EyewearStyleColor[];lock:number};styleShapes[styleKey()]=next.shape;styleColors[variantKey()]=next.colors;styleLocks[styleKey()]=next.lock;$<HTMLInputElement>('front-layers').value=String(next.lock);$('front-layers-value').textContent=String(next.lock);persist();void render(true);}
function putStyle(row:number,x:number,depth:number,action:'paint'|'erase'|'recolor'){if(!validStyleCell(row,x,depth))return false;const key=styleKey(),shape=styleShapes[key]??[],existing=shape.findIndex(e=>e.row===row&&e.x===x&&e.depth===depth);if(action==='recolor'){const p=standalonePieces().find(p=>p.x===x&&p.z===depth&&31-Math.round(p.y/2.5)===row);if(!p)return false;const hex=$<HTMLInputElement>('new-color').value,rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number],color=mapColors([{rgb,count:999}],new Set())[0],list=styleColors[variantKey()]??[],at=list.findIndex(e=>e.row===row&&e.x===x&&e.depth===depth);if(at>=0&&list[at].color===color)return false;const edit={row,x,depth,color};if(at>=0)list[at]=edit;else list.push(edit);styleColors[variantKey()]=list;return true;}
 const filled=action==='paint';if(existing>=0&&shape[existing].filled===filled)return false;
 const occupied=standalonePieces().some(p=>p.x===x&&p.z===depth&&31-Math.round(p.y/2.5)===row);
 if(occupied===filled)return false;
 const edit={row,x,depth,filled};if(existing>=0)shape[existing]=edit;else shape.push(edit);styleShapes[key]=shape;return true;}
function eyewearCheckpoint(){const id=identity(),stack=eyewearUndo.get(id)??[];stack.push(JSON.stringify(eyewear[id]??[]));if(stack.length>50)stack.shift();eyewearUndo.set(id,stack);eyewearRedo.delete(id);}
function restoreEyewear(from:Map<string,string[]>,to:Map<string,string[]>){const id=identity(),stack=from.get(id);if(!stack?.length)return;const dest=to.get(id)??[];dest.push(JSON.stringify(eyewear[id]??[]));to.set(id,dest);const next=JSON.parse(stack.pop()!) as EyewearEdit[];if(next.length)eyewear[id]=next;else delete eyewear[id];persist();void render(true);}
function putEyewear(row:number,x:number,d:number,color:number|null){if(row<0||row>31||x<0||x>31||Math.abs(d)>64)return false;const id=identity(),list=eyewear[id]??[];const existing=list.findIndex(e=>e.row===row&&e.x===x&&e.depth===d);if(existing>=0&&list[existing].color===color)return false;const edit={row,x,depth:d,color};if(existing>=0)list[existing]=edit;else list.push(edit);eyewear[id]=list;return true;}
function addEditableGlasses(ps:Piece[],focus=false){pickables.length=0;const buckets=new Map<string,Piece[]>();for(const p of ps){const active=!focus||p.z===depth,k=p.c+':'+active,b=buckets.get(k)??[];b.push(p);buckets.set(k,b);}for(const [label,pieces] of buckets){const [id,active]=label.split(':'),color=+id,visible=active==='true';const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.98,.98,.98),new THREE.MeshStandardMaterial({color:renderHex(color),roughness:.55,transparent:!visible,opacity:visible?1:.12,depthWrite:visible}),pieces.length);const cells:{x:number;d:number;row:number;color:number}[]=[];pieces.forEach((p,i)=>{const row=31-Math.round(p.y/2.5);matrix.makeTranslation(p.x+.5,31-row+.5,-p.z-.5);mesh.setMatrixAt(i,matrix);cells.push({x:p.x,d:p.z,row,color});});mesh.userData.cells=cells;mesh.computeBoundingSphere();group.add(mesh);if(visible)pickables.push(mesh);}}
function set3d(value:boolean){if(!renderer)return;edit3d=value;if(controls){controls.enableRotate=!value;controls.enablePan=!value;}$('edit3d').classList.toggle('active',value);$('edit3d').textContent=value?'Editing blocks · tap to rotate':'Rotating view · tap to edit blocks';updateToolHelp();}
$('edit3d').onclick=()=>{if(mode.value==='mini'||mode.value==='xl'||target.value==='glasses'&&mode.value!=='fit'&&mode.value!=='glasses'){$('edit-message').textContent='Select Head + fitted eyewear to edit glasses, or Head sculpture to edit the head.';return;}set3d(!edit3d);void render(true);};

let pinMode=false;
const markers=new THREE.Group();scene.add(markers);
function showPins(){markers.clear();for(const p of review[identity()]?.pins??[]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.37,12,8),new THREE.MeshBasicMaterial({color:'#ff4938',depthTest:false}));dot.position.set(...p);dot.renderOrder=999;markers.add(dot);}const n=review[identity()]?.pins?.length??0;$('pin-count').textContent=`${n} pinned area${n===1?'':'s'} for this pairing.`;}
$('pin').onclick=()=>{if(mode.value!=='shape'&&mode.value!=='fit')mode.value='fit';set3d(false);pinMode=true;$('pin').classList.add('active');$('pin-count').textContent='Click the problem area on the 3D model.';void render(true);};
$('clear-pins').onclick=()=>{if(review[identity()]){review[identity()].pins=[];persist();showPins();}};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function applyModelTap(clientX:number,clientY:number){if((!edit3d&&!pinMode)||!(mode.value==='shape'||mode.value==='fit'||mode.value==='glasses'))return;const r=renderer!.domElement.getBoundingClientRect();pointer.set(((clientX-r.left)/r.width)*2-1,-((clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);if(pinMode){const pinHit=raycaster.intersectObjects(group.children,false)[0];if(!pinHit)return;const p=pinHit.point;const r=review[identity()]??{decision:'unreviewed',tags:[],note:'',pins:[]};r.pins=[...(r.pins??[]),([+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)] as [number,number,number])].slice(-30);review[identity()]=r;pinMode=false;$('pin').classList.remove('active');persist();showPins();return;}const hit=raycaster.intersectObjects(pickables,false)[0];if(!hit||hit.instanceId===undefined)return;const cell=(hit.object as THREE.InstancedMesh).userData.cells[hit.instanceId] as {x:number;d:number;z:number;row:number;color:number};if(mode.value==='glasses'){if(tool==='pick'){$<HTMLInputElement>('new-color').value=renderHex(cell.color);setTool('recolor');return;}styleCheckpoint();let {x,d,row}=cell;if(tool==='paint'){const n=hit.face!.normal;if(Math.abs(n.x)>.5)x+=Math.sign(n.x);else if(Math.abs(n.y)>.5)row-=Math.sign(n.y);else d-=Math.sign(n.z);}if(putStyle(row,x,d,tool==='erase'?'erase':tool==='recolor'?'recolor':'paint')){persist();setDepth(d,false);void render(true);}return;}if(target.value==='glasses'){if(tool==='pick'){$<HTMLInputElement>('new-color').value=renderHex(cell.color);setTool('recolor');return;}eyewearCheckpoint();let {x,d,row}=cell;if(tool==='paint'){const n=hit.face!.normal;if(Math.abs(n.x)>.5)x+=Math.sign(n.x);else if(Math.abs(n.y)>.5)row-=Math.sign(n.y);else d-=Math.sign(n.z);}const hex=$<HTMLInputElement>('new-color').value,rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number],color=mapColors([{rgb,count:999}],new Set())[0];if(putEyewear(row,x,d,tool==='erase'?null:color)){persist();void render(true);}return;}const old=current().slices[cell.d][31-cell.z][cell.x];if(tool==='pick'){if(current().palette[old]){brush=old;setTool('recolor');drawSwatches();}return;}checkpoint();let {x,d,z}=cell;if(tool==='paint'){const n=hit.face!.normal;if(Math.abs(n.x)>.5)x+=Math.sign(n.x);else if(Math.abs(n.y)>.5)z+=Math.sign(n.y);else d-=Math.sign(n.z);if(d<0&&current().slices.length<32){current().slices.unshift(Array(32).fill('.'.repeat(32)));current().front=(current().front??0)+1;d=0;}}if(put(x,d,z,tool==='erase'?'.':brush)){persist();setDepth(d,false);void render(true);}}

// A finger-down can become a pinch. Only a completed, stationary tap edits a block.
type TapStart={x:number;y:number;time:number;cancelled:boolean};
const activeTouches=new Map<number,TapStart>();
renderer?.domElement.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const touch={x:e.clientX,y:e.clientY,time:performance.now(),cancelled:false};
 if(e.pointerType==='touch'&&activeTouches.size){for(const other of activeTouches.values())other.cancelled=true;touch.cancelled=true;}
 activeTouches.set(e.pointerId,touch);
});
renderer?.domElement.addEventListener('pointermove',e=>{
 const touch=activeTouches.get(e.pointerId);
 if(touch&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>9)touch.cancelled=true;
});
renderer?.domElement.addEventListener('pointercancel',e=>activeTouches.delete(e.pointerId));
renderer?.domElement.addEventListener('pointerup',e=>{
 const touch=activeTouches.get(e.pointerId);activeTouches.delete(e.pointerId);
 if(touch&&!touch.cancelled&&performance.now()-touch.time<700)applyModelTap(e.clientX,e.clientY);
});
setDepth(0,false);updateFocusButton();updateToolHelp();drawQueue();

function loop(){requestAnimationFrame(loop);controls?.update();renderer?.render(scene,camera);}if(renderer)loop();void render();
