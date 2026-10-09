// Permanent garage apron -> camp lawn, registered against DJI_121 and the
// house-facing-cabin / garage-facing-southeast photos. Units are world metres.
// Width is the half-width of the worn lane; wear fades out toward the fire pit.
import {photoToWorld} from './property-layout.mjs';
// First pit is visible in the straight-down photo. The second end is an
// approximately 12 m placement toward the house, to refine with a measured span.
const pit=photoToWorld(961,592);
export const HORSESHOES=[pit,{x:pit.x+8,z:pit.z-9}];
export const CAMP_APPROACH=[
  {x:-24,z:-6,width:5.2,wear:1},
  {x:-18,z:-1,width:5.0,wear:1},
  {x:-19,z:7,width:4.3,wear:.94},
  {x:-21.4,z:15,width:4.7,wear:.65},
  {x:-23,z:22,width:5.8,wear:.16},
  {x:-23,z:29,width:7,wear:0},
];
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function campSurface(x,z){
  let best={distance:Infinity,width:0,wear:0,along:0},run=0;
  for(let i=1;i<CAMP_APPROACH.length;i++){
    const a=CAMP_APPROACH[i-1],b=CAMP_APPROACH[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(len*len)),distance=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
    if(distance<best.distance)best={distance,width:a.width+(b.width-a.width)*t,wear:a.wear+(b.wear-a.wear)*t,along:run+len*t};
    run+=len;
  }
  const edge=1-smooth(best.width-.6,best.width+1.0,best.distance);
  const laneLawn=1-smooth(best.width+1,best.width+3,best.distance);
  // Mown opening shared by cabin and camp; keeps the tall grassy islands beside it.
  const oval=Math.hypot((x+26)/14,(z-29)/15);
  const a=HORSESHOES[0],b=HORSESHOES[1],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));
  const court=1-smooth(2.4,4.4,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
  const lawn=Math.max(laneLawn,1-smooth(.84,1.08,oval),court);
  const patch=.5+.28*Math.sin(x*1.37+z*.73)+.22*Math.sin(z*2.07-x*.61);
  const wear=clamp(best.wear+(patch-.5)*.24*(1-best.wear));
  const gravel=edge*wear;
  return {gravel,lawn,clear:edge>.5&&best.wear>.35,distance:best.distance,along:best.along};
}
