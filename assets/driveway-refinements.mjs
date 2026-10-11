import {polygonDistance,smooth} from './property-layout.mjs';
// Local correction registered to the user's overhead markup. Preserve the
// original scatter route so existing rock/sage IDs and edits remain stable.
export function correctedDriveway(points){
 const join=points.findIndex(p=>Math.abs(p.x-26.5)<.01&&Math.abs(p.z+1.2)<.01);
 if(join<0)return points;
 return [...points.slice(0,join+1),...[ [20,-.8],[15,-.45],[10,-.1],[5,.25],[0,.6],[-5,.95],[-10,-.9],[-15,-3.1],[-22.9,-6.4] ].map(([x,z])=>({x,z}))];
}
export const GRAVEL_EXCLUSIONS=[
 {id:'behind-garage',outline:[[-15.59,-8.53],[-22.02,-9.69],[-25.71,-11.78],[-31.3,-14.81],[-30.28,-15.8],[-27.52,-16.54],[-24.1,-16.51],[-21.61,-13.86],[-20.13,-10.97]]},
 {id:'house-corner',outline:[[-4.13,-.35],[-7.6,-1.69],[-11.97,-3.84],[-8.44,-4.27],[-5.72,-3.92],[-5.49,-2.74]]},
].map(p=>({...p,outline:p.outline.map(([x,z])=>({x,z}))}));
export function grassReclaim(x,z){return Math.max(...GRAVEL_EXCLUSIONS.map(p=>smooth(-.3,.3,polygonDistance(x,z,p.outline))));}
