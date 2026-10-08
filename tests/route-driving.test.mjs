import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RouteDriver,buildRoute,angleDelta,dampFactor} from '../assets/route-driving.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const points=JSON.parse(html.match(/const DRIVEWAY=(\[\[.*?\]\])/)[1]).map(([x,n])=>({x,z:-n}));
function roadDistance(car){let distance=Infinity;for(const s of car.route.segments){const t=Math.max(0,Math.min(1,((car.x-s.a.x)*s.dx+(car.z-s.a.z)*s.dz)/s.length**2));distance=Math.min(distance,Math.hypot(car.x-s.a.x-t*s.dx,car.z-s.a.z-t*s.dz));}return distance;}
function simulate(fps){
 const car=new RouteDriver(points);let yaw=0,maxDistance=0,maxYawAcceleration=0,maxSteerRate=0,lastProgress=0,time=0;const checkpoints=[];
 for(let frame=1;!car.done&&frame<=120*fps;frame++){
  const oldHeading=car.heading,oldSteer=car.steering,oldSpeed=car.speed;car.update(1/fps);time=frame/fps;
  const nextYaw=angleDelta(car.heading,oldHeading)*fps;
  maxYawAcceleration=Math.max(maxYawAcceleration,Math.abs(nextYaw-yaw)*fps);yaw=nextYaw;
  maxSteerRate=Math.max(maxSteerRate,Math.abs(car.steering-oldSteer)*fps);maxDistance=Math.max(maxDistance,roadDistance(car));
  assert.ok(car.progress>=lastProgress,'forward route progress');lastProgress=car.progress;
  assert.ok(Number.isFinite(car.heading)&&car.speed>=0&&car.speed<=9);
  assert.ok(car.speed-oldSpeed<=1.5/fps+1e-6,'bounded acceleration');
  if(frame%(fps*10)===0)checkpoints.push([car.x,car.z,car.heading,car.speed]);
 }
 assert.ok(car.done&&time<100,'the entire driveway completes without getting stuck');
 assert.ok(maxDistance<.8,'car stays close to the driveway centre through every bend');
 assert.ok(maxYawAcceleration<.7,'steering changes smoothly at waypoint transitions');
 assert.ok(maxSteerRate<=.7+1e-6,'front wheels cannot snap left or right');
 assert.equal(car.speed,0,'stop at the road end before handing over to manual driving');
 assert.ok(Math.hypot(car.x-points.at(-1).x,car.z-points.at(-1).z)<.5);
 return {checkpoints,maxDistance,maxYawAcceleration,time};
}
const reference=simulate(60);
for(const fps of [30,10]){const run=simulate(fps);assert.equal(run.checkpoints.length,reference.checkpoints.length);run.checkpoints.forEach((p,i)=>p.forEach((n,j)=>assert.ok(Math.abs(n-reference.checkpoints[i][j])<1e-7,'same trajectory at different frame rates')));}
for(const points of [[],[{x:1,z:2}],[{x:1,z:2},{x:1,z:2}]]){const car=new RouteDriver(points);assert.equal(car.done,true);assert.equal(car.update(.1),0);}
const short=new RouteDriver([{x:0,z:0},{x:0,z:0},{x:0,z:1}]);for(let i=0;i<200;i++)short.update(1/30);assert.ok(short.done&&short.speed===0);
assert.equal(buildRoute([{x:0,z:0},{x:0,z:1},{x:0,z:1},{x:0,z:3}]).length,3);
assert.ok(Math.abs(angleDelta(-Math.PI+.01,Math.PI-.01)-.02)<1e-9,'take shortest turn across the angle wrap');
let a=0,b=0;for(let i=0;i<60;i++)a+=(1-a)*dampFactor(5,1/60);for(let i=0;i<10;i++)b+=(1-b)*dampFactor(5,1/10);assert.ok(Math.abs(a-b)<1e-12,'camera damping is frame-rate independent');
console.log('Full driveway, bounded steering, road tracking, frame rates, safe stops and degenerate routes passed',JSON.stringify({maxRoadOffset:reference.maxDistance,maxYawAcceleration:reference.maxYawAcceleration,seconds:reference.time}));
