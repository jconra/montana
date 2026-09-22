import * as THREE from 'three';

// Complementary screen-door coverage preserves depth writes and avoids sorting
// thousands of transparent trees. The two representations never cover the same pixel.
export const lodDither=`
varying float vMeshFade;
float lodNoise(){return fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));}
`;
export function fadingMeshMaterial(original){
  const material=original.clone();
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float meshFade;\nvarying float vMeshFade;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMeshFade=meshFade;');
    shader.fragmentShader=lodDither+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(lodNoise()>=vMeshFade)discard;');
  };
  material.customProgramCacheKey=()=> 'forest-lod-crossfade-v1';
  return material;
}

// Y-up full-sphere octahedral mapping; JS bake and GLSL lookup use the same fold.
export function octDecode(u,v){
  let x=u*2-1,z=v*2-1,y=1-Math.abs(x)-Math.abs(z);
  if(y<0){const old=x;x=(1-Math.abs(z))*(old>=0?1:-1);z=(1-Math.abs(old))*(z>=0?1:-1);}
  return new THREE.Vector3(x,y,z).normalize();
}
export function viewBasis(direction){
  const up=Math.abs(direction.y)>.999?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const right=new THREE.Vector3().crossVectors(up,direction).normalize();
  return {right,up:new THREE.Vector3().crossVectors(direction,right).normalize()};
}

export async function bakeAtlas(renderer,tree,grid,tile,onProgress){
  const size=grid*tile;
  if(size>renderer.capabilities.maxTextureSize)throw new Error(`Atlas ${size}px exceeds this device's ${renderer.capabilities.maxTextureSize}px texture limit.`);
  const box=new THREE.Box3().setFromObject(tree),center=box.getCenter(new THREE.Vector3());
  const radius=box.getSize(new THREE.Vector3()).length()*.5*1.05;
  const target=new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false,depthBuffer:true});
  // Linear RGBA8: the custom fragment shader performs the final output conversion.
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  const scene=new THREE.Scene();scene.add(tree);
  scene.add(new THREE.HemisphereLight(0xdce8f1,0x6c6650,.8));
  const sun=new THREE.DirectionalLight(0xfff2d6,1.2);sun.position.set(-2,3.5,2.5);scene.add(sun);
  const camera=new THREE.OrthographicCamera(-radius,radius,radius,-radius,.01,radius*6);
  const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
  const oldViewport=renderer.getViewport(new THREE.Vector4()),oldScissor=renderer.getScissor(new THREE.Vector4()),oldScissorTest=renderer.getScissorTest();
  try{
    for(let y=0;y<grid;y++){
      renderer.setRenderTarget(target);renderer.setScissorTest(true);renderer.setClearColor(0,0);
      for(let x=0;x<grid;x++){
        const dir=octDecode(x/(grid-1),y/(grid-1));
        camera.position.copy(center).addScaledVector(dir,radius*3);
        camera.up.copy(viewBasis(dir).up);camera.lookAt(center);camera.updateMatrixWorld();
        // A transparent two-pixel gutter prevents interpolation between neighboring views.
        renderer.setViewport(x*tile,y*tile,tile,tile);renderer.setScissor(x*tile,y*tile,tile,tile);renderer.clear();
        renderer.setViewport(x*tile+2,y*tile+2,tile-4,tile-4);renderer.render(scene,camera);
      }
      // Restore before yielding so the interactive render loop cannot draw into the atlas.
      renderer.setRenderTarget(oldTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);renderer.setClearColor(oldColor,oldAlpha);
      onProgress?.(y+1,grid);await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {target,grid,tile,center,radius,bytes:size*size*4};
  }catch(e){target.dispose();throw e;}
  finally{scene.remove(tree);renderer.setRenderTarget(oldTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);renderer.setClearColor(oldColor,oldAlpha);}
}

