import {correctedDriveway,GRAVEL_EXCLUSIONS,grassReclaim} from './driveway-refinements.mjs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRoute,groundZone,polygonDistance,POND_OUTLINE,CLEARING,CAMP_PROPS,smooth} from './property-layout.mjs';
import {loadSagebrush} from './sagebrush.js';
import {TALL_GRASS_PATCHES,tallGrassCoverage,frontDoorGravel} from './property-refinements.mjs';
import {campSurface,HORSESHOES} from './camp-approach.mjs';
import {roadCoverage,driveLineDistance} from './driveway-measured.mjs';
import {rockGeometry} from './ground-detail.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92});
const wood=mat(0x827053),endWood=mat(0xb39a70),dark=mat(0x302c24),stone=mat(0x777468);
function box(g,size,pos,material,rotation){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);if(rotation)m.rotation.set(...rotation);g.add(m);return m;}
const PALE_LOG=new THREE.MeshStandardMaterial({color:0xcfc39a,roughness:.95});
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
// A plastic Adirondack chair as the frames show them: low seat sloping back, tall fan of back slats leaning well back, wide flat arms.
function chair(color){const g=new THREE.Group(),m=mat(color);
 for(let i=0;i<5;i++)box(g,[.1,.04,.5],[(i-2)*.11,.3,.08],m,[.12,0,0]);
 for(let i=0;i<5;i++){const x=(i-2)*.11,h=.72+.08*(2-Math.abs(i-2));box(g,[.095,h,.035],[x*1.12,.28+h/2*.88,-.22-h/2*.45],m,[-.47,0,x*-.25]);}
 for(const x of [-.32,.32]){box(g,[.05,.5,.06],[x,.25,.3],m);box(g,[.05,.42,.06],[x,.21,-.12],m);box(g,[.15,.035,.72],[x*1.08,.55,.06],m);}
 mergeGroup(g);return g;}
// The fire ring as the frames show it: one low ring of fist-to-head sized stones round a black ash bed, a few on a second course,
// and an old log seat on the near side (north). Not a heap of boulders.
function firepit(){const g=new THREE.Group(),R=rng(501),pitStone=mat(0x4a3d38);
 const ash=new THREE.Mesh(new THREE.CircleGeometry(1.0,24),mat(0x2e2b27));ash.rotation.x=-Math.PI/2;ash.position.y=.012;g.add(ash);
 for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2+(R()-.5)*.08,r=1.1+(R()-.5)*.1,m=new THREE.Mesh(rockGeometry(11+i%4*16),pitStone),s=.16+R()*.09;
  m.scale.set(s*1.4,s*.75,s*1.1);m.position.set(Math.cos(a)*r,s*.35,Math.sin(a)*r);m.rotation.set((R()-.5)*.3,-a,(R()-.5)*.25);g.add(m);
 }
 for(let i=0;i<8;i++){const a=R()*Math.PI*2,r=1.12,m=new THREE.Mesh(rockGeometry(27+i%3*16),pitStone),s=.11+R()*.06;m.scale.set(s*1.3,s*.7,s);m.position.set(Math.cos(a)*r,.17,Math.sin(a)*r);m.rotation.set(0,-a,0);g.add(m);}
 for(let i=0;i<3;i++){const m=log(g,.9,.07,[(i-1)*.2,.07,(R()-.5)*.3],[Math.PI/2,0,(i%2)*1.2]);m.material=dark;}
 {const seat=log(g,2.1,.2,[.25,.24,-1.75],[0,0,Math.PI/2]);seat.material=mat(0x4b443d);for(const x of [-.55,.95]){const m=new THREE.Mesh(rockGeometry(43),pitStone);m.scale.set(.16,.12,.14);m.position.set(x,.08,-1.75);g.add(m);}}
 mergeGroup(g);return g;}
