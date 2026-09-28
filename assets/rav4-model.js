import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The supplied Tripo GLB has one mesh, but the wheels are disconnected islands.
// Weld position seams only for connectivity; retain original normals and UVs.
export function rigRav4(source){
  source.updateMatrixWorld(true);
  const meshes=[];source.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(meshes.length!==1)throw new Error('Unexpected RAV4 mesh layout.');
  const original=meshes[0],geometry=original.geometry.clone().applyMatrix4(original.matrixWorld);
  const position=geometry.attributes.position,index=geometry.index;
  if(!index||position.count>65535)throw new Error('Unexpected RAV4 geometry.');
  const parent=Array.from({length:position.count},(_,i)=>i),seams=new Map();
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  const join=(a,b)=>{parent[root(a)]=root(b);};
  for(let i=0;i<position.count;i++){
    const key=[position.getX(i),position.getY(i),position.getZ(i)].map(n=>n.toFixed(5)).join(',');
    if(seams.has(key))join(i,seams.get(key));else seams.set(key,i);
  }
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i+1),index.getX(i+2));}
  const bounds=new Map(),point=new THREE.Vector3();
  for(let i=0;i<position.count;i++){
    const key=root(i);if(!bounds.has(key))bounds.set(key,new THREE.Box3());
    bounds.get(key).expandByPoint(point.fromBufferAttribute(position,i));
  }
  const wheelIslands=[...bounds].filter(([,box])=>{
    const s=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
    return box.min.y<.01&&Math.abs(c.x)>.14&&s.x<.08&&s.y>.15&&s.y<.18&&s.z>.15&&s.z<.18;
  });
  if(wheelIslands.length!==4)throw new Error('Could not identify all four RAV4 wheels.');
  const groups=new Map(wheelIslands.map(([key])=>[key,[]])),body=[];
  for(let i=0;i<index.count;i+=3){const indices=groups.get(root(index.getX(i)))||body;indices.push(index.getX(i),index.getX(i+1),index.getX(i+2));}
  const makePart=indices=>{
    const g=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(geometry.attributes))g.setAttribute(name,attribute);
    // Uint16 avoids requiring OES_element_index_uint for the car on WebGL1.
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(indices),1));g.computeBoundingBox();g.computeBoundingSphere();
    return new THREE.Mesh(g,original.material);
  };
  const model=new THREE.Group();model.name='RAV4';model.add(makePart(body));
  const wheels=wheelIslands.map(([key,box])=>{
    const center=box.getCenter(new THREE.Vector3()),pivot=new THREE.Group(),spin=new THREE.Group(),mesh=makePart(groups.get(key));
    pivot.position.copy(center);mesh.position.copy(center).negate();spin.add(mesh);pivot.add(spin);model.add(pivot);
    return {pivot,spin,front:center.z>0,radius:(box.max.y-box.min.y)*.5};
  });
  geometry.computeBoundingBox();const length=geometry.boundingBox.max.z-geometry.boundingBox.min.z,scale=4.6/length;
  model.scale.setScalar(scale);model.position.y=-geometry.boundingBox.min.y*scale;
  original.geometry.dispose();
  return {model,wheels,update(steer,distance){for(const wheel of wheels){wheel.pivot.rotation.y=wheel.front?steer:0;wheel.spin.rotation.x+=distance/(wheel.radius*scale);}}};
}

export async function loadRav4(){
  const gltf=await new GLTFLoader().loadAsync(new URL('./models/rav4.glb',import.meta.url).href);
  return rigRav4(gltf.scene);
}