const vertexShader=`
attribute vec4 instanceData;
attribute float instanceYaw;
attribute float meshFade;
varying float vMeshFade;
uniform vec3 treeCenter;
uniform float treeRadius;
uniform float gridSize;
uniform float tileSize;
uniform float blendViews;
varying vec2 uvA;varying vec2 uvB;varying vec2 uvC;
varying vec3 weights;varying float distanceToEye;
vec3 decodeOct(vec2 uv){
  vec2 p=uv*2.0-1.0;vec3 n=vec3(p.x,1.0-abs(p.x)-abs(p.y),p.y);
  if(n.y<0.0)n.xz=(1.0-abs(n.zx))*vec2(n.x>=0.0?1.0:-1.0,n.z>=0.0?1.0:-1.0);
  return normalize(n);
}
vec2 encodeOct(vec3 n){
  n/=abs(n.x)+abs(n.y)+abs(n.z);
  vec2 p=n.xz;
  if(n.y<0.0)p=(1.0-abs(p.yx))*vec2(p.x>=0.0?1.0:-1.0,p.y>=0.0?1.0:-1.0);
  return p*.5+.5;
}
mat3 basis(vec3 n){
  vec3 u=abs(n.y)>.999?vec3(0,0,1):vec3(0,1,0);
  vec3 r=normalize(cross(u,n));return mat3(r,normalize(cross(n,r)),n);
}
vec2 projectFrame(vec3 p,vec2 frame){
  mat3 b=basis(decodeOct(frame/(gridSize-1.0)));
  vec2 uv=vec2(dot(p,b[0]),dot(p,b[1]))/(2.0*treeRadius)+.5;
  uv=clamp(uv,0.0,1.0);
  return (frame*tileSize+vec2(2.5)+uv*(tileSize-5.0))/(gridSize*tileSize);
}
void main(){
  vMeshFade=meshFade;
  float c=cos(instanceYaw),s=sin(instanceYaw);
  mat3 yaw=mat3(c,0,-s, 0,1,0, s,0,c);
  vec3 center=instanceData.xyz+yaw*treeCenter*instanceData.w;
  vec3 worldDir=normalize(cameraPosition-center);
  vec3 localDir=vec3(c*worldDir.x-s*worldDir.z,worldDir.y,s*worldDir.x+c*worldDir.z);
  mat3 b=basis(localDir);
  vec3 localPoint=(b[0]*position.x+b[1]*position.y)*2.0*treeRadius;
  vec3 wp=center+yaw*localPoint*instanceData.w;
  vec2 p=encodeOct(localDir)*(gridSize-1.0);
  vec2 a=floor(min(p,vec2(gridSize-2.0))),f=p-a;
  vec2 iA=a,iB=a+vec2(1,0),iC=a+vec2(0,1);
  weights=vec3(1.0-f.x-f.y,f.x,f.y);
  if(f.x+f.y>1.0){iA=a+vec2(1,1);iB=a+vec2(0,1);iC=a+vec2(1,0);weights=vec3(f.x+f.y-1.0,1.0-f.x,1.0-f.y);}
  if(blendViews<.5){iA=floor(p+.5);iB=iA;iC=iA;weights=vec3(1,0,0);}
  uvA=projectFrame(localPoint,iA);uvB=projectFrame(localPoint,iB);uvC=projectFrame(localPoint,iC);
  vec4 mv=viewMatrix*vec4(wp,1);distanceToEye=-mv.z;
  gl_Position=projectionMatrix*mv;
}`;
const fragmentShader=lodDither+`
uniform sampler2D atlas;
uniform float cutoff;
uniform float blendViews;
uniform vec3 fogColor;
uniform vec2 fogRange;
varying vec2 uvA;varying vec2 uvB;varying vec2 uvC;varying vec3 weights;varying float distanceToEye;
void main(){
  vec4 a=texture2D(atlas,uvA);
  float alpha=a.a;
  vec3 color=a.rgb;
  if(blendViews>.5){
  vec4 b=texture2D(atlas,uvB),c=texture2D(atlas,uvC);
  // Alpha-weighted blending avoids dark RGB from the transparent atlas background.
  alpha=dot(vec3(a.a,b.a,c.a),weights);
  color=(a.rgb*a.a*weights.x+b.rgb*b.a*weights.y+c.rgb*c.a*weights.z)/max(alpha,.0001);
  }
  if(alpha<cutoff)discard;
  if(lodNoise()<vMeshFade)discard;
  color=mix(color,fogColor,smoothstep(fogRange.x,fogRange.y,distanceToEye));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function impostorMaterial(atlas,fog){
  return new THREE.ShaderMaterial({vertexShader,fragmentShader,side:THREE.DoubleSide,uniforms:{
    atlas:{value:atlas.target.texture},treeCenter:{value:atlas.center},treeRadius:{value:atlas.radius},
    gridSize:{value:atlas.grid},tileSize:{value:atlas.tile},blendViews:{value:1},cutoff:{value:.3},
    fogColor:{value:fog.color},fogRange:{value:new THREE.Vector2(fog.near,fog.far)}
  }});
}

export function atlasCanvas(renderer,atlas){
  const size=atlas.grid*atlas.tile,pixels=new Uint8Array(size*size*4);
  renderer.readRenderTargetPixels(atlas.target,0,0,size,size,pixels);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),out=ctx.createImageData(size,size);
  const lut=Array.from({length:256},(_,i)=>{const x=i/255;return Math.round(255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055));});
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const src=(y*size+x)*4,dst=((size-1-y)*size+x)*4;
    for(let c=0;c<3;c++)out.data[dst+c]=lut[pixels[src+c]];
    out.data[dst+3]=pixels[src+3];
  }
  ctx.putImageData(out,0,0);return canvas;
}
