import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Keep the supplied Blender asset intact. Bake its object transforms once so
// branches and leaf cards can share each shrub's instancing transform.
// The supplied sage is open twigs and thin leaf cards, which from any distance read as a dark scribble. A small lumpy
// pale body inside gives it the rounded silver-green mass the real plants have.
function sageBody(){
 let seed=9011;const r=()=>((seed=(seed*16807)%2147483647)/2147483647),pos=[],col=[],nor=[];
 for(let i=0;i<70;i++){
  // little sprays of silver leaves over a dome, thicker toward the top
  const a=r()*6.283,up=Math.pow(r(),.6),rad=Math.sqrt(1-up*up)*(.34+r()*.16),cx=Math.cos(a)*rad,cz=Math.sin(a)*rad,cy=.1+up*.62+r()*.08,size=.1+r()*.08,turn=r()*6.283,k=.82+r()*.5;
  for(const [u,v] of [[-1,-.5],[1,-.5],[.15,1.1]]){const lx=u*size,ly=v*size;pos.push(cx+Math.cos(turn)*lx,cy+ly,cz+Math.sin(turn)*lx);nor.push(cx*.3,1,cz*.3);col.push(.165*k,.2*k,.12*k);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.normalizeNormals();
 const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,name:'sagebrush-body'});
 return {geometry:g,material};
}
export async function loadSagebrush(){const parts=await loadBushModel('./models/sage.glb?v=c4f739d5','sagebrush');for(const p of parts)p.material.color.setRGB(.62,.68,.5);return [sageBody(),...parts];}
export function loadBigBush(){return loadBushModel('./models/big-bush.glb?v=bb3','big-bush');}
async function loadBushModel(file,name){
 const {scene}=await new GLTFLoader().loadAsync(new URL(file,import.meta.url).href);
 scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(scene,true),height=bounds.max.y-bounds.min.y;
 if(!Number.isFinite(height)||height<=0)throw new Error('Sagebrush has no usable bounds');
 const parts=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  // The authored trunk is rooted at X/Z=0. Normalize to one metre high;
  // placement supplies the final height and varied canopy proportions.
  geometry.translate(0,-bounds.min.y,0).scale(1/height,1/height,1/height);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=mesh.material.clone(),foliage=material.transparent||material.alphaTest>0;
  if(foliage){
   // Preserve the revised export's roughness and MASK cutoff. Cutouts keep
   // instanced shrubs depth-correct without per-leaf sorting on WebGL1 too.
   material.transparent=false;material.depthWrite=true;
   if(material.alphaTest===0)material.alphaTest=.5;
   material.alphaToCoverage=true;material.side=THREE.DoubleSide;
  }
  material.name=name+(foliage?'-leaves':'-branches');
  parts.push({geometry,material});
  mesh.geometry.dispose();mesh.material.dispose();
 });
 if(!parts.length)throw new Error('Sagebrush contains no meshes');
 return parts;
}
