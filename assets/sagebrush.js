import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Keep the supplied Blender asset intact. Bake its object transforms once so
// branches and leaf cards can share each shrub's instancing transform.
// Sage across the property is a rounded pale mound: soft-lit lumpy body under small sprays of silver leaves, a few dozen triangles.
// The supplied Blender model stays available in the editor as its own object; at scale its twigs read as dark thistles.
function sageMound(){
 let seed=9011;const r=()=>((seed=(seed*16807)%2147483647)/2147483647),parts=[];
 const dome=new THREE.IcosahedronGeometry(1,2).toNonIndexed(),p=dome.attributes.position,domeCol=new Float32Array(p.count*3),domeNor=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.1*Math.sin(x*4.1+z*2.7)+.07*Math.sin(y*5+x*3.3);
  p.setXYZ(i,x*n*.47,Math.max(.01,.3+y*n*.42),z*n*.47);const k=.72+.34*Math.max(0,y);domeCol.set([.145*k,.185*k,.11*k],i*3);const l=Math.hypot(x*.5,1,z*.5);domeNor.set([x*.5/l,1/l,z*.5/l],i*3);}
 const pos=[...p.array],nor=[...domeNor],col=[...domeCol];
 for(let i=0;i<60;i++){const a=r()*6.283,up=Math.pow(r(),.55),rad=Math.sqrt(1-up*up)*.46,cx=Math.cos(a)*rad,cz=Math.sin(a)*rad,cy=.3+up*.42,size=.07+r()*.07,turn=r()*6.283,k=.95+r()*.45;
  for(const [u,v] of [[-1,-.5],[1,-.5],[.15,1.1]]){const lx=u*size;pos.push(cx+Math.cos(turn)*lx,cy+v*size,cz+Math.sin(turn)*lx);const l=Math.hypot(cx*.4,1,cz*.4);nor.push(cx*.4/l,1/l,cz*.4/l);col.push(.175*k,.22*k,.13*k);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));
 return {geometry:g,material:new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,name:'sagebrush-body'})};
}
export async function loadSagebrush(){return [sageMound()];}
export function loadSageModel(){return loadBushModel('./models/sage.glb?v=c4f739d5','sagebrush');}
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
