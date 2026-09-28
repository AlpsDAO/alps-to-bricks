// Self-contained 3D review file: node --import tsx scripts/heads/review.ts
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {HEAD_NAMES} from '../lib/heads';
import {readArt,projectionComponents} from './generate';
const models=HEAD_NAMES.map(n=>JSON.parse(readFileSync(`src/alps/heads/${n}.json`,'utf8')));
const art=HEAD_NAMES.map((_,i)=>{const a=readArt(i);return {...a,components:projectionComponents(a)};});
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const bundle=await build({entryPoints:['scripts/heads/review-client.ts'],bundle:true,minify:true,format:'iife',platform:'browser',write:false});
const html=readFileSync('scripts/heads/review.html','utf8').replace('/* REVIEW_DATA */','window.REVIEW_DATA='+JSON.stringify({models,art,revision}).replaceAll('<','\\u003c')+';').replace('/* REVIEW_CLIENT */',()=>bundle.outputFiles[0].text.replaceAll('</script','<\\/script'));
const output=process.argv[2]??'out/review/alps-head-workshop.html';
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html);console.log(`${models.length} heads; ${(html.length/1024/1024).toFixed(1)} MB → ${output}`);
