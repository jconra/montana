// The property line as an optional overlay: a thin bright band standing on the ground along the public parcel outline, with a post at each corner.
import * as THREE from 'three';
export async function createPropertyLine({scene,heightAt,url='./assets/property-line.json',step=2.5,band=.45,lift=.25}){
 const {points}=await (await fetch(url)).json(),pos=[],idx=[],mat=new THREE.MeshBasicMaterial({color:0xff7a1a,side:THREE.DoubleSide,fog:false,toneMapped:false}),group=new THREE.Group();
 for(let i=0;i<points.length;i++){const [ax,az]=points[i],[bx,bz]=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/step));
  for(let k=0;k<=n;k++){const t=k/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t,y=heightAt(x,z)+lift,q=pos.length/3;pos.push(x,y,z,x,y+band,z);if(k<n)idx.push(q,q+1,q+2,q+1,q+3,q+2);}
  // and a flat strip on the ground, so the line still shows from straight above
  {const L=Math.hypot(bx-ax,bz-az)||1,nx=-(bz-az)/L*.7,nz=(bx-ax)/L*.7;for(let k=0;k<=n;k++){const t=k/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t,q=pos.length/3;pos.push(x-nx,heightAt(x-nx,z-nz)+lift,z-nz,x+nx,heightAt(x+nx,z+nz)+lift,z+nz);if(k<n)idx.push(q,q+1,q+2,q+1,q+3,q+2);}}
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,3,8),mat);post.position.set(ax,heightAt(ax,az)+1.5,az);group.add(post);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);group.add(new THREE.Mesh(g,mat));
 group.name='property-line';group.visible=false;scene.add(group);return group;
}