function horseshoePit(){
 const g=new THREE.Group(),stake=mat(0x626965);
 // Three slim poles laid on the grass, two sides and a back, open toward the
 // opposing stake (+Z). No sand box: the frame sits directly on the lawn.
 for(const x of [-.8,.8])log(g,1.1,.05,[x,.05,0],[Math.PI/2,0,0]);
 log(g,1.65,.05,[0,.05,-.52],[0,0,Math.PI/2]);
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.43,8),stake);pin.position.set(0,.2,.2);pin.rotation.x=-.12;g.add(pin);
 mergeGroup(g);g.name='horseshoe-pit';return g;
}
// A low heap of split firewood on the ground, as the May frames show it: no rack, no roof.
function stoneRow(len,seed){const g=new THREE.Group(),R=rng(seed),m=mat(0x8d8a80),n=Math.round(len/.32);for(let i=0;i<n;i++){const r=.1+R()*.11,o=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),m);o.position.set((i-(n-1)/2)*len/n+(R()-.5)*.1,r*.55,(R()-.5)*.28);o.rotation.set(R()*3,R()*3,R()*3);o.scale.y=.7;g.add(o);}mergeGroup(g);return g;}
// A chicken-wire cage full of field stones, as the frames show them: a short round column, stones packed to the top, a few wire hoops and uprights.
function rockCage(radius,height,seed){const g=new THREE.Group(),R=rng(seed),m=mat(0x4f4b44),light=mat(0x6d675b),wire=mat(0x3c3e3b),rows=Math.max(3,Math.round(height/.2));
 for(let row=0;row<rows;row++){const n=Math.max(5,Math.round(radius*16)),y=.1+(row+.5)*(height-.1)/rows;for(let i=0;i<n;i++){const a=(i+R())/n*Math.PI*2,r=radius*(.62+R()*.22),o=new THREE.Mesh(rockGeometry(7+Math.floor(R()*60),1),R()<.3?light:m),k=.1+R()*.07;o.scale.set(k*1.25,k*.85,k);o.position.set(Math.cos(a)*r,y,Math.sin(a)*r);o.rotation.set(R()*3,R()*6,R()*3);g.add(o);}}
 for(let i=0;i<7;i++){const h=new THREE.Mesh(new THREE.TorusGeometry(radius,.006,3,18),wire);h.rotation.x=Math.PI/2;h.position.y=.08+i*(height-.1)/6;g.add(h);}
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2,u=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,height,3),wire);u.position.set(Math.cos(a)*radius,height/2,Math.sin(a)*radius);g.add(u);}
 mergeGroup(g);return g;}
// The entry arch at the start of the driveway: two stained log posts and a log laid across their tops, overhanging both sides. Posts run below the ground line so a slope never shows a gap.
function entryArch(){const g=new THREE.Group(),m=mat(0x8a3f24),end=mat(0xa8805a),b=mat(0x77614f),paint=[m,end,end],span=4.6,h=5;
 for(const x of [-span/2,span/2])log(g,h+.8,.14,[x,(h-.8)/2,0],[0,0,0]).material=paint;
 log(g,span+1.7,.15,[.18,h+.1,0],[0,0,Math.PI/2]).material=[b,end,end];
 box(g,[.22,.1,.02],[-span/2,1.25,.145],mat(0x2fa37a));
 mergeGroup(g);return g;}
// Firewood rounds stacked ends-out between end stakes, after the woodpile in the Mathwood props lab: rows sit in each other's hollows.
// The real stacks are low and loose (his note on the renders): rows shorten and wander toward the top, rounds sit crooked and some are
// missing, no tall end stakes.
function woodStack(len,height,seed){const g=new THREE.Group(),R=rng(seed),r=.085,up=r*1.6,rows=Math.round(height/up),n0=Math.max(2,Math.round(len/(r*1.9)));
 for(const z of[-.18,.18])box(g,[len+.12,.07,.08],[0,.035,z],mat(0x4a3d30));
 for(let row=0;row<rows;row++){const shrink=1-row/rows*.45*(.6+R()*.8),n=Math.max(1,Math.round((n0-(row%2))*shrink)),shift=(R()-.5)*len*.12;
  for(let i=0;i<n;i++){if(R()<.12)continue;log(g,.38+R()*.16,r*(.85+R()*.3),[(i-(n-1)/2)*len/n0+shift+(R()-.5)*.05,.09+r+row*up*(.92+R()*.12),(R()-.5)*.14],[Math.PI/2+(R()-.5)*.25,(R()-.5)*.35,(R()-.5)*.2]);}}
 for(let i=0;i<5;i++)log(g,.35+R()*.15,r*(.8+R()*.3),[(R()-.5)*(len+.8),r*.9,(R()<.5?-1:1)*(.35+R()*.3)],[R()*.4,R()*6.28,Math.PI/2]);
 mergeGroup(g);return g;}
