// Approximate registration of DJI_121 using the existing house and cabin anchors.
// X = east, Z = south, metres. Keep these authored locations together for refinement.
export function photoToWorld(u,v){
  const du=u-1240,dv=v-823,a=-0.004946272542881978,b=-0.08932266266176393;
  return {x:8+a*du-b*dv,z:-8+b*du+a*dv};
}
const pondAnchors=[[398,595],[442,605],[480,651],[492,726],[497,820],[521,900],[542,974],[517,1010],[466,1028],[413,1010],[383,950],[371,874],[376,795],[390,725],[401,654]].map(([u,v])=>photoToWorld(u,v));
// Rounded interpolation through the traced bank avoids a visibly polygonal shoreline.
export const POND_OUTLINE=pondAnchors.flatMap((p1,i)=>Array.from({length:6},(_,j)=>{
 const p0=pondAnchors[(i+pondAnchors.length-1)%pondAnchors.length],p2=pondAnchors[(i+1)%pondAnchors.length],p3=pondAnchors[(i+2)%pondAnchors.length],t=j/6;
 const interp=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t);
 return {x:interp('x'),z:interp('z')};
}));
export const CLEARING={fire:photoToWorld(796,454),picnic:photoToWorld(830,491),wood:photoToWorld(808,591)};
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function polygonDistance(x,z,points=POND_OUTLINE){
  let inside=false,distance=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));
    distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?distance:-distance;
}
export function createRoute(points){
  let total=0;const segments=points.slice(1).map((b,i)=>{const a=points[i],length=Math.hypot(b.x-a.x,b.z-a.z),s={a,b,length,start:total};total+=length;return s;});
  function at(distance,offset=0){let s=segments.find(s=>distance<=s.start+s.length)||segments.at(-1),t=clamp((distance-s.start)/s.length),nx=-(s.b.z-s.a.z)/s.length,nz=(s.b.x-s.a.x)/s.length;return {x:s.a.x+(s.b.x-s.a.x)*t+nx*offset,z:s.a.z+(s.b.z-s.a.z)*t+nz*offset,nx,nz};}
  function nearest(x,z){let best={distance:Infinity};for(const s of segments){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=clamp(((x-s.a.x)*dx+(z-s.a.z)*dz)/(s.length*s.length)),px=s.a.x+dx*t,pz=s.a.z+dz*t,distance=Math.hypot(x-px,z-pz);if(distance<best.distance)best={distance,offset:((x-px)*-dz+(z-pz)*dx)/s.length,along:s.start+t*s.length};}return best;}
  return {total,at,nearest};
}
export function isTireTrack(info,total){return info.distance<2.3&&(info.along>total-18||Math.abs(Math.abs(info.offset)-.86)<.68);}
export function groundZone(x,z,route,buildings=[]){
  if(polygonDistance(x,z)>-1)return 'water';
  for(const b of buildings)if(Math.hypot(x-b.x,z-b.z)<(b.type==='house'?12:9))return 'building';
  for(const [key,p] of Object.entries(CLEARING))if(Math.hypot(x-p.x,z-p.z)<(key==='fire'?4:2))return 'clearing';
  const n=route.nearest(x,z);if(isTireTrack(n,route.total))return 'track';
  return n.distance<.35&&n.along<route.total-22?'median':'meadow';
}
