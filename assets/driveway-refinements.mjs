import {polygonDistance,smooth} from './property-layout.mjs';
export {correctedDriveway} from './driveway-measured.mjs';
export const GRAVEL_EXCLUSIONS=[
 {id:'behind-garage',outline:[[-15.59,-8.53],[-22.02,-9.69],[-25.71,-11.78],[-31.3,-14.81],[-30.28,-15.8],[-27.52,-16.54],[-24.1,-16.51],[-21.61,-13.86],[-20.13,-10.97]]},
 {id:'house-corner',outline:[[-5.4,-2.3],[-7.8,-2.4],[-11.97,-3.84],[-8.44,-4.27],[-5.72,-3.92]]},
].map(p=>({...p,outline:p.outline.map(([x,z])=>({x,z}))}));
export function grassReclaim(x,z){return Math.max(...GRAVEL_EXCLUSIONS.map(p=>smooth(-.3,.3,polygonDistance(x,z,p.outline))));}