// The tarped stack at the fire pit's east edge (picture 7): a beige tarp pulled over the top and most of the way down the sides, the
// rounds' ends showing under its hem, and red metal stakes at the corners holding the stack in.
function tarpedStack(len,height,seed){const g=woodStack(len,height,seed),R=rng(seed+5),W=.72,top=height+.14;
 const geo=new THREE.BoxGeometry(len+.3,top-.3,W,14,3,4),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i)+(top-.3)/2+.3,z=pos.getZ(i);const up=(y-.3)/(top-.3),edge=Math.abs(z)/(W/2);
  y-=up>.99?edge*edge*.16-Math.sin(x*2.3+seed)*.03:up>.5?edge*(up-.5)*.1:0;   // a rounded top, sagging here and there
  z*=1+(1-up)*.12;x*=1+(1-up)*.04;                                     // the hem flares out a little
  y+=(R()-.5)*.025;pos.setXYZ(i,x,y,z);}
 geo.computeVertexNormals();const t=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x6f644d,roughness:.95}));g.add(t);
 const red=mat(0x9e2a1f);for(const x of [-1,1])for(const z of [-1,1]){const k=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.25,6),red);k.position.set(x*(len/2+.12),.6,z*(W/2+.06));k.rotation.z=(R()-.5)*.12;g.add(k);}
 mergeGroup(g);return g;}
// The rope swing on the big dead tree (phone photo and video of 2026-05-16): a yellow rope tied to a dead limb on the downhill side,
// a knot, a short chain, a black strap and a round seat. Local +x runs out along the limb; drop is how far the ground under the
// seat lies below the trunk's foot.
function ropeSwing(limbY,reach,drop){const g=new THREE.Group(),tilt=.12,L=reach+.15,c=Math.cos(tilt),s=Math.sin(tilt);
 const limb=new THREE.Mesh(new THREE.CylinderGeometry(.05,.12,L,7),mat(0x76736c));limb.rotation.z=-Math.PI/2+tilt;limb.position.set(.1+L/2*c,limbY+L/2*s,0);g.add(limb);
 const x=.1+(L-.25)*c,top=limbY+(L-.25)*s-.05,seat=-drop+.55;
 const seg=(y0,y1,r,color)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,y1-y0,6),mat(color));m.position.set(x,(y0+y1)/2,0);g.add(m);};
 seg(seat,seat+1.1,.012,0x1f1e1c);seg(seat+1.1,seat+1.45,.01,0x8a8a86);seg(seat+1.45,seat+1.62,.032,0xc9b25e);seg(seat+1.62,top,.016,0xc9b25e);
 const d=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.045,14),mat(0x2b2622));d.position.set(x,seat,0);g.add(d);
 mergeGroup(g);return g;}
