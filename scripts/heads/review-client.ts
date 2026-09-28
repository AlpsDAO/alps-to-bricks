import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { readHeadFile, type HeadFile } from '../../src/alps/headModel';
import { alpGrid, TRAITS } from '../../src/alps/alps';
import { buildModel } from '../../src/core/build';
import { analyze } from '../../src/core/analyze';
import { fitEyewear, applyEyewearEdits } from '../../src/core/eyewear';
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
const originals=structuredClone(data.models);
type Review={decision:'unreviewed'|'needs-work'|'approved';tags:string[];note:string;pins?:[number,number,number][]};
const review:Record<string,Review>={};
const edited:Record<string,HeadFile>={};
const eyewear:Record<string,EyewearEdit[]>={};
const STORAGE='alps-head-workshop-v2';
const TAGS=['Silhouette','Depth','Colour','Face','Glasses fit','Supports','Other'];
const identity=()=>`${data.models[selected].head}::${glassSelect.value}`;
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({version:2,baseRevision:data.revision,reviews:review,models:edited,eyewear}));$('edit-message').textContent='Saved in this browser. Export review to share it.';}catch{$('edit-message').textContent='Browser storage is full or unavailable. Export review now to keep your changes.';}}
function acceptModel(name:string,value:unknown){if(!value||typeof value!=='object'||(value as HeadFile).head!==name)return false;try{const result=readHeadFile(JSON.stringify(value));if(result.problems.length)return false;return true;}catch{return false;}}
function acceptEyewear(value:unknown):value is EyewearEdit[]{return Array.isArray(value)&&value.length<50000&&value.every(e=>e&&Number.isInteger(e.row)&&e.row>=0&&e.row<32&&Number.isInteger(e.x)&&e.x>=0&&e.x<32&&Number.isInteger(e.depth)&&Math.abs(e.depth)<=64&&(e.color===null||Number.isInteger(e.color)&&COLOR_BY_ID.has(e.color)));}
try{const saved=JSON.parse(localStorage.getItem(STORAGE)??'{}');if(saved?.version===2){for(const [name,value] of Object.entries(saved.models??{})){const i=data.models.findIndex(m=>m.head===name);if(i>=0&&acceptModel(name,value)){data.models[i]=value as HeadFile;edited[name]=value as HeadFile;}}for(const [id,value] of Object.entries(saved.reviews??{})){if(typeof value==='object'&&value&&['unreviewed','needs-work','approved'].includes((value as Review).decision))review[id]=value as Review;}for(const [id,value] of Object.entries(saved.eyewear??{}))if(acceptEyewear(value))eyewear[id]=value;}}catch{/* invalid browser cache: continue with bundled models */}
for(const [i,label] of TRAITS.find(t=>t.key==='glasses')!.names.entries()){const o=new Option(label,String(i));glassSelect.add(o);}
glassSelect.value='115';
function filter(){headSelect.replaceChildren();data.models.forEach((m,i)=>{if(m.head.includes(search.value.toLowerCase().replaceAll(' ','-')))headSelect.add(new Option(m.head.replaceAll('-',' '),String(i)));});headSelect.value=String(selected);}
search.oninput=()=>{filter();if(headSelect.options.length&&headSelect.selectedIndex<0){selected=+headSelect.options[0].value;headSelect.value=String(selected);void render();}};filter();
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
 if(withGlasses){const frame=fitEyewear(analyze(grid),rows,head,1);applyEyewearEdits(eyewear[identity()],rows,head,frame,1);}
 const ps:Piece[]=[];
 for(const [r,cells]of rows)for(const [k,c]of cells)ps.push({x:kx(k),z:kz(k),y:(31-r)*2.5,w:1,d:1,h:2.5,c,kind:'brick',part:'voxel',group:'body',glasses:!head.get(r)?.has(k)});
 return ps;
}
function art(){const a=data.art[selected],canvas=$<HTMLCanvasElement>('art'),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,256,256);for(let r=0;r<32;r++)for(let x=0;x<32;x++){ctx.fillStyle=a.pixels[r][x]?a.palette[a.pixels[r][x]!]:((x+r)%2?'#e1e6ed':'#f0f3f7');ctx.fillRect(x*8,r*8,8,8);}}
async function render(preserveView=false){
 const mine=++generation;selected=Number(headSelect.value)||0;const m=data.models[selected];
 $('name').textContent=m.head.replaceAll('-',' ');$('about').textContent=m.about??'';art();drawSlice();showReview();drawQueue();
 $('status').textContent='Building…';await new Promise(r=>requestAnimationFrame(r));if(mine!==generation)return;
 try{
  let ps:Piece[]=[];let status='';
  if(mode.value==='shape'||mode.value==='fit'){ps=sourcePieces(mode.value==='fit');status=`Exact source silhouette · ${m.slices.length} voxels deep · ${data.art[selected].components} artwork component${data.art[selected].components===1?'':'s'}.`;
  }else{
   const grid=alpGrid({head:selected,glasses:+glassSelect.value,background:0,body:0,accessory:0});
   const built=buildModel({...grid,headModel:readHeadFile(JSON.stringify(m)).model,eyewearEdits:eyewear[identity()]},mode.value==='xl'?'xl':'mini');ps=built.pieces;
   const c=built.checks;status=`${c.pieces.toLocaleString()} real pieces · ${c.floating} floating · ${c.collisions} collisions · ${c.com.inside?'balanced':'balance failed'}. Head: ${c.head?.parts} subassemblies. Eyewear: ${c.glasses?.parts} subassemblies.`;
  }
  clear();if((mode.value==='shape'||mode.value==='fit')&&edit3d){addEditableHead();if(mode.value==='fit'){const fitted=ps.filter(p=>p.glasses);if(target.value==='glasses')addEditableGlasses(fitted);else addPieces(fitted);}}else addPieces(ps);const bounds=new THREE.Box3().setFromObject(group);centre=bounds.getCenter(new THREE.Vector3());radius=Math.max(...bounds.getSize(new THREE.Vector3()).toArray())*.6;if(!preserveView)angle(-.65,.32);$('status').textContent=status;
  showPins();$('component-note').textContent=data.art[selected].components>1?'The artwork contains disconnected fragments. Physical builds may need supports.':'Sides and back are authored interpretations of the original art.';
 }catch(e){$('status').textContent=`Could not build: ${String(e)}`;}
}
headSelect.onchange=()=>{selected=+headSelect.value;depth=0;void render();};glassSelect.onchange=()=>{void render();};mode.onchange=()=>{if(mode.value==='mini'||mode.value==='xl'||mode.value==='shape'&&target.value==='glasses')set3d(false);void render();};
$('prev').onclick=()=>{selected=(selected+data.models.length-1)%data.models.length;search.value='';filter();void render();};
$('next').onclick=()=>{selected=(selected+1)%data.models.length;search.value='';filter();void render();};
$('download').onclick=()=>download(data.models[selected].head+'.json',data.models[selected]);
$('capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=data.models[selected].head+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
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
$('export-review').onclick=()=>download('alps-review-'+new Date().toISOString().slice(0,10)+'.json',{format:'alps-head-review',version:2,baseRevision:data.revision,exportedAt:new Date().toISOString(),reviews:review,models:edited,eyewear});
$('import-review').onclick=()=>$<HTMLInputElement>('file').click();
$<HTMLInputElement>('file').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>25_000_000)throw Error('Review file is too large');const payload=JSON.parse(await file.text());if(payload.format!=='alps-head-review'||payload.version!==2||typeof payload.models!=='object'||typeof payload.reviews!=='object')throw Error('Not a compatible review file');let count=0;for(const [name,value] of Object.entries(payload.models)){const i=data.models.findIndex(m=>m.head===name);if(i<0||!acceptModel(name,value))throw Error('Invalid head model: '+name);data.models[i]=value as HeadFile;edited[name]=value as HeadFile;count++;}for(const [id,value] of Object.entries(payload.reviews)){if(!data.models.some(m=>id.startsWith(m.head+'::'))||!value||typeof value!=='object')continue;const r=value as Review;if(!['unreviewed','needs-work','approved'].includes(r.decision)||!Array.isArray(r.tags)||typeof r.note!=='string')continue;review[id]={decision:r.decision,tags:r.tags.filter(t=>TAGS.includes(t)),note:r.note.slice(0,5000),pins:Array.isArray(r.pins)?r.pins.filter(p=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n))).slice(0,30):[]};}for(const [id,value] of Object.entries(payload.eyewear??{})){if(!data.models.some(m=>id.startsWith(m.head+'::'))||!acceptEyewear(value))throw Error('Invalid eyewear edits: '+id);eyewear[id]=value;}persist();depth=0;void render();$('edit-message').textContent=`Imported ${count} edited heads and review decisions. Export again to share the combined result.`;}catch(err){$('edit-message').textContent=`Import failed: ${String(err)}`;}input.value='';};
let depth=0,brush='.',tool:'paint'|'erase'|'pick'='paint',edit3d=false,painting=false;
const undo=new Map<string,string[]>(),redo=new Map<string,string[]>();
const eyewearUndo=new Map<string,string[]>(),eyewearRedo=new Map<string,string[]>();
const target=$<HTMLSelectElement>('target');
target.onchange=()=>{const glasses=target.value==='glasses';$('head-editor').style.display=glasses?'none':'';$('head-actions').style.display=glasses?'none':'';$('reset-glasses').style.display=glasses?'block':'none';$('add-color').style.display=glasses?'none':'';if(glasses)mode.value='fit';void render(true);};
const paletteKeys='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%&*+=?~';
function current(){return data.models[selected];}
function setDepth(d:number){depth=Math.max(0,Math.min(31,d));$<HTMLInputElement>('slice-depth').value=String(depth);$('depth-value').textContent=String(depth);$('depth-name').textContent=depth===0?'front':depth<current().slices.length?'inside shape':'new empty slice';drawSlice();}
$('depth-prev').onclick=()=>setDepth(depth-1);$('depth-next').onclick=()=>setDepth(depth+1);$<HTMLInputElement>('slice-depth').oninput=e=>setDepth(+(e.target as HTMLInputElement).value);
function drawSlice(){if(!data.models[selected])return;const c=$<HTMLCanvasElement>('slice'),ctx=c.getContext('2d')!,slice=current().slices[depth];for(let y=0;y<32;y++)for(let x=0;x<32;x++){const ch=slice?.[y]?.[x]??'.';ctx.fillStyle=current().palette[ch]??((x+y)%2?'#e5e9ed':'#f3f5f6');ctx.fillRect(x*8,y*8,8,8);}ctx.strokeStyle='rgba(52,72,79,.22)';ctx.lineWidth=1;for(let i=0;i<=32;i++){ctx.beginPath();ctx.moveTo(i*8+.5,0);ctx.lineTo(i*8+.5,256);ctx.moveTo(0,i*8+.5);ctx.lineTo(256,i*8+.5);ctx.stroke();}drawSwatches();}
function drawSwatches(){const node=$('swatches');node.replaceChildren();for(const [ch,hex] of Object.entries(current().palette)){const b=document.createElement('button');b.title=`${ch} ${hex}`;b.style.background=hex;b.className=brush===ch?'selected':'';b.onclick=()=>{brush=ch;setTool('paint');drawSwatches();};node.append(b);}if(!current().palette[brush])brush=Object.keys(current().palette)[0]??'.';}
function setTool(t:typeof tool){tool=t;for(const name of ['paint','erase','pick'])$(name).classList.toggle('active',name===t);}
for(const t of ['paint','erase','pick'] as const)$(t).onclick=()=>setTool(t);
$('add-color').onclick=()=>{if(target.value==='glasses')return;const m=current(),hex=$<HTMLInputElement>('new-color').value.toLowerCase();const existing=Object.entries(m.palette).find(([,v])=>v.toLowerCase()===hex);if(existing){brush=existing[0];drawSwatches();return;}const ch=[...paletteKeys].find(k=>!m.palette[k]);if(!ch){$('edit-message').textContent='Palette is full.';return;}checkpoint();m.palette[ch]=hex;brush=ch;edited[m.head]=m;persist();drawSwatches();};
function checkpoint(){const name=current().head,stack=undo.get(name)??[];stack.push(JSON.stringify(current()));if(stack.length>50)stack.shift();undo.set(name,stack);redo.delete(name);}
function restore(from:Map<string,string[]>,to:Map<string,string[]>){const name=current().head,s=from.get(name);if(!s?.length)return;const dest=to.get(name)??[];dest.push(JSON.stringify(current()));to.set(name,dest);const next=JSON.parse(s.pop()!) as HeadFile;data.models[selected]=next;if(JSON.stringify(next)===JSON.stringify(originals[selected]))delete edited[name];else edited[name]=next;persist();void render(true);}
$('undo').onclick=()=>target.value==='glasses'?restoreEyewear(eyewearUndo,eyewearRedo):restore(undo,redo);$('redo').onclick=()=>target.value==='glasses'?restoreEyewear(eyewearRedo,eyewearUndo):restore(redo,undo);
$('reset-glasses').onclick=()=>{if(!eyewear[identity()]?.length)return;eyewearCheckpoint();delete eyewear[identity()];persist();void render(true);};
$('reset-head').onclick=()=>{const name=current().head;if(!edited[name])return;checkpoint();data.models[selected]=structuredClone(originals[selected]);delete edited[name];persist();void render(true);};
function put(x:number,d:number,z:number,ch:string){if(x<0||x>31||d<0||d>31||z<0||z>31)return false;const m=current();while(m.slices.length<=d)m.slices.push(Array(32).fill('.'.repeat(32)));const row=31-z,old=m.slices[d][row];if(old[x]===ch)return false;m.slices[d][row]=old.slice(0,x)+ch+old.slice(x+1);edited[m.head]=m;return true;}
function cellAt(x:number,y:number){const row=Math.floor(y/8),col=Math.floor(x/8);return {x:col,z:31-row};}
function applySlice(e:PointerEvent){const c=$<HTMLCanvasElement>('slice'),r=c.getBoundingClientRect(),{x,z}=cellAt((e.clientX-r.left)*256/r.width,(e.clientY-r.top)*256/r.height);if(x<0||x>31||z<0||z>31)return;const old=current().slices[depth]?.[31-z]?.[x]??'.';if(tool==='pick'){if(current().palette[old]){brush=old;setTool('paint');drawSwatches();}return;}if(put(x,depth,z,tool==='erase'?'.':brush)){drawSlice();persist();void render(true);}}
const sliceCanvas=$<HTMLCanvasElement>('slice');sliceCanvas.onpointerdown=e=>{if(tool!=='pick')checkpoint();painting=true;sliceCanvas.setPointerCapture(e.pointerId);applySlice(e);};sliceCanvas.onpointermove=e=>{if(painting)applySlice(e);};sliceCanvas.onpointerup=()=>{painting=false;};sliceCanvas.onpointercancel=()=>{painting=false;};
const pickables:THREE.InstancedMesh[]=[];
function addEditableHead(){pickables.length=0;const m=readHeadFile(JSON.stringify(current())).model,buckets=new Map<string,typeof m.voxels>();for(const v of m.voxels){const hex='#'+v.rgb.map(c=>c.toString(16).padStart(2,'0')).join('');const b=buckets.get(hex)??[];b.push(v);buckets.set(hex,b);}for(const [hex,vs] of buckets){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.98,.98,.98),new THREE.MeshStandardMaterial({color:hex,roughness:.6}),vs.length);const cells:{x:number;d:number;z:number}[]=[];vs.forEach((v,i)=>{matrix.makeTranslation(v.x+.5,v.z+.5,-(v.y-(m.front??0))-.5);mesh.setMatrixAt(i,matrix);cells.push({x:v.x,d:v.y,z:v.z});});mesh.userData.cells=cells;mesh.computeBoundingSphere();group.add(mesh);pickables.push(mesh);}}

