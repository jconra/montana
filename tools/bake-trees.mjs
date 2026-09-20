globalThis.document = { createElementNS:()=>({style:{},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}}), createElement:()=>({style:{},getContext:()=>null,setAttribute(){},addEventListener(){},remove(){}}) };
globalThis.self = globalThis;
import fs from 'fs';
const THREE = await import('three');
const { Tree } = await import('@dgreenheck/ez-tree');

const OUT = '/var/www/html/terrain/trees';
fs.mkdirSync(OUT+'/tex', {recursive:true});
const A='node_modules/@dgreenheck/ez-tree/src/lib/assets';
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
function normalize(mesh, height, cx, cz, spread){
  const g=mesh.geometry; const p=g.getAttribute('position'); const arr=p.array;
  for(let i=0;i<arr.length;i+=3){ arr[i]=(arr[i]-cx)/height*spread; arr[i+1]=arr[i+1]/height; arr[i+2]=(arr[i+2]-cz)/height*spread; }
  p.needsUpdate=true; g.computeVertexNormals?.();
}

// variant roster: role (canopy=full detail, zoned | grove=aspen clusters | mid/far=distance LODs); preset + tweaks; tex; spread; leaf alphaTest
const variants = [
  { name:'pine_large', role:'canopy', preset:'Pine Large', seed:777, tex:'pine', spread:1.18, alphaTest:0.5,
    tweak:o=>{ o.branch.length['1']=10; } },   // shorter mid branches → skinnier through the middle
  { name:'pine_bush',  role:'canopy', preset:'Pine Small', seed:308, tex:'pine', spread:1.42, alphaTest:0.4,
    tweak:o=>{ o.branch.start['1']=0.02;           // child branches start almost at the ground → bushy to the base
               o.branch.children['0']=95;           // moderate branching (perf: fewer tube branches)
               o.branch.length['1']=15;             // side branches wide but not straggly
               o.branch.angle['1']=126;             // sweep them out/down
               o.branch.segments['1']=4;            // fewer radial segments per branch (lighter tubes)
               o.leaves.count=26; o.leaves.size=1.45; o.leaves.start=0; } },  // fewer but bigger leaf cards keep it full
  { name:'aspen',      role:'grove', preset:'Aspen Medium', seed:18020, tex:'aspen', spread:1.2, alphaTest:0.3,
    tweak:o=>{ o.branch.children['0']=20; o.branch.children['1']=5;   // some twigs to hang leaves on
               o.branch.length['1']=9;
               o.leaves.count=17; o.leaves.size=2.9; o.leaves.start=0.05; } },  // less dense crown (see-through, real aspen)
  // ---- distance LODs (same pine textures so they match the detailed pines) ----
  { name:'pine_mid',   role:'mid', preset:'Pine Large', seed:501, tex:'pine', spread:1.28, alphaTest:0.32,
    tweak:o=>{ o.branch.children['0']=12;           // ~10% of the branches…
               o.branch.segments['0']=5; o.branch.segments['1']=3;  // …lighter tubes
               o.leaves.count=10; o.leaves.size=3.2; o.leaves.start=0; } },  // …but big fat foliage clumps to fill the silhouette
  { name:'pine_far',   role:'far', preset:'Pine Large', seed:88, tex:'pine', spread:1.15, alphaTest:0.3,
    tweak:o=>{ o.branch.children['0']=5;             // just a few branches…
               o.branch.start['1']=0.42;             // …up toward the top
               o.branch.segments['0']=4; o.branch.segments['1']=3;
               o.leaves.count=8; o.leaves.size=4.4; o.leaves.start=0.3; } },  // big cards clustered near the crown (crowded-back-forest impostor)
];

const manifest={ variants:[] };
for(const v of variants){
  const t=new Tree(); t.loadPreset(v.preset); t.options.seed=v.seed; if(v.tweak) v.tweak(t.options); t.generate();
  const bg=t.branchesMesh.geometry, lg=t.leavesMesh.geometry;
  bg.computeBoundingBox(); lg.computeBoundingBox();
  const height=Math.max(bg.boundingBox.max.y, lg.boundingBox.max.y);
  const cx=(bg.boundingBox.min.x+bg.boundingBox.max.x)/2, cz=(bg.boundingBox.min.z+bg.boundingBox.max.z)/2;
  normalize(t.branchesMesh,height,cx,cz,v.spread); normalize(t.leavesMesh,height,cx,cz,v.spread);
  const data={ name:v.name, srcHeight:height, branches:packGeo(bg), leaves:packGeo(lg) };
  fs.writeFileSync(OUT+'/'+v.name+'.json', JSON.stringify(data));
  const sz=(fs.statSync(OUT+'/'+v.name+'.json').size/1024).toFixed(0);
  manifest.variants.push({ name:v.name, role:v.role, file:v.name+'.json', srcHeight:+height.toFixed(2), tex:TEX[v.tex], alphaTest:v.alphaTest });
  console.log(v.name.padEnd(11), v.preset.padEnd(12), 'srcH', height.toFixed(1), 'bark', (bg.getIndex().count/3)|0, 'leaf', (lg.getIndex().count/3)|0, sz+'KB');
}
fs.writeFileSync(OUT+'/manifest.json', JSON.stringify(manifest,null,2));
// drop the stale first-round single-material files if present
for(const f of ['pine_a.json','pine_b.json','pine_c.json']){ try{ fs.unlinkSync(OUT+'/'+f); }catch(e){} }
console.log('wrote', OUT);