function lumber(pieces,color=0x9c8a6c){const g=new THREE.Group(),R=rng(77),m=mat(color),dk=mat(0x8d7a5c);for(let i=0;i<pieces;i++)box(g,[3.2+R()*.5,.05,.2+R()*.14],[(R()-.5)*.3,.05+Math.floor(i/4)*.06,(i%4-1.5)*.32+(R()-.5)*.06],R()<.3?dk:m,[0,(R()-.5)*.06,0]);mergeGroup(g);return g;}
function brushPile(){const g=new THREE.Group(),R=rng(303),m=mat(0x6b5a43),d=mat(0x4a3f30);for(let i=0;i<34;i++){const a=R()*6.283,l=1.4+R()*1.6,c=new THREE.Mesh(new THREE.CylinderGeometry(.018,.045,l,5),R()<.5?m:d);c.position.set(Math.cos(a)*R()*.9,.12+R()*.55,Math.sin(a)*R()*.9);c.rotation.set((R()-.5)*1.1,R()*6.28,Math.PI/2+(R()-.5)*.8);g.add(c);}mergeGroup(g);return g;}
function pedestal(w,h,d,color){const g=new THREE.Group();box(g,[w,h,d],[0,h/2,0],mat(color));box(g,[w*1.1,.04,d*1.1],[0,h+.02,0],mat(color));mergeGroup(g);return g;}
function board(len,w,color=0xc4ad80){const g=new THREE.Group();box(g,[len,.05,w],[0,.04,0],mat(color));mergeGroup(g);return g;}
// The root cellar's outer door, built new and tidy: a framed plank door lying on the slope, measured by triangulating its outline in two drone frames
// (about 1.2 x 1.85 m, rising 26 degrees to the north), with the plain pale threshold panel at its lower end. Local +z runs downhill; y is from the ground at its centre.
function rootCellar(){const g=new THREE.Group(),R=rng(1417),W=1.2,L=1.85,frame=mat(0x5f4a33),strap=mat(0x3a342e);
 const door=new THREE.Group();door.position.set(0,.04,0);door.rotation.x=Math.atan(.49);g.add(door);
 const n=7;for(let i=0;i<n;i++)box(door,[W/n-.01,.05,L],[(i-(n-1)/2)*W/n,.03,0],mat([0x7c6549,0x735d43,0x846c4f][Math.floor(R()*3)]));
 for(const z of [-.62,.1])box(door,[W-.04,.03,.12],[0,.07,z],frame);
 for(const x of [-.34,.34])box(door,[.05,.012,.42],[x,.09,-.62-.02],strap);
 for(const x of [-1,1])box(door,[.13,.14,L+.26],[x*(W/2+.065),.03,0],frame);
 for(const z of [-1,1])box(door,[W+.26,.14,.13],[0,.03,z*(L/2+.065)],frame);
 box(door,[.66,.03,.85],[0,.075,.42],mat(0xbdb8ac));
 door.traverse(o=>{if(o.isMesh)o.updateMatrix();});door.updateMatrix();
 for(const m of [...door.children]){m.applyMatrix4(door.matrix);g.add(m);}g.remove(door);
 mergeGroup(g);return g;}
