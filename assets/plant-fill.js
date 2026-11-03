// THE GROUND LAYER along the drive, round the camp and between the buildings: low plants filled in to match what the drone
// frames show at each spot (assets/plant-fill.json, a 1 m map read from the solved frames). Tall thick green grass on the low
// lush ground, short sparse dry tufts on slopes and crowns, nothing on bare patches; small white and yellow flower flecks in
// loose drifts; real-looking cattails on the pond's edge and sparse thistles on the lush borders. None of it stands above the
// knee except cattails and thistles. Chunks of instanced plants that grow up as the camera nears. WebGL1 safe.
import * as THREE from 'three';
import {polygonDistance} from './property-layout.mjs';
import {roadCoverage,grassPriority} from './driveway-measured.mjs';
import {campSurface} from './camp-approach.mjs';
import {tallGrassCoverage} from './property-refinements.mjs';
import {gradeLand} from './land-grade.mjs';
const CHUNK=24,RADIUS=[28,42,58,78,100],DENSITY=[.25,.45,.7,.9,1];
const FOOTPRINTS=[{x:8.78,z:-4.88,hx:11.2,hz:5.2,yaw:.15},{x:-30.73,z:-8.2,hx:4.6,hz:4.6,yaw:1.16},{x:-38.99,z:37.7,hx:3.2,hz:4,yaw:1.6},{x:-42.75,z:43.13,hx:1.6,hz:1.6,yaw:1.64},{x:-7.28,z:-4.67,hx:.9,hz:1.2,yaw:.03}];
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
const vnoise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),f=x-i,g=z-j,u=f*f*(3-2*f),v=g*g*(3-2*g),a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const floats=s=>new Float32Array(bytes(s).buffer);

// One clump of curved blades; one metre across at size 1.
function tuft({blades,height,width,spread,seed}){
 const pos=[],aH=[],idx=[];let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
 for(let b=0;b<blades;b++){const a=rnd()*6.283,d=Math.sqrt(rnd())*spread,bx=Math.cos(a)*d,bz=Math.sin(a)*d,face=rnd()*6.283,lean=(rnd()-.5)*1.1,h=height*(.6+.75*rnd()),bend=(.5+.6*rnd())*h,c=Math.cos(face),n=Math.sin(face),lx=Math.cos(lean),lz=Math.sin(lean),base=pos.length/3;
  for(let i=0;i<=2;i++){const t=i/2,w=width*(1-.85*t),x=t*t*bend,y=(2*(1-t)*t*.62+t*t)*h;for(const e of [-1,1]){pos.push(bx+c*w*e+lx*x,y,bz-n*w*e+lz*x);aH.push(t);}}
  for(let i=0;i<2;i++){const q=base+i*2;idx.push(q,q+1,q+3,q,q+3,q+2);}}
 return geometry(pos,null,null,aH,idx);
}
// A few tiny flat flecks on a loose spread of stalk heights.
function flecks(n,seed){
 const pos=[],aH=[],idx=[];let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
 for(let i=0;i<n;i++){const x=(rnd()-.5)*.55,z=(rnd()-.5)*.55,y=.16+rnd()*.26,r=.009+rnd()*.008,base=pos.length/3;
  pos.push(x-r,y,z,x+r,y,z,x,y+r*.4,z-r,x,y-r*.3,z+r);aH.push(1,1,1,1);idx.push(base,base+1,base+2,base,base+3,base+1);}
 return geometry(pos,null,null,aH,idx);
}
function geometry(pos,nor,col,aH,idx){
 const g={position:new Float32Array(pos),aH:new Float32Array(aH),index:new Uint16Array(idx)};
 g.normal=nor||(()=>{const n=new Float32Array(pos.length);for(let i=1;i<n.length;i+=3)n[i]=1;return n;})();
 g.color=col||new Float32Array(pos.length).fill(1);return g;
}
function bakedPlant(m){const position=floats(m.position),normal=floats(m.normal),color=floats(m.color),index=new Uint16Array(bytes(m.index).buffer),aH=new Float32Array(position.length/3);for(let i=0;i<aH.length;i++)aH[i]=Math.min(1,position[i*3+1]);return {position,normal,color,index,aH};}