function eyewearCheckpoint(){const id=identity(),stack=eyewearUndo.get(id)??[];stack.push(JSON.stringify(eyewear[id]??[]));if(stack.length>50)stack.shift();eyewearUndo.set(id,stack);eyewearRedo.delete(id);}
function restoreEyewear(from:Map<string,string[]>,to:Map<string,string[]>){const id=identity(),stack=from.get(id);if(!stack?.length)return;const dest=to.get(id)??[];dest.push(JSON.stringify(eyewear[id]??[]));to.set(id,dest);const next=JSON.parse(stack.pop()!) as EyewearEdit[];if(next.length)eyewear[id]=next;else delete eyewear[id];persist();void render(true);}
function putEyewear(row:number,x:number,d:number,color:number|null){if(row<0||row>31||x<0||x>31||Math.abs(d)>64)return false;const id=identity(),list=eyewear[id]??[];const existing=list.findIndex(e=>e.row===row&&e.x===x&&e.depth===d);if(existing>=0&&list[existing].color===color)return false;const edit={row,x,depth:d,color};if(existing>=0)list[existing]=edit;else list.push(edit);eyewear[id]=list;return true;}
function addEditableGlasses(ps:Piece[]){pickables.length=0;const buckets=new Map<number,Piece[]>();for(const p of ps){const b=buckets.get(p.c)??[];b.push(p);buckets.set(p.c,b);}for(const [color,pieces] of buckets){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.98,.98,.98),new THREE.MeshStandardMaterial({color:renderHex(color),roughness:.55}),pieces.length);const cells:{x:number;d:number;row:number;color:number}[]=[];pieces.forEach((p,i)=>{const row=31-Math.round(p.y/2.5);matrix.makeTranslation(p.x+.5,31-row+.5,-p.z-.5);mesh.setMatrixAt(i,matrix);cells.push({x:p.x,d:p.z,row,color});});mesh.userData.cells=cells;mesh.computeBoundingSphere();group.add(mesh);pickables.push(mesh);}}
function set3d(value:boolean){edit3d=value;controls.enableRotate=!value;controls.enablePan=!value;$('edit3d').classList.toggle('active',value);$('edit3d').textContent='Click blocks in 3D: '+(value?'on':'off');}
$('edit3d').onclick=()=>{if(mode.value==='mini'||mode.value==='xl'||target.value==='glasses'&&mode.value!=='fit'){$('edit-message').textContent='Select Head + fitted eyewear to edit glasses, or Head sculpture to edit the head.';return;}set3d(!edit3d);void render(true);};

