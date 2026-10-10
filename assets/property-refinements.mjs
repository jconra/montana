import {polygonDistance,smooth} from './property-layout.mjs';
// Traced from the user's blue/purple markup, registered to the existing
// fire ring and horseshoe stakes. World metres, not screen coordinates.
export const TALL_GRASS_PATCHES=[
 {id:'garage-island',outline:[[-32.04,8.1],[-31.87,2.05],[-30,-1.84],[-25.33,.14],[-23.77,2.35],[-26.16,9.49]]},
 {id:'house-island',outline:[[-13.31,9.53],[-13.88,5.77],[-12.35,1.69],[-7.37,2.68],[-.16,4.4],[3.87,4.68],[4.48,7.88],[2.89,12.11],[-.45,13.71],[-5.28,13.24],[-11.14,11.04]]},
].map(p=>({...p,outline:p.outline.map(([x,z])=>({x,z}))}));
export const FRONT_DOOR_GRAVEL=[[-20.61,-9.03],[-18.24,-8.84],[-13.22,-7.95],[-8.78,-8.15],[-5.75,-8],[-5.58,-5.49],[-4.81,-3.22],[-8.55,-2.71],[-12.13,-2.77],[-14.55,-4.08],[-18,-6.83]].map(([x,z])=>({x,z}));
export function tallGrassCoverage(x,z){return Math.max(...TALL_GRASS_PATCHES.map(p=>smooth(-.45,.65,polygonDistance(x,z,p.outline))));}
export function frontDoorGravel(x,z){return smooth(-.5,.4,polygonDistance(x,z,FRONT_DOOR_GRAVEL));}
