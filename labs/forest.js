import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bakeAtlas, impostorMaterial, atlasCanvas } from './octahedral.js';
THREE.ColorManagement.enabled=false;
const $=id=>document.getElementById(id);
const treeFields=[
  ['seed','Tree seed',0,65535,1,777],['height','Tree height (m)',5,50,1,28],
  ['crown','Crown starts up trunk',.05,.9,.01,.64],['branches','Main branches',4,100,1,48],
  ['leaves','Leaf cards / tip',1,32,1,20],['width','Crown spread',.5,2,.05,1.2],
  ['leafSize','Leaf size multiplier',.3,2,.05,1.2]
];
const advancedFields=[['secondary','Twigs / branch (aspen)',1,6,1,3],['length','Branch length multiplier',.3,2,.05,1],
  ['angle','Branch angle (degrees)',20,150,1,100],['leafStart','Leaves start along branch',0,.9,.05,.05],
  ['trunk','Trunk thickness multiplier',.3,2,.05,.8],['bend','Trunk irregularity',0,.15,.01,.02],
  ['segments','Radial segments',3,8,1,5],['sections','Lengthwise sections',3,12,1,6]];
const forestFields=[['count','Trees',1,30000,1,900],['spacing','Tree spacing (m)',2,30,.5,7],
  ['variation','Height variation',0,.45,.05,.2],['forestSeed','Forest seed',0,65535,1,2026],
  ['near','Mesh distance (m)',10,300,5,65],['budget','Max near meshes',0,250,1,60],['cutoff','Impostor alpha cutoff',.05,.8,.05,.3]];
function fields(target,items){for(const [id,title,min,max,step,value] of items){
  const label=document.createElement('label');label.textContent=title;
  const output=document.createElement('output');output.id=id+'Value';output.value=value;
  const input=document.createElement('input');Object.assign(input,{id,min,max,step,value,type:['seed','count','forestSeed'].includes(id)?'number':'range'});
  input.oninput=()=>{output.value=input.value;};label.append(output,input);$(target).append(label);
}}
fields('treeControls',treeFields);fields('advancedControls',advancedFields);fields('forestControls',forestFields);
function values(items){return Object.fromEntries(items.map(([id,,min,max,,def])=>{const v=Number($(id).value);const n=Number.isFinite(v)?THREE.MathUtils.clamp(v,min,max):def;$(id).value=n;$(id+'Value').value=n;return [id,n];}));}
const error=e=>{$('error').textContent=e?.message||String(e||'');};
const Renderer=new URLSearchParams(location.search).get('webgl')==='1'?THREE.WebGL1Renderer:THREE.WebGLRenderer;
let renderer;
try{renderer=new Renderer({canvas:$('scene'),antialias:true});}
catch(e){error('WebGL is unavailable in this browser. '+e.message);throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.useLegacyLights=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc4d3ce);scene.fog=new THREE.Fog(0xc4d3ce,400,1600);
const camera=new THREE.PerspectiveCamera(48,1,.2,12000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xdce8f1,0x6c6650,.8));
const sun=new THREE.DirectionalLight(0xfff2d6,1.2);sun.position.set(-20,35,25);scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(16000,16000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x68785b,roughness:1}));ground.position.y=-.05;scene.add(ground);
const root=new THREE.Group();scene.add(root);
let models=[],activeMix="single";
let parts=[],atlas=null,source=null,triangleCount=0,activeRecipe=null,activeOptions=null;
let forest=[],forestSettings=null,nearCount=0,farCount=0;
let busy=false,paused=false,inspection=false,generation=0,frameTimes=[],previous=performance.now(),lastStats=0,lastLOD=0;
let measurement=null,lastAtlasCanvas=null;
const textures=new Map(),textureLoader=new THREE.TextureLoader();
async function texture(name){if(!textures.has(name))textures.set(name,textureLoader.loadAsync('../assets/vegetation-lab/tex/'+name).then(t=>{t.colorSpace=THREE.SRGBColorSpace;return t;}).catch(e=>{textures.delete(name);throw e;}));return textures.get(name);}
function geometry(p){const g=new THREE.BufferGeometry();for(const name of ['position','normal','uv'])g.setAttribute(name,new THREE.BufferAttribute(p[name],name==='uv'?2:3));
  // Prefer Uint16 when possible; larger meshes need OES_element_index_uint on WebGL1.
  const index=p.position.length/3<65536?new Uint16Array(p.index):p.index;
  if(index instanceof Uint32Array&&!renderer.capabilities.isWebGL2&&!renderer.extensions.has('OES_element_index_uint'))throw new Error('This WebGL1 device needs fewer branches or leaves (16-bit mesh limit).');
  g.setIndex(new THREE.BufferAttribute(index,1));g.computeBoundingSphere();return g;}
