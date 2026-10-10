import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRoute,groundZone,polygonDistance,POND_OUTLINE,CLEARING,smooth} from './property-layout.mjs';
import {loadSagebrush} from './sagebrush.js';
import {TALL_GRASS_PATCHES,tallGrassCoverage,frontDoorGravel} from './property-refinements.mjs';
import {campSurface,HORSESHOES} from './camp-approach.mjs';
import {rockGeometry} from './ground-detail.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92});
const wood=mat(0x827053),endWood=mat(0xb39a70),dark=mat(0x302c24),stone=mat(0x777468);
function box(g,size,pos,material,rotation){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);if(rotation)m.rotation.set(...rotation);g.add(m);return m;}
function log(g,length,radius,pos,rotation=[0,0,Math.PI/2]){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius*.86,radius,length,9,1,false),[wood,endWood,endWood]);m.position.set(...pos);m.rotation.set(...rotation);g.add(m);return m;}
function mergeGroup(group){
 const buckets=new Map();group.updateMatrixWorld(true);
 for(const child of [...group.children]){
  if(!child.isMesh)continue;
  const source=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();source.applyMatrix4(child.matrix);
  const groups=Array.isArray(child.material)?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}];
  for(const part of groups){const material=Array.isArray(child.material)?child.material[part.materialIndex]:child.material,g=new THREE.BufferGeometry();
   for(const [name,attr] of Object.entries(source.attributes))g.setAttribute(name,new THREE.BufferAttribute(attr.array.slice(part.start*attr.itemSize,(part.start+part.count)*attr.itemSize),attr.itemSize));
   if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(g);
  }
  source.dispose();group.remove(child);child.geometry.dispose();
 }
 for(const [material,geos] of buckets){const merged=mergeGeometries(geos,false);group.add(new THREE.Mesh(merged,material));geos.forEach(g=>g.dispose());}
}
function picnic(){const g=new THREE.Group();
 for(let i=0;i<5;i++)box(g,[2.25,.065,.145],[0,.77,(i-2)*.16],wood);
 for(const side of [-1,1])for(let p=0;p<2;p++)box(g,[2.3,.06,.16],[0,.43,side*(.69+p*.17)],wood);
 const frame=mat(0x252a28);
 for(const x of [-.78,.78]){
  const points=[[-.85,.05],[-.9,.1],[-.74,.39],[-.46,.48],[-.27,.73],[.27,.73],[.46,.48],[.74,.39],[.9,.1],[.85,.05]].map(([z,y])=>new THREE.Vector3(x,y,z));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.024,6,false),frame));
  box(g,[.06,.045,1.65],[x,.405,0],frame);
 }
 box(g,[1.6,.045,.045],[0,.52,0],frame);mergeGroup(g);return g;}
function chair(color){const g=new THREE.Group(),m=mat(color);
 for(let i=0;i<5;i++){box(g,[.09,.05,.48],[(i-2)*.1,.36,.05],m);box(g,[.095,.63,.045],[(i-2)*.1,.67,-.2],m,[-.22,0,0]);}
 for(const x of [-.29,.29]){box(g,[.05,.48,.055],[x,.23,.2],m);box(g,[.05,.51,.055],[x,.23,-.2],m,[-.16,0,0]);box(g,[.095,.045,.62],[x,.56,.03],m);}
 mergeGroup(g);return g;}
function firepit(){const g=new THREE.Group(),R=rng(501);
 const ash=new THREE.Mesh(new THREE.CircleGeometry(1.03,24),mat(0x49443b));ash.rotation.x=-Math.PI/2;ash.position.y=.015;g.add(ash);
 for(let row=0;row<2;row++)for(let i=0;i<14;i++){
  const a=(i+.45*row)/14*Math.PI*2,r=1.08+(R()-.5)*.09,m=new THREE.Mesh(rockGeometry(11+i%4*16),stone),s=.24+R()*.1;
  m.scale.set(s*1.5,s*.8,s);m.position.set(Math.cos(a)*r,.12+row*.19,Math.sin(a)*r);m.rotation.set((R()-.5)*.3,-a,(R()-.5)*.25);g.add(m);
 }
 for(let i=0;i<4;i++){const m=log(g,1.1,.09,[(i-1.5)*.17,.1+i*.04,0],[Math.PI/2,0,(i%2)*1.3]);m.material=dark;}
 mergeGroup(g);return g;}
