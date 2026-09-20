globalThis.document = { createElementNS:()=>({style:{},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}}), createElement:()=>({style:{},getContext:()=>null,setAttribute(){},addEventListener(){},remove(){}}) };
globalThis.self = globalThis;
import fs from 'fs';
const THREE = await import('three');
const { Tree } = await import('@dgreenheck/ez-tree');

import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
if(args.includes('--help')) { console.log('node tools/bake-trees.mjs [--out DIRECTORY]'); process.exit(0); }
if(args.length && (args.length!==2 || args[0]!=='--out')) throw new Error('Expected --out DIRECTORY');
const OUT=args.length ? path.resolve(args[1]) : path.resolve(here,'../assets/vegetation-lab');
if(OUT===path.resolve(here,'../assets/trees')) throw new Error('Use a staging directory; production trees need matching impostors before promotion.');
fs.mkdirSync(OUT+'/tex', {recursive:true});
const A=path.join(here,'node_modules/@dgreenheck/ez-tree/src/lib/assets');
const cp=(s,d)=>fs.copyFileSync(A+'/'+s, OUT+'/tex/'+d);
// bark sets + leaf cards we use
cp('bark/pine_color_1k.jpg','pine_color.jpg');  cp('bark/pine_normal_1k.jpg','pine_normal.jpg');  cp('bark/pine_roughness_1k.jpg','pine_rough.jpg');  cp('bark/pine_ao_1k.jpg','pine_ao.jpg');
cp('bark/birch_color_1k.jpg','birch_color.jpg'); cp('bark/birch_normal_1k.jpg','birch_normal.jpg'); cp('bark/birch_roughness_1k.jpg','birch_rough.jpg'); cp('bark/birch_ao_1k.jpg','birch_ao.jpg');
cp('leaves/pine_color.png','pine_leaf.png');
cp('leaves/oak_color.png','oak_leaf.png');       // GREEN broadleaf → used for the aspen (he wants green, not golden)
const TEX = {
  pine:  { barkColor:'tex/pine_color.jpg',  barkNormal:'tex/pine_normal.jpg',  barkRough:'tex/pine_rough.jpg',  barkAO:'tex/pine_ao.jpg',  leaf:'tex/pine_leaf.png'  },
  aspen: { barkColor:'tex/birch_color.jpg', barkNormal:'tex/birch_normal.jpg', barkRough:'tex/birch_rough.jpg', barkAO:'tex/birch_ao.jpg', leaf:'tex/oak_leaf.png' },
};

const b64 = (typedArr)=> Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength).toString('base64');
function packGeo(g){
  const o={};
  for(const k of ['position','normal','uv']){ const a=g.getAttribute(k); o[k]=b64(a.array instanceof Float32Array?a.array:new Float32Array(a.array)); o[k+'_n']=a.count; }
  const idx=g.getIndex(); const ia = idx? (idx.array instanceof Uint32Array?idx.array:new Uint32Array(idx.array)) : null;
  if(ia){ o.index=b64(ia); o.index_n=ia.length; }
  return o;
}
// center X/Z at 0, base at y=0, scale so height=1, then fan out horizontally by `spread` (cheap fullness, no extra tris)
function normalize(mesh, height, cx, cz, spread, baseY){
  const g=mesh.geometry; const p=g.getAttribute('position'); const arr=p.array;
  for(let i=0;i<arr.length;i+=3){ arr[i]=(arr[i]-cx)/height*spread; arr[i+1]=(arr[i+1]-baseY)/height; arr[i+2]=(arr[i+2]-cz)/height*spread; }
  p.needsUpdate=true; g.computeVertexNormals?.();
}

// variant roster: role (canopy=full detail, zoned | grove=aspen clusters | mid/far=distance LODs); preset + tweaks; tex; spread; leaf alphaTest
import { variants } from './tree-presets.mjs';

const manifest={generator:{ezTree:'1.1.0',three:THREE.REVISION}, variants:[] };
fs.copyFileSync(path.join(here,'node_modules/@dgreenheck/ez-tree/LICENSE'),path.join(OUT,'EZ-TREE-LICENSE.txt'));
for(const v of variants){
  const t=new Tree(); t.loadPreset(v.preset); t.options.seed=v.seed; if(v.tweak) v.tweak(t.options); t.generate();
  const bg=t.branchesMesh.geometry, lg=t.leavesMesh.geometry;
  bg.computeBoundingBox(); lg.computeBoundingBox();
  const baseY=Math.min(bg.boundingBox.min.y, lg.boundingBox.min.y);
  const height=Math.max(bg.boundingBox.max.y, lg.boundingBox.max.y)-baseY;
  if(!Number.isFinite(height)||height<=0) throw new Error(`Invalid height: ${v.name}`);
  const cx=(bg.boundingBox.min.x+bg.boundingBox.max.x)/2, cz=(bg.boundingBox.min.z+bg.boundingBox.max.z)/2;
  normalize(t.branchesMesh,height,cx,cz,v.spread,baseY); normalize(t.leavesMesh,height,cx,cz,v.spread,baseY);
  const data={ name:v.name, srcHeight:height, branches:packGeo(bg), leaves:packGeo(lg) };
  fs.writeFileSync(OUT+'/'+v.name+'.json', JSON.stringify(data));
  const sz=(fs.statSync(OUT+'/'+v.name+'.json').size/1024).toFixed(0);
  manifest.variants.push({ name:v.name, role:v.role, file:v.name+'.json', srcHeight:+height.toFixed(2), tex:TEX[v.tex], alphaTest:v.alphaTest, seed:v.seed, preset:v.preset, label:v.label||v.name.replaceAll('_',' '), displayHeight:v.displayHeight||(v.role==='grove'?7:16), leafTint:v.leafTint||0xffffff, triangles:(bg.getIndex().count+lg.getIndex().count)/3, bytes:fs.statSync(OUT+'/'+v.name+'.json').size });
  console.log(v.name.padEnd(11), v.preset.padEnd(12), 'srcH', height.toFixed(1), 'bark', (bg.getIndex().count/3)|0, 'leaf', (lg.getIndex().count/3)|0, sz+'KB');
}
fs.writeFileSync(OUT+'/manifest.json', JSON.stringify(manifest,null,2));
// drop the stale first-round single-material files if present
for(const f of ['pine_a.json','pine_b.json','pine_c.json']){ try{ fs.unlinkSync(OUT+'/'+f); }catch(e){} }
console.log('wrote', OUT);