function requestTree(recipe){return new Promise((resolve,reject)=>{
  const worker=new Worker('./forest-worker.js'),id=++generation;
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Generation exceeded 20 seconds. Reduce branching.'));},20000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message||'Could not load generator worker.'));};
  worker.postMessage({id,recipe});
});}
function setBusy(value){busy=value;for(const id of ['generate','randomize','bake','applyForest','single','overview','measure','export','downloadAtlas','atlasModel'])$(id).disabled=value;measurement=null;frameTimes=[];previous=performance.now();}
function disposeForest(){for(const model of models){
  for(const mesh of model.meshBatches||[])mesh.dispose();model.meshBatches=[];
  if(model.sprite){model.sprite.geometry.dispose();model.sprite.material.dispose();model.sprite=null;}
}root.clear();}
function disposeSource(tree){if(tree)for(const m of tree.children){m.geometry.dispose();m.material.dispose();}}
function disposeModel(model){disposeSource(model.source);model.atlas?.target.dispose();}
async function makeModel(recipe,label){const model={recipe,label,source:new THREE.Group(),meshBatches:[]};
  try{const data=await requestTree(recipe),aspen=recipe.preset==='aspen';
    const [bark,leaf]=await Promise.all([texture(aspen?'birch_color.jpg':'pine_color.jpg'),texture(aspen?'oak_leaf.png':'pine_leaf.png')]);
    data.parts.forEach((p,i)=>model.source.add(new THREE.Mesh(geometry(p),new THREE.MeshStandardMaterial({map:i?leaf:bark,alphaTest:i?.35:0,alphaToCoverage:i===1,side:i?THREE.DoubleSide:THREE.FrontSide,roughness:1}))));
    model.atlas=await bake(model.source);model.options=data.options;model.parts=model.source.children;
    model.triangleCount=model.parts.reduce((n,m)=>n+m.geometry.index.count/3,0);return model;
  }catch(e){disposeModel(model);throw e;}
}
async function generate(recipeOverride=null){if(busy)return;setBusy(true);error('');$('status').textContent='Generating trees in background…';
  const next=[];
  try{
    const recipe=recipeOverride||{preset:$('preset').value,...values(treeFields),...values(advancedFields)};
    const mix=$('mix').value;
    next.push(await makeModel(recipe,'Designer'));
    if(mix==='mixed')for(const [index,preset] of ['pine','open','aspen'].entries()){
      const defaults=Object.fromEntries([...treeFields,...advancedFields].map(([id,,,,,value])=>[id,value]));
      next.push(await makeModel({...defaults,...presetSettings[preset],preset,seed:(recipe.seed+1009*(index+1))%65536}, {pine:'Full pine',open:'Open pine',aspen:'Aspen'}[preset]));
    }
    planForest({...values(forestFields),mode:$('mode').value},next,false);
    disposeForest();models.forEach(disposeModel);models=next;activeMix=mix;
    ({source,atlas,parts,triangleCount}=models[0]);activeRecipe=recipe;activeOptions=models[0].options;
    lastAtlasCanvas=null;$('atlasModel').replaceChildren(...models.map((m,i)=>new Option(m.label,i)));inspection=false;rebuildForest(!recipeOverride);await previewAtlas();
    $('status').textContent='Ready · '+(renderer.capabilities.isWebGL2?'WebGL2':'WebGL1');window.__forestReady=true;
  }catch(e){if(models!==next)next.forEach(disposeModel);error(e);$('status').textContent='Generation failed; adjust controls and retry.';}
  finally{setBusy(false);}
}
async function bake(tree){const grid=+$('views').value,tile=+$('tile').value;
  return bakeAtlas(renderer,tree,grid,tile,(row,total)=>{$('status').textContent=`Baking octahedral views · ${row*grid} / ${total*grid}`;});}