// The old timbers lying just above the door, measured; left as they are.
function cellarTimbers(){const g=new THREE.Group(),beam=mat(0x8a7a64),O=new THREE.Vector3(-7,125.3,-6);
 const add=(x0,y0,z0,x1,y1,z1,r)=>{const a=new THREE.Vector3(x0,y0,z0).sub(O),d=new THREE.Vector3(x1,y1,z1).sub(O).sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r*.9,r,d.length(),7),beam);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());g.add(m);};
 add(-7.96,125.08,-5.76,-5.97,125.21,-5.67,.09);add(-7.86,125.6,-6.54,-6.1,125.64,-6.41,.08);add(-7.5,125.5,-6.75,-6,125.58,-6.6,.07);
 g.children.forEach(m=>m.updateMatrix());mergeGroup(g);return g;}
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
 for(const t of tiles){const p=t.pos;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(x<6||x>46||z<50||z>80)continue;const d=polygonDistance(x,z);if(d< -3)continue;
 const target=d>=0?level-.12-1.8*smooth(0,4,d):level+.08;
 const mix=d>=0?1:1-smooth(0,3,-d);t.baseY[i]=t.baseY[i]*(1-mix)+target*mix;
 }}return level;
}
export async function createPropertyNature({scene,heightAt,driveway,buildings,pondLevel,paintUniforms}){
 const route=createRoute(driveway),R=rng(423031),o=new THREE.Object3D(),chunks=new Map(),props=[],wind={value:0},fadeDistance={value:90};let vex=1,quality=1,lastCam=new THREE.Vector3(1e8,0,0),radius=70;
 const geos={grass:grassGeometry(71),reeds:grassGeometry(75,true),white:flowerGeometry(81,false),yellow:flowerGeometry(85,true)};
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});
 function plantMaterial(material,sway){
 material.onBeforeCompile=sh=>{Object.assign(sh.uniforms,paintUniforms);sh.uniforms.plantTime=wind;sh.uniforms.plantDistance=fadeDistance;
 sh.vertexShader='varying vec2 plantGround;uniform float plantTime;varying float plantViewDistance;\n'+sh.vertexShader;
 sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 transformed.x+=sin(plantTime*.85+root.x*.37+root.z*.2)*position.y*position.y*${sway.toFixed(3)};
 plantGround=root.xz;plantViewDistance=length(cameraPosition.xz-root.xz)+abs(cameraPosition.y-root.y)*.2;`);
 sh.fragmentShader='varying vec2 plantGround;uniform sampler2D paintSurface;uniform sampler2D paintMoisture;uniform float paintHalf;uniform float plantDistance;varying float plantViewDistance;\n'+sh.fragmentShader;
 sh.fragmentShader=sh.fragmentShader.replace('void main() {',`void main(){vec2 paintUV=vec2(plantGround.x/(2.*paintHalf)+.5,.5-plantGround.y/(2.*paintHalf));vec4 paintedSurface=texture2D(paintSurface,paintUV);if(${sway===.08?'true':'false'}&&paintedSurface.r*paintedSurface.a>.35)discard;float visibility=1.-smoothstep(plantDistance-18.,plantDistance,plantViewDistance);if(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>visibility)discard;`);
 if(material.name==='sagebrush-body')sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','vec3 normal=normalize(vNormal);vec3 nonPerturbedNormal=normal;');
 sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec4 moisture=texture2D(paintMoisture,paintUV);diffuseColor.rgb*=mix(vec3(1.),mix(vec3(1.8,1.1,.85),vec3(.9,1.13,.96),moisture.r),moisture.a);`);
 };
 material.customProgramCacheKey=()=>`property-plant-${sway}-${material.name}`;
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
 const correctedRoute=createRoute(correctedDriveway(driveway)),reclaimR=rng(20261011);
 for(const patch of GRAVEL_EXCLUSIONS){const xs=patch.outline.map(p=>p.x),zs=patch.outline.map(p=>p.z),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
  for(let i=0;i<(xmax-xmin)*(zmax-zmin)*2;i++){const x=xmin+reclaimR()*(xmax-xmin),z=zmin+reclaimR()*(zmax-zmin);if(reclaimR()<grassReclaim(x,z))add('grass',x,z,.8+reclaimR()*.4);}
 }
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
    chunk.list=chunk.list.filter(t=>{const s=campSurface(t.x,t.z);if(Math.abs(t.x+7.28)<1&&Math.abs(t.z+4.67)<1.2||roadCoverage(t.x,t.z)>.3||correctedRoute.nearest(t.x,t.z).distance<.5||(t.x>-30&&driveLineDistance(t.x,t.z)<1.6)||HORSESHOES.some(p=>Math.hypot(t.x-p.x,t.z-p.z)<1.1))return false;
      if(chunk.kind!=='grass')return false;   // the big meadow flowers gave way to the small real flecks in plant-fill.js
      // Open ground now has the meadow grass; these full tufts stay only in the marked tall patches and reclaimed corners.
      if(!t.tallPatch&&!(t.s>=.8&&grassReclaim(t.x,t.z)>.5)&&s.tallGrass<.1)return false;
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
 function place(group,p,rotation=0,id='prop:'+props.length,label='Property prop'){group.position.set(p.x,heightAt(p.x,p.z),p.z);group.rotation.y=rotation;scene.add(group);props.push({group,baseY:group.position.y,id,label});return group;}
 place(firepit(),CAMP_PROPS.fire,0,'prop:firepit','Campfire');place(picnic(),CAMP_PROPS.picnic,.1,'prop:picnic','Picnic table');place(woodStack(2.8,.85,916),{x:-5.89,z:35.76},-.145,'prop:wood','Firewood stack');
 // the second stack, crosswise to the first: the tarped one. Picture 7 shows it running north-south at x -8.5, in front of the
 // juniper (his batch-4 marks 07-4, 07-5), and picture 8 shows only a glimpse of it behind the group.
 place(tarpedStack(2.4,.8,917),{x:-8.5,z:35.3},-.145+Math.PI/2,'prop:wood-2','Firewood stack under a tarp');
 // The swing tree is the census snag M4_swing at (-1.31, 81.39); the limb points down the 43% slope (north-north-west), the way
 // the video shows the swing going out, toward the house clearing.
 {const T={x:-1.31,z:81.39},dir={x:-.33,z:-.94},reach=3,tip=reach*Math.cos(.12),drop=heightAt(T.x,T.z)-heightAt(T.x+dir.x*tip,T.z+dir.z*tip);
  place(ropeSwing(9.5,reach,drop),T,Math.atan2(-dir.z,dir.x),'prop:rope-swing','Rope swing');}
 // Ground clutter measured on the May mosaic and by rays from solved frames.
 [[lumber(16),-26,1,-.37,'lumber-garage','Lumber pile'],[board(2.6,.12),-22.5,.4,-.24,'board-garage','Loose board'],[brushPile(),-6.6,-7.2,.8,'brush-house','Brush heap'],
    [stoneRow(2.4,47),-5.28,6.9,-.25,'stones-boxes','Stone row'],[entryArch(),98.8,-101.7,-2.33,'entry-arch','Driveway entry arch'],[rockCage(.36,1,61),3.11,36.75,0,'rock-cage-1','Wire rock cage'],[rockCage(.34,.82,62),-25.4,15.7,0,'rock-cage-2','Wire rock cage'],[pedestal(.28,1.15,.22,0x8c97a0),-2.05,7.7,0,'pedestal-post','Utility post'],[pedestal(.75,.85,.65,0x5f7f62),-.6,8.4,.15,'pedestal-box','Utility box']
 ].forEach(([g,x,z,yaw,id,label])=>place(g,{x,z},yaw,'prop:'+id,label));
 // The two pale poles by the entry, measured on the drone mosaic. They lie along the slope: a straight piece levelled at its middle would dip under the ground and show as dashes.
 [[3.2,.075,-3.99,-1.97,0,'pole-entry'],[3.65,.08,-3.31,-.02,.16,'pole-entry-2']].forEach(([len,r,x,z,yaw,id])=>{const g=new THREE.Group();log(g,len,r,[0,0,0],[0,0,Math.PI/2]).material=[PALE_LOG,PALE_LOG,PALE_LOG];mergeGroup(g);const e=len*.5,hi=heightAt(x+Math.cos(yaw)*e,z-Math.sin(yaw)*e),lo=heightAt(x-Math.cos(yaw)*e,z+Math.sin(yaw)*e);let lift=0;for(let q=-1;q<=1;q+=.25)lift=Math.max(lift,heightAt(x+Math.cos(yaw)*e*q,z-Math.sin(yaw)*e*q)-((hi+lo)*.5+(hi-lo)*.5*q));g.children.forEach(m=>{m.position.y=r*1.05+lift+(hi+lo)*.5-heightAt(x,z);m.rotation.z+=Math.atan2(hi-lo,len);});place(g,{x,z},yaw,'prop:'+id,'Pole by the entry');});
 place(rootCellar(),{x:-7.28,z:-4.67},.03,'prop:root-cellar','Root cellar door');
 {const g=cellarTimbers(),p=place(g,{x:-7,z:-6},0,'prop:cellar-timbers','Old timbers');g.position.y=125.3;props.at(-1).baseY=125.3;}
 {const g=new THREE.Group();log(g,2.8,.13,[0,.12,0],[Math.PI/2,0,0]);mergeGroup(g);place(g,{x:-27.5,z:17.5},.97,'prop:log-west','Downed log');}
 // Loose logs beside the upper pit, measured from solved drone cameras.
 [[1.76,.15,-6.59,21.27,.49],[.95,.17,-5.3,23.22,1.45]].forEach(([len,r,x,z,yaw],i)=>{const g=new THREE.Group();log(g,len,r,[0,r*.8,0],[Math.PI/2,0,0]);mergeGroup(g);place(g,{x,z},yaw,`prop:loose-log:${i}`,`Loose log ${i+1}`);});
 HORSESHOES.forEach((p,i)=>{const other=HORSESHOES[1-i];place(horseshoePit(),p,Math.atan2(other.x-p.x,other.z-p.z),`prop:horseshoe:${i}`,`Horseshoe pit ${i+1}`);});
 const chairColors=[0x169a9c,0x2a2a2c,0x14a3a0,0xd4567a,0x14a3a0];   // (south to north, as the frames show them)
 // a loose row on the fire's west side facing it, as the July frames show (feet found by rays from picture 7)
 chairColors.forEach((color,i)=>{const z=37.9+i*1.15+(i%2)*.15,p={x:-22.4+(i%2)*.35,z},a=Math.atan2(CAMP_PROPS.fire.x-p.x,CAMP_PROPS.fire.z-p.z);place(chair(color),p,a,`prop:chair:${i}`,`Camp chair ${i+1}`);});
 // Horizontal water surface with animated ripple normals and sky tint, no reflection render pass.
 const shape=new THREE.Shape(POND_OUTLINE.map(p=>new THREE.Vector2(p.x,-p.z))),waterGeo=new THREE.ShapeGeometry(shape,24);waterGeo.rotateX(-Math.PI/2);
 const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:wind},vertexShader:'varying vec3 waterWorld;void main(){waterWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(waterWorld,1.);}',fragmentShader:`uniform float time;varying vec3 waterWorld;
 void main(){vec2 p=waterWorld.xz;vec2 ripple=vec2(sin(p.x*2.1+p.y*.83+time*.9)+sin(p.x*.7-p.y*2.4-time*.65),cos(p.y*1.8+p.x*.6+time*.7))*.025;
 vec3 normal=normalize(vec3(ripple.x,1.,ripple.y)),viewDir=normalize(cameraPosition-waterWorld);
 float fresnel=pow(1.-max(dot(normal,viewDir),0.),3.);vec3 reflectDir=reflect(-viewDir,normal);vec3 sky=mix(vec3(.72,.76,.74),vec3(.2,.38,.62),smoothstep(.02,.6,reflectDir.y));vec3 color=mix(vec3(.018,.05,.038),sky,.1+fresnel*.82);
 float ripples=.55*sin(p.x*16.7+p.y*4.1+sin(p.y*.63+time*.12)*1.7+time*1.5)+.3*sin(p.x*24.3+p.y*5.9+sin(p.x*.21)*2.-time*.9);
 color+=vec3(.006,.009,.010)*ripples;
 float glint=pow(max(dot(reflect(normalize(vec3(1.,-1.3,.6)),normal),viewDir),0.),100.);color+=vec3(.30,.29,.22)*glint;
 gl_FragColor=vec4(color,.94);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const water=new THREE.Mesh(waterGeo,waterMat);water.name='property-pond-water';water.position.y=pondLevel;scene.add(water);
 function setQuality(level,density){quality=level;radius=[45,70,95,125,150][level];fadeDistance.value=radius;for(const chunk of chunks.values())for(const im of chunk.meshes||[]){im.count=Math.max(1,Math.floor(chunk.list.length*(chunk.kind==='sage'?Math.max(.35,density):density)));im.computeBoundingSphere();}lastCam.set(1e8,0,0);}
 function update(time,camera){wind.value=time;if(camera.position.distanceToSquared(lastCam)>36){lastCam.copy(camera.position);for(const c of chunks.values())for(const im of c.meshes)im.visible=Math.hypot(camera.position.x-c.x,camera.position.z-c.z)<radius+21;}}
 function setVerticalScale(value){vex=value;water.position.y=pondLevel*vex;for(const p of props)p.group.position.y=p.baseY*vex;for(const c of chunks.values())writeTransforms(c);}
 function detachSage(){for(const [key,c] of chunks)if(c.kind==='sage'){for(const im of c.meshes){scene.remove(im);im.dispose();}chunks.delete(key);}}
 function reanchor(){for(const c of chunks.values()){for(const t of c.list)t.y=heightAt(t.x,t.z)/vex;writeTransforms(c);}for(const p of props){p.baseY=heightAt(p.group.position.x,p.group.position.z)/vex;p.group.position.y=p.baseY*vex;}}
 return {setQuality,update,setVerticalScale,water,props,chunks,pondLevel,models,detachSage,detachProps(){for(const p of props)scene.remove(p.group);props.length=0;},reanchor};
}
