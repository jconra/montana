// The drive, traced on a top-down mosaic of the solved May 2026 drone frames projected onto LiDAR ground
// (checked by shooting frame pixels onto the ground, within about 0.5 m). World metres: x east, z south.
import {polygonDistance,smooth} from './property-layout.mjs';
const pts=a=>a.map(([x,z])=>({x,z}));
// Packed dirt: the Y as the mosaic shows it. The garage arm runs up to the slab, the south arm fades out toward camp, the east arm narrows into the two wheel tracks.
export const DIRT_OUTLINE=pts([[-22.3,-8.3],[-18.4,-7.1],[-17.3,-4.8],[-13.75,-2.4],[-9.8,-.5],[-5.9,1.9],[-1.25,3.8],[3,4.5],[3,6.3],[-1.25,5.6],[-8.3,4.7],[-13.4,5.2],[-14.7,7],[-15,11.25],[-15.9,14.4],[-17.8,16.7],[-19.6,18.7],[-22.7,18.1],[-21.7,13.2],[-20,8.5],[-18.6,4.4],[-19.1,2.3],[-21.6,.7],[-24,-.5],[-26.25,-1.9],[-24.5,-8]]);
// Centre of the two-track, gate side first, read from 390 solved July 2022 frames on LiDAR ground (every 3 m; a few stretches behind trees interpolated); ends on the apron.
export const DRIVE_LINE=pts([[98.8,-101.7],[101.0,-99.6],[103.3,-97.6],[105.5,-95.5],[107.6,-93.4],[109.6,-91.1],[111.5,-88.9],[113.4,-86.8],[115.5,-84.8],[117.7,-82.7],[120.0,-80.7],[122.5,-78.7],[125.0,-76.2],[127.2,-73.2],[128.5,-69.9],[129.5,-66.8],[129.9,-63.4],[130.1,-60.4],[130.2,-57.4],[130.2,-54.2],[129.9,-50.8],[129.2,-47.7],[128.5,-44.6],[127.3,-41.5],[125.7,-38.8],[123.9,-36.1],[121.2,-34.5],[118.7,-33.0],[115.8,-32.3],[112.9,-31.4],[110.2,-30.5],[107.3,-30.0],[104.4,-29.5],[101.2,-28.9],[98.2,-27.6],[95.5,-26.1],[92.9,-24.5],[90.3,-22.7],[88.0,-20.7],[85.7,-18.7],[83.4,-16.9],[81.0,-15.2],[78.5,-13.6],[76.0,-12.1],[73.4,-10.6],[70.8,-9.1],[68.1,-7.6],[65.6,-6.2],[63.0,-5.2],[60.2,-4.6],[57.3,-4.0],[54.4,-3.3],[51.5,-2.7],[48.7,-2.2],[45.8,-1.8],[42.8,-1.2],[39.8,-0.7],[36.9,0.1],[33.9,0.7],[31.0,1.3],[28.1,1.8],[25.1,2.1],[22.1,2.5],[19.2,3.0],[16.2,3.5],[13.3,4.0],[10.4,4.4],[7.4,4.8],[4.5,4.9],[1.5,4.8],[-1.4,4.4],[-4.3,3.6],[-7.2,2.8],[-10.1,2.0],[-12.9,0.9],[-15.5,-0.3],[-18.0,-2.0],[-20.3,-3.8],[-22.7,-5.6]]);
// Beyond the frames the old line was traced on the aerial, which sits about 4.5 m north of LiDAR along the whole measured part.
export const AERIAL_ROAD_SHIFT=4.5;
export const TRACK_OFFSET=.92;      // each wheel track from the centre
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
  [[-17.6,3.2],[-17.2,.6],[-15.2,-1],[-12.2,-.4]],
 [[-16.2,4.6],[-16,1.8],[-14.2,.2],[-11.2,.8]],
 [[-15,5],[-15,2.8],[-13.2,1.4],[-10.4,1.8]],
 [[-18.6,1.4],[-16.8,-1.6],[-13.8,-2],[-10.6,-.6]],
].map(pts);
export function correctedDriveway(points){
 const head=points.map(p=>({x:p.x,z:p.z+AERIAL_ROAD_SHIFT})).filter(p=>p.z<DRIVE_LINE[0].z-4);
 return [...head,...DRIVE_LINE];
}
function lineDistance(x,z,line){let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return best;}
export const driveLineDistance=(x,z)=>lineDistance(x,z,DRIVE_LINE);
export const dirtCoverage=(x,z)=>x<-30||x>4||z<-10||z>21?0:smooth(-.35,.35,polygonDistance(x,z,DIRT_OUTLINE));
// 0..1: is this spot bare drive? Plants use it to stay off the wheel tracks; the short grass strip between them stays.
export function roadCoverage(x,z){
 const dirt=dirtCoverage(x,z);if(dirt>=1||x<-30)return dirt;
 if(x>136||z<-107)return 0;
 const d=lineDistance(x,z,DRIVE_LINE);
 return Math.max(dirt,(1-smooth(TRACK_OFFSET+.3,TRACK_OFFSET+.55,d))*smooth(TRACK_OFFSET-.45,TRACK_OFFSET-.25,d));
}