async function rebake(){if(busy||!source)return;setBusy(true);error('');const next=[];try{
  planForest({...values(forestFields),mode:$('mode').value},models,inspection);
  for(const model of models)next.push(await bake(model.source));
  disposeForest();models.forEach((model,i)=>{model.atlas.target.dispose();model.atlas=next[i];});atlas=models[0].atlas;lastAtlasCanvas=null;
  rebuildForest(false);await previewAtlas();$('status').textContent='Atlases ready';
}catch(e){for(const item of next)if(!models.some(m=>m.atlas===item))item.target.dispose();error(e);}finally{setBusy(false);}}
async function previewAtlas(){lastAtlasCanvas=atlasCanvas(renderer,models[+$('atlasModel').value]?.atlas||atlas);const c=$('atlasPreview');c.getContext('2d').clearRect(0,0,c.width,c.height);c.getContext('2d').drawImage(lastAtlasCanvas,0,0,c.width,c.height);}
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function planForest(f,modelSet,inspection){
  const random=rng(f.forestSeed),types=rng(f.forestSeed^0x9e3779b9),count=inspection?1:f.count,cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
  const nextForest=Array.from({length:count},(_,i)=>{const model=inspection?0:Math.floor(types()*modelSet.length);return {
    model,x:inspection?0:((i%cols)-(cols-1)/2+(random()-.5)*.7)*f.spacing,
    z:inspection?0:(Math.floor(i/cols)-(rows-1)/2+(random()-.5)*.7)*f.spacing,
    height:modelSet[model].recipe.height*(inspection?1:1+(random()*2-1)*f.variation),yaw:inspection?0:random()*Math.PI*2
  };});
  const triangles=nextForest.reduce((n,p)=>n+modelSet[p.model].triangleCount,0);
  if(!inspection&&f.mode==='mesh'&&triangles>25000000)throw new Error(`Mesh mode would draw ${(triangles/1e6).toFixed(1)}M triangles. Reduce the tree count or choose Hybrid / Impostors.`);
  return nextForest;
}
function rebuildForest(reframe=false){if(!source||!atlas)return;
  const f=values(forestFields);f.count=Math.floor(f.count);f.budget=Math.floor(f.budget);f.mode=$('mode').value;f.mix=activeMix;
  if(!renderer.capabilities.isWebGL2&&!renderer.extensions.has('ANGLE_instanced_arrays'))throw new Error('Forest rendering needs WebGL1 instancing (ANGLE_instanced_arrays).');
  const nextForest=planForest(f,models,inspection);
  disposeForest();forestSettings=f;forest=nextForest;
  const mode=inspection?'mesh':f.mode,count=forest.length;
  for(const model of models){const {parts,atlas}=model;const count=forest.filter(p=>models[p.model]===model).length;if(!count)continue;let spriteMaterial,sprite;
  if(mode!=='impostor')for(const part of parts){const mesh=new THREE.InstancedMesh(part.geometry,part.material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;model.meshBatches.push(mesh);root.add(mesh);}
  if(mode!=='mesh'){
    const base=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();g.index=base.index;g.attributes=base.attributes;
    g.setAttribute('instanceData',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('instanceYaw',new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage));
    spriteMaterial=impostorMaterial(atlas,scene.fog);spriteMaterial.uniforms.blendViews.value=+$('blend').value;spriteMaterial.uniforms.cutoff.value=f.cutoff;
    sprite=new THREE.Mesh(g,spriteMaterial);sprite.frustumCulled=false;root.add(sprite);
  }
    model.sprite=sprite;
  }
  renderer.setPixelRatio(+$('dpr').value);resize();
  if(reframe)frameForest();updateLOD();frameTimes=[];measurement=null;
  window.__forestState={mode,requested:count,trianglesPerTree:triangleCount,atlasGrid:atlas.grid,atlasTile:atlas.tile,mix:activeMix,models:models.map((m,i)=>({label:m.label,count:forest.filter(p=>p.model===i).length,triangles:m.triangleCount}))};
  $('composition').textContent=window.__forestState.models.map(m=>`${m.label}: ${m.count.toLocaleString()}`).join(' · ');
}
const dummy=new THREE.Object3D();
function updateLOD(){if(!forestSettings)return;const mode=inspection?'mesh':forestSettings.mode;
  const selected=new Set();
  if(mode==='hybrid'){
    const max=forestSettings.budget;let triangles=0;
    const candidates=forest.map((p,i)=>({i,d:(camera.position.x-p.x)**2+(camera.position.z-p.z)**2+(camera.position.y-p.height*.5)**2})).filter(p=>p.d<forestSettings.near**2).sort((a,b)=>a.d-b.d);
    for(const p of candidates){const cost=models[forest[p.i].model].triangleCount;if(selected.size>=max)break;if(triangles+cost<=12000000){selected.add(p.i);triangles+=cost;}}
  }
  nearCount=farCount=0;for(const model of models)model.nearCount=model.farCount=0;
  forest.forEach((p,i)=>{
    const model=models[p.model],sprite=model.sprite;
    if(mode==='mesh'||selected.has(i)){
      dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.height);dummy.updateMatrix();
      for(const mesh of model.meshBatches)mesh.setMatrixAt(model.nearCount,dummy.matrix);model.nearCount++;nearCount++;
    }else if(sprite){sprite.geometry.attributes.instanceData.setXYZW(model.farCount,p.x,0,p.z,p.height);sprite.geometry.attributes.instanceYaw.setX(model.farCount,p.yaw);model.farCount++;farCount++;}
  });
  for(const model of models){const sprite=model.sprite;
  for(const mesh of model.meshBatches){mesh.count=model.nearCount;mesh.instanceMatrix.needsUpdate=true;}
  if(sprite){sprite.geometry.instanceCount=model.farCount;sprite.geometry.attributes.instanceData.needsUpdate=true;sprite.geometry.attributes.instanceYaw.needsUpdate=true;}
  }
}
function frameForest(){
  const box=new THREE.Box3();
  for(const p of forest){const atlas=models[p.model].atlas;const r=atlas.radius*p.height,c=atlas.center.clone().multiplyScalar(p.height).add(new THREE.Vector3(p.x,0,p.z));
    box.expandByPoint(c.clone().addScalar(r));box.expandByPoint(c.clone().addScalar(-r));}
  const center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length()*.5;
  const halfFov=Math.min(THREE.MathUtils.degToRad(camera.fov)*.5,Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*camera.aspect));
  const distance=radius/Math.sin(halfFov)*1.05;
  controls.target.copy(center);camera.position.copy(center).addScaledVector(new THREE.Vector3(.65,.42,.8).normalize(),distance);controls.update();
}
function resize(){const host=$('view');renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('view'));
async function apply(){if(busy)return;if($('mix').value!==activeMix){await generate(activeRecipe);return;}const previous=inspection;try{error('');inspection=false;rebuildForest(false);}catch(e){inspection=previous;error(e);}}
$('generate').onclick=()=>generate();$('bake').onclick=rebake;$('applyForest').onclick=apply;
$('randomize').onclick=()=>{$('seed').value=Math.floor(Math.random()*65536);$('seedValue').value=$('seed').value;generate();};
const presetSettings={crown:{crown:.64,branches:48,leaves:20,height:28,width:1.2,angle:100},pine:{crown:.18,branches:64,leaves:18,height:24,width:1,angle:115},open:{crown:.35,branches:18,leaves:8,height:24,width:1,angle:105},aspen:{crown:.35,branches:12,leaves:10,height:18,width:1,angle:55}};
$('preset').onchange=()=>{const settings=presetSettings[$('preset').value];
  for(const [id,value] of Object.entries(settings)){$(id).value=value;$(id+'Value').value=value;}
  $('status').textContent='Preset selected · press Generate & bake';};
