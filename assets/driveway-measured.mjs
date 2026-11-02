// The drive, traced on a top-down mosaic of the solved May 2026 drone frames projected onto LiDAR ground
// (checked by shooting frame pixels onto the ground, within about 0.5 m). World metres: x east, z south.
import {polygonDistance,smooth} from './property-layout.mjs';
const pts=a=>a.map(([x,z])=>({x,z}));
// Packed dirt: garage apron, the tight Y, the short arm toward camp fading out, and the strip to the entry room.
export const DIRT_OUTLINE=pts([[-24,-8.4],[-20.5,-7.4],[-17.5,-5.6],[-14.5,-3.4],[-11.5,-1.9],[-8,-1.6],[-2.5,-1.6],[-2,.1],[-6.25,.9],[-3,2.6],[0,3.7],[0,6.4],[-3,6],[-6.25,5.6],[-10,5],[-12.5,5.1],[-14.7,6.25],[-15,9],[-14.4,11.25],[-13.6,13.75],[-15,16],[-17,18],[-20.6,19.5],[-22.8,18.75],[-22.2,15.6],[-21.6,12.5],[-20.6,8.75],[-19.4,5.6],[-18.75,3.4],[-20,1.25],[-23,0],[-26.25,-.6],[-28.4,-2.2]]);
// Centre of the two-track, gate side first; ends on the apron.
export const DRIVE_LINE=pts([[123.5,-36.3],[119,-32.5],[110,-28.8],[101,-26.5],[92,-21.3],[83,-14.5],[74,-9.3],[65,-4],[50,-.1],[40,1.2],[28.1,3.3],[18.75,4.5],[12.5,5.3],[6.25,5.7],[0,5.1],[-5,3.6],[-10,2.2],[-15,.5],[-20,-2.5],[-24,-5.5]]);
// Beyond the frames the old line was traced on the aerial, which sits about 4.5 m north of LiDAR along the whole measured part.
export const AERIAL_ROAD_SHIFT=4.5;
export const TRACK_OFFSET=.72;      // each wheel track from the centre
export const MEDIAN_ENDS_AT=0;      // west of this x the grass strip between the tracks is worn away
// Tyre marks read off the mosaic: broad soft arcs sweeping from the garage apron into the camp arm, turning doughnuts in the middle, wheel paths up the east arm. Control points for a smooth curve.
export const RUTS=[
 [[0,4.4],[-4,3],[-9,1.6],[-13.5,.2],[-17.5,-2.4],[-22,-5.4]],
 [[0,5.75],[-4,4.5],[-9,3],[-13.5,1.5],[-18,-1],[-23,-4.2]],
 [[-11.5,-1.6],[-14,-1.1],[-16,.3],[-17,2],[-17.6,4.2],[-18,8],[-18.6,13]],
 [[-10,-.6],[-13.2,-.1],[-15.4,1.2],[-16.2,3.6],[-16.4,7],[-17,11.5]],
 [[-22.2,.9],[-20.6,1.9],[-19.4,3.6],[-19,6]],
 [[-14.5,3.4],[-12.6,2],[-13.4,.2],[-15.6,.4],[-16.2,2.2],[-14.5,3.4]],
 [[-18,-3.5],[-15.5,-2.6],[-12.6,-2.2],[-9.5,-.4]],
].map(pts);
export function correctedDriveway(points){
 const join=points.findIndex(p=>Math.abs(p.x-126.1)<.01&&Math.abs(p.z+43.1)<.01);
 const head=join<0?[]:points.slice(0,join+1).map(p=>({x:p.x,z:p.z+AERIAL_ROAD_SHIFT}));
 return [...head,...DRIVE_LINE];
}
function lineDistance(x,z,line){let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return best;}
export const dirtCoverage=(x,z)=>x<-30||x>2||z<-10||z>21?0:smooth(-.35,.35,polygonDistance(x,z,DIRT_OUTLINE));
// 0..1: is this spot bare drive? Plants use it to stay off the wheel tracks; the short grass strip between them stays.
export function roadCoverage(x,z){
 const dirt=dirtCoverage(x,z);if(dirt>=1||x<-30)return dirt;
 if(x>128||z<-60)return 0;
 const d=lineDistance(x,z,DRIVE_LINE);
 return Math.max(dirt,(1-smooth(TRACK_OFFSET+.3,TRACK_OFFSET+.55,d))*smooth(TRACK_OFFSET-.45,TRACK_OFFSET-.25,d));
}
