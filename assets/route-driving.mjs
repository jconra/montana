const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const dampFactor=(rate,dt)=>1-Math.exp(-rate*dt);
const approach=(value,target,step)=>value+clamp(target-value,-step,step);

// Arc-length lookup keeps the aim point moving along the road continuously,
// including across short segments. Original waypoints still define the road.
export function buildRoute(points){
 const nodes=[],segments=[];let length=0;
 for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw Error('Invalid route point.');const last=nodes.at(-1);if(!last||Math.hypot(p.x-last.x,p.z-last.z)>.001)nodes.push({x:p.x,z:p.z});}
 for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);segments.push({a,b,dx,dz,length:d,start:length,end:length+d,heading:Math.atan2(dx,dz)});length+=d;}
 function indexAt(s){let lo=0,hi=segments.length-1;while(lo<hi){const m=(lo+hi)>>1;if(segments[m].end<s)lo=m+1;else hi=m;}return lo;}
 function sample(s){if(!segments.length)return {...(nodes[0]||{x:0,z:0}),heading:0};const segment=segments[indexAt(s)],t=clamp((s-segment.start)/segment.length,0,1);return {x:segment.a.x+segment.dx*t,z:segment.a.z+segment.dz*t,heading:segment.heading};}
 function project(x,z,progress,reach){let best=progress,distance=Infinity;for(let i=indexAt(progress);i<segments.length&&segments[i].start<=progress+reach;i++){const seg=segments[i],t=clamp(((x-seg.a.x)*seg.dx+(z-seg.a.z)*seg.dz)/(seg.length*seg.length),0,1),s=seg.start+t*seg.length;if(s<progress-.5||s>progress+reach)continue;const d=Math.hypot(x-seg.a.x-t*seg.dx,z-seg.a.z-t*seg.dz);if(d<distance){distance=d;best=Math.max(progress,s);}}return best;}
 return {nodes,segments,length,sample,project};
}

// Pure-pursuit steering, with bounded steering speed and acceleration. Small
// time steps keep the same trajectory on fast machines and thin clients.
export class RouteDriver{
 constructor(points){
  this.route=buildRoute(points);const start=this.route.sample(0);
  this.x=start.x;this.z=start.z;this.heading=start.heading;this.speed=0;this.steering=0;this.progress=0;this.done=!this.route.segments.length;
 }
 update(dt){
  let remaining=clamp(dt,0,.25),travel=0;
  while(remaining>1e-8&&!this.done){const h=Math.min(remaining,1/120);remaining-=h;const route=this.route;
   this.progress=route.project(this.x,this.z,this.progress,Math.max(12,this.speed*2));
   const lookahead=4+this.speed*.35,target=route.sample(this.progress+lookahead),dx=target.x-this.x,dz=target.z-this.z,distance=Math.hypot(dx,dz);
   const curvature=2*Math.sin(angleDelta(Math.atan2(dx,dz),this.heading))/Math.max(1,distance);
   const steer=clamp(Math.atan(2.7*curvature),-.55,.55);
   this.steering=approach(this.steering,this.steering+(steer-this.steering)*dampFactor(5,h),.7*h);
   // Brake before bends, not after the nose has already changed direction.
   let targetSpeed=9;const ahead=12;
   for(const seg of route.segments){if(seg.end<this.progress||seg.start>this.progress+ahead)continue;const turn=Math.abs(angleDelta(route.sample(seg.end+.01).heading,seg.heading));if(turn<.02)continue;const cornerSpeed=Math.max(3.5,9/(1+turn*1.7));targetSpeed=Math.min(targetSpeed,Math.sqrt(cornerSpeed*cornerSpeed+2*2*Math.max(0,seg.end-this.progress-3)));}
   targetSpeed=Math.min(targetSpeed,Math.sqrt(2/Math.max(.001,Math.abs(curvature))),Math.sqrt(2*1.8*Math.max(0,route.length-this.progress-.15)));
   this.speed=approach(this.speed,targetSpeed,(targetSpeed<this.speed?2.4:1.5)*h);
   const yaw=this.speed/2.7*Math.tan(this.steering),distanceStep=this.speed*h,mid=this.heading+yaw*h*.5;
   this.x+=Math.sin(mid)*distanceStep;this.z+=Math.cos(mid)*distanceStep;this.heading+=yaw*h;travel+=distanceStep;
   const end=route.nodes.at(-1);
   if(route.length-this.progress<.3&&Math.hypot(end.x-this.x,end.z-this.z)<.5&&this.speed<.2){this.speed=0;this.done=true;}
  }
  return travel;
 }
}
