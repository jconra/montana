import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {roofPanelGeometry,clipRoofPolygon} from '../assets/roof-panels.mjs';
const outer=[[0,0],[10,0],[10,10],[0,10]],height=p=>2+p[1]*.5,uv=p=>[p[0],p[1]*Math.hypot(1,.5)];
function panel(holes){return roofPanelGeometry(THREE,outer,holes,height,uv);}
function area(geo){const p=geo.attributes.position;let sum=0;for(let i=0;i<p.count;i+=3){if([i,i+1,i+2].every(k=>Math.abs(p.getY(k)-height([p.getX(k),p.getZ(k)])-.2)<1e-5))sum+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;}return sum;}
const hole=[[2,2],[6,2],[6,6],[2,6]],cut=panel([hole]);
assert.ok(Math.abs(area(cut)-84)<1e-5,'Opening removed from both roof faces');
assert.ok(Math.abs(area(panel([[[2,-2],[6,-2],[6,6],[2,6]]]))-76)<1e-5,'Eave-crossing notch');
assert.ok(Math.abs(area(panel([hole,[[4,4],[8,4],[8,8],[4,8]]]))-72)<1e-5,'Overlapping cutouts');
assert.ok(Math.abs(area(panel([[[2,2],[6,2],[6,4],[4,4],[4,6],[2,6]]]))-88)<1e-5,'Concave opening');
assert.equal(panel([[[-1,-1],[11,-1],[11,11],[-1,11]]]).attributes.position.count,0,'Entire panel removed');
for(let i=0;i<cut.attributes.position.count;i++){
 const p=cut.attributes.position,expected=uv([p.getX(i),p.getZ(i)]);
 assert.ok(Math.abs(cut.attributes.uv.getX(i)-expected[0])<1e-5);
 assert.ok(Math.abs(cut.attributes.uv.getY(i)-expected[1])<1e-5,'Texture phase and density unchanged at cuts');
}
const mesh=new THREE.Mesh(cut,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
const ray=new THREE.Raycaster(new THREE.Vector3(4,20,4),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(mesh).length,0,'Hole clear through roof thickness');
ray.ray.origin.set(8,20,8);assert.ok(ray.intersectObject(mesh).length>=2,'Surrounding roof retains top and underside');
assert.equal(clipRoofPolygon(outer,p=>p[0]-20).length,0);
console.log('Roof openings: interior, eave notch, overlapping/concave, through-thickness and continuous UVs passed');
