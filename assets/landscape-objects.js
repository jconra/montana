import * as THREE from 'three';

// Rebuild only on committed edits. Shared geometry/materials stay instanced;
// editing one object never creates thousands of independent scene meshes.
export function createLandscapeObjects(scene,catalog,heightAt){
 const chunks=[],bindings=new Map(),o=new THREE.Object3D(),color=new THREE.Color(),zero=new THREE.Matrix4().makeScale(0,0,0);
 let level=1,density=.4,hidden=null;
 function matrix(record){o.position.set(record.x,heightAt(record.x,record.z)+record.offset,record.z);o.rotation.set(...record.rotation);o.scale.set(...record.scale);o.updateMatrix();return record.id===hidden?zero:o.matrix;}
 function write(chunk){for(let i=0;i<chunk.list.length;i++){const t=chunk.list[i],m=matrix(t);for(const im of chunk.meshes)im.setMatrixAt(i,m);}for(const im of chunk.meshes){im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();}}
 function setQuality(l,d){level=l;density=d;for(const c of chunks)for(const im of c.meshes){im.count=Math.max(1,c.authored+Math.ceil((c.list.length-c.authored)*Math.max(c.asset.startsWith('rock/')?.65:c.asset==='bush/sage'?.35:0,d)));im.computeBoundingSphere();}}
 function rebuild(records,authored=new Set()){
  for(const c of chunks)for(const im of c.meshes){scene.remove(im);im.dispose();}chunks.length=0;bindings.clear();
  const cells=new Map();for(const t of records){if(t.asset.startsWith('tree/'))continue;const x=Math.floor(t.x/28),z=Math.floor(t.z/28),key=t.asset==='bush/sage'?`${t.asset}:${x}:${z}`:t.asset;if(!cells.has(key))cells.set(key,{asset:t.asset,x:(x+.5)*28,z:(z+.5)*28,list:[]});cells.get(key).list.push(t);}
  const rank=t=>{let n=2166136261;for(const c of t.id)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  for(const chunk of cells.values()){
   chunk.list.sort((a,b)=>Number(authored.has(b.id))-Number(authored.has(a.id))||rank(a)-rank(b));chunk.authored=chunk.list.filter(t=>authored.has(t.id)).length;chunk.meshes=catalog.get(chunk.asset).parts.map(p=>{const im=new THREE.InstancedMesh(p.geometry,p.material,chunk.list.length);im.name='landscape-'+chunk.asset;chunk.list.forEach((t,i)=>{const tint=p.geometry.hasAttribute('color')?1:t.tint;im.setColorAt(i,color.setRGB(tint,tint,tint));});scene.add(im);return im;});
   chunk.list.forEach((t,i)=>bindings.set(t.id,{chunk,i}));chunks.push(chunk);write(chunk);
  }setQuality(level,density);
 }
 function setHidden(id){const old=hidden;hidden=id;for(const key of [old,id]){const b=bindings.get(key);if(b){const m=matrix(b.chunk.list[b.i]);for(const im of b.chunk.meshes){im.setMatrixAt(b.i,m);im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();}}}}
 function update(camera){for(const c of chunks){const visible=c.asset!=='bush/sage'||Math.hypot(camera.position.x-c.x,camera.position.z-c.z)<[45,70,95,125,150][level]+22;for(const im of c.meshes)im.visible=visible;}}
 return {rebuild,setQuality,setHidden,update,refreshHeights(){chunks.forEach(write);},visibleIds(){return [...bindings].filter(([,b])=>b.i<b.chunk.meshes[0].count&&b.chunk.meshes[0].visible).map(([id])=>id);},chunks};
}
