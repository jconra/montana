import * as THREE from 'three';
import {createRoute,POND_OUTLINE} from './property-layout.mjs';
import {campSurface} from './camp-approach.mjs';
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
export function createGroundDetail(half,driveway){
  const c=document.createElement('canvas');c.width=c.height=2048;const g=c.getContext('2d');g.fillStyle='black';g.fillRect(0,0,c.width,c.height);
  const maskMin=new THREE.Vector2(-160,-480),maskSize=new THREE.Vector2(370,660),route=createRoute(driveway);
  // Draw in metres, then transform to mask pixels; enough resolution for the grass median.
  g.setTransform(c.width/maskSize.x,0,0,c.height/maskSize.y,-maskMin.x*c.width/maskSize.x,-maskMin.y*c.height/maskSize.y);
  function path(width,color,offset=0,start=0,end=route.total){g.strokeStyle=color;g.lineWidth=width;g.lineCap=g.lineJoin='round';g.beginPath();for(let d=start;d<=end+.01;d+=.5){const p=route.at(Math.min(d,end),offset);if(d===start)g.moveTo(p.x,p.z);else g.lineTo(p.x,p.z);}g.stroke();}
  // Green channel controls the lush corridor and meadow, red controls gravel.
  for(let i=0;i<=24;i++){const t=i/24;path(85-i*2.5,`rgb(0,${Math.round(t*t*(3-2*t)*255)},0)`);}
  g.fillStyle='#00e000';g.beginPath();g.ellipse(-8,28,36,28,-.2,0,Math.PI*2);g.fill();
  g.strokeStyle='#00ff00';g.lineWidth=9;g.beginPath();POND_OUTLINE.forEach((p,i)=>g[i?'lineTo':'moveTo'](p.x,p.z));g.closePath();g.stroke();
  path(4.6,'#24ff00');path(3.5,'#38ff00');path(.72,'#00ff00');
  for(const side of [-1,1]){path(1.45,'#80ff00',side*.86);path(1.08,'#cfff00',side*.86);path(.72,'#ffff00',side*.86);}
  // The parking/turnaround end is fully worn; the drive retains its centre strip.
  path(4.5,'#b8ff00',0,route.total-18);path(3.6,'#ffff00',0,route.total-15);
  for(const [x,z,rx,rz] of [[-28,-10,7,6],[-22,-5,5,5]]){g.fillStyle='#e0ff00';g.beginPath();g.ellipse(x,z,rx,rz,0,0,Math.PI*2);g.fill();}
  // Blend the wider garage apron into a short green lawn. Sample the same
  // footprint as the grass renderer, so blades cannot sprout through gravel.
  const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;
  const left=Math.floor((-55-maskMin.x)/maskSize.x*c.width),right=Math.ceil((20-maskMin.x)/maskSize.x*c.width);
  const top=Math.floor((-16-maskMin.y)/maskSize.y*c.height),bottom=Math.ceil((48-maskMin.y)/maskSize.y*c.height);
  for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
    const x=maskMin.x+(px+.5)/c.width*maskSize.x,z=maskMin.y+(py+.5)/c.height*maskSize.y,s=campSurface(x,z),i=(py*c.width+px)*4;
    data[i]=Math.max(data[i],Math.round(s.gravel*255));data[i+1]=Math.max(data[i+1],Math.round(Math.max(s.lawn,s.tallGrass)*255));data[i+2]=Math.round(s.lawn*255);
  }
  g.putImageData(pixels,0,0);
  const mask=new THREE.CanvasTexture(c);mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;
  const uniforms={detailEnabled:{value:1},roadMask:{value:mask},groundMaskMin:{value:maskMin},groundMaskSize:{value:maskSize},greenness:{value:.85},grassDetail:{value:surface(3)},soilDetail:{value:surface(0)},gravelDetail:{value:surface(1)},stoneDetail:{value:surface(2)}};
  return {uniforms,attach(material){material.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndetailWorld=(modelMatrix*vec4(position,1.)).xyz;detailNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader='uniform float detailEnabled;uniform float greenness;uniform sampler2D grassDetail;uniform vec2 groundMaskMin;uniform vec2 groundMaskSize;uniform sampler2D roadMask;uniform sampler2D soilDetail;uniform sampler2D gravelDetail;uniform sampler2D stoneDetail;varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      vec2 landUV=detailWorld.xz;vec2 localMask=(landUV-groundMaskMin)/groundMaskSize;vec2 maskUV=vec2(localMask.x,1.-localMask.y);
      vec3 coverage=texture2D(roadMask,maskUV).rgb;coverage*=step(0.,localMask.x)*step(localMask.x,1.)*step(0.,localMask.y)*step(localMask.y,1.);float road=coverage.r;
      // Broad patches break up texture repetition without extra texture reads.
      float patches=.5+.25*sin(landUV.x*.071+sin(landUV.y*.043)*2.)+.25*sin(landUV.y*.093+landUV.x*.031);
      float steep=smoothstep(.18,.58,1.-abs(normalize(detailNormal).y));
      vec3 soil=texture2D(soilDetail,landUV*.45).rgb;
      vec3 stone=texture2D(stoneDetail,landUV*.3).rgb;
      vec3 gravel=texture2D(gravelDetail,landUV*.7).rgb;
      // Texture splatting: grass/soil on gentle terrain, stone on steep slopes.
      // Replace the grey aerial base nearby instead of just multiplying it.
      vec3 grass=texture2D(grassDetail,landUV*.65).rgb;
      // The greener trip is the color reference. Keep fine lawn variation,
      // rather than flattening the clearing to one color or baking dry-season tan.
      grass=mix(grass,grass*vec3(1.03,1.15,.98),coverage.b*.75);
      float grassWeight=clamp(greenness*(.48+patches*.5+coverage.g*.48),0.,1.)*(1.-steep*.85);
      vec3 land=mix(soil,grass,grassWeight);
      land*=.88+patches*.24;
      vec3 detailed=mix(land,stone,steep*.7);
      detailed=mix(diffuseColor.rgb,detailed,.9);
      detailed=mix(detailed,gravel,road*.94);
      float proximity=1.-smoothstep(180.,650.,distance(cameraPosition,detailWorld));
      diffuseColor.rgb=mix(diffuseColor.rgb,detailed,detailEnabled*proximity);
      #endif`);
  };material.customProgramCacheKey=()=> 'montana-ground-detail-v4';}};
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
