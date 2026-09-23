import * as THREE from 'three';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Small repeatable detail maps; no remote texture dependencies.
function surface(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=random(810+kind);
  const colors=[['#827565','#a49984','#645d4f'],['#85817a','#b3aa9b','#625e56'],['#777267','#aaa294','#57584f']][kind];
  g.fillStyle=colors[0];g.fillRect(0,0,256,256);
  for(let i=0;i<4000;i++){const x=r()*256,y=r()*256,sz=kind===1?1+r()*5:.5+r()*3;g.fillStyle=colors[i%3];g.globalAlpha=.25+r()*.5;g.beginPath();g.ellipse(x,y,sz,sz*(.35+r()*.6),r()*Math.PI,0,Math.PI*2);g.fill();}
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function createGroundDetail(half,driveway){
  const c=document.createElement('canvas');c.width=c.height=2048;const g=c.getContext('2d');g.fillStyle='black';g.fillRect(0,0,c.width,c.height);
  const draw=width=>{g.lineWidth=width*c.width/(2*half);g.lineCap=g.lineJoin='round';g.beginPath();driveway.forEach((p,i)=>g[i?'lineTo':'moveTo']((p.x+half)/(2*half)*c.width,(p.z+half)/(2*half)*c.height));g.stroke();};
  g.strokeStyle='#555';draw(7);g.strokeStyle='#aaa';draw(5.5);g.strokeStyle='white';draw(4);
  const mask=new THREE.CanvasTexture(c);mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;
  const uniforms={detailEnabled:{value:1},roadMask:{value:mask},groundHalf:{value:half},soilDetail:{value:surface(0)},gravelDetail:{value:surface(1)},stoneDetail:{value:surface(2)}};
  return {uniforms,attach(material){material.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndetailWorld=(modelMatrix*vec4(position,1.)).xyz;detailNormal=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader='uniform float detailEnabled;uniform float groundHalf;uniform sampler2D roadMask;uniform sampler2D soilDetail;uniform sampler2D gravelDetail;uniform sampler2D stoneDetail;varying vec3 detailWorld;varying vec3 detailNormal;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      vec2 landUV=detailWorld.xz;vec2 maskUV=vec2(.5+landUV.x/(2.*groundHalf),.5-landUV.y/(2.*groundHalf));
      float road=texture2D(roadMask,maskUV).r;
      float steep=smoothstep(.18,.58,1.-abs(normalize(detailNormal).y));
      vec3 soil=texture2D(soilDetail,landUV*.45).rgb;
      vec3 stone=texture2D(stoneDetail,landUV*.3).rgb;
      vec3 gravel=texture2D(gravelDetail,landUV*.7).rgb;
      // Keep aerial color variation while adding metre-scale soil/stone detail.
      vec3 detailed=mix(diffuseColor.rgb*(.7+soil*.8),stone,steep*.65);
      detailed=mix(detailed,gravel,road*.94);
      float proximity=1.-smoothstep(180.,650.,distance(cameraPosition,detailWorld));
      diffuseColor.rgb=mix(diffuseColor.rgb,detailed,detailEnabled*proximity);
      #endif`);
  };material.customProgramCacheKey=()=> 'montana-ground-detail-v1';}};
}
export function rockGeometry(seed){
  const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,col=new Float32Array(p.count*3);
  // Deform by coordinate, not by vertex index: duplicated triangle corners stay
  // coincident, avoiding cracks in the old randomly displaced dodecahedron.
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=Math.sin(x*4.1+seed)*Math.sin(z*3.7-seed*.3)*.13+Math.cos(y*5+seed)*.08;
    p.setXYZ(i,x*(1+n)*(1+seed%3*.12),Math.max(-.55,Math.min(.7,y*(.7+n))),z*(1+n));
    const shade=.78+.15*Math.sin(x*7+z*9+seed)+.07*y;col.set([shade,shade*.98,shade*.92],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function rockMaterial(){const t=surface(2);return new THREE.MeshStandardMaterial({map:t,color:0xb9b4a8,vertexColors:true,flatShading:true,roughness:1});}
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
