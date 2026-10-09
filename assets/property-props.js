import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Small local mesh: no download, texture atlas, or new rendering requirement.
export function propaneTank(){
  const white=new THREE.MeshStandardMaterial({color:0xe6e9e5,roughness:.58}),blue=new THREE.MeshStandardMaterial({color:0x287fa2,roughness:.55}),steel=new THREE.MeshStandardMaterial({color:0x676b68,roughness:.8}),concrete=new THREE.MeshStandardMaterial({color:0xaaa696,roughness:1});
  const profile=[],r=.48,half=.88;
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i*Math.PI/16;profile.push(new THREE.Vector2(Math.cos(a)*r,-half+Math.sin(a)*r));}
  for(let i=0;i<=8;i++){const a=i*Math.PI/16;profile.push(new THREE.Vector2(Math.cos(a)*r,half+Math.sin(a)*r));}
  const shell=new THREE.LatheGeometry(profile,24).rotateZ(Math.PI/2).translate(0,.77,0);
  const cover=new THREE.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI/2).scale(1,.55,1).translate(0,1.245,0);
  const legs=[],pads=[];
  for(const x of [-.68,.68]){
    legs.push(new THREE.BoxGeometry(.12,.28,.6).translate(x,.25,0));
    pads.push(new THREE.BoxGeometry(.5,.13,.85).translate(x,.065,0));
  }
  return [{geometry:shell,material:white},{geometry:cover,material:blue},{geometry:mergeGeometries(legs,false),material:steel},{geometry:mergeGeometries(pads,false),material:concrete}];
}