function horseshoePit(){
 const g=new THREE.Group(),sand=mat(0x908976),stake=mat(0x626965);
 box(g,[1.15,.025,1.45],[0,.018,0],sand);
 // Three substantial logs per pit: two sides and a back, open toward the
 // opposing stake (+Z). Retain separate bark and cut-end wood materials.
 for(const x of [-.72,.72])log(g,1.65,.14,[x,.13,0],[Math.PI/2,0,0]);
 log(g,1.7,.14,[0,.13,-.92],[0,0,Math.PI/2]);
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.43,8),stake);pin.position.set(0,.2,-.14);pin.rotation.x=-.12;g.add(pin);
 mergeGroup(g);g.name='horseshoe-pit';return g;
}
function woodpile(){const g=new THREE.Group(),R=rng(916);
 for(const x of [-1.3,1.3])box(g,[.12,1.15,.12],[x,.56,0],dark);box(g,[2.75,.12,.8],[0,.1,0],wood);
 for(let row=0;row<4;row++)for(let i=0;i<10-row;i++)log(g,.68+R()*.16,.105+R()*.025,[(i-(9-row)/2)*.25,.24+row*.2,(R()-.5)*.09],[Math.PI/2,(R()-.5)*.06,0]);
 box(g,[2.5,.035,.95],[0,1.01,0],mat(0x586052),[0,0,.04]);mergeGroup(g);return g;}
