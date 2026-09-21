import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id), host=$('view');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xd9e1dd);
const renderer=new THREE.WebGLRenderer({canvas:host.querySelector('canvas'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(45,1,0.05,2000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xdce8f1,0x6c6650,0.8));
const sun=new THREE.DirectionalLight(0xfff2d6,1.2);sun.position.set(-20,35,25);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:0.1,far:200});sun.shadow.bias=-0.0002;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x868d70,roughness:1}));ground.receiveShadow=true;ground.position.y=-0.015;scene.add(ground);
const grid=new THREE.GridHelper(120,120,0x777c69,0x949986);grid.material.transparent=true;grid.material.opacity=0.2;scene.add(grid);
const root=new THREE.Group();scene.add(root);
const base='../assets/vegetation-lab/',cache=new Map(),textureCache=new Map();
const loader=new THREE.TextureLoader();let manifest,selection=0,frames=0,last=performance.now(),fps=0;
function texture(url,srgb=false){if(!textureCache.has(url)){const t=loader.load(base+url,undefined,undefined,()=>{$('error').textContent=`Could not load texture ${url}`;});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(srgb)t.encoding=THREE.sRGBEncoding;textureCache.set(url,t);}return textureCache.get(url);}
function decode(s,Type){return new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);}
function geometry(p){const g=new THREE.BufferGeometry();for(const [name,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(name,new THREE.BufferAttribute(decode(p[name],Float32Array),size));g.setAttribute('uv2',g.attributes.uv);if(p.index)g.setIndex(new THREE.BufferAttribute(decode(p.index,Uint32Array),1));return g;}
async function asset(v){if(!cache.has(v.name))cache.set(v.name,(async()=>{const r=await fetch(base+v.file);if(!r.ok)throw new Error(`${v.file}: HTTP ${r.status}`);const d=await r.json(),t=v.tex;
const bark=new THREE.MeshStandardMaterial({map:texture(t.barkColor,true),normalMap:texture(t.barkNormal),roughnessMap:texture(t.barkRough),aoMap:texture(t.barkAO),roughness:1});
const leaf=new THREE.MeshStandardMaterial({map:texture(t.leaf,true),color:v.leafTint||0xffffff,alphaTest:v.alphaTest,side:THREE.DoubleSide,roughness:1});leaf.alphaToCoverage=true;
return {bark:geometry(d.branches),leaf:geometry(d.leaves),barkMat:bark,leafMat:leaf};})());return cache.get(v.name);}
function frame(){const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const fit=Math.max(size.y,size.x/camera.aspect, size.z)*1.7;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(fit*.35,fit*.35,fit));controls.update();}
async function show(reframe=false){const request=++selection;try{const vs=[$('left').value,$('right').value].map(n=>manifest.variants.find(v=>v.name===n));const assets=await Promise.all(vs.map(asset));if(request!==selection)return;
root.clear();const h=+$('height').value,equal=$('equal').checked,patch=$('mode').value==='patch';$('heightValue').value=`${h.toFixed(1)} m`;
const heights=vs.map(v=>equal?h:v.displayHeight),size=Math.max(...heights),spacing=size*.95, separation=size*(patch?4:1.6);
vs.forEach((v,i)=>{const a=assets[i],count=patch?9:1;for(let k=0;k<count;k++){const group=new THREE.Group();for(const part of ['bark','leaf']){const mesh=new THREE.Mesh(a[part],a[part+'Mat']);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}group.scale.setScalar(heights[i]);group.rotation.y=patch?k*2.399:0;group.position.set((i-.5)*separation+(patch?(k%3-1)*spacing:0),0,patch?(Math.floor(k/3)-1)*spacing:0);root.add(group);}});
$('badges').children[0].textContent='A · '+vs[0].label;$('badges').children[1].textContent='B · '+vs[1].label;
$('details').textContent=vs.map((v,i)=>`${i?'B':'A'}: ${v.triangles.toLocaleString()} triangles/plant · ${Math.round(v.bytes/1024)} KB geometry · seed ${v.seed}`).join(' | ');
$('error').textContent='';if(reframe)frame();window.__labReady=true;
}catch(e){$('error').textContent=e.message;}}
new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}).observe(host);
$('reset').onclick=frame;for(const id of ['left','right','mode','equal'])$(id).onchange=()=>show(true);$('height').oninput=()=>show(true);
$('light').onchange=()=>{const low=$('light').value==='low';sun.position.set(-20,low?8:35,25);sun.color.set(low?0xffd2a0:0xfff2d6);};
try{const r=await fetch(base+'manifest.json');if(!r.ok)throw new Error('Generate candidates with npm run bake --prefix tools');manifest=await r.json();for(const id of ['left','right'])for(const v of manifest.variants){const o=document.createElement('option');o.value=v.name;o.textContent=v.label;$(id).append(o);}$('left').value='evergreen_shrub_1301';$('right').value='broadleaf_shrub_2401';await show(true);}catch(e){$('error').textContent=e.message;}
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);frames++;const now=performance.now();if(now-last>600){fps=Math.round(frames*1000/(now-last));frames=0;last=now;$('stats').textContent=`${fps} fps · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles · grid 1 m`;}}animate();
