import {createTerrainPaint} from './terrain-paint.js';
import * as THREE from 'three';
import {createRoute,POND_OUTLINE} from './property-layout.mjs';
import {grassReclaim} from './driveway-refinements.mjs';
import {campSurface} from './camp-approach.mjs';
import {DIRT_OUTLINE,RUTS,TRACK_OFFSET,TRACK_WIDTH,VERGE} from './driveway-measured.mjs';
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
export const shown=hex=>{const n=parseInt(hex.slice(1),16);return `vec3(${[n>>16&255,n>>8&255,n&255].map(v=>(lin(v/255)/LIT).toFixed(4)).join(',')})`;};
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
// Baked colour of the land (tools: ground bake): a fine map round the buildings, a wider one over the fine terrain tile. The coarse tile's map is the third.
const HI_MIN=new THREE.Vector2(-70,-60),HI_SIZE=160,MID_HALF=250;
function colourMap(file){const t=new THREE.TextureLoader().load(new URL(file,import.meta.url).href);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;return t;}
// A patch of real ground from a drone still, lightness variation only; the map holds the colour.
function detailTile(file){const t=colourMap(file);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
// Baked tree shadows round the buildings: red cast shadow (long, lumpy, away from the sun), green soft contact shade.
const CAST_HALF=128;
const APRON_MIN=new THREE.Vector2(-32,-14),APRON_SIZE=40;
const RUV_MIN=new THREE.Vector2(-26,-108),RUV_SIZE=new THREE.Vector2(164,122);   // (the drive's corridor, for its own coordinates)
// value noise that repeats every `per` cells along x (the tyre marks' along coordinate wraps), with no texture and so no mip seams
const TYRE_GLSL=`float tyreHash(vec2 i){return fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);}
float tyreNoise(vec2 p,float per){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float x0=mod(i.x,per),x1=mod(i.x+1.,per);
 return mix(mix(tyreHash(vec2(x0,i.y)),tyreHash(vec2(x1,i.y)),f.x),mix(tyreHash(vec2(x0,i.y+1.)),tyreHash(vec2(x1,i.y+1.)),f.x),f.y);}
`;
export function createGroundDetail(half,driveway,sunDir){
  const c=document.createElement('canvas');c.width=c.height=2048;const g=c.getContext('2d');g.fillStyle='black';g.fillRect(0,0,c.width,c.height);
  const maskMin=new THREE.Vector2(-160,-480),maskSize=new THREE.Vector2(370,660),route=createRoute(driveway);
  // Draw in metres, then transform to mask pixels; enough resolution for the grass median.
  g.setTransform(c.width/maskSize.x,0,0,c.height/maskSize.y,-maskMin.x*c.width/maskSize.x,-maskMin.y*c.height/maskSize.y);
  function path(width,color,offset=0,start=0,end=route.total){g.strokeStyle=color;g.lineWidth=width;g.lineCap=g.lineJoin='round';g.beginPath();for(let d=start;d<=end+.01;d+=.5){const p=route.at(Math.min(d,end),offset);if(d===start)g.moveTo(p.x,p.z);else g.lineTo(p.x,p.z);}g.stroke();}
  // Green channel controls the lush corridor and meadow, red controls gravel.
  // Blue: the damp bank round the pond.
  g.globalCompositeOperation='lighter';g.filter='blur(5px)';g.strokeStyle='#0000ff';g.lineWidth=3.2;g.beginPath();POND_OUTLINE.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.closePath();g.stroke();g.filter='none';g.globalCompositeOperation='source-over';
  // Red: the drive. The apron and arms as traced; elsewhere two pale wheel tracks and a weak value down the middle, which fine noise breaks into a patchy grass strip.
  let farEnd=0;for(let d=0;d<=route.total;d+=1)if(route.at(d).x>=-5.5)farEnd=d;
  g.globalCompositeOperation='lighter';path(TRACK_OFFSET*2+.2,'#3a0000',0,0,farEnd);g.globalCompositeOperation='source-over';
  for(const side of [-1,1])path(TRACK_WIDTH,'#ff0000',side*TRACK_OFFSET,0,farEnd);
  g.fillStyle='#ff0000';g.beginPath();DIRT_OUTLINE.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.closePath();g.fill();
  // The camp arm wears out into the lawn as a ragged fan along the worn lane (the May frames), not a box: gravel holds near the lane's
  // middle while the wear is high and frays to its edges as the wear falls toward the fire pit.
  const hash=(x,z)=>{const h=Math.sin(x*127.1+z*311.7)*43758.5453;return h-Math.floor(h);},vn=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j,a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1),su=u*u*(3-2*u),sv=v*v*(3-2*v);return a+(b-a)*su+(c-a)*sv+(a-b-c+d)*su*sv;};
  function campArmGravel(x,z,s){if(x>-8||z<9)return 1;const n=vn(x*.9,z*.9)*.65+vn(x*2.3+7,z*2.3)*.35-.5,core=s.width*.5*(.35+.9*s.wear)+n*1.4,k=Math.min(1,(z-9)/5);
    const fan=Math.max(0,Math.min(1,(core-s.distance)/1.2+.5))*Math.max(0,Math.min(1,(s.wear-.12+n*.35)/.3));return 1-k*k*(3-2*k)*(1-fan);}   // from z 9 on
  // Blend the wider garage apron into a short green lawn. Sample the same
  // footprint as the grass renderer, so blades cannot sprout through gravel.
  const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;
  const left=Math.floor((-55-maskMin.x)/maskSize.x*c.width),right=Math.ceil((20-maskMin.x)/maskSize.x*c.width);
  const top=Math.floor((-20-maskMin.y)/maskSize.y*c.height),bottom=Math.ceil((48-maskMin.y)/maskSize.y*c.height);
  for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
    const x=maskMin.x+(px+.5)/c.width*maskSize.x,z=maskMin.y+(py+.5)/c.height*maskSize.y,s=campSurface(x,z),i=(py*c.width+px)*4;
    data[i+1]=Math.round(s.lawn*255);
    const reclaim=grassReclaim(x,z);data[i]=Math.round(data[i]*(1-reclaim)*campArmGravel(x,z,s));
  }
  // Feather only moisture, preserving the narrow gravel wheel tracks.
  const green=document.createElement('canvas');green.width=green.height=c.width;const gg=green.getContext('2d'),gp=gg.createImageData(c.width,c.height);
  for(let i=0;i<data.length;i+=4){gp.data[i]=gp.data[i+1]=gp.data[i+2]=data[i+1];gp.data[i+3]=255;}gg.putImageData(gp,0,0);
  const soft=document.createElement('canvas');soft.width=soft.height=c.width;const sg=soft.getContext('2d');sg.filter='blur(18px)';sg.drawImage(green,0,0);const sm=sg.getImageData(0,0,c.width,c.height).data;
  for(let i=0;i<data.length;i+=4)data[i+1]=sm[i];
  g.putImageData(pixels,0,0);
  const mask=new THREE.CanvasTexture(c);mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;
  // Each spot's place on the drive, for the tyre marks and the cut strip beside the tracks: R across the drive (±2 m), G and B the
  // sine and cosine of the distance along it over 32 m (a phase, so it wraps with no seam), A on the drive's corridor. 16 cm texels.
  // The corridor runs 40 cm past the ±2 m the code reads, with R held at its end value, and the shader trusts only texels with A at 1:
  // where A fell to the empty outside, R slid from +2 to -2 between texels and drew a thin false track along one edge.
  const roadUV=(()=>{const W=1024,H=768,px=RUV_SIZE.x/W,pz=RUV_SIZE.y/H,out=new Uint8Array(W*H*4),best=new Float32Array(W*H).fill(9);let s0=0;
    for(let i=1;i<driveway.length;i++){const a=driveway[i-1],b=driveway[i],dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);
      if(L>0&&Math.max(a.x,b.x)>-7.5){const c0=Math.max(0,Math.floor((Math.min(a.x,b.x)-2.6-RUV_MIN.x)/px)),c1=Math.min(W-1,Math.ceil((Math.max(a.x,b.x)+2.6-RUV_MIN.x)/px)),r0=Math.max(0,Math.floor((Math.min(a.z,b.z)-2.6-RUV_MIN.y)/pz)),r1=Math.min(H-1,Math.ceil((Math.max(a.z,b.z)+2.6-RUV_MIN.y)/pz));
        for(let r=r0;r<=r1;r++)for(let q=c0;q<=c1;q++){const x=RUV_MIN.x+(q+.5)*px,z=RUV_MIN.y+(r+.5)*pz,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(L*L))),ex=x-a.x-dx*t,ez=z-a.z-dz*t,d=Math.hypot(ex,ez),k=r*W+q;
          if(d>=2.4||d>=best[k])continue;best[k]=d;const off=Math.max(-2,Math.min(2,(ex*-dz+ez*dx)/L)),ph=(s0+t*L)/32*Math.PI*2;
          out[k*4]=Math.round(127.5+off/2*127.5);out[k*4+1]=Math.round(127.5+127.5*Math.sin(ph));out[k*4+2]=Math.round(127.5+127.5*Math.cos(ph));out[k*4+3]=255;}}
      s0+=L;}
    const t=new THREE.DataTexture(out,W,H,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;})();
  // The apron's own marks: red tyre arcs, green the pale scuffed middle of the Y.
  const apronCanvas=document.createElement('canvas');apronCanvas.width=apronCanvas.height=512;{const a=apronCanvas.getContext('2d'),k=512/APRON_SIZE,r=random(5151);a.fillStyle='black';a.fillRect(0,0,512,512);a.setTransform(k,0,0,k,-APRON_MIN.x*k,-APRON_MIN.y*k);a.globalCompositeOperation='lighter';a.filter='blur(9px)';a.strokeStyle='#00a000';a.lineCap='round';a.lineWidth=2.6;
    for(const l of [[[-22,-3],[-15,0],[-6,3.6],[3,5.4]],[[-15.5,1],[-17.5,8],[-19,15]]]){a.beginPath();l.forEach(([x,z],i)=>a[i?'lineTo':'moveTo'](x,z));a.stroke();}
    a.filter='blur(1.2px)';for(const line of RUTS.slice(0,7)){a.strokeStyle=`rgba(${190+r()*65|0},0,0,1)`;a.lineWidth=.2+r()*.14;a.beginPath();a.moveTo(line[0].x,line[0].z);for(let i=1;i<line.length-1;i++){const m=line[i],n=line[i+1];a.quadraticCurveTo(m.x,m.z,(m.x+n.x)/2,(m.z+n.z)/2);}const e=line[line.length-1];a.lineTo(e.x,e.z);a.stroke();}}
  const apronMap=new THREE.CanvasTexture(apronCanvas);apronMap.generateMipmaps=false;apronMap.minFilter=THREE.LinearFilter;
  const uniforms={greenness:{value:.85},detailEnabled:{value:1},roadMask:{value:mask},groundMaskMin:{value:maskMin},groundMaskSize:{value:maskSize},patchMap:{value:patchNoise()},colourHi:{value:colourMap('./ground-colour-hi.jpg')},colourMid:{value:colourMap('./ground-colour-mid.jpg')},tileDry:{value:detailTile('./tile-dry.jpg')},tileGreen:{value:detailTile('./tile-green.jpg')},tileRoad:{value:detailTile('./tile-road.jpg')},hiMin:{value:HI_MIN},hiSize:{value:HI_SIZE},midHalf:{value:MID_HALF},lushMap:{value:null},lushMin:{value:new THREE.Vector2()},lushSize:{value:new THREE.Vector2(1,1)},apronMap:{value:apronMap},apronMin:{value:APRON_MIN},apronSize:{value:APRON_SIZE},roadUV:{value:roadUV},roadUVMin:{value:RUV_MIN},roadUVSize:{value:RUV_SIZE},trackAt:{value:new THREE.Vector3(TRACK_OFFSET,TRACK_WIDTH,VERGE)}};
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
    for(const t of trees){const radius=Math.max(1.8,Math.min(14,Math.max(t.editorScale?.[0]||t.h,t.editorScale?.[2]||t.h)*.45));
      const gradient=g.createRadialGradient(t.x,t.z,0,t.x,t.z,radius);
      gradient.addColorStop(0,'rgba(0,0,0,.6)');gradient.addColorStop(.5,'rgba(0,0,0,.36)');gradient.addColorStop(1,'rgba(0,0,0,0)');
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
      // Fallen needles: a red-brown ring under each juniper, in lumps so it is never a clean circle.
      if(String(t.asset||'').startsWith('juniper'))for(let i=0;i<6;i++){const a=r()*6.283,o=w*(.15+r()*.65),q=Math.max(.4,w*(.38+r()*.34)),px=t.x+Math.cos(a)*o,pz=t.z+Math.sin(a)*o,du=c.createRadialGradient(px,pz,q*.2,px,pz,q);du.addColorStop(0,'rgba(0,0,170,1)');du.addColorStop(1,'rgba(0,0,0,1)');c.fillStyle=du;c.fillRect(px-q,pz-q,q*2,q*2);}
    }castTexture.needsUpdate=true;
  }
  const paint=createTerrainPaint(half);Object.assign(uniforms,paint.uniforms);
  // The far hills: tan-grey grass, dark forest patches on the shadier and higher ground, rusty streaks, snow on the tops; colours from the May frames.
  function attachHills(material){material.onBeforeCompile=sh=>{
    sh.uniforms.patchMap=uniforms.patchMap;
    sh.vertexShader='varying vec3 hillWorld;varying vec3 hillNormal;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhillWorld=(modelMatrix*vec4(position,1.)).xyz;hillNormal=normal;');
    sh.fragmentShader='uniform sampler2D patchMap;varying vec3 hillWorld;varying vec3 hillNormal;\n'+sh.fragmentShader.replace('#include <color_fragment>',`
      vec2 hp=hillWorld.xz;vec3 hn=normalize(hillNormal);
      vec4 n1=texture2D(patchMap,hp*.00009),n2=texture2D(patchMap,hp*.00037),n3=texture2D(patchMap,hp*.0017),n4=texture2D(patchMap,hp*.0071);
      float h=hillWorld.y+1666.,noise=n1.r*.42+n2.g*.33+n3.b*.17+n4.a*.08;
      vec3 c=mix(${shown('#98906e')},${shown('#858c66')},smoothstep(.4,.6,n2.r*.6+n3.g*.4));
      c=mix(c,${shown('#8a8578')},smoothstep(.45,.65,n1.g));
      // Timber on the north faces and in the folds, bare grass on the south and west slopes, its edge cut fine.
      float shady=clamp(.5-hn.z*2.2+hn.x*.5,0.,1.);
      vec4 n5=texture2D(patchMap,hp*.021);
      float forest=smoothstep(.5,.535,noise*.8+shady*.2+n4.r*.05+n5.g*.05-.03)*smoothstep(3050.,2700.,h);
      c=mix(c,${shown('#2e382f')}*(.72+n4.r*.34+n5.b*.42),forest);
      // Dirt and scree in streaks running down the fall line, not blotches.
      vec2 fall=normalize(hn.xz+vec2(1e-4)),across=vec2(-fall.y,fall.x);
      float streak=n3.g*.55+n2.a*.45;
      float rust=smoothstep(.62,.76,streak)*(1.-forest)*smoothstep(.04,.2,length(hn.xz));
      c=mix(c,${shown('#9a6a50')},rust*.6);
      c=mix(c,${shown('#c4b48a')},smoothstep(.56,.68,1.-streak)*(1.-forest)*.4);
      // The bald knob on the skyline to the north-west stays pale grass.
      float bald=1.-smoothstep(500.,1000.,distance(hp,vec2(-4460.,-5432.)));
      c=mix(c,${shown('#b4a884')},bald*(.75+.25*n4.g));
      c=mix(c,${shown('#f2f2f0')},smoothstep(2900.,3150.,h+(n3.r-.5)*200.));
      c*=.82+n4.b*.36;
      // Air between the ridges: each layer further off goes bluer and paler.
      float air=1.-exp(-distance(cameraPosition,hillWorld)/8500.);
      c=mix(c,${shown('#8496ac')}*1.12,air*.6);
      diffuseColor.rgb=c;`).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec2 hillBump=(texture2D(patchMap,hillWorld.xz*.0031).rg-.5)*.16+(texture2D(patchMap,hillWorld.xz*.019).rg-.5)*.07;normal=normalize(normal+(viewMatrix*vec4(hillBump.x,0.,hillBump.y,0.)).xyz);`);
  };material.customProgramCacheKey=()=>'montana-far-hills-v4';}
  // The house cut: no ground inside the house's walls above its floor. The grid is a metre apart and the house sits into a slope (the
  // back wall holds 2.5 m of hill), so its triangles cannot follow the walls; the shader drops ground inside the footprint instead, at
  // the wall line exactly. setCut takes the closed outline in world x,z and the floor's world height.
  uniforms.cutPoly={value:Array.from({length:24},()=>new THREE.Vector2())};uniforms.cutCount={value:0};uniforms.cutFloor={value:1e9};
  function setCut(points,floorY){const n=Math.min(points.length,23);if(n<3){uniforms.cutCount.value=0;return;}for(let i=0;i<=n;i++){const p=points[i%n];uniforms.cutPoly.value[i].set(p.x,p.z);}uniforms.cutCount.value=n;uniforms.cutFloor.value=floorY;}
  return {uniforms,paint,setTrees,attachHills,setCut,attach(material){material.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndetailWorld=(modelMatrix*vec4(position,1.)).xyz;detailNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      {bool cutIn=false;for(int i=0;i<23;i++){if(i>=cutCount)break;vec2 a=cutPoly[i],b=cutPoly[i+1];
        if((a.y>detailWorld.z)!=(b.y>detailWorld.z)&&detailWorld.x<(b.x-a.x)*(detailWorld.z-a.y)/(b.y-a.y)+a.x)cutIn=!cutIn;}
       if(cutIn&&detailWorld.y>cutFloor)discard;}`);
    sh.fragmentShader='uniform vec2 cutPoly[24];uniform int cutCount;uniform float cutFloor;\n'+sh.fragmentShader;
    sh.fragmentShader='float apronLift=0.;float detailRoad=0.;uniform sampler2D patchMap;uniform sampler2D colourHi;uniform sampler2D colourMid;uniform sampler2D tileDry;uniform sampler2D tileGreen;uniform sampler2D tileRoad;uniform vec2 hiMin;uniform float hiSize;uniform float midHalf;uniform sampler2D lushMap;uniform vec2 lushMin;uniform vec2 lushSize;uniform sampler2D apronMap;uniform vec2 apronMin;uniform float apronSize;uniform sampler2D castShade;uniform float castHalf;uniform float castStrength;uniform sampler2D paintMoisture;uniform sampler2D paintSurface;uniform float paintHalf;uniform sampler2D canopyShade;uniform float canopyHalf;uniform float detailEnabled;uniform vec2 groundMaskMin;uniform vec2 groundMaskSize;uniform sampler2D roadMask;uniform sampler2D roadUV;uniform vec2 roadUVMin;uniform vec2 roadUVSize;uniform vec3 trackAt;varying vec3 detailWorld;varying vec3 detailNormal;\n'+TYRE_GLSL+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      // Light bounced round the meadow: shaded grass stays a living blue-green.
      totalEmissiveRadiance+=diffuseColor.rgb*vec3(.09,.12,.1)+diffuseColor.rgb*apronLift*vec3(.3,.22,.14);`).replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      vec2 landUV=detailWorld.xz;
      // The coarse tile's map holds the same colouring for the whole property.
      vec3 farLand=diffuseColor.rgb/1.8;
      farLand=mix(farLand,vec3(dot(farLand,vec3(.3,.55,.15)))*vec3(1.18,.98,.64),smoothstep(.012,.06,1.-abs(normalize(detailNormal).y))*smoothstep(146.,158.,detailWorld.y));
      vec2 midUV=(landUV+midHalf)/(2.*midHalf);vec2 hiUV=(landUV-hiMin)/hiSize;
      vec2 midEdge=min(midUV,1.-midUV)*2.*midHalf,hiEdge=min(hiUV,1.-hiUV)*hiSize;
      float inMid=smoothstep(0.,10.,min(midEdge.x,midEdge.y)),inHi=smoothstep(0.,6.,min(hiEdge.x,hiEdge.y));
      vec3 near=mix(texture2D(colourMid,vec2(midUV.x,1.-midUV.y)).rgb,texture2D(colourHi,vec2(hiUV.x,1.-hiUV.y)).rgb,inHi);
      vec4 mid=texture2D(patchMap,landUV*.0094),fine=texture2D(patchMap,landUV*.041),tiny=texture2D(patchMap,landUV*.33);
      vec2 localMask=(landUV-groundMaskMin)/groundMaskSize;vec2 inMask=step(vec2(0.),localMask)*step(localMask,vec2(1.));
      vec3 masks=texture2D(roadMask,vec2(localMask.x,1.-localMask.y)).rgb*inMask.x*inMask.y;
      float road=smoothstep(.3,.6,masks.r+(tiny.r*.6+fine.g*.4-.5)*.5);
      // THE DRIVE'S OWN COORDINATES (roadUV, 16 cm texels): across it and along it. On the two-track the wheel tracks are drawn
      // from them, their measured width exactly with a slightly ragged edge (the ground mask, 30 cm texels, drew them broad and
      // soft), and the strip between them is grass.
      float across=0.,along=0.,onDrive=0.;
      {vec2 ruv=(landUV-roadUVMin)/roadUVSize;
       if(ruv.x>0.&&ruv.x<1.&&ruv.y>0.&&ruv.y<1.){vec4 rc=texture2D(roadUV,ruv);across=(rc.r-.5)*4.;along=atan(rc.g*2.-1.,rc.b*2.-1.)/6.2832+.5;onDrive=smoothstep(.97,1.,rc.a)*smoothstep(-5.5,-3.,landUV.x+(tiny.r-.5)*.6);}}   // (the two-track starts at the lawn wedge's tip, x -4, as the May frames show)
      float tOff=mix(.43,trackAt.x,smoothstep(-5.,.5,landUV.x));   // the strip between the tracks starts as a thin wedge
      float track=1.-smoothstep(trackAt.y*.5-.07,trackAt.y*.5+.07,abs(abs(across)-tOff)+(tiny.r-.5)*.1+(fine.g-.5)*.06);
      road=mix(road,track,onDrive);
      // Past where the drone frames resolve the drive, the wheel tracks are drawn.
      float drawn=road*smoothstep(-5.5,-3.,landUV.x);
      float centre=smoothstep(.1,.2,masks.r)*(1.-road)*smoothstep(-5.5,-3.,landUV.x)*(1.-onDrive),tuftsHere=smoothstep(.38,.58,fine.g*.55+tiny.r*.45);near=mix(near,vec3(.5,.58,.3)*(.8+fine.g*.4),centre*tuftsHere*.92);near*=1.-centre*tuftsHere*.25;drawn=max(drawn,centre*(1.-tuftsHere));
      // (the gravel measured 143,141,141 in the July frames, a neutral mid grey; it was drawn 176,173,153)
      near=mix(near,vec3(.66,.65,.64)*(.88+fine.r*.24),drawn*.95);
      // TYRE MARKS AND THE CUT VERGE, from the drive's own coordinates (roadUV): in each track the tyres' long streaks, a darker packed
      // middle and loose paler gravel at its edges, as the July frames show; beside it a foot or two of short mown green.
      {if(onDrive>0.){float side=abs(across),fade=1.-smoothstep(25.,70.,distance(cameraPosition,detailWorld));
         float inTrack=clamp(abs(side-tOff)/(trackAt.y*.5),0.,1.);
         float st=tyreNoise(vec2(along*16.,across*22.),16.)*.6+tyreNoise(vec2(along*48.,across*57.+3.7),48.)*.4;
         near*=mix(1.,mix(.86,1.08,smoothstep(.3,.95,inTrack))*(.88+st*.24),drawn*fade);
         float edge=tOff+trackAt.y*.5,verge=smoothstep(edge-.05,edge+.08,side)*(1.-smoothstep(edge+trackAt.z-.1,edge+trackAt.z+.12,side))*(1.-road);
         near=mix(near,mix(vec3(.36,.56,.17),vec3(.46,.64,.2),smoothstep(.3,.7,fine.r))*(.86+tiny.g*.28),verge*.7*onDrive);
         // the strip between the tracks: grass, a little thinner where the wheels drift onto it
         float median=(1.-smoothstep(tOff-trackAt.y*.5-.06,tOff-trackAt.y*.5+.04,side))*(1.-road);
         near=mix(near,mix(vec3(.4,.53,.2),vec3(.5,.6,.26),fine.b)*(.8+tiny.r*.4),median*.8*onDrive*smoothstep(.3,.6,fine.g*.6+tiny.b*.4+.25));}}
      // The apron: its colour is drawn, so the shadows the drone caught on it stay out of the map. Pale scuffed middle, tyre arcs, gravel grain.
      float apron=road*(1.-smoothstep(-6.,-2.,landUV.x+(fine.r-.5)*.8));   // the apron's pale gravel greys into the tracks
      if(apron>0.){vec2 apronUV=(landUV-apronMin)/apronSize;vec2 apronMark=texture2D(apronMap,vec2(apronUV.x,1.-apronUV.y)).rg;
       vec3 gravel=mix(vec3(.72,.65,.6),vec3(.84,.78,.72),apronMark.g)*(.9+fine.r*.12+tiny.b*.1);gravel*=1.-apronMark.r*.27*smoothstep(.32,.62,fine.b*.6+tiny.g*.4);near=mix(near,gravel,apron);apronLift=apron;}
      // Lush ground has no dirt showing: a green mat under the blades, wherever the frames' plant map says lush.
      vec2 lushUV=(landUV-lushMin)/lushSize;float lushHere=texture2D(lushMap,lushUV).r*step(0.,lushUV.x)*step(lushUV.x,1.)*step(0.,lushUV.y)*step(lushUV.y,1.);
      vec3 lushMat=mix(mix(vec3(.27,.5,.12),vec3(.4,.67,.13),smoothstep(.3,.7,fine.b)),vec3(.5,.6,.17),smoothstep(.55,.8,mid.g)*.5);
      near=mix(near,lushMat*(.84+fine.g*.24+tiny.r*.12),smoothstep(.1,.42,lushHere+(fine.r-.5)*.25)*(1.-road)*.92);
      // Mown lawn: no stripes. A dull soft green with pale dry mottling and the odd worn spot, as in the July frames.
      float mown=smoothstep(.25,.6,masks.g)*(1.-smoothstep(.05,.4,masks.r));
      if(mown>0.){float mott=mid.g*.55+fine.b*.45;vec3 sward=mix(vec3(.34,.6,.15),vec3(.44,.69,.17),smoothstep(.3,.7,fine.r));sward=mix(sward,vec3(.5,.64,.22),smoothstep(.56,.74,mott)*.5);sward=mix(sward,vec3(.28,.52,.14),smoothstep(.6,.85,mid.b)*.5);sward=mix(sward,vec3(.64,.6,.4),smoothstep(.68,.76,mid.a*.6+tiny.g*.4)*.6);near=mix(near,sward,mown*.93);}
      // Past the grass blades (they end some 60 m out), tall lush grass still shows its texture as in the July frames: streaks where it
      // lies over in the wind, paler tips, darker hollows. Costs nothing but two texture reads, so the far lawn is never a flat colour.
      float grassFar=smoothstep(.1,.42,lushHere)*(1.-road)*(1.-mown)*smoothstep(35.,65.,distance(cameraPosition,detailWorld));
      if(grassFar>0.){vec2 sw=vec2(landUV.x*.9+landUV.y*.42,landUV.y*.16-landUV.x*.05);float streak=texture2D(patchMap,sw*.3).g*.55+texture2D(patchMap,landUV*.9).r*.45;
       near*=mix(vec3(1.),vec3(.72,.77,.7)+vec3(.5,.46,.38)*streak,grassFar*.85);}
      // Real ground from the drone stills, in two sizes so it does not repeat, by what the map says is here.
      float close=1.-smoothstep(70.,300.,distance(cameraPosition,detailWorld));
      vec2 w2=vec2(landUV.x*.8-landUV.y*.6,landUV.x*.6+landUV.y*.8);
      vec3 dA=texture2D(tileDry,landUV/7.).rgb,dB=texture2D(tileDry,w2/16.3).rgb,gA=texture2D(tileGreen,landUV/3.1).rgb,gB=texture2D(tileGreen,w2/7.7).rgb;
      float greenish=smoothstep(-.01,.07,near.g-near.r);
      vec3 grain=mix(dA*.65+dB*.35,gA*.65+gB*.35,greenish);
      grain=mix(grain,(gA*.45+gB*.25+texture2D(tileGreen,w2/1.7).rgb*.3),mown);
      grain=mix(grain,texture2D(tileRoad,landUV/3.3).rgb*.6+texture2D(tileRoad,w2/8.3).rgb*.4,road);
      near*=mix(vec3(1.),grain*2.,close);
      // Hill ground: an olive green with some tan in it, as the July frames show (the critic found it too straw); no lime up on
      // the slopes. The low ground keeps its full green.
      float upHill=smoothstep(.012,.06,1.-abs(normalize(detailNormal).y))*smoothstep(146.,158.,detailWorld.y)*(1.-road)*(1.-mown);
      near=mix(near,vec3(dot(near,vec3(.36,.42,.22)))*vec3(.94,1.08,.62),max(upHill*.42,greenish<.5?.22*(1.-road)*(1.-mown):0.));
      // Pink-red bare soil on the back hill.
      {float pinkD=length((landUV-vec2(190.,-73.))/vec2(26.,16.));near=mix(near,vec3(.68,.55,.5)*(.86+fine.g*.28),(1.-smoothstep(.55,1.05,pinkD+(mid.r-.5)*.5+(fine.b-.5)*.35))*.85);}
      // (.74: the near ground measured 20-30% brighter than the July frames outside his outlines, views 01-03 most)
      near=pow(max(near,vec3(.0)),vec3(2.2))/1.8*mix(.74,1.,road)*mix(vec3(1.),vec3(1.,1.02,.8),greenish*(1.-road));   // (the gravel keeps its own measured grey)
      vec2 paintUV=vec2(landUV.x/(2.*paintHalf)+.5,.5-landUV.y/(2.*paintHalf));
      vec4 moisture=texture2D(paintMoisture,paintUV),surfacePaint=texture2D(paintSurface,paintUV);
      near=mix(near,mix(${shown('#a89d72')},${shown('#578c30')},moisture.r)*(.8+fine.r*.4),moisture.a*.85);
      near=mix(near,mix(${shown('#7a9a48')},${shown('#b3a892')},surfacePaint.r)*(.8+fine.g*.4),surfacePaint.a);
      near=mix(near,mix(${shown('#4e5536')},${shown('#6c7a3c')},fine.b)*(.8+tiny.g*.4),smoothstep(.15,.7,masks.b+(fine.r-.5)*.3)*.85);
      float steep=smoothstep(.2,.62,1.-abs(normalize(detailNormal).y));
      near=mix(near,${shown('#6a6456')}*(.8+fine.b*.4),smoothstep(.45,.8,steep));
      diffuseColor.rgb=mix(farLand,near,inMid*detailEnabled);
      #endif
      vec2 canopyUV=detailWorld.xz/(2.*canopyHalf)+.5;
      float canopy=texture2D(canopyShade,vec2(canopyUV.x,1.-canopyUV.y)).a;
      canopy*=step(0.,canopyUV.x)*step(canopyUV.x,1.)*step(0.,canopyUV.y)*step(canopyUV.y,1.);
      diffuseColor.rgb*=1.-min(1.,canopy*1.8)*.9;
      vec2 castUV=detailWorld.xz/(2.*castHalf)+.5;
      vec2 castIn=step(vec2(0.),castUV)*step(castUV,vec2(1.));
      vec3 baked=texture2D(castShade,vec2(castUV.x,1.-castUV.y)).rgb*castIn.x*castIn.y;
      diffuseColor.rgb=mix(diffuseColor.rgb,${shown('#7a5a42')}*(.75+fine.a*.5),clamp(baked.b*1.5,0.,1.)*(.25+tiny.r*.45));
      diffuseColor.rgb*=1.-baked.g*.42;
      diffuseColor.rgb*=mix(vec3(1.),vec3(.5,.5,.55),clamp(baked.r*2.,0.,1.)*castStrength);`);
  };material.customProgramCacheKey=()=> 'montana-ground-detail-v22';}};
}
export function rockGeometry(seed,detail=2){
  const g=new THREE.IcosahedronGeometry(1,detail),p=g.attributes.position,col=new Float32Array(p.count*3);
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
// Rock colour against the July frames: the real rocks are a neutral grey, the model's had a greenish-yellow cast.
export function rockMaterial(){const t=surface(2);return new THREE.MeshStandardMaterial({map:t,color:new THREE.Color().setRGB(.6,.6,.61),vertexColors:true,flatShading:true,roughness:1});}
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
