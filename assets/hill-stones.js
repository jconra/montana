// SMALL STONES over the open hill: hundreds of grey stones of mixed size, half sunk, as the frames show. One instanced draw of very low-poly rocks, not editor objects.
import * as THREE from 'three';
import {gradeLand} from './land-grade.mjs';
// (fewer and paler than first drawn: the frames show the odd pale stone in the grass, not a dark scatter)
export function createHillStones({scene,heightAt,free,count=1800}){
 let s=91173;const R=()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);
 const geo=new THREE.IcosahedronGeometry(1,0);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.22*Math.sin(x*5+y*3)+.16*Math.cos(z*4-x*2);p.setXYZ(i,x*n,y*n*.62,z*n);}geo.computeVertexNormals();
 const mat=gradeLand(new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true})),rows=[];
 for(let n=0;n<count*4&&rows.length<count;n++){
  const x=-60+R()*210,z=-110+R()*112,cl=Math.sin(x*.09+Math.sin(z*.07)*2)+Math.cos(z*.11-x*.04);
  if(R()>.42+cl*.28||!free(x,z))continue;
  const v=R(),size=.04+v*v*v*.22;rows.push({x,z,size,r:R()*6.283,tone:.16+R()*.14,warm:R()});
 }
 const m=new THREE.InstancedMesh(geo,mat,rows.length),o=new THREE.Object3D(),c=new THREE.Color();
 rows.forEach((t,i)=>{o.position.set(t.x,heightAt(t.x,t.z)-t.size*.2,t.z);o.rotation.set(R()*.5,t.r,R()*.5);o.scale.set(t.size*(.8+R()*.5),t.size,t.size*(.7+R()*.5));o.updateMatrix();m.setMatrixAt(i,o.matrix);c.setRGB(t.tone*(1+t.warm*.04),t.tone,t.tone*(.96-t.warm*.08));m.setColorAt(i,c);});
 m.name='hill-stones';m.receiveShadow=false;m.castShadow=false;scene.add(m);
 return {mesh:m,count:rows.length,trisEach:geo.attributes.position.count/3,reanchor(){}};
}
