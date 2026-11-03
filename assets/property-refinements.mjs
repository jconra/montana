import {polygonDistance,smooth} from './property-layout.mjs';
import {GRASS_MARKS} from './grass-marks.mjs';
// Traced from the user's blue/purple markup, registered to the existing
// fire ring and horseshoe stakes. World metres, not screen coordinates.
export const TALL_GRASS_PATCHES=[
 {id:'garage-island',outline:[[-32.04,8.1],[-31.87,2.05],[-30,-1.84],[-25.33,.14],[-23.77,2.35],[-26.16,9.49]]},
 {id:'house-island',outline:[[-13.31,9.53],[-13.88,5.77],[-12.35,1.69],[-7.37,2.68],[-.16,4.4],[3.87,4.68],[4.48,7.88],[2.89,12.11],[-.45,13.71],[-5.28,13.24],[-11.14,11.04]]},
].concat(GRASS_MARKS.tall.map((outline,i)=>({id:'marked-long-'+i,outline}))).map(p=>({...p,outline:p.outline.map(([x,z])=>({x,z}))}));
// Trimmed lawn he marked (round the fire pit): short grass wins over long grass where the two meet.
export const SHORT_GRASS_PATCHES=GRASS_MARKS.short.map(o=>o.map(([x,z])=>({x,z})));
const box=o=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of o){a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.z);d=Math.max(d,p.z);}return [a-1,b+1,c-1,d+1];};
const cover=(list,x,z,lo,hi)=>{let v=0;for(const p of list){const b=p.box||(p.box=box(p.outline||p));if(x<b[0]||x>b[1]||z<b[2]||z>b[3])continue;v=Math.max(v,smooth(lo,hi,polygonDistance(x,z,p.outline||p)));}return v;};
export function shortGrassCoverage(x,z){return cover(SHORT_GRASS_PATCHES,x,z,-.4,.6);}
export const FRONT_DOOR_GRAVEL=[[-20.61,-9.03],[-18.24,-8.84],[-13.22,-7.95],[-8.78,-8.15],[-5.75,-8],[-5.58,-5.49],[-4.81,-3.22],[-8.55,-2.71],[-12.13,-2.77],[-14.55,-4.08],[-18,-6.83]].map(([x,z])=>({x,z}));
export function tallGrassCoverage(x,z){return cover(TALL_GRASS_PATCHES,x,z,-.45,.65)*(1-shortGrassCoverage(x,z));}
export function frontDoorGravel(x,z){return smooth(-.5,.4,polygonDistance(x,z,FRONT_DOOR_GRAVEL));}
