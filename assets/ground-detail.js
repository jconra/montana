import {createTerrainPaint} from './terrain-paint.js';
import * as THREE from 'three';
import {createRoute,POND_OUTLINE} from './property-layout.mjs';
import {grassReclaim} from './driveway-refinements.mjs';
import {campSurface} from './camp-approach.mjs';
import {DIRT_OUTLINE,RUTS,TRACK_OFFSET} from './driveway-measured.mjs';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Small repeatable detail maps; no remote texture dependencies.
function surface(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=random(810+kind);
  const colors=[['#827565','#a49984','#645d4f'],['#85817a','#b3aa9b','#625e56'],['#8c9089','#c1beb0','#656f67'],['#486728','#819342','#355422']][kind];
  g.fillStyle=colors[0];g.fillRect(0,0,256,256);
  for(let i=0;i<4000;i++){const x=r()*256,y=r()*256,sz=kind===1?1+r()*5:.5+r()*3;g.fillStyle=colors[i%3];g.globalAlpha=.25+r()*.5;g.beginPath();g.ellipse(x,y,sz,sz*(.35+r()*.6),r()*Math.PI,0,Math.PI*2);g.fill();}
  if(kind===3){
    for(let i=0;i<2200;i++){const x=r()*256,y=r()*256;g.strokeStyle=colors[i%3];g.globalAlpha=.35+r()*.4;g.lineWidth=.5+r();g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*4,y-2-r()*7);g.stroke();}
  }
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
// Linear working value that shows as `hex` on sunlit ground (the renderer encodes to sRGB; LIT is the light flat sunny ground gets).
const LIT=1.8,lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
const shown=hex=>{const n=parseInt(hex.slice(1),16);return `vec3(${[n>>16&255,n>>8&255,n&255].map(v=>(lin(v/255)/LIT).toFixed(4)).join(',')})`;};
// Tiling value noise, four independent channels, for the broad patches on the ground.
function patchNoise(){
 const S=128,C=16,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d'),im=g.createImageData(S,S),r=random(4242);
 const grid=[0,1,2,3].map(()=>Float32Array.from({length:C*C},()=>r()));
 const ss=t=>t*t*(3-2*t);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=x/S*C,v=y/S*C,i=Math.floor(u),j=Math.floor(v),fx=ss(u-i),fy=ss(v-j);
  for(let k=0;k<4;k++){const G=grid[k],a=G[j*C+i],b=G[j*C+(i+1)%C],d=G[((j+1)%C)*C+i],e=G[((j+1)%C)*C+(i+1)%C];im.data[(y*S+x)*4+k]=((a+(b-a)*fx)*(1-fy)+(d+(e-d)*fx)*fy)*255;}
  im.data[(y*S+x)*4+3]=255;}
 // straight to a data texture, not through the canvas: the fourth channel holds noise, not alpha
 const t=new THREE.DataTexture(im.data,S,S,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
// Fine map of the drive around the buildings: red dirt and wheel tracks, green tyre ruts.
const HI_MIN=new THREE.Vector2(-35,-14),HI_SIZE=new THREE.Vector2(96,48);
function driveMap(route){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');g.fillStyle='black';g.fillRect(0,0,1024,512);
 g.setTransform(1024/HI_SIZE.x,0,0,512/HI_SIZE.y,-HI_MIN.x*1024/HI_SIZE.x,-HI_MIN.y*512/HI_SIZE.y);g.globalCompositeOperation='lighter';g.lineJoin=g.lineCap='round';
 g.filter='blur(3px)';g.fillStyle='rgb(255,0,0)';g.beginPath();DIRT_OUTLINE.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.closePath();g.fill();
 g.filter='blur(2px)';g.strokeStyle='rgb(255,0,0)';g.lineWidth=.68;
 for(const side of [-1,1]){g.beginPath();let on=false;for(let d=0;d<=route.total;d+=.5){const p=route.at(d,side*TRACK_OFFSET);if(p.x>62||p.x<-1){on=false;continue;}if(on)g.lineTo(p.x,p.z);else g.moveTo(p.x,p.z);on=true;}g.stroke();}
 g.filter='blur(1.5px)';g.strokeStyle='rgb(0,200,0)';g.lineWidth=.26;
 for(const r of RUTS){g.beginPath();r.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.stroke();}
 g.filter='none';const t=new THREE.CanvasTexture(c);t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;return t;
}
const ZONES_MIN=new THREE.Vector2(-110,-100),ZONES_SIZE=256;
// Baked tree shadows round the buildings: red cast shadow (long, lumpy, away from the sun), green soft contact shade.
const CAST_HALF=128;
export function createGroundDetail(half,driveway,sunDir){
  const c=document.createElement('canvas');c.width=c.height=2048;const g=c.getContext('2d');g.fillStyle='black';g.fillRect(0,0,c.width,c.height);
  const maskMin=new THREE.Vector2(-160,-480),maskSize=new THREE.Vector2(370,660),route=createRoute(driveway);
  // Draw in metres, then transform to mask pixels; enough resolution for the grass median.
  g.setTransform(c.width/maskSize.x,0,0,c.height/maskSize.y,-maskMin.x*c.width/maskSize.x,-maskMin.y*c.height/maskSize.y);
  function path(width,color,offset=0,start=0,end=route.total){g.strokeStyle=color;g.lineWidth=width;g.lineCap=g.lineJoin='round';g.beginPath();for(let d=start;d<=end+.01;d+=.5){const p=route.at(Math.min(d,end),offset);if(d===start)g.moveTo(p.x,p.z);else g.lineTo(p.x,p.z);}g.stroke();}
  // Green channel controls the lush corridor and meadow, red controls gravel.
  for(let i=0;i<=24;i++){const t=i/24;path(85-i*2.5,`rgb(0,${Math.round(t*t*(3-2*t)*255)},0)`);}
  g.fillStyle='#00e000';g.beginPath();g.ellipse(-8,28,36,28,-.2,0,Math.PI*2);g.fill();
  g.strokeStyle='#00ff00';g.lineWidth=9;g.beginPath();POND_OUTLINE.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.closePath();g.stroke();
  // Outside the fine drive map: two wheel tracks only, the grass strip between them stays.
  let farEnd=0;for(let d=0;d<=route.total;d+=1)if(route.at(d).x>=60||route.at(d).z<-60)farEnd=d;
  for(const side of [-1,1]){path(1.0,'#80ff00',side*TRACK_OFFSET,0,farEnd);path(.62,'#ffff00',side*TRACK_OFFSET,0,farEnd);}
  // Blend the wider garage apron into a short green lawn. Sample the same
  // footprint as the grass renderer, so blades cannot sprout through gravel.
  const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;
  const left=Math.floor((-55-maskMin.x)/maskSize.x*c.width),right=Math.ceil((20-maskMin.x)/maskSize.x*c.width);
  const top=Math.floor((-20-maskMin.y)/maskSize.y*c.height),bottom=Math.ceil((48-maskMin.y)/maskSize.y*c.height);
  for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
    const x=maskMin.x+(px+.5)/c.width*maskSize.x,z=maskMin.y+(py+.5)/c.height*maskSize.y,s=campSurface(x,z),i=(py*c.width+px)*4;
    data[i+1]=Math.max(data[i+1],Math.round(Math.max(s.lawn,s.tallGrass)*255));data[i+2]=Math.round(s.lawn*255);
    const reclaim=grassReclaim(x,z);data[i]=Math.round(data[i]*(1-reclaim));data[i+1]=Math.max(data[i+1],Math.round(reclaim*255));data[i+2]=Math.max(data[i+2],Math.round(reclaim*255));
  }
  // Feather only moisture, preserving the narrow gravel wheel tracks.
  const green=document.createElement('canvas');green.width=green.height=c.width;const gg=green.getContext('2d'),gp=gg.createImageData(c.width,c.height);
  for(let i=0;i<data.length;i+=4){gp.data[i]=gp.data[i+1]=gp.data[i+2]=data[i+1];gp.data[i+3]=255;}gg.putImageData(gp,0,0);
  const soft=document.createElement('canvas');soft.width=soft.height=c.width;const sg=soft.getContext('2d');sg.filter='blur(18px)';sg.drawImage(green,0,0);const sm=sg.getImageData(0,0,c.width,c.height).data;
  for(let i=0;i<data.length;i+=4)data[i+1]=sm[i];
  g.putImageData(pixels,0,0);
  const mask=new THREE.CanvasTexture(c);mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;
  const zones=new THREE.TextureLoader().load(new URL('./ground-zones.png',import.meta.url).href);zones.generateMipmaps=false;zones.minFilter=THREE.LinearFilter;
  const uniforms={detailEnabled:{value:1},roadMask:{value:mask},groundMaskMin:{value:maskMin},groundMaskSize:{value:maskSize},greenness:{value:.85},grassDetail:{value:surface(3)},soilDetail:{value:surface(0)},gravelDetail:{value:surface(1)},stoneDetail:{value:surface(2)},patchMap:{value:patchNoise()},driveHi:{value:driveMap(route)},hiMin:{value:HI_MIN},hiSize:{value:HI_SIZE},groundZones:{value:zones},zonesMin:{value:ZONES_MIN},zonesSize:{value:ZONES_SIZE}};
  // Static soft canopy contact shadows: one small mask, no shadow-map pass.
  const shade=document.createElement('canvas');shade.width=shade.height=1024;
  const shadeContext=shade.getContext('2d'),shadeTexture=new THREE.CanvasTexture(shade);
  shadeTexture.generateMipmaps=false;shadeTexture.minFilter=THREE.LinearFilter;
  uniforms.canopyShade={value:shadeTexture};uniforms.canopyHalf={value:half};
  const cast=document.createElement('canvas');cast.width=cast.height=1024;const castContext=cast.getContext('2d'),castTexture=new THREE.CanvasTexture(cast);
  castTexture.generateMipmaps=false;castTexture.minFilter=THREE.LinearFilter;
  uniforms.castShade={value:castTexture};uniforms.castHalf={value:CAST_HALF};uniforms.castStrength={value:1};
  function setTrees(trees){
    const g=shadeContext,scale=shade.width/(half*2);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,shade.width,shade.height);
    g.setTransform(scale,0,0,scale,half*scale,half*scale);
    for(const t of trees){const radius=Math.max(1.5,Math.min(12,Math.max(t.editorScale?.[0]||t.h,t.editorScale?.[2]||t.h)*.35));
      const gradient=g.createRadialGradient(t.x,t.z,0,t.x,t.z,radius);
      gradient.addColorStop(0,'rgba(0,0,0,.48)');gradient.addColorStop(.45,'rgba(0,0,0,.28)');gradient.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=gradient;g.fillRect(t.x-radius,t.z-radius,radius*2,radius*2);
    }shadeTexture.needsUpdate=true;
    // long shadows near the buildings, for the levels with no shadow map
    const c=castContext,k=cast.width/(2*CAST_HALF);c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.fillStyle='black';c.fillRect(0,0,cast.width,cast.height);c.setTransform(k,0,0,k,CAST_HALF*k,CAST_HALF*k);c.globalCompositeOperation='lighter';
    const flat=Math.hypot(sunDir.x,sunDir.z),sx=-sunDir.x/flat,sz=-sunDir.z/flat,reach=flat/sunDir.y;
    for(const t of trees){if(Math.abs(t.x)>CAST_HALF+40||Math.abs(t.z)>CAST_HALF+40)continue;
      const h=t.h||6,w=Math.max(t.editorScale?.[0]||0,h*(t.wide||1)*.34)*.5,len=h*reach,n=Math.max(3,Math.min(9,Math.round(len/1.6))),r=random((Math.abs(t.x*131+t.z*17)|0)+5);
      for(let i=0;i<n;i++){const f=(i+.5)/n,rad=Math.max(.5,w*(1.08-f*.85)*(.8+r()*.5)),px=t.x+sx*len*f+(r()-.5)*w*.5,pz=t.z+sz*len*f+(r()-.5)*w*.5,gr=c.createRadialGradient(px,pz,rad*.45,px,pz,rad);
        gr.addColorStop(0,'rgba(120,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,1)');c.fillStyle=gr;c.fillRect(px-rad,pz-rad,rad*2,rad*2);}
      const rad=Math.max(1.2,w*1.25),gr=c.createRadialGradient(t.x,t.z,0,t.x,t.z,rad);gr.addColorStop(0,'rgba(0,150,0,1)');gr.addColorStop(1,'rgba(0,0,0,1)');c.fillStyle=gr;c.fillRect(t.x-rad,t.z-rad,rad*2,rad*2);
    }castTexture.needsUpdate=true;
  }
  const paint=createTerrainPaint(half);Object.assign(uniforms,paint.uniforms);
  return {uniforms,paint,setTrees,attach(material){material.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndetailWorld=(modelMatrix*vec4(position,1.)).xyz;detailNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader='uniform sampler2D patchMap;uniform sampler2D driveHi;uniform vec2 hiMin;uniform vec2 hiSize;uniform sampler2D groundZones;uniform vec2 zonesMin;uniform float zonesSize;uniform sampler2D castShade;uniform float castHalf;uniform float castStrength;uniform sampler2D paintMoisture;uniform sampler2D paintSurface;uniform float paintHalf;uniform sampler2D canopyShade;uniform float canopyHalf;uniform float detailEnabled;uniform float greenness;uniform sampler2D grassDetail;uniform vec2 groundMaskMin;uniform vec2 groundMaskSize;uniform sampler2D roadMask;uniform sampler2D soilDetail;uniform sampler2D gravelDetail;uniform sampler2D stoneDetail;varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      vec2 landUV=detailWorld.xz;vec2 localMask=(landUV-groundMaskMin)/groundMaskSize;vec2 maskUV=vec2(localMask.x,1.-localMask.y);
      vec3 coverage=texture2D(roadMask,maskUV).rgb;coverage*=step(0.,localMask.x)*step(localMask.x,1.)*step(0.,localMask.y)*step(localMask.y,1.);
      vec4 broad=texture2D(patchMap,landUV*.0031),mid=texture2D(patchMap,landUV*.0094),fine=texture2D(patchMap,landUV*.041),tiny=texture2D(patchMap,landUV*.33);
      // The drive: a soft mask read against fine noise makes a crisp, grass-nibbled edge.
      float nibble=tiny.r*.6+fine.g*.4-.5;
      vec2 hiLocal=(landUV-hiMin)/hiSize;vec3 hi=texture2D(driveHi,vec2(hiLocal.x,1.-hiLocal.y)).rgb*step(0.,hiLocal.x)*step(hiLocal.x,1.)*step(0.,hiLocal.y)*step(hiLocal.y,1.);
      float road=max(smoothstep(.42,.58,hi.r+nibble*.5),smoothstep(.3,.6,coverage.r+nibble*.35));
      float rut=hi.g*(.55+tiny.b*.6);
      float steep=smoothstep(.2,.62,1.-abs(normalize(detailNormal).y));
      vec3 soil=texture2D(soilDetail,landUV*.45).rgb;
      vec3 stone=texture2D(stoneDetail,landUV*.3).rgb;
      vec3 gravel=texture2D(gravelDetail,landUV*.7).rgb;
      vec3 blade=texture2D(grassDetail,landUV*.65).rgb;
      float bladeVar=dot(blade,vec3(.6))/.33;
      // Which ground is which: the May frames near the buildings, the aerial's own tint farther out; both broken up at several sizes.
      vec2 zoneLocal=(landUV-zonesMin)/zonesSize;vec3 zone=texture2D(groundZones,vec2(zoneLocal.x,1.-zoneLocal.y)).rgb;
      float zoneTrust=zone.b*step(0.,zoneLocal.x)*step(zoneLocal.x,1.)*step(0.,zoneLocal.y)*step(zoneLocal.y,1.);
      float aerialGreen=clamp((diffuseColor.g-diffuseColor.r)*9.+.42,0.,1.);
      float wet=mix(.14+aerialGreen*.42+coverage.g*.26,zone.r*.92+.08,zoneTrust);
      float variety=mix(1.,.55,zoneTrust);
      wet+=((broad.r-.5)*.9+(mid.g-.5)*.6)*variety+(fine.b-.5)*.32+(tiny.a-.5)*.14+(greenness-.85);
      vec2 paintUV=vec2(landUV.x/(2.*paintHalf)+.5,.5-landUV.y/(2.*paintHalf));
      vec4 moisture=texture2D(paintMoisture,paintUV),surfacePaint=texture2D(paintSurface,paintUV);
      wet=mix(wet,mix(.12,.92,moisture.r),moisture.a*.85);
      // dry straw, sage, yellow-green, fresh meadow, lush swale
      vec3 grass=mix(${shown('#a8a070')},${shown('#8f9a70')},smoothstep(.12,.3,wet));
      grass=mix(grass,${shown('#a0b050')},smoothstep(.3,.5,wet));
      grass=mix(grass,${shown('#7aa83f')},smoothstep(.5,.72,wet));
      grass=mix(grass,${shown('#4f8a35')},smoothstep(.76,1.,wet));
      // a mown lawn is mottled rather than even: paler and darker drifts, thin spots
      grass*=1.+coverage.b*(fine.r-.5)*.5;
      grass=mix(grass,grass*vec3(1.22,1.1,.72),smoothstep(.56,.74,mid.b*.5+fine.a*.5)*.7);
      grass*=.8+bladeVar*.32;
      vec3 dirtPatch=${shown('#8a7a5e')}*(.75+dot(soil,vec3(.5)));
      float bare=smoothstep(.62,.78,fine.g*.6+tiny.g*.4)*(1.-smoothstep(.1,.5,wet));
      vec3 land=mix(grass,dirtPatch,bare*.8);
      land=mix(land,dirtPatch*.95,smoothstep(.15,.55,steep)*.7);
      land=mix(land,stone*.8,smoothstep(.62,.8,steep));
      vec3 detailed=land;
      road=mix(road,surfacePaint.r,surfacePaint.a);
      detailed=mix(detailed,grass,surfacePaint.a*(1.-surfacePaint.r));
      // Dirt: grey-brown packed earth with gravel pockets, dark ruts pressed in.
      vec3 dirt=${shown('#ad9f8b')}*(.62+dot(gravel,vec3(.75))*.62);
      dirt=mix(dirt,${shown('#c0b39f')},smoothstep(.5,.72,fine.r)*.5);
      dirt=mix(dirt,${shown('#74685a')},clamp(rut,0.,1.)*.9);
      detailed=mix(detailed,dirt,road);
      float proximity=1.-smoothstep(180.,650.,distance(cameraPosition,detailWorld));
      // Beyond the painted ground the photo is a dry-season view: pull it toward the green, darker ridges.
      vec3 distantLand=mix(${shown('#8f9068')},${shown('#6f8a4c')},clamp(aerialGreen+(broad.r-.5)*.5,0.,1.))*(.72+dot(diffuseColor.rgb,vec3(.8)));
      diffuseColor.rgb=mix(distantLand,detailed,proximity);
      if(detailEnabled<.5)diffuseColor.rgb=distantLand;
      #endif
      vec2 canopyUV=detailWorld.xz/(2.*canopyHalf)+.5;
      float canopy=texture2D(canopyShade,vec2(canopyUV.x,1.-canopyUV.y)).a;
      canopy*=step(0.,canopyUV.x)*step(canopyUV.x,1.)*step(0.,canopyUV.y)*step(canopyUV.y,1.);
      diffuseColor.rgb*=1.-canopy*.3;
      vec2 castUV=detailWorld.xz/(2.*castHalf)+.5;
      vec2 castIn=step(vec2(0.),castUV)*step(castUV,vec2(1.));
      vec3 baked=texture2D(castShade,vec2(castUV.x,1.-castUV.y)).rgb*castIn.x*castIn.y;
      diffuseColor.rgb*=1.-baked.g*.42;
      diffuseColor.rgb*=mix(vec3(1.),vec3(.44,.49,.62),clamp(baked.r*1.4,0.,1.)*castStrength);`);
  };material.customProgramCacheKey=()=> 'montana-ground-detail-v9';}};
}
export function rockGeometry(seed){
  const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,col=new Float32Array(p.count*3);
  // Deform by coordinate, not by vertex index: duplicated triangle corners stay
  // coincident, avoiding cracks in the old randomly displaced dodecahedron.
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=Math.sin(x*4.1+seed)*Math.sin(z*3.7-seed*.3)*.13+Math.cos(y*5+seed)*.08;
    const top=Math.min(.62,.62-x*.22+z*.15,.7+x*.18-z*.25);
    p.setXYZ(i,x*(1+n)*(1+seed%3*.12),Math.max(-.55,Math.min(top,y*(.7+n))),z*(1+n));
    const lichen=Math.max(0,Math.sin(x*13+z*11+seed)*Math.cos(y*17-x*8)-.2),shade=.79+.1*Math.sin(x*7+z*9+seed)+.08*y;
    col.set([shade+lichen*.14,shade+lichen*.14,shade*.97+lichen*.07],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function rockMaterial(){const t=surface(2);return new THREE.MeshStandardMaterial({map:t,color:0xd4d7cf,vertexColors:true,flatShading:true,roughness:1});}
export async function loadShrub(name,broadleaf){
  const base='./assets/vegetation-lab/',response=await fetch(base+name+'.json');if(!response.ok)throw new Error(`Shrub ${name}: HTTP ${response.status}`);
  const data=await response.json(),loader=new THREE.TextureLoader();
  const maps=await Promise.all([loader.loadAsync(base+'tex/'+(broadleaf?'birch_color.jpg':'pine_color.jpg')),loader.loadAsync(base+'tex/'+(broadleaf?'oak_leaf.png':'pine_leaf.png'))]);maps.forEach(t=>t.colorSpace=THREE.SRGBColorSpace);
  const decode=(s,Type)=>new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
  return ['branches','leaves'].map((part,i)=>{const p=data[part],geometry=new THREE.BufferGeometry();
    for(const [name,size] of [['position',3],['normal',3],['uv',2]])geometry.setAttribute(name,new THREE.BufferAttribute(decode(p[name],Float32Array),size));
    if(p.index){const index=decode(p.index,Uint32Array);geometry.setIndex(new THREE.BufferAttribute(geometry.attributes.position.count<65536?new Uint16Array(index):index,1));}
    const material=new THREE.MeshStandardMaterial({map:maps[i],color:i?0xb7c39d:0xffffff,alphaTest:i?.3:0,alphaToCoverage:i===1,side:i?THREE.DoubleSide:THREE.FrontSide,roughness:1});return {geometry,material};
  });
}