let pinMode=false;
const markers=new THREE.Group();scene.add(markers);
function showPins(){markers.clear();for(const p of review[identity()]?.pins??[]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.37,12,8),new THREE.MeshBasicMaterial({color:'#ff4938',depthTest:false}));dot.position.set(...p);dot.renderOrder=999;markers.add(dot);}const n=review[identity()]?.pins?.length??0;$('pin-count').textContent=`${n} pinned area${n===1?'':'s'} for this pairing.`;}
$('pin').onclick=()=>{if(mode.value!=='shape'&&mode.value!=='fit')mode.value='fit';set3d(false);pinMode=true;$('pin').classList.add('active');$('pin-count').textContent='Click the problem area on the 3D model.';void render(true);};
$('clear-pins').onclick=()=>{if(review[identity()]){review[identity()].pins=[];persist();showPins();}};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if((!edit3d&&!pinMode)||e.button!==0||!(mode.value==='shape'||mode.value==='fit'))return;const r=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);if(pinMode){const pinHit=raycaster.intersectObjects(group.children,false)[0];if(!pinHit)return;const p=pinHit.point;const r=review[identity()]??{decision:'unreviewed',tags:[],note:'',pins:[]};r.pins=[...(r.pins??[]),([+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)] as [number,number,number])].slice(-30);review[identity()]=r;pinMode=false;$('pin').classList.remove('active');persist();showPins();return;}const hit=raycaster.intersectObjects(pickables,false)[0];if(!hit||hit.instanceId===undefined)return;const cell=(hit.object as THREE.InstancedMesh).userData.cells[hit.instanceId] as {x:number;d:number;z:number;row:number;color:number};if(target.value==='glasses'){if(tool==='pick'){$<HTMLInputElement>('new-color').value=renderHex(cell.color);setTool('paint');return;}eyewearCheckpoint();let {x,d,row}=cell;if(tool==='paint'&&!e.shiftKey){const n=hit.face!.normal;if(Math.abs(n.x)>.5)x+=Math.sign(n.x);else if(Math.abs(n.y)>.5)row-=Math.sign(n.y);else d-=Math.sign(n.z);}const hex=$<HTMLInputElement>('new-color').value,rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number],color=mapColors([{rgb,count:999}],new Set())[0];if(putEyewear(row,x,d,tool==='erase'?null:color)){persist();void render(true);}return;}const old=current().slices[cell.d][31-cell.z][cell.x];if(tool==='pick'){if(current().palette[old]){brush=old;setTool('paint');drawSwatches();}return;}checkpoint();let {x,d,z}=cell;if(tool==='paint'&&!e.shiftKey){const n=hit.face!.normal;if(Math.abs(n.x)>.5)x+=Math.sign(n.x);else if(Math.abs(n.y)>.5)z+=Math.sign(n.y);else d-=Math.sign(n.z);if(d<0&&current().slices.length<32){current().slices.unshift(Array(32).fill('.'.repeat(32)));current().front=(current().front??0)+1;d=0;}}if(put(x,d,z,tool==='erase'?'.':brush)){persist();setDepth(d);void render(true);}});
setDepth(0);drawQueue();

function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);}loop();void render();