function grassGeometry(seed,reed=false){
 const R=rng(seed),positions=[],colors=[],indices=[];
 const add=(x,y,z,c)=>{positions.push(x,y,z);colors.push(...c);};
 for(let i=0;i<(reed?12:24);i++){
  const angle=R()*Math.PI*2,rad=Math.sqrt(R())*.22,x=Math.cos(angle)*rad,z=Math.sin(angle)*rad,h=(reed?.85:.24)+R()*(reed?.55:.43),w=reed?.014+R()*.012:.004+R()*.006,lean=.12+R()*.23,dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;
  const color=reed?[.37,.43,.19]:[.20+R()*.09,.35+R()*.13,.08+R()*.055];
  add(x-dz*w,0,z+dx*w,color.map(c=>c*.65));add(x+dz*w,0,z-dx*w,color.map(c=>c*.65));
  add(x+dx*lean*.4-dz*w*.65,h*.55,z+dz*lean*.4+dx*w*.65,color);add(x+dx*lean*.4+dz*w*.65,h*.55,z+dz*lean*.4-dx*w*.65,color);
  add(x+dx*lean,h,z+dz*lean,color.map(c=>c*1.25));indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function flowerGeometry(seed,yellow){
 const R=rng(seed),geos=[];for(let j=0;j<4;j++){const x=(R()-.5)*.5,z=(R()-.5)*.5,h=.3+R()*.35;
 const stem=new THREE.CylinderGeometry(.008,.01,h,3).translate(x,h/2,z);paint(stem,[.28,.39,.13]);geos.push(stem);
 for(let k=0;k<7;k++){const a=k/7*Math.PI*2,petal=new THREE.CircleGeometry(.034,5);petal.rotateX(-Math.PI/2);petal.scale(1,1,.65);petal.translate(x+Math.cos(a)*.027,h,z+Math.sin(a)*.027);paint(petal,yellow?[.95,.73,.14]:[.91,.90,.75]);geos.push(petal);}
 const heart=new THREE.SphereGeometry(.018,5,3).translate(x,h+.006,z);paint(heart,[.83,.59,.10]);geos.push(heart);
 }return mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g),false);
}
function paint(g,c){const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)colors.set(c,i);g.setAttribute('color',new THREE.BufferAttribute(colors,3));}
export function preparePond(tiles,sample){
 const levels=POND_OUTLINE.map(p=>sample(p.x,p.z)).sort((a,b)=>a-b),level=levels[Math.floor(levels.length/2)]+.06;
 for(const t of tiles){const p=t.pos;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(x< -14||x>36||z<48||z>76)continue;const d=polygonDistance(x,z);if(d< -3)continue;
 const target=d>=0?level-.12-1.8*smooth(0,4,d):level+.08;
 const mix=d>=0?1:1-smooth(0,3,-d);t.baseY[i]=t.baseY[i]*(1-mix)+target*mix;
 }}return level;
}
export async function createPropertyNature({scene,heightAt,driveway,buildings,pondLevel}){
 const route=createRoute(driveway),R=rng(423031),o=new THREE.Object3D(),chunks=new Map(),props=[],wind={value:0},fadeDistance={value:90};let vex=1,quality=1,lastCam=new THREE.Vector3(1e8,0,0),radius=70;
 const geos={grass:grassGeometry(71),reeds:grassGeometry(75,true),white:flowerGeometry(81,false),yellow:flowerGeometry(85,true)};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});
 function plantMaterial(material,sway){
 material.onBeforeCompile=sh=>{sh.uniforms.plantTime=wind;sh.uniforms.plantDistance=fadeDistance;
 sh.vertexShader='uniform float plantTime;varying float plantViewDistance;\n'+sh.vertexShader;
 sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 transformed.x+=sin(plantTime*.85+root.x*.37+root.z*.2)*position.y*position.y*${sway.toFixed(3)};
 plantViewDistance=length(cameraPosition.xz-root.xz)+abs(cameraPosition.y-root.y)*.2;`);
 sh.fragmentShader='uniform float plantDistance;varying float plantViewDistance;\n'+sh.fragmentShader;
 sh.fragmentShader=sh.fragmentShader.replace('void main() {',`void main(){float visibility=1.-smoothstep(plantDistance-18.,plantDistance,plantViewDistance);if(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>visibility)discard;`);
 };
 material.customProgramCacheKey=()=>`property-plant-${sway}`;
 }
 plantMaterial(material,.08);
 const models=Object.fromEntries(Object.entries(geos).map(([kind,geometry])=>[kind,[{geometry,material}]]));
 try{models.sage=await loadSagebrush();for(const part of models.sage)plantMaterial(part.material,.018);}
 catch(error){models.sage=[];console.warn('Sagebrush model unavailable:',error);}
 function add(kind,x,z,s=1,variation={}){if(!models[kind].length)return;const cellX=Math.floor(x/28),cellZ=Math.floor(z/28),key=kind+':'+cellX+':'+cellZ;if(!chunks.has(key))chunks.set(key,{kind,x:(cellX+.5)*28,z:(cellZ+.5)*28,list:[]});chunks.get(key).list.push({x,z,y:heightAt(x,z),s,r:R()*Math.PI*2,rank:R(),...variation});}
 function candidate(x,z){const zone=groundZone(x,z,route,buildings);if(!['meadow','median'].includes(zone))return;
 const patch=.5+.25*Math.sin(x*.19+Math.sin(z*.09)*2)+.25*Math.cos(z*.14-x*.11);if(zone==='meadow'&&R()>.4+patch*.58)return;
 const mown=Math.hypot(x-CLEARING.fire.x,z-CLEARING.fire.z)<17;
 add('grass',x,z,zone==='median'?.21+R()*.16:mown?.25+R()*.22:.6+R()*.65);
 if(zone==='meadow'&&!mown&&patch>.6&&R()<.045)add(R()<.75?'white':'yellow',x,z,.7+R()*.4);
 }
 for(let i=0;i<24000;i++){const p=route.at(R()*route.total,(R()<.5?-1:1)*(2.3+R()*19));candidate(p.x,p.z);}
 for(let i=0;i<24000;i++){const a=R()*Math.PI*2,r=Math.sqrt(R())*78;candidate(-8+Math.cos(a)*r,25+Math.sin(a)*r);}
 for(let d=0;d<route.total-23;d+=.35){const p=route.at(d,(R()-.5)*.42);if(groundZone(p.x,p.z,route,buildings)==='median')add('grass',p.x,p.z,.18+R()*.16);}
 // The hillside reference has uneven thickets of open, woody sagebrush.
 // Keep gaps, the mown camp and the entire road clear; avoid coincident shrubs.
 const sageR=rng(701),occupied=new Map(),cell=3;
 for(let i=0;i<6000;i++){
  const p=route.at(sageR()*route.total,(sageR()<.5?-1:1)*(3.8+sageR()*33));
  const patch=.5+.25*Math.sin(p.x*.13+Math.sin(p.z*.07)*2)+.25*Math.cos(p.z*.12-p.x*.06);
  if(sageR()>.03+.88*smooth(.25,.7,patch)||groundZone(p.x,p.z,route,buildings)!=='meadow'||route.nearest(p.x,p.z).distance<3.5||Math.hypot(p.x-CLEARING.fire.x,p.z-CLEARING.fire.z)<17)continue;
  const s=.65+sageR()*.85,cx=Math.floor(p.x/cell),cz=Math.floor(p.z/cell);let crowded=false;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const q of occupied.get(`${cx+dx}:${cz+dz}`)||[]){if(Math.hypot(p.x-q.x,p.z-q.z)<.55*(s+q.s))crowded=true;}
  if(crowded)continue;
  const key=`${cx}:${cz}`;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({...p,s});
  add('sage',p.x,p.z,s,{sx:.9+sageR()*.25,sz:.85+sageR()*.3,tint:.88+sageR()*.18});
 }
 for(let i=0;i<800;i++){const x=-12+R()*47,z=50+R()*24,d=polygonDistance(x,z);if(d<-.1&&d> -2.5)add('reeds',x,z,.7+R()*.5);}
 // Add denser grass only after the stable sage scatter has been generated.
 // This keeps saved landscape IDs unchanged. Tufts remain instanced and culled.
 const meadowR=rng(20261010);
 for(const patch of TALL_GRASS_PATCHES){
  const xs=patch.outline.map(p=>p.x),zs=patch.outline.map(p=>p.z),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
  for(let i=0;i<(xmax-xmin)*(zmax-zmin)*3;i++){
   const x=xmin+meadowR()*(xmax-xmin),z=zmin+meadowR()*(zmax-zmin),cover=tallGrassCoverage(x,z);
   if(meadowR()>cover||frontDoorGravel(x,z)>.2)continue;
   add('grass',x,z,1.15+meadowR()*.65,{tallPatch:true});
   if(meadowR()<.06)add(meadowR()<.7?'yellow':'white',x,z,.9+meadowR()*.4,{tallPatch:true});
  }
 }
 function writeTransforms(chunk){
  for(let i=0;i<chunk.list.length;i++){const t=chunk.list[i];o.position.set(t.x,t.y*vex,t.z);o.rotation.set(0,t.r,0);o.scale.set(t.s*(t.sx||1),t.s,t.s*(t.sz||1));o.updateMatrix();for(const im of chunk.meshes)im.setMatrixAt(i,o.matrix);}
  for(const im of chunk.meshes){im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();}
 }
 for(const chunk of chunks.values()){
  // Trim after generating the stable scatter: changing this footprint must not
  // renumber the sagebrush objects in existing exported landscape edits.
  if(chunk.kind==='grass'||chunk.kind==='white'||chunk.kind==='yellow'){
    chunk.list=chunk.list.filter(t=>{const s=campSurface(t.x,t.z);if(s.gravel>.45||HORSESHOES.some(p=>Math.hypot(t.x-p.x,t.z-p.z)<1.1))return false;
      if(chunk.kind!=='grass')return s.lawn<.3;
      if(s.tallGrass>.1&&!t.tallPatch)t.s=Math.max(t.s,1.05+s.tallGrass*.5);
      t.s*=1-s.lawn*.83;return true;});
  }
  if(!chunk.list.length){chunk.meshes=[];continue;}
  chunk.list.sort((a,b)=>a.rank-b.rank);
  chunk.meshes=models[chunk.kind].map(({geometry,material})=>{
   const im=new THREE.InstancedMesh(geometry,material,chunk.list.length);im.name='property-'+chunk.kind;
   if(chunk.kind==='sage'){const color=new THREE.Color();chunk.list.forEach((t,i)=>im.setColorAt(i,color.setRGB(t.tint,t.tint,t.tint)));}
   scene.add(im);return im;
  });
  chunk.im=chunk.meshes[0];writeTransforms(chunk);
 }
 function place(group,p,rotation=0){group.position.set(p.x,heightAt(p.x,p.z),p.z);group.rotation.y=rotation;scene.add(group);props.push({group,baseY:group.position.y});return group;}
 place(firepit(),CLEARING.fire);place(picnic(),CLEARING.picnic,.1);place(woodpile(),CLEARING.wood,-.3);
 HORSESHOES.forEach((p,i)=>{const other=HORSESHOES[1-i];place(horseshoePit(),p,Math.atan2(other.x-p.x,other.z-p.z));});
 const chairColors=[0x2b9798,0xce5669,0x40a6a1,0xc85871,0x3f91a0];
 chairColors.forEach((color,i)=>{const a=-2.5+i*.38,p={x:CLEARING.fire.x+Math.sin(a)*2.35,z:CLEARING.fire.z+Math.cos(a)*2.35};place(chair(color),p,a+Math.PI);});
 // Horizontal water surface with animated ripple normals and sky tint, no reflection render pass.
 const shape=new THREE.Shape(POND_OUTLINE.map(p=>new THREE.Vector2(p.x,-p.z))),waterGeo=new THREE.ShapeGeometry(shape,24);waterGeo.rotateX(-Math.PI/2);
 const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:wind},vertexShader:'varying vec3 waterWorld;void main(){waterWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(waterWorld,1.);}',fragmentShader:`uniform float time;varying vec3 waterWorld;
 void main(){vec2 p=waterWorld.xz;vec2 ripple=vec2(sin(p.x*2.1+p.y*.83+time*.9)+sin(p.x*.7-p.y*2.4-time*.65),cos(p.y*1.8+p.x*.6+time*.7))*.025;
 vec3 normal=normalize(vec3(ripple.x,1.,ripple.y)),viewDir=normalize(cameraPosition-waterWorld);
 float fresnel=pow(1.-max(dot(normal,viewDir),0.),3.);vec3 color=mix(vec3(.075,.14,.10),vec3(.36,.51,.60),.12+fresnel*.68);
 float ripples=.55*sin(p.x*16.7+p.y*4.1+sin(p.y*.63+time*.12)*1.7+time*1.5)+.3*sin(p.x*24.3+p.y*5.9+sin(p.x*.21)*2.-time*.9);
 color+=vec3(.006,.009,.010)*ripples;
 float glint=pow(max(dot(reflect(normalize(vec3(1.,-1.3,.6)),normal),viewDir),0.),100.);color+=vec3(.30,.29,.22)*glint;
 gl_FragColor=vec4(color,.88);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const water=new THREE.Mesh(waterGeo,waterMat);water.name='property-pond-water';water.position.y=pondLevel;scene.add(water);
 function setQuality(level,density){quality=level;radius=[45,70,95,125,150][level];fadeDistance.value=radius;for(const chunk of chunks.values())for(const im of chunk.meshes||[]){im.count=Math.max(1,Math.floor(chunk.list.length*(chunk.kind==='sage'?Math.max(.35,density):density)));im.computeBoundingSphere();}lastCam.set(1e8,0,0);}
 function update(time,camera){wind.value=time;if(camera.position.distanceToSquared(lastCam)>36){lastCam.copy(camera.position);for(const c of chunks.values())for(const im of c.meshes)im.visible=Math.hypot(camera.position.x-c.x,camera.position.z-c.z)<radius+21;}}
 function setVerticalScale(value){vex=value;water.position.y=pondLevel*vex;for(const p of props)p.group.position.y=p.baseY*vex;for(const c of chunks.values())writeTransforms(c);}
 function detachSage(){for(const [key,c] of chunks)if(c.kind==='sage'){for(const im of c.meshes){scene.remove(im);im.dispose();}chunks.delete(key);}}
 function reanchor(){for(const c of chunks.values()){for(const t of c.list)t.y=heightAt(t.x,t.z)/vex;writeTransforms(c);}for(const p of props){p.baseY=heightAt(p.group.position.x,p.group.position.z)/vex;p.group.position.y=p.baseY*vex;}}
 return {setQuality,update,setVerticalScale,water,props,chunks,pondLevel,models,detachSage,reanchor};
}
