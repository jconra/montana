// MEADOW GRASS: low tufts over all the open ground near the property, thicker in patches, thinning out with distance.
// A tuft grows up out of the ground as the camera nears it (each at its own distance, so there is no visible ring) rather
// than popping in. Chunks of instanced tufts, no per-frame CPU beyond switching chunks on and off. WebGL1 safe.
import * as THREE from 'three';
import {polygonDistance} from './property-layout.mjs';
import {roadCoverage,DRIVE_LINE} from './driveway-measured.mjs';
import {campSurface} from './camp-approach.mjs';
import {shown} from './ground-detail.js';
import {gradeLand} from './land-grade.mjs';
const CHUNK=28,RADIUS=[34,55,80,115,150],DENSITY=[.3,.5,.72,.9,1];
// Measured footprints the grass stays out of (x, z, half sizes, yaw).
const FOOTPRINTS=[{x:8.78,z:-4.88,hx:11.2,hz:5.2,yaw:.15},{x:-30.73,z:-8.2,hx:4.6,hz:4.6,yaw:1.16},{x:-38.99,z:37.7,hx:3.2,hz:4,yaw:1.6},{x:-42.75,z:43.13,hx:1.6,hz:1.6,yaw:1.64},{x:-7.28,z:-4.67,hx:.9,hz:1.2,yaw:.03}];
// Pale bunches of last year's growth standing in the May frames, ray-measured.
export const STRAW_BUNCHES=[[-8.9,13.3,1.5],[-9.2,17.2,1.5],[-11,14.6,.8]];
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
const vnoise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),f=x-i,g=z-j,u=f*f*(3-2*f),v=g*g*(3-2*g),a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
function tuftGeometry(blades=13,segs=2,height=.22,width=.019,spread=.34){
 const pos=[],nor=[],aH=[],idx=[];let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
 for(let b=0;b<blades;b++){const a=rnd()*6.283,d=Math.sqrt(rnd())*spread,bx=Math.cos(a)*d,bz=Math.sin(a)*d,face=rnd()*6.283,lean=(rnd()-.5)*1.1,h=height*(.6+.8*rnd()),bend=(.55+.6*rnd())*h,c=Math.cos(face),s=Math.sin(face),lx=Math.cos(lean),lz=Math.sin(lean),base=pos.length/3;
  for(let i=0;i<=segs;i++){const t=i/segs,w=width*(1-.82*t),x=t*t*bend,y=(2*(1-t)*t*.62+t*t)*h;for(const e of [-1,1]){pos.push(bx+c*w*e+lx*x,y,bz-s*w*e+lz*x);nor.push(0,1,0);aH.push(t);}}
  for(let i=0;i<segs;i++){const q=base+i*2;idx.push(q,q+1,q+3,q,q+3,q+2);}}
 return {position:new THREE.Float32BufferAttribute(pos,3),normal:new THREE.Float32BufferAttribute(nor,3),aH:new THREE.Float32BufferAttribute(aH,1),index:new THREE.Uint16BufferAttribute(idx,1)};
}
async function zoneReader(){
 const image=new Image();image.src=new URL('./ground-zones.png',import.meta.url).href;await image.decode();
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);const d=g.getImageData(0,0,512,512).data;
 return (x,z)=>{const i=Math.floor((x+110)*2),j=Math.floor((z+100)*2);if(i<0||j<0||i>=512||j>=512)return [0,0];const k=(j*512+i)*4;return [d[k]/255,d[k+2]/255];};
}
export async function createMeadow({scene,heightAt,uniforms,prepareShadow,fill=null}){
 const zone=await zoneReader(),wind={value:0},far={value:80},R=(()=>{let s=20261101;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);})();
 const material=gradeLand(new THREE.MeshLambertMaterial({side:THREE.DoubleSide}));
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{paintMoisture:uniforms.paintMoisture,paintHalf:uniforms.paintHalf,castShade:uniforms.castShade,castHalf:uniforms.castHalf,castStrength:uniforms.castStrength,meadowTime:wind,meadowFar:far});
  sh.vertexShader=`attribute float aH;attribute vec3 iPos;attribute vec3 iTurn;attribute vec3 iTone;uniform float meadowTime,meadowFar;varying vec3 vTone;varying float vH;varying vec2 vRoot;\n`+sh.vertexShader.replace('#include <begin_vertex>',`
   // grow up from the ground as the camera nears, each tuft at its own distance
   float meadowDist=length(cameraPosition.xz-iPos.xz)+abs(cameraPosition.y-iPos.y)*.25;
   float meadowEnd=meadowFar*(.62+.38*iTone.z);
   float meadowGrow=1.-smoothstep(meadowEnd*.72,meadowEnd,meadowDist);
   float mc=cos(iTurn.x),ms=sin(iTurn.x);vec3 p=position*iTurn.y*meadowGrow;
   p.y*=iTurn.z;
   vec3 transformed=iPos+vec3(mc*p.x+ms*p.z,p.y,-ms*p.x+mc*p.z);
   transformed.xz+=vec2(sin(meadowTime*1.3+iPos.x*.31+iPos.z*.17),cos(meadowTime*1.1+iPos.z*.27))*aH*aH*p.y*.22;
   vTone=iTone;vH=aH;vRoot=iPos.xz;`);
  sh.fragmentShader=`uniform sampler2D paintMoisture,castShade;uniform float paintHalf,castHalf,castStrength;varying vec3 vTone;varying float vH;varying vec2 vRoot;\n`+sh.fragmentShader.replace('#include <normal_fragment_begin>','vec3 normal=normalize(vNormal);vec3 nonPerturbedNormal=normal;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.08,.2,.12);').replace('#include <color_fragment>',`
   float wet=vTone.x;vec4 moisture=texture2D(paintMoisture,vec2(vRoot.x/(2.*paintHalf)+.5,.5-vRoot.y/(2.*paintHalf)));wet=mix(wet,mix(.12,.92,moisture.r),moisture.a*.85);
   vec3 c=mix(${shown('#ab9a70')},${shown('#a2a06c')},smoothstep(.15,.36,wet));c=mix(c,${shown('#8c9a55')},smoothstep(.36,.52,wet));c=mix(c,${shown('#6f9440')},smoothstep(.52,.68,wet));c=mix(c,${shown('#567f34')},smoothstep(.68,.95,wet));
   c=mix(c,${shown('#c2b080')},vTone.y);
   c*=mix(.74,1.28,smoothstep(.0,1.,vH))*(.86+.28*fract(vTone.z*7.3));
   diffuseColor.rgb=c;
   vec2 castUV=vRoot/(2.*castHalf)+.5;vec2 castIn=step(vec2(0.),castUV)*step(castUV,vec2(1.));
   vec3 baked=texture2D(castShade,vec2(castUV.x,1.-castUV.y)).rgb*castIn.x*castIn.y;
   diffuseColor.rgb*=1.-baked.g*.42;diffuseColor.rgb*=mix(vec3(1.),vec3(.44,.49,.62),clamp(baked.r*2.,0.,1.)*castStrength);`);
 };
 material.customProgramCacheKey=()=>'meadow-grass-v4';
 prepareShadow?.(material);
 const shape=tuftGeometry(),cells=new Map();
 const clear=(x,z)=>{for(const f of FOOTPRINTS){const c=Math.cos(f.yaw),s=Math.sin(f.yaw),lx=(x-f.x)*c-(z-f.z)*s,lz=(x-f.x)*s+(z-f.z)*c;if(Math.abs(lx)<f.hx&&Math.abs(lz)<f.hz)return false;}
  return polygonDistance(x,z)<-1&&roadCoverage(x,z)<.3;};
 function add(x,z,size,height,wet,straw){const k=Math.floor(x/CHUNK)+':'+Math.floor(z/CHUNK);let c=cells.get(k);if(!c)cells.set(k,c={x:(Math.floor(x/CHUNK)+.5)*CHUNK,z:(Math.floor(z/CHUNK)+.5)*CHUNK,rows:[]});c.rows.push({x,z,size,height,wet,straw,turn:(vnoise(x*.035+9,z*.035)*2+vnoise(x*.16,z*.16+4)*.6)*6.283+(R()-.5)*.7,rank:R(),vary:R()});}
 const wetAt=(x,z)=>{const [t,r]=zone(x,z),n=(vnoise(x*.032,z*.032)-.5)*.6+(vnoise(x*.13,z*.13)-.5)*.3;return Math.max(0,Math.min(1,t*(r*.92+.08)+(1-t)*.36+n*(1-t*.45)));};
 const STEP=.42,E=150;
 for(let gx=-E;gx<E;gx+=STEP)for(let gz=-E;gz<E;gz+=STEP){
  const x=gx+(R()-.5)*STEP*1.4-5,z=gz+(R()-.5)*STEP*1.4+10,centre=Math.hypot(x+5,z-12);if(centre>E)continue;
  const near=centre<62?1:Math.max(.16,1-(centre-62)/85),patch=vnoise(x*.09+3,z*.09)*.65+vnoise(x*.34,z*.34)*.35,dense=.25+1.25*Math.max(0,patch-.26);
  if(R()>near*Math.min(1,dense))continue;if(!clear(x,z))continue;
  // Where the photo-matched ground layer grows (plant-fill.js), only a thin base stays; bare patches stay bare.
  if(fill){const f=fill.at('cover',x,z);if(f>.6&&(fill.at('bare',x,z)>.45||R()<.72))continue;}
  const s=x>-60&&x<30&&z>-25&&z<60?campSurface(x,z):{lawn:0,tallGrass:0},wet=wetAt(x,z),lawn=s.lawn;
  if(lawn>.3)continue;   // mown ground is the ground's own fine sward
  const tall=(1-lawn)*(.65+patch*.5)*(.8+R()*.45)*(.5+Math.pow(wet,1.5)*.95),size=(1-lawn*.3)*(.9+R()*.5);
  const dryBunch=(1-lawn)*(wet<.42?1:.15)*(patch>.6?1:.3)*(R()<.1?1:0);
  if(dryBunch)add(x,z,1.4+R()*.7,1+R()*.4,wet,.72+R()*.28);
  else add(x,z,size,lawn>.5?.34+R()*.18:tall,wet,lawn<.3&&R()<.05?.5:0);
 }
 for(const [cx,cz,big] of STRAW_BUNCHES)for(let i=0;i<46;i++){const a=R()*6.283,r=Math.sqrt(R())*big*.55;add(cx+Math.cos(a)*r,cz+Math.sin(a)*r,1.7+R()*.6,1.7+R()*.7,.3,.8+R()*.2);}
 // Skirts: taller tufts round tree bases, along the drive and at the foundations.
 const skirt=(x,z)=>{if(!clear(x,z)||(x>-60&&x<30&&z>-25&&z<60&&campSurface(x,z).lawn>.3))return;const w=wetAt(x,z);const m=x>-60&&x<30&&z>-25&&z<60?campSurface(x,z).lawn:0;add(x,z,1+R()*.5,(1+R()*.7)*(1-m*.6),w,m<.2&&R()<.25?.55:0);};
 try{const t=new Float32Array(await (await fetch(new URL('./trees.bin',import.meta.url))).arrayBuffer());for(let i=0;i<t.length;i+=3){const x=t[i],z=t[i+1]-3,h=t[i+2];if(Math.hypot(x+5,z-12)>110)continue;const n=Math.min(9,3+h*.5),rad=Math.max(.8,h*.2);for(let q=0;q<n;q++){const a=R()*6.283,r=rad*(.8+R()*.8);skirt(x+Math.cos(a)*r,z+Math.sin(a)*r);}}}catch(e){console.warn('No tree skirts',e);}
 for(let q=1;q<DRIVE_LINE.length;q++){const a=DRIVE_LINE[q-1],b=DRIVE_LINE[q],len=Math.hypot(b.x-a.x,b.z-a.z);for(let d=0;d<len*5;d++){const t=R(),s=R()<.5?-1:1,o=1.25+R()*1.3,nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;skirt(a.x+(b.x-a.x)*t+nx*s*o,a.z+(b.z-a.z)*t+nz*s*o);}}
 for(const f of FOOTPRINTS.slice(0,4))for(let q=0;q<(f.hx+f.hz)*22;q++){const c=Math.cos(f.yaw),s=Math.sin(f.yaw),side=R(),e=R()*2-1,g=.15+R()*.7;let lx,lz;if(side<.5){lx=e*f.hx;lz=(R()<.5?-1:1)*(f.hz+g);}else{lx=(R()<.5?-1:1)*(f.hx+g);lz=e*f.hz;}skirt(f.x+lx*c+lz*s,f.z-lx*s+lz*c);}
 const chunks=[];let tufts=0;
 for(const c of cells.values()){c.rows.sort((a,b)=>a.rank-b.rank);const n=c.rows.length;tufts+=n;
  const g=new THREE.InstancedBufferGeometry();g.index=shape.index;g.setAttribute('position',shape.position);g.setAttribute('normal',shape.normal);g.setAttribute('aH',shape.aH);
  const iPos=new Float32Array(n*3),iTurn=new Float32Array(n*3),iTone=new Float32Array(n*3);
  c.rows.forEach((t,i)=>{iPos.set([t.x,heightAt(t.x,t.z),t.z],i*3);iTurn.set([t.turn,t.size,t.height],i*3);iTone.set([t.wet,t.straw,t.vary],i*3);});
  g.setAttribute('iPos',new THREE.InstancedBufferAttribute(iPos,3));g.setAttribute('iTurn',new THREE.InstancedBufferAttribute(iTurn,3));g.setAttribute('iTone',new THREE.InstancedBufferAttribute(iTone,3));g.instanceCount=n;
  const y=c.rows.reduce((s,t)=>s+heightAt(t.x,t.z),0)/n;g.boundingSphere=new THREE.Sphere(new THREE.Vector3(c.x,y,c.z),CHUNK*.75+6);
  const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;mesh.name='meadow-grass';scene.add(mesh);chunks.push({mesh,g,c,n});}
 const last=new THREE.Vector3(1e8,0,0);
 return {tufts,trisPerTuft:shape.index.count/3,
  setQuality(level){far.value=RADIUS[level];for(const k of chunks)k.g.instanceCount=Math.max(1,Math.floor(k.n*DENSITY[level]));last.x=1e8;},
  update(time,camera){wind.value=time;if(camera.position.distanceToSquared(last)<16)return;last.copy(camera.position);const r=far.value+CHUNK;for(const k of chunks)k.mesh.visible=Math.hypot(camera.position.x-k.c.x,camera.position.z-k.c.z)+Math.abs(camera.position.y-k.g.boundingSphere.center.y)*.25<r;},
  reanchor(){for(const k of chunks){const a=k.g.attributes.iPos;k.c.rows.forEach((t,i)=>a.setY(i,heightAt(t.x,t.z)));a.needsUpdate=true;}},
 };
}
