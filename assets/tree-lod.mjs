// Stable spatial thresholds and time-continuous coverage, independent of frame rate.
export function lodOffset(id){let h=2166136261;for(const c of String(id)){h=Math.imul(h^c.charCodeAt(0),16777619);}return ((h>>>0)/4294967295-.5)*40;}
export function meshCoverage(distance,end){const t=Math.max(0,Math.min(1,(end-distance)/35));return t*t*(3-2*t);}
export function approachCoverage(current,target,dt){const step=Math.min(.1,Math.max(0,dt))/1.1;return current<target?Math.min(target,current+step):Math.max(target,current-step);}
// Cheap object-space occlusion. Use the SAME vertex colors for live and baked trees.
export function shadeCanopy(THREE,geometry){
 geometry.computeBoundingBox();const b=geometry.boundingBox,p=geometry.attributes.position,colors=new Float32Array(p.count*3);
 const height=Math.max(.001,b.max.y-b.min.y),radius=Math.max(.001,Math.max(Math.abs(b.min.x),Math.abs(b.max.x),Math.abs(b.min.z),Math.abs(b.max.z)));
 for(let i=0;i<p.count;i++){const y=(p.getY(i)-b.min.y)/height,r=Math.min(1,Math.hypot(p.getX(i),p.getZ(i))/radius);
 const light=.43+.30*Math.sqrt(r)+.23*y;colors.set([light,light,light],i*3);}
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