export async function loadPlantFillMap(){
 const d=await (await fetch(new URL('./plant-fill.json',import.meta.url))).json();
 const maps=Object.fromEntries(['lush','dry','bare','white','yellow','cover'].map(k=>[k,bytes(d[k])]));
 const at=(k,x,z)=>{const j=Math.floor(x-d.x0),i=Math.floor(z-d.z0);return i<0||j<0||i>=d.h||j>=d.w?0:maps[k][i*d.w+j]/255;};
 return {data:d,at};
}
export async function createPlantFill({scene,heightAt,fill}){
 const {data,at}=fill,wind={value:0},far={value:58};let seed=20261102;const R=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const models=await (await fetch(new URL('./models/fill-plants.json',import.meta.url))).json();
 const material=gradeLand(new THREE.MeshLambertMaterial({side:THREE.DoubleSide,vertexColors:true}));material.name='plant-fill';
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{fillTime:wind,fillFar:far});
  sh.vertexShader=`attribute float aH;attribute vec3 iPos;attribute vec4 iTurn;attribute vec3 iCol;uniform float fillTime,fillFar;varying vec3 vFill;\n`+sh.vertexShader.replace('#include <begin_vertex>',`
   float fillDist=length(cameraPosition.xz-iPos.xz)+abs(cameraPosition.y-iPos.y)*.25;
   float fillEnd=fillFar*(.6+.4*iTurn.w);
   float fillGrow=1.-smoothstep(fillEnd*.7,fillEnd,fillDist);
   float mc=cos(iTurn.x),ms=sin(iTurn.x);vec3 p=position*iTurn.y*fillGrow;p.y*=iTurn.z;
   vec3 transformed=iPos+vec3(mc*p.x+ms*p.z,p.y,-ms*p.x+mc*p.z);
   transformed.xz+=vec2(sin(fillTime*1.2+iPos.x*.31+iPos.z*.17),cos(fillTime*1.05+iPos.z*.27))*aH*aH*p.y*.16;
   vFill=iCol*mix(.84,1.08,aH);`);
  sh.fragmentShader=`varying vec3 vFill;\n`+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vFill;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.12,.18,.12);');
 };
 material.customProgramCacheKey=()=>'plant-fill-v2';
 const shapes={lush:tuft({blades:28,height:.3,width:.0085,spread:.42,seed:11}),dry:tuft({blades:12,height:.14,width:.0075,spread:.26,seed:23}),shrublet:tuft({blades:12,height:.26,width:.028,spread:.14,seed:37}),white:flecks(6,41),yellow:flecks(6,43),cattail:bakedPlant(models.cattail),thistle:bakedPlant(models.thistle)};
 const inWater=(x,z)=>{let c=false;const w=data.water;for(let i=0,j=w.length-1;i<w.length;j=i++)if((w[i][1]>z)!==(w[j][1]>z)&&x<(w[j][0]-w[i][0])*(z-w[i][1])/(w[j][1]-w[i][1])+w[i][0])c=!c;return c;};
 const road=data.road,nearRoad=(x,z)=>{for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<1.3)return true;}return false;};
 const clear=(x,z)=>{if(nearRoad(x,z))return false;for(const f of FOOTPRINTS){const c=Math.cos(f.yaw),s=Math.sin(f.yaw),lx=(x-f.x)*c-(z-f.z)*s,lz=(x-f.x)*s+(z-f.z)*c;if(Math.abs(lx)<f.hx&&Math.abs(lz)<f.hz)return false;}return polygonDistance(x,z)<-.6&&!inWater(x,z)&&roadCoverage(x,z)<.3;};
 const cells=new Map(),count={};
 const add=(kind,x,z,size,height,col)=>{if(kind==='lush'||kind==='dry'||kind==='shrublet'){const keep=.5+.5*grassPriority(x,z);if(R()>keep)return;size*=1+(1-keep)*.4;}const k=kind+':'+Math.floor(x/CHUNK)+':'+Math.floor(z/CHUNK);let c=cells.get(k);if(!c)cells.set(k,c={kind,x:(Math.floor(x/CHUNK)+.5)*CHUNK,z:(Math.floor(z/CHUNK)+.5)*CHUNK,rows:[]});c.rows.push({x,z,size,height,col,turn:R()*6.283,rank:R(),vary:R()});count[kind]=(count[kind]||0)+1;};
 const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
 const DEEP=[.12,.2,.06],LIME=[.2,.3,.09],OLIVE=[.19,.24,.09],BRILLIANT=[.2,.38,.06],EMERALD=[.09,.24,.06],YELLOWGREEN=[.27,.33,.07],STRAW=[.42,.34,.16],TAN=[.3,.24,.11],PALE=[.25,.3,.12],SILVER=[.3,.33,.24];
 for(let i=0;i<data.h;i++)for(let j=0;j<data.w;j++){const T=tallGrassCoverage(data.x0+j+.5,data.z0+i+.5),cover=Math.max(T,data.cover&&fill.at('cover',data.x0+j+.5,data.z0+i+.5));if(cover<.3)continue;
  // where he marked long lush grass, it is long lush grass whatever the frames' map read
  const X=data.x0+j,Z=data.z0+i,lush=Math.max(T,at('lush',X+.5,Z+.5)),dry=at('dry',X+.5,Z+.5)*(1-T),bare=at('bare',X+.5,Z+.5)*(1-T),live=cover*(1-bare)*(1-bare);
  const patch=vnoise(X*.11+7,Z*.11),fine=vnoise(X*.45,Z*.45);
  const nLush=lush*lush*20*live*(.55+.9*patch),nDry=dry*(5+lush*2)*live*(.45+1.1*patch),nShrub=dry*.1*live*(fine>.55?2:.4);
  const roll=(n,fn)=>{for(let q=Math.floor(n)+(R()<n%1?1:0);q>0;q--){const x=X+R(),z=Z+R();if(clear(x,z))fn(x,z);}};
  roll(nLush,(x,z)=>{const s=x>-60&&x<30&&z>-25&&z<60?campSurface(x,z):{lawn:0},m=s.lawn;if(m>.3)return;const t=vnoise(x*.2,z*.2),pa=vnoise(x*.035+11,z*.035),pb=vnoise(x*.06-7,z*.06+3),patch=mix(mix(EMERALD,BRILLIANT,Math.min(1,Math.max(0,(pa-.25)*2))),YELLOWGREEN,Math.max(0,pb-.55)*1.2),c=mix(mix(mix(mix(DEEP,LIME,t),OLIVE,R()*.25),patch,.6),LIME,m),v=(.82+R()*.36)*(1+m*.35);if(m>.5&&R()<.45)return;add('lush',x,z,(.85+R()*.5)*(1-m*.35),(.8+R()*.65)*(1-m*.72),[c[0]*v,c[1]*v,c[2]*v]);});
  roll(nDry,(x,z)=>{const m=x>-60&&x<30&&z>-25&&z<60?campSurface(x,z).lawn:0;if(m>.3)return;const c=mix(mix(STRAW,TAN,R()),PALE,R()*.7*(1-dry*.3)),v=.85+R()*.3;add('dry',x,z,.75+R()*.6,(.7+R()*.75)*(1-m*.5),[c[0]*v,c[1]*v,c[2]*v]);});
  roll(nShrub,(x,z)=>{const c=mix(SILVER,PALE,R());add('shrublet',x,z,.7+R()*.7,.75+R()*.6,c);});
  const grassy=(lush+dry*.6)*live,drift=vnoise(X*.07+31,Z*.07-9)*.7+vnoise(X*.3,Z*.3)*.3,w=at('white',X+.5,Z+.5);
  roll(grassy*Math.max(0,(drift-.5)*3)*(1.5+Math.min(w,1)*3),(x,z)=>(x>-60&&x<30&&z>-25&&z<60&&campSurface(x,z).lawn>.3)||add('white',x,z,.9+R()*.5,1,[.95,.95,.85]));
  roll(grassy*Math.min(at('yellow',X+.5,Z+.5),1)*.35,(x,z)=>add('yellow',x,z,.9+R()*.4,1,[.95,.72,.12]));
 }
 for(const [px,pz,r] of data.yellowPatches)for(let q=r*r*7;q>0;q--){const a=R()*6.283,d=Math.sqrt(R())*r,x=px+Math.cos(a)*d,z=pz+Math.sin(a)*d;if(clear(x,z))add('yellow',x,z,.9+R()*.5,1,[.95,.72,.12]);}
 for(const [x,z,h] of data.cattails){const v=.9+R()*.25;add('cattail',x,z,h*1.15,1,[v,v,v]);}
 for(const [x,z,h] of data.thistles)if(clear(x,z)){const v=.9+R()*.2;add('thistle',x,z,h,1,[v,v,v]);}
 const chunks=[];let tris=0;
 for(const c of cells.values()){const sh=shapes[c.kind],n=c.rows.length;c.rows.sort((a,b)=>a.rank-b.rank);tris+=n*sh.index.length/3;
  const g=new THREE.InstancedBufferGeometry();g.setIndex(new THREE.BufferAttribute(sh.index,1));g.setAttribute('position',new THREE.BufferAttribute(sh.position,3));g.setAttribute('normal',new THREE.BufferAttribute(sh.normal,3));g.setAttribute('color',new THREE.BufferAttribute(sh.color,3));g.setAttribute('aH',new THREE.BufferAttribute(sh.aH,1));
  // (arrays hold every plant so a higher quality setting only widens the count)
  const iPos=new Float32Array(n*3),iTurn=new Float32Array(n*4),iCol=new Float32Array(n*3);
  c.rows.forEach((t,i)=>{iPos.set([t.x,heightAt(t.x,t.z),t.z],i*3);iTurn.set([t.turn,t.size,t.height,t.vary],i*4);iCol.set(t.col,i*3);});
  g.setAttribute('iPos',new THREE.InstancedBufferAttribute(iPos,3));g.setAttribute('iTurn',new THREE.InstancedBufferAttribute(iTurn,4));g.setAttribute('iCol',new THREE.InstancedBufferAttribute(iCol,3));g.instanceCount=n;
  const y=c.rows.reduce((s,t)=>s+heightAt(t.x,t.z),0)/n;g.boundingSphere=new THREE.Sphere(new THREE.Vector3(c.x,y,c.z),CHUNK*.75+6);
  const mesh=new THREE.Mesh(g,material);mesh.name='plant-fill-'+c.kind;mesh.receiveShadow=true;scene.add(mesh);chunks.push({mesh,g,c,n,tall:c.kind==='cattail'||c.kind==='thistle'});}
 console.log('Plant fill',JSON.stringify(count),'triangles in all',tris);
 const last=new THREE.Vector3(1e8,0,0);
 return {count,tris,chunks,
  setQuality(level){far.value=RADIUS[level];for(const k of chunks)k.g.instanceCount=k.tall?k.n:Math.max(1,Math.floor(k.n*DENSITY[level]));last.x=1e8;},
  update(time,camera){wind.value=time;if(camera.position.distanceToSquared(last)<9)return;last.copy(camera.position);const r=far.value+CHUNK;for(const k of chunks)k.mesh.visible=Math.hypot(camera.position.x-k.c.x,camera.position.z-k.c.z)+Math.abs(camera.position.y-k.g.boundingSphere.center.y)*.25<r;},
  reanchor(){for(const k of chunks){const a=k.g.attributes.iPos;k.c.rows.forEach((t,i)=>a.setY(i,heightAt(t.x,t.z)));a.needsUpdate=true;}},
 };
}
