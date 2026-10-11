// Roof cutouts are expressed in plan coordinates (feet). Subtracting each
// triangulated opening also supports notches which cross an eave or ridge.
const EPS=1e-8;
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const clean=p=>p.filter((a,i)=>{const b=p[(i+p.length-1)%p.length];return Math.hypot(a[0]-b[0],a[1]-b[1])>EPS;});
export function clipRoofPolygon(poly,distance){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
  if(da>=-EPS)out.push(a);
  if((da>EPS&&db< -EPS)||(da< -EPS&&db>EPS)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 return clean(out);
}
const ccw=p=>area(p)<0?p.slice().reverse():p.slice();
function subtractConvex(poly,hole){
 let inside=poly;const outside=[];
 for(let i=0;i<hole.length&&inside.length>=3;i++){
  const a=hole[i],b=hole[(i+1)%hole.length],side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const part=clipRoofPolygon(inside,p=>-side(p));
  if(part.length>=3&&Math.abs(area(part))>EPS)outside.push(part);
  inside=clipRoofPolygon(inside,side);
 }
 return outside;
}
export function roofOpeningPolygon(hole){
 const p=Array.isArray(hole)?hole:hole.poly;
 if(p)return p.map(v=>[...v]);
 return [[hole.x-hole.w/2,hole.z-hole.d/2],[hole.x+hole.w/2,hole.z-hole.d/2],[hole.x+hole.w/2,hole.z+hole.d/2],[hole.x-hole.w/2,hole.z+hole.d/2]];
}
function contains(poly,p){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
export function roofPanelGeometry(THREE,outline,holes,height,uv,thickness=.4){
 const boundary=ccw(outline),cuts=holes.filter(p=>p.length>=3&&Math.abs(area(p))>EPS).map(ccw);
 let pieces=[boundary];
 for(const hole of cuts){
  const vertices=hole.map(p=>new THREE.Vector2(...p));
  for(const tri of THREE.ShapeUtils.triangulateShape(vertices,[])){
   const cut=ccw(tri.map(i=>hole[i]));pieces=pieces.flatMap(p=>subtractConvex(p,cut));
  }
 }
 const pos=[],tex=[],push=(p,y,t)=>{pos.push(p[0],y,p[1]);tex.push(...t);};
 const surface=(a,b,c,offset)=>{for(const p of [a,b,c])push(p,height(p)+offset,uv(p));};
 const solid=p=>contains(boundary,p)&&!cuts.some(h=>contains(h,p));
 for(const poly of pieces){
  for(let i=1;i<poly.length-1;i++){surface(poly[0],poly[i+1],poly[i],thickness/2);surface(poly[0],poly[i],poly[i+1],-thickness/2);}
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   // Internal subdivision edges are not physical roof edges.
   if(solid([(a[0]+b[0])/2+dz/len*1e-5,(a[1]+b[1])/2-dx/len*1e-5]))continue;
   for(const [p,off] of [[a,-1],[b,-1],[b,1],[a,-1],[b,1],[a,1]])push(p,height(p)+off*thickness/2,uv(p));
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));geo.computeVertexNormals();return geo;
}
