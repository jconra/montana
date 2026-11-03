import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Small local mesh: no download, texture atlas, or new rendering requirement.
export function propaneTank(){
  // A 500-gallon tank: about 0.95 m across and 3 m long (the photos measure 3.0-3.3 m), sitting low on two short saddles that
  // the grass hides; the frames show its belly a hand's width off the ground and a dark shadow line under it.
  const white=new THREE.MeshStandardMaterial({color:0xe6e9e5,roughness:.58}),blue=new THREE.MeshStandardMaterial({color:0x287fa2,roughness:.55}),steel=new THREE.MeshStandardMaterial({color:0x676b68,roughness:.8}),concrete=new THREE.MeshStandardMaterial({color:0xaaa696,roughness:1});
  const profile=[],r=.48,half=1.04,y=.6;
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i*Math.PI/16;profile.push(new THREE.Vector2(Math.cos(a)*r,-half+Math.sin(a)*r));}
  for(let i=0;i<=8;i++){const a=i*Math.PI/16;profile.push(new THREE.Vector2(Math.cos(a)*r,half+Math.sin(a)*r));}
  const shell=new THREE.LatheGeometry(profile,24).rotateZ(Math.PI/2).translate(0,y,0);
  const cover=new THREE.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI/2).scale(1,.55,1).translate(0,y+r-.005,0);
  const legs=[],pads=[];
  for(const x of [-.72,.72]){
    legs.push(new THREE.BoxGeometry(.1,.16,.5).translate(x,.13,0));
    pads.push(new THREE.BoxGeometry(.28,.08,.5).translate(x,.01,0));
  }
  return [{geometry:shell,material:white,shadow:true},{geometry:cover,material:blue,shadow:true},{geometry:mergeGeometries(legs,false),material:steel,shadow:true},{geometry:mergeGeometries(pads,false),material:concrete}];
}
