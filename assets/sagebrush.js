import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Keep the supplied Blender asset intact. Bake its object transforms once so
// branches and leaf cards can share each shrub's instancing transform.
export async function loadSagebrush(){
 const {scene}=await new GLTFLoader().loadAsync(new URL('./models/sage.glb?v=c4f739d5',import.meta.url).href);
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
  material.name=foliage?'sagebrush-leaves':'sagebrush-branches';
  parts.push({geometry,material});
  mesh.geometry.dispose();mesh.material.dispose();
 });
 if(!parts.length)throw new Error('Sagebrush contains no meshes');
 return parts;
}