$('blend').onchange=()=>{for(const model of models)if(model.sprite)model.sprite.material.uniforms.blendViews.value=+$('blend').value;frameTimes=[];measurement=null;};
$('single').onclick=()=>{try{inspection=true;rebuildForest(true);}catch(e){error(e);}};
$('overview').onclick=()=>{const previous=inspection;try{inspection=false;rebuildForest(true);}catch(e){inspection=previous;error(e);}};
$('orbit').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('orbit').textContent='Orbit: '+(controls.autoRotate?'on':'off');frameTimes=[];measurement=null;};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';previous=performance.now();measurement=null;};
$('measure').onclick=()=>{if(paused){error('Resume rendering before measuring.');return;}measurement={start:performance.now(),times:[],mode:inspection?'mesh':forestSettings.mode,count:forest.length};$('measurement').textContent='Measuring 10 seconds… keep this tab visible.';};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{if(!activeRecipe)return;download(new Blob([JSON.stringify({version:1,recipe:activeRecipe,ezTreeOptions:activeOptions,models:models.map(m=>({label:m.label,recipe:m.recipe,ezTreeOptions:m.options,atlas:{center:m.atlas.center.toArray(),radius:m.atlas.radius}})),atlas:{grid:atlas.grid,tile:atlas.tile,center:atlas.center.toArray(),radius:atlas.radius,mapping:'full-sphere-y-up-octahedral',gutter:2},forest:forestSettings,view:{blend:+$('blend').value,pixelRatio:renderer.getPixelRatio(),camera:camera.position.toArray(),target:controls.target.toArray(),inspection}},null,2)],{type:'application/json'}),'montana-tree-recipe.json');};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file||busy)return;if(file.size>100000)throw new Error('Recipe file is too large.');const data=JSON.parse(await file.text());if(data.version!==1||!['crown','pine','open','aspen'].includes(data.recipe?.preset))throw new Error('Unsupported tree recipe.');
  $('mix').value=data.forest?.mix==='mixed'?'mixed':'single';
  $('preset').value=data.recipe.preset;for(const [id] of [...treeFields,...advancedFields])if(Number.isFinite(data.recipe[id])){$(id).value=data.recipe[id];$(id+'Value').value=$(id).value;}
  for(const [id] of forestFields)if(Number.isFinite(data.forest?.[id])){$(id).value=data.forest[id];$(id+'Value').value=$(id).value;}
  if(['mesh','hybrid','impostor'].includes(data.forest?.mode))$('mode').value=data.forest.mode;
  if([4,8,12].includes(data.atlas?.grid))$('views').value=data.atlas.grid;
  if([64,128,256].includes(data.atlas?.tile))$('tile').value=data.atlas.tile;
  if([.5,1,2].includes(data.view?.pixelRatio))$('dpr').value=data.view.pixelRatio;
  if([0,1].includes(data.view?.blend))$('blend').value=data.view.blend;
  await generate();
  if(data.view?.inspection){inspection=true;rebuildForest(false);}
  const validVector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<12000);
  if(validVector(data.view?.camera)&&validVector(data.view?.target)){camera.position.fromArray(data.view.camera);controls.target.fromArray(data.view.target);controls.update();}
}catch(e){error(e);}finally{$('import').value='';}};
$('atlasModel').onchange=()=>{if(!busy)previewAtlas();};
$('downloadAtlas').onclick=()=>lastAtlasCanvas?.toBlob(blob=>{if(blob)download(blob,`montana-octahedral-atlas-${$('atlasModel').value}.png`);});
document.addEventListener('visibilitychange',()=>{measurement=null;frameTimes=[];previous=performance.now();});
function animate(now){requestAnimationFrame(animate);const dt=now-previous;previous=now;if(paused||busy||document.hidden||!atlas)return;
  controls.update();if(now-lastLOD>200&&forestSettings?.mode==='hybrid'){updateLOD();lastLOD=now;}
  renderer.render(scene,camera);frameTimes.push(dt);if(frameTimes.length>120)frameTimes.shift();
  if(measurement){measurement.times.push(dt);if(now-measurement.start>=10000){const t=measurement.times,avg=t.reduce((a,b)=>a+b,0)/t.length,sorted=[...t].sort((a,b)=>a-b);$('measurement').textContent=`${measurement.mode} · ${measurement.count.toLocaleString()} trees · ${(1000/avg).toFixed(1)} FPS · ${avg.toFixed(1)} ms mean · ${sorted[Math.floor((sorted.length-1)*.95)].toFixed(1)} ms p95 · ${renderer.domElement.width} × ${renderer.domElement.height}px. CPU/display frame timing, not GPU timer.`;measurement=null;}}
  if(now-lastStats>650){const avg=frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length;
    $('stats').textContent=`${(1000/avg).toFixed(1)} FPS · ${avg.toFixed(1)} ms/frame · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles`;
    $('cost').textContent=`${nearCount.toLocaleString()} meshes + ${farCount.toLocaleString()} impostors · ${models.length} models · atlases ${(models.reduce((n,m)=>n+m.atlas.bytes,0)/1048576).toFixed(1)} MiB color (+ depth) · ${renderer.domElement.width} × ${renderer.domElement.height}px`;
    window.__forestCounts={near:nearCount,far:farCount,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};lastStats=now;
  }
}
requestAnimationFrame(animate);generate();
