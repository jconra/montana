// The drive, traced on a top-down mosaic of the solved May 2026 drone frames projected onto LiDAR ground
// (checked by shooting frame pixels onto the ground, within about 0.5 m). World metres: x east, z south.
import {polygonDistance,smooth,CLEARING} from './property-layout.mjs';
const FIRE=CLEARING.fire;
const pts=a=>a.map(([x,z])=>({x,z}));
// Packed dirt: the Y as the mosaic shows it. The garage arm runs up to the slab, the south arm fades out toward camp, the east arm narrows into the two wheel tracks.
// (the east arm's north side follows the north track's outer edge, 1.1 m off the centre line: drawn on the mosaic's grass line, it
// left the track's last 8 m on lawn, a sharp green wedge into the drive just before the apron)
export const DIRT_OUTLINE=pts([[-18.4,-7.1],[-17.3,-4.8],[-13.75,-2.4],[-9.8,-.5],[-7.4,-2.0],[-5.5,-2.3],[-0.75,-2.65],[-0.45,-0.2],[-5.2,-.05],[-5.9,1.9],[-4.6,2.35],[-3.8,2.6],[-3.8,4.15],[-4.6,4.45],[-8.3,4.7],[-13.4,5.2],[-14.7,7],[-15,11.25],[-15.9,14.4],[-17.8,16.7],[-19.6,18.7],[-22.7,18.1],[-21.7,13.2],[-20,8.5],[-18.6,4.4],[-19.1,2.3],[-21.6,.7],[-24,-.5],[-27.6,-2.2],[-24.2,-9.4],[-21.5,-8.9]]);
// Centre of the two-track, gate side first, read from 390 solved July 2022 frames on LiDAR ground (every 3 m; a few stretches behind trees interpolated); ends on the apron.
// Corrected 2026-11-03 from the gravel traced in the Spot Check pictures 1-4 and shot onto the ground: 94-145 m from the gate the
// line ran up to 1.7 m wide of the real road (the S-bend he saw in picture 1); elsewhere it moved under half a metre.
// Eased west through the entry arch (2026-11-04): six July 2022 frames put the arch's posts at (131.04, -56.0) and (125.25, -55.79)
// with the two-track through their middle; the line read from the low take-off frames ran 2.05 m east there. Taper: 25 m each way.
export const DRIVE_LINE=pts([[98.8,-101.7],[101,-99.6],[103.3,-97.6],[105.5,-95.5],[107.6,-93.4],[109.6,-91.1],[111.5,-88.9],[113.4,-86.8],[115.5,-84.8],[117.7,-82.7],[120,-80.7],[122.5,-78.7],[124.9,-76.2],[126.8,-73.2],[127.7,-69.9],[128.3,-66.8],[128.3,-63.4],[128.2,-60.4],[128.2,-57.4],[128.2,-54.2],[128.1,-50.8],[127.7,-47.7],[127.3,-44.6],[126.6,-41.5],[125.3,-38.8],[123.8,-36.1],[121.2,-34.5],[118.7,-33],[115.8,-32.3],[112.9,-31.4],[110.2,-30.4],[107.3,-29.7],[104.5,-28.9],[101.5,-27.9],[98.8,-26.4],[96.3,-24.7],[93.8,-23.1],[91.3,-21.4],[89.1,-19.5],[86.6,-17.6],[84.2,-15.9],[81.6,-14.3],[79,-12.8],[76.4,-11.4],[73.7,-10.1],[71,-8.8],[68.2,-7.4],[65.6,-6.2],[63,-5.3],[60.2,-4.7],[57.3,-4.1],[54.4,-3.3],[51.5,-2.7],[48.7,-2.1],[45.8,-1.5],[42.9,-0.8],[39.9,-0.4],[37,0.4],[33.9,0.9],[31,1.4],[28.1,2],[25.1,2.3],[22.1,2.7],[19.2,3.2],[16.2,3.6],[13.3,3.9],[10.4,4.2],[7.4,4.5],[4.5,4.5],[1.5,4.3],[-1.3,4],[-4.2,3.3],[-7.1,2.6],[-10.1,1.9],[-12.9,0.9],[-15.5,-0.3],[-18,-2],[-20.3,-3.8],[-22.7,-5.6]]);
// Beyond the frames the old line was traced on the aerial, which sits about 4.5 m north of LiDAR along the whole measured part.
export const AERIAL_ROAD_SHIFT=4.5;
// The tracks measured on pictures 1-4: each 0.67-0.98 m wide (0.75 typical), 1.28-1.61 m apart centre to centre (1.4 typical);
// they were drawn 1.05 m wide and 1.84 m apart, half again too broad.
export const TRACK_OFFSET=.7;       // each wheel track from the centre
export const TRACK_WIDTH=.75;
// Beside each track a strip of short cut grass, a foot or two wide, before the long grass.
export const VERGE=.45;
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
// 0..1: the short grass of the drive: the cut strip beside the tracks, and the strip between them (not on the apron or the camp arms)
export function driveVerge(x,z){if(x<-5.5||x>136||z<-107)return 0;const d=lineDistance(x,z,DRIVE_LINE),e=TRACK_OFFSET+TRACK_WIDTH/2,m=TRACK_OFFSET-TRACK_WIDTH/2;return Math.max(smooth(e-.05,e+.08,d)*(1-smooth(e+VERGE-.1,e+VERGE+.12,d)),1-smooth(m-.08,m+.04,d));}
// Where grass density is spent: round the buildings, along the drive and at the fire pit. 0 elsewhere, 1 there.
export function grassPriority(x,z){
 let p=1-smooth(10,26,driveLineDistance(x,z));p=Math.max(p,1-smooth(12,24,Math.hypot(x-FIRE.x,z-FIRE.z)));
 for(const f of GRASS_BUILDINGS)p=Math.max(p,1-smooth(14,30,Math.hypot(x-f[0],z-f[1])));return p;
}
const GRASS_BUILDINGS=[[8.78,-4.88],[-30.73,-8.2],[-38.99,37.7]];
export const dirtCoverage=(x,z)=>x<-30||x>8||z<-10||z>21?0:smooth(-.35,.35,polygonDistance(x,z,DIRT_OUTLINE));
// 0..1: is this spot bare drive? Plants use it to stay off the wheel tracks; the short grass strip between them stays.
export function roadCoverage(x,z){
 const dirt=dirtCoverage(x,z);if(dirt>=1||x<-30)return dirt;
 if(x>136||z<-107)return 0;
 const d=lineDistance(x,z,DRIVE_LINE);
 return Math.max(dirt,(1-smooth(TRACK_OFFSET+.3,TRACK_OFFSET+.55,d))*smooth(TRACK_OFFSET-.45,TRACK_OFFSET-.25,d));
}
