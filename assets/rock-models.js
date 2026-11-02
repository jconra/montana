import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// Rock models are authored in metres around their own origin, so the transforms
// are baked and the size is kept. Each mesh in a file comes back under its name.
async function loadParts(file){
 const {scene}=await new GLTFLoader().loadAsync(new URL(file,import.meta.url).href),parts=new Map();
 scene.updateMatrixWorld(true);
 scene.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();parts.set(mesh.name,{geometry,material:mesh.material,shadow:true});});
 if(!parts.size)throw new Error(file+' contains no meshes');
 return parts;
}
export async function loadBoulder(name){return [...(await loadParts(`./models/${name}.glb?v=1`)).values()];}
// Four detailed shapes sharing one texture, named after the rock asset they replace.
export async function loadCentralRocks(){const parts=await loadParts('./models/central-rocks.glb?v=1');for(const part of parts.values()){part.instanceTint=true;part.material.color.setScalar(.8);}return parts;}
