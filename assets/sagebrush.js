import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Keep the supplied Blender asset intact. Bake its object transforms once so
// branches and leaf cards can share each shrub's instancing transform.
// The supplied sage is open twigs and thin leaf cards, which from any distance read as a dark scribble. A small lumpy
// pale body inside gives it the rounded silver-green mass the real plants have.
function sageBody(){
 const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,col=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.16*Math.sin(x*5.1+z*3.3)+.1*Math.sin(y*7+x*4)+.07*Math.cos(z*9-y*3);
  p.setXYZ(i,x*n*.46,Math.max(.03,.42+y*n*.38),z*n*.46);const k=.78+.32*Math.max(0,y)+.1*Math.sin(x*11+y*9+z*7);col.set([.25*k,.28*k,.19*k],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
 return {geometry:g,material:new THREE.MeshLambertMaterial({vertexColors:true,name:'sagebrush-body'})};
}
export async function loadSagebrush(){const parts=await loadBushModel('./models/sage.glb?v=c4f739d5','sagebrush');for(const p of parts)p.material.color.multiplyScalar(.68);return [sageBody(),...parts];}
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
