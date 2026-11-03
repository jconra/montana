// THE PROPERTY'S TREES, built from cards at load: a tree is a dark inner shape that closes the view through it and cards of
// foliage on the outside, so it stays solid to the ground like the real ones, for about a tenth of the triangles of the
// old generated pines. All are one unit high with their base at y = 0; a placement's scale is then its height in metres.
// The needle picture is the branch texture of the big bush model. Junipers are built from clumps of a flame picture made here.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function rnd(seed){let s=seed>>>0||1;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
const SPRAY={u0:.05,u1:.95,v0:.74,v1:.01};       // the spray in the branch picture: base (v0) to tip (v1)

function fromArrays(pos,nor,uv,col,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);return g;}

// A ribbon of `segs` quads from `at` outward along `yaw`, dropping as it goes; `roll` turns it about its own length.
function addBranch(a,at,yaw,len,width,droop,curve,roll,segs,shade,box=SPRAY,tint=[1,1,1]){
 const {pos,nor,uv,col,idx}=a,base=pos.length/3,cy=Math.cos(yaw),sy=Math.sin(yaw);let x=0,y=0,ang=droop;
 const side=[-sy*Math.cos(roll),Math.sin(roll),cy*Math.cos(roll)];
 for(let i=0;i<=segs;i++){
  const t=i/segs,w=width*.5*(1-t*.45),px=at[0]+cy*x,pz=at[2]+sy*x,py=at[1]+y,v=box.v0+(box.v1-box.v0)*t;
  for(const e of [-1,1]){pos.push(px+side[0]*w*e,py+side[1]*w*e,pz+side[2]*w*e);const nx=cy*.75,nz=sy*.75,ny=.65,l=Math.hypot(nx,ny,nz);nor.push(nx/l,ny/l,nz/l);uv.push(e<0?box.u0:box.u1,v);const c=shade*(.72+.28*t);col.push(c*tint[0],c*tint[1],c*tint[2]);}
  x+=Math.cos(ang)*len/segs;y-=Math.sin(ang)*len/segs;ang+=curve;
 }
 for(let i=0;i<segs;i++){const q=base+i*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}
}

// A solid crown: a dense lathe whose surface is pushed out by many small tufts and a few big lobes, so the mass is opaque with a fine lumpy edge. Ridges lighter, hollows darker, the top lightest; its grain is a tile cut from real crowns.
function crownShell({profile,rows=36,sides=40,seed,tufts=150,lobes=11,tiers=0,tierDepth=.2,tile=5}){
 const r=rnd(seed),spots=[];
 for(let i=0;i<lobes;i++)spots.push([r()*6.283,Math.pow(r(),.8),.1+r()*.1,.6+r()*.6]);
 for(let i=0;i<tufts;i++){const y=Math.pow(r(),.85);spots.push([r()*6.283,y,.045+r()*.045,.6+r()*.6]);}
 const pos=[],uv=[],col=[],idx=[],big=[],small=[];
 for(let j=0;j<=rows;j++){const y=j/rows;for(let i=0;i<=sides;i++){const a=(i%sides)/sides*6.283,Ry=Math.max(profile(y),.01);let hb=0,hs=0;
  spots.forEach(([sa,sy,w,amp],k)=>{let da=Math.abs(a-sa);if(da>3.1416)da=6.283-da;const dx=da*Ry,dy=y-sy,d2=(dx*dx+dy*dy)/(w*w);if(d2<4){const v=amp*Math.exp(-d2);if(k<lobes)hb+=v;else hs+=v;}});big.push(hb);small.push(hs);}}
 const mean=v=>v.reduce((p,c)=>p+c,0)/v.length,mb=mean(big),ms=mean(small),sd=Math.sqrt(mean(small.map(v=>(v-ms)**2)))||1,mx=Math.max(...big.map(v=>Math.abs(v-mb)))||1;
 let vi=0;for(let j=0;j<=rows;j++){const y=j/rows;for(let i=0;i<=sides;i++){const a=(i%sides)/sides*6.283,hb=(big[vi]-mb)/mx,hs=Math.max(-2,Math.min(2,(small[vi]-ms)/sd));vi++;
  let tier=0;if(tiers){const u=y*tiers+.7*Math.sin(a*3+seed)+.45*Math.sin(a*7+seed*2);tier=(u-Math.floor(u)-.5)*tierDepth;}
  const R=profile(y,a)*(1+hb*.1+hs*.03);pos.push(Math.cos(a)*R,y,Math.sin(a)*R);uv.push(i/sides*Math.round(tile),y*tile);
  const v=.42+hs*.06+hb*.05+y*.1;col.push(v,v,v*(1-Math.max(0,hs)*.03));}}
 const row=sides+1;for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const q=j*row+i;idx.push(q,q+row,q+1,q+1,q+row,q+row+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
 const n=g.attributes.normal;for(let j=0;j<=rows;j++){const a=j*row,c=a+sides,x=n.getX(a)+n.getX(c),y=n.getY(a)+n.getY(c),z=n.getZ(a)+n.getZ(c),l=Math.hypot(x,y,z)||1;n.setXYZ(a,x/l,y/l,z/l);n.setXYZ(c,x/l,y/l,z/l);}
 return g;
}
// Inner shape: a lathe of (height, radius) points in one colour.
// A lumpy inner body in foliage colours, so what shows between sprays reads as deeper foliage rather than a flat shape.
function lumpyBody(profile,sides,color,seed){
 const r=rnd(seed),pos=[],nor=[],uv=[],col=[],idx=[],p1=r()*6,p2=r()*6;
 profile.forEach(([y,R],j)=>{for(let i=0;i<=sides;i++){const a=(i%sides)/sides*Math.PI*2,k=1+.11*Math.sin(a*3+p1+y*9)+.08*Math.sin(a*5+p2-y*14),s=.72+.5*(.5+.5*Math.sin(a*4+p2+y*17))*(.5+.5*Math.sin(a*2+p1-y*8))+.16*y;pos.push(Math.cos(a)*R*k,y,Math.sin(a)*R*k);nor.push(Math.cos(a),.6,Math.sin(a));uv.push(i/sides*2,y*6);col.push(color[0]*s,color[1]*s,color[2]*s);}});
 const row=sides+1;for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){const q=j*row+i;idx.push(q,q+row,q+1,q+1,q+row,q+row+1);}
 return fromArrays(pos,nor,uv,col,idx);
}
function lathe(profile,sides,color){
 const pos=[],nor=[],uv=[],col=[],idx=[];
 profile.forEach(([y,r],j)=>{for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;pos.push(Math.cos(a)*r,y,Math.sin(a)*r);nor.push(Math.cos(a),.35,Math.sin(a));uv.push(i/sides*2,y*6);col.push(color[0],color[1],color[2]);}});
 const row=sides+1;for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){const q=j*row+i;idx.push(q,q+row,q+1,q+1,q+row,q+row+1);}
 return fromArrays(pos,nor,uv,col,idx);
}

// fade (0..1): the lower crown this much darker, top full: in a close stand the neighbours shade every tree's lower half and only the cones' upper parts catch light.
// inner:'tufts': the inside of the crown is a second, darker layer of tufts instead of a smooth shell, so the gaps show deeper foliage, never a solid core.
function conifer({seed,radius,tiers,perTier,droop,pointed=.9,core=.46,open=false,dead=0,fade=0,inner=null}){
 const r=rnd(seed),a={pos:[],nor:[],uv:[],col:[],idx:[]},shadeY=y=>1-fade+fade*Math.pow(Math.max(0,y),.7);
  const layers=Math.max(7,Math.round(tiers*.34)),p0=seed*.7,crown=(y,c=0)=>{const u=y*layers+.6*Math.sin(c*2+p0);return Math.max(.002,radius*1.02*Math.pow(1-y*.99,pointed)*(.68+.5*(1-(u-Math.floor(u))))*(1+.14*Math.sin(c*3+p0+y*5)));};
 if(!open)tuftLayer(a,r,crown,{count:Math.round(tiers*perTier*1.5),size:Math.max(.03,radius*.3),up:[-.5,.5],shade:[.72,1.2],tiers:layers,shadeAt:fade?y=>shadeY(y):null});
 else for(let t=0;t<tiers;t++){const f=t/(tiers-1),y=.05+f*.94,reach=radius*Math.pow(1-f*.985,pointed)*(.86+.3*Math.sin(t*2.7+seed))+.008,n=Math.max(3,Math.round(perTier*(1-f*.55)));
  for(let i=0;i<n;i++){if(f<.14||r()<.12+.2*(.5+.5*Math.sin(t*1.9+seed)))continue;const yaw=(i+r()*.8)/n*Math.PI*2+t*2.399,limb=reach*(.74+r()*r()*.55);for(let k=1;k<=3;k++){const d=limb*k/3*.95,len=Math.max(.05,Math.min(.1,limb*.7));addBranch(a,[Math.cos(yaw)*d,y-d*.25,Math.sin(yaw)*d],yaw+(r()-.5)*.7,len,len,droop*.5,0,(r()-.5)*.6,1,.72+r()*.4,FLAME);}}}
 if(!open&&inner==='tufts')tuftLayer(a,r,(y,c)=>crown(y,c)*.6,{count:Math.round(tiers*perTier*.9),size:Math.max(.03,radius*.34),up:[-.5,.5],shade:[.3,.52],shadeAt:fade?y=>shadeY(y):null});
 const leaf=fromArrays(a.pos,a.nor,a.uv,a.col,a.idx);
 if(open)return {leaf,wood:lathe([[0,.016],[.3,.012],[.65,.008],[.97,.002]],6,[.2,.14,.09])};
 if(inner==='tufts')return {leaf,wood:lathe([[0,.012],[.4,.008],[.8,.004],[.985,.0012]],5,[.12,.095,.075])};
 const shell=crownShell({profile:y=>Math.max(.002,radius*.74*Math.pow(1-y*.99,pointed)),seed:seed+3,tufts:40,lobes:8,rows:18,sides:14,tile:9});
 if(fade){const c=shell.attributes.color,p=shell.attributes.position;for(let i=0;i<c.count;i++){const k=shadeY(p.getY(i));c.setXYZ(i,c.getX(i)*k,c.getY(i)*k,c.getZ(i)*k);}}
 return {leaf,wood:dead?mergeGeometries([shell,trunk(dead,seed)]):shell};
}
// A fir as the frames show it, built bough by bough with no solid core: each bough is a thick bushy lobe of mesh that droops and lifts at its tip, with see-through bough cards fanning off it for a soft edge. Gaps between boughs show the dark of the boughs behind.
function firTree({seed,radius,boughs=72,pointed=.82,cards=8,spindle=.2,dead=0,lobes=true,crownBase=0}){
 const r=rnd(seed),L={pos:[],nor:[],uv:[],col:[],idx:[]},W={pos:[],nor:[],uv:[],col:[],idx:[]},p0=r()*6.283,p1=r()*6.283,
  reach=(y,c=0)=>radius*Math.pow(Math.max(0,1-Math.max(0,y-crownBase)/(1-crownBase)),pointed)*(1+.2*Math.sin(y*11+p0)*Math.sin(c+p1)+.13*Math.sin(c*2+p0+y*7)+.1*Math.sin(y*23+p1)),SEG=3,SIDES=5,WID=[.3,1,.72,.1];
 for(let i=0;i<boughs;i++){const f=i/(boughs-1),y=crownBase+(1-crownBase)*(.04+.93*Math.pow(f,1.12))+(r()-.5)*.018,yaw=i*2.399+(r()-.5)*.9,R=reach(y,yaw)*(.76+r()*.5)+.012,cy=Math.cos(yaw),sy=Math.sin(yaw),light=(.72+r()*.5)*(.86+f*.2);
  let ang=(.55*(1-f)-.2)*(.7+r()*.6),x=R*.04,h=y;const path=[],base=W.pos.length/3;
  for(let k=0;k<=SEG;k++){path.push([cy*x,h,sy*x,ang]);const w=R*.34*WID[k],th=w*.62,ca=Math.cos(ang),sa=Math.sin(ang);
   for(let j=0;j<=SIDES;j++){const a=j/SIDES*6.283,cs=Math.cos(a),sn=Math.sin(a),off=w*cs,up=th*sn*(sn>0?1:.55),bump=1+.16*Math.sin(a*2+i+k*2);
    W.pos.push(cy*x-sy*off*bump+cy*sa*up,h+ca*up,sy*x+cy*off*bump+sy*sa*up);const nx=cy*sa*sn-sy*cs,ny=ca*sn+.35,nz=sy*sa*sn+cy*cs,l=Math.hypot(nx,ny,nz);W.nor.push(nx/l,ny/l,nz/l);W.uv.push(j/SIDES*2,(k/SEG)*1.4+i*.37);const c=light*(sn>0?.5+.2*sn:.4)*(.8+.2*k/SEG);W.col.push(c,c,c);}
   x+=Math.cos(ang)*R/SEG;h-=Math.sin(ang)*R/SEG;ang-=.2;}
  if(lobes)for(let k=0;k<SEG;k++)for(let j=0;j<SIDES;j++){const q=base+k*(SIDES+1)+j,o=SIDES+1;W.idx.push(q,q+o,q+1,q+1,q+o,q+o+1);}
  for(let k=0;k<cards;k++){const t=(k+.6)/cards,u=t*SEG,n=Math.min(SEG-1,Math.floor(u)),m=u-n,A=path[n],B=path[n+1],side=k%2?1:-1,len=R*(lobes?.62-.4*t:.95-.5*t)*(.8+r()*.45)+.012,a2=yaw+side*(.62+r()*.6);
   addBranch(L,[A[0]+(B[0]-A[0])*m,A[1]+(B[1]-A[1])*m+R*.02,A[2]+(B[2]-A[2])*m],a2,len,len*.86,A[3]*.6+.14,-.04,(r()-.5)*.9,1,light*(.8+r()*.34),BOUGH);}
  const E=path[SEG];addBranch(L,[E[0],E[1],E[2]],yaw,R*.34,R*.3+.008,E[3],-.04,(r()-.5)*.5,1,light*1.08,BOUGH);}
 const parts=[lobes?fromArrays(W.pos,W.nor,W.uv,W.col,W.idx):null,lathe([[0,.012],[.4,.008],[.8,.004],[.985,.0012]],5,[.12,.095,.075])];
 if(spindle)parts.push(lathe([.06,.25,.5,.75,.92].map(u=>{const y=crownBase+(1-crownBase)*u;return [y,Math.max(.002,radius*Math.pow(1-u,pointed)*spindle)];}),6,[.11,.14,.09]));
 if(dead)parts.push(trunk(dead,seed));
 return {leaf:fromArrays(L.pos,L.nor,L.uv,L.col,L.idx),wood:mergeGeometries(parts.filter(Boolean))};
}
// A fir built the way the real ones are: whorls of branches up a straight trunk, each drooping a little and turning up at the tip,
// carrying clumps of a real fir spray picture (no tubes, no inner pole). The crown is a cone of sprays with gaps between whorls, so
// it reads as a fir with a ragged edge from the clearing and from the drone, and the shading by sky makes the cone (lit side,
// shaded side, dark inside). crownBase: bare trunk below that share of the height. sparse: share of branches left out.
// fade: the lower crown this much darker (neighbours shade it in a close stand; only the tops catch the light, so each cone reads).
function sprayFir({seed,radius=.22,whorls=46,perWhorl=6,sprays=6,crownBase=.03,pointed=.9,droop=.3,spraySize=.55,sparse=0,dead=0,fade=.6}){
 const r=rnd(seed),L={pos:[],nor:[],uv:[],col:[],idx:[]},W={pos:[],nor:[],uv:[],col:[],idx:[]},p0=r()*6.283;
 const env=y=>radius*Math.pow(Math.max(0,1-Math.max(0,y-crownBase)/(1-crownBase)),pointed)*(1+.12*Math.sin(y*17+p0));
 for(let w=0;w<whorls;w++){
  const f=w/(whorls-1),y=crownBase+(1-crownBase)*(.015+.95*Math.pow(f,1.08))+(r()-.5)*.01,n=Math.max(2,perWhorl-(f>.8?2:f>.6?1:0)),y0=w*2.399+r();
  for(let b=0;b<n;b++){
   if(r()<sparse*(1-f*.5))continue;
   const yaw=y0+b/n*6.283+(r()-.5)*.7,len=env(y)*(.72+.5*r())+.01,dip=droop*(1.15-f)*(.6+.8*r()),cy=Math.cos(yaw),sy=Math.sin(yaw);
   // the limb: a thin dark stick from the trunk out along the droop
   const ex=len*Math.cos(dip),ey=-len*Math.sin(dip);
   {const base=W.pos.length/3,th=.0035+len*.025;for(const [t,o] of [[0,th],[1,th*.3]])for(const e of [-1,1]){W.pos.push(cy*ex*t-sy*o*e,y+ey*t,sy*ex*t+cy*o*e);W.nor.push(0,1,0);W.uv.push(0,0);const c=.16+.06*t;W.col.push(c,c*.92,c*.82);}W.idx.push(base,base+2,base+1,base+1,base+2,base+3);}
   // sprays along its outer part, flat-ish so they show from above, lighter out at the tips and up high
   const light=(.35+r()*.8)*(.7+.45*f)*(1-fade+fade*Math.pow(f,.8));
   for(let k=0;k<sprays;k++){
    const t=.3+.7*(k+.5)/sprays+(r()-.5)*.08,px=cy*ex*t,pz=sy*ex*t,py=y+ey*t,s=Math.max(len*spraySize,radius*.2*(1-f*.4))*(.7+.55*r())*(.8+.35*t)+.012;
    // each spray two crossed cards: one lying flat (seen from the drone), one tipped up on edge (seen from the side)
    const sy2=yaw+(r()-.5)*1.1,dp=dip*.5-.1+(r()-.5)*.3,sh=light*(.7+.35*t)*(t>.6&&r()<.45?1.45:1);
    const tilt=f>.6?(r()<.5?1:-1)*(.5+.6*r())*(f-.6)/.4:0;
    // (rolled well off the flat both ways, so a fir seen level from the side, as down the hill, is foliage and not a ladder of slabs)
    addBranch(L,[px,py,pz],sy2,s,s*.72,dp-(f>.6?.35*(f-.6)/.4:0),-.05,(r()-.5)*1.6+tilt,1,sh,FLAME);addBranch(L,[px,py,pz],sy2+(r()-.5)*.6,s*.9,s*.66,dp,-.05,(r()<.5?1:-1)*(1.15+r()*.45),1,sh*.9,FLAME);
   }
   const tl=len*spraySize*.9+.01;addBranch(L,[cy*ex,y+ey,sy*ex],yaw+(r()-.5)*.4,tl,tl*.7,-.15,-.06,(r()-.5)*.6,1,light*1.08,FLAME);
   // close in by the trunk: shaded sprays, so no bare pole shows up the middle
   const ci=radius*.24*(1-f*.5)+.01;addBranch(L,[cy*len*.08,y,sy*len*.08],yaw+(r()-.5),ci,ci*.7,.2,-.05,1.3+(r()-.5)*.5,1,light*.3,FLAME);
  }
 }
 // the leader: a few upright sprays at the very top
 for(let k=0;k<4;k++){const s=radius*.3;addBranch(L,[0,1-s*1.1,0],k*1.6,s,s*.55,-1.1,.05,1.57,1,.95,FLAME);}
 // the trunk stops a little over halfway up: above that the real foliage hides it, and drawn it shows as a dark line through far trees
 const parts=[fromArrays(W.pos,W.nor,W.uv,W.col,W.idx),lathe([[0,.009],[.3,.0055],[.55,.002]],5,[.15,.155,.12])];
 if(dead)parts.push(trunk(dead,seed));
 return {leaf:fromArrays(L.pos,L.nor,L.uv,L.col,L.idx),wood:mergeGeometries(parts)};
}
// Grey dead limbs and a bare grey trunk showing under the crown, as on the tall forest firs.
function trunk(limbs,seed){const r=rnd(seed+9),grey=[.22,.21,.195],parts=[lathe([[0,.012],[.34,.009]],5,grey)];for(let i=0;i<limbs;i++){const l=.05+r()*.075,g=lathe([[0,.0035],[l*.6,.002],[l,.0006]],3,grey);g.rotateZ(-1.1-r()*.9);g.rotateY(r()*6.283);g.translate(0,.05+r()*.3,0);parts.push(g);}return mergeGeometries(parts);}

// A juniper as the census crops show it: a solid dense mass to the ground, fine lumpy surface, with short sprays on it for a soft broken edge.
// Overlapping tufts cut from real crown pictures, tips up and out, laid over a dark inner mass that closes every gap. The tufts make the lumpy opaque surface and the soft edge; larger ones are the lobes.
// `weight(y)` (0..1), when given, thins the sprays where the crown is narrow so a wide skirt is as full as the top.
function tuftLayer(a,r,profile,{count,size,up=[.35,1.25],shade=[.72,1.12],tiers=0,shadeAt=null,weight=null}){
 for(let i=0;i<count;i++){let y=Math.pow(r(),.82)*.985;if(weight)for(let k=0;k<8&&r()>weight(y);k++)y=r()*.985;const yaw=r()*6.283,R=profile(y,yaw),big=r()<.14?1.55:1,sz=size*(.72+r()*.56)*big,lift=up[0]+r()*(up[1]-up[0]),cy=Math.cos(yaw),sy=Math.sin(yaw);
  addBranch(a,[cy*R*.8,Math.max(.012,y-sz*.3),sy*R*.8],yaw+(r()-.5)*.9,sz,sz*(1+r()*.35),-lift,.08,(r()-.5)*.9,1,(shade[0]+r()*(shade[1]-shade[0]))*(.8+y*.3)*(tiers?.72+.56*(1-((y*tiers+.6*Math.sin(yaw*2))%1)):1)*(shadeAt?shadeAt(y,yaw):1),FLAME);}
}
// Bush silhouettes, widest = 1, listed from the tip down to the ground. The real junipers here keep their skirts: every one is
// widest right at the ground and narrows upward, and the forms differ only in how the top closes (pointed, egg, round, low, column).
// (The outlines drawn on the frames averaged narrower at the foot, but that was grass hiding the base and hand-drawn corners rounding.)
const OUTLINE_SHAPES={"pyramid":[0.1,0.24,0.35,0.44,0.53,0.62,0.7,0.78,0.85,0.93,1.0],"egg":[0.06,0.26,0.42,0.56,0.67,0.76,0.84,0.9,0.95,0.98,1.0],"round":[0.08,0.38,0.56,0.7,0.8,0.87,0.92,0.96,0.99,1.0,1.0],"low":[0.15,0.59,0.73,0.82,0.88,0.93,0.96,0.98,0.99,1.0,1.0],"column":[0.06,0.3,0.48,0.62,0.72,0.8,0.86,0.91,0.95,0.98,1.0],
 // the exception he pointed out (picture 12): some are widest a third of the way up and tuck in at the foot
 "eggfoot":[0.12,0.4,0.62,0.8,0.93,1.0,0.99,0.93,0.84,0.76,0.7]};
const fromTip=(list,y)=>{const u=Math.max(0,Math.min(.9999,1-y))*(list.length-1),i=Math.floor(u);return list[i]+(list[i+1]-list[i])*(u-i);};
function juniper({seed,radius,pointed=1.25,egg=0,count=520,size=.1,outline=null,clumps=0}){
 const r=rnd(seed+1),a={pos:[],nor:[],uv:[],col:[],idx:[]},own=[r()*6.283,r()*6.283],shape=outline&&OUTLINE_SHAPES[outline],
  spots=[];for(let i=0;i<clumps;i++)spots.push([r()*6.283,Math.pow(r(),.75),.1+r()*.11,.55+r()*.45]);
 // the crown breaks into separate masses of foliage with dark gaps between them, as in the frames
 const bump=(y,c)=>{let v=0;for(const [sa,sy,w,amp] of spots){let d=Math.abs(c-sa);if(d>3.1416)d=6.283-d;const dx=d*.42,dy=y-sy,e=(dx*dx+dy*dy)/(w*w);if(e<5)v=Math.max(v,amp*Math.exp(-e));}return v;},
  base=y=>Math.max(.002,radius*(shape?fromTip(shape,y):egg?Math.pow(Math.max(0,1-Math.pow(y,egg)),.62):Math.pow(Math.max(0,1-y),1/pointed)*Math.min(1,.72+y*2.4))),
  // no two plants one shape: big masses bulge out and bite in round the crown, more so toward the top
  profile=(y,c=0)=>base(y)*(1+(.13+.3*y)*Math.sin(c*2+own[0]+y*3.1)+(.1+.16*y)*Math.sin(c*3+own[1]-y*7.3)+.09*Math.sin(c*5+own[0]*2+y*13))*(clumps?.8+.42*bump(y,c):1);
 // (sprays reaching out past the mass at random make the ragged outline the frames show, not a smooth bullet)
 tuftLayer(a,r,(y,c)=>profile(y,c)*(r()<.18?1.22:1),{count,size,shadeAt:clumps?(y,c)=>.62+.62*bump(y,c):null,weight:shape?y=>fromTip(shape,y):null});
 return {leaf:fromArrays(a.pos,a.nor,a.uv,a.col,a.idx),wood:crownShell({profile:(y,c)=>profile(y,c)*.84,seed:seed+3,tufts:50,lobes:9,rows:16,sides:18,tile:4})};
}
const FLAME={u0:0,u1:1,v0:0,v1:1};
const BOUGH={u0:0,u1:1,v0:1,v1:0};
// One fir bough drawn stroke by stroke: a rib from the base up to the tip, side twigs shortening toward the tip, needles along every twig, tips paler.
function boughTexture(seed){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=rnd(seed);g.lineCap='round';
 const needle=(x,y,a,l,tone)=>{g.strokeStyle=tone;g.lineWidth=2.6;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();};
 const dark=['#17241b','#1c2c20','#223426','#1a2a22'],mid=['#2a3f2c','#30482f','#2b4436'],tip=['#4b6a42','#567547','#47683f'];
 for(let i=0;i<70;i++){const t=i/70,y=250-t*240,side=i%2?1:-1,len=(1-t*.86)*112*(.72+r()*.4),ang=-Math.PI/2+side*(1.02-.25*t)+(r()-.5)*.14;
  for(let k=0;k<16;k++){const d=k/16,x0=128+Math.cos(ang)*len*d,y0=y+Math.sin(ang)*len*d,tone=d>.72?tip[Math.floor(r()*3)]:d>.35?mid[Math.floor(r()*3)]:dark[Math.floor(r()*4)];
   needle(x0,y0,ang+.7,9+r()*5,tone);needle(x0,y0,ang-.7,9+r()*5,tone);}}
 for(let i=0;i<46;i++){const t=i/46;needle(128,250-t*240,-Math.PI/2+(i%2?.6:-.6),12,t>.82?tip[0]:dark[1]);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
// A soft flame of juniper foliage: fine scaly strokes, dark olive at the base going to yellow at the tips.
function tuftTexture(image,seed){
 // A tuft cut from a real crown tile: pointed top, broken edge from small lobes, darker at the base where it enters the tree.
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=rnd(seed);
 g.fillStyle='#000';g.beginPath();for(let i=0;i<34;i++){const t=r(),w=Math.sqrt(1-t*t)*82+6,x=128+(r()-.5)*2*w,y=232-t*196,R=13+r()*18;g.moveTo(x+R,y);g.arc(x,y,R,0,6.283);}g.fill();
 g.globalCompositeOperation='source-in';g.drawImage(image,r()*200,r()*200,120,120,0,0,256,256);
 g.globalCompositeOperation='source-atop';const d=g.createLinearGradient(0,256,0,0);d.addColorStop(0,'rgba(10,14,8,.62)');d.addColorStop(.55,'rgba(10,14,8,.08)');d.addColorStop(1,'rgba(235,225,150,.2)');g.fillStyle=d;g.fillRect(0,0,256,256);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
// A dead tree as the census crop shows it: a silver trunk whose limbs fork again and again, the upper ones broken short.
function snag({seed}){
 const r=rnd(seed),silver=[.62,.60,.55],parts=[],Y=new THREE.Vector3(0,1,0),q=new THREE.Quaternion(),d=new THREE.Vector3();
 const limb=(x,y,z,dir,len,rad,depth)=>{
  d.copy(dir).normalize();const g=lathe([[0,rad],[len,rad*.62]],depth>1?3:5,silver);q.setFromUnitVectors(Y,d);g.applyQuaternion(q);g.translate(x,y,z);parts.push(g);
  const ex=x+d.x*len,ey=y+d.y*len,ez=z+d.z*len;if(depth>=3)return;
  const forks=depth===0?1:2;
  for(let i=0;i<forks;i++){const a=r()*6.283,k=.55+r()*.5,n=new THREE.Vector3(d.x+Math.cos(a)*k,d.y*.8+(r()-.35)*.4,d.z+Math.sin(a)*k);limb(ex,ey,ez,n,len*(.5+r()*.25),rad*.6,depth+1);}
 };
 parts.push(lathe([[0,.024],[.35,.017],[.7,.01],[.95,.003]],6,silver));
 for(let i=0;i<13;i++){const y=.22+i*.055+r()*.03,a=i*2.399+r(),l=(.2+r()*.14)*(1.1-y*.75);limb(0,y,0,new THREE.Vector3(Math.cos(a),.35+r()*.7,Math.sin(a)),l*.55,.0075*(1.15-y*.6),1);}
 return mergeGeometries(parts);
}

function leafTexture(seed){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=rnd(seed);
 g.clearRect(0,0,256,256);
 for(let i=0;i<620;i++){const a=r()*6.283,d=Math.pow(r(),.75)*124,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d,s=2.5+r()*3.5,k=r();
  const tone=k<.33?[62,98,46]:k<.72?[78,118,54]:[100,138,66];g.fillStyle=`rgb(${tone[0]+r()*16|0},${tone[1]+r()*14|0},${tone[2]+r()*14|0})`;
  g.save();g.translate(x,y);g.rotate(r()*6.283);g.beginPath();g.ellipse(0,0,s,s*.72,0,0,6.283);g.fill();g.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function aspen({seed}){
 const r=rnd(seed),pos=[],nor=[],uv=[],col=[],idx=[];
 // Stems of one clone: thin, white, leaning a little apart, sharing a crown.
 const stems=[];for(let i=0;i<5;i++){const a=r()*6.283,d=i?.03+r()*.1:0;stems.push({x:Math.cos(a)*d,z:Math.sin(a)*d,lx:Math.cos(a)*(.07+r()*.13),lz:Math.sin(a)*(.07+r()*.13),h:i?.62+r()*.33:1,th:i?.004+r()*.0025:.006});}
 // (the groves in the frames are opaque bright masses down to near the ground, white stems only showing at the foot)
 const clumps=[];for(let i=0;i<380;i++){const s=stems[Math.floor(r()*stems.length)],t=.2+r()*.8,y=t*s.h,sp=.27*(1-Math.abs(t-.56)*1.05),a=r()*6.283;clumps.push([s.x+s.lx*t+Math.cos(a)*sp*(.3+r()),y,s.z+s.lz*t+Math.sin(a)*sp*(.3+r()),.06+r()*.05]);}
 const card=(cx,cy,cz,nx,ny,nz,s,shade)=>{const q=pos.length/3,u=[r()-.5,r()-.5,r()-.5],lu=Math.hypot(...u)||1;u.forEach((_,i)=>u[i]/=lu);
  const v=[u[1]*nz-u[2]*ny,u[2]*nx-u[0]*nz,u[0]*ny-u[1]*nx],lv=Math.hypot(...v)||1;v.forEach((_,i)=>v[i]/=lv);
  for(const [e,f] of [[-1,-1],[1,-1],[-1,1],[1,1]]){pos.push(cx+(u[0]*e+v[0]*f)*s,cy+(u[1]*e+v[1]*f)*s,cz+(u[2]*e+v[2]*f)*s);nor.push(nx,ny,nz);uv.push((e+1)/2,(f+1)/2);col.push(shade,shade,shade);}
  idx.push(q,q+1,q+2,q+1,q+3,q+2);};
 for(const [x,y,z,R] of clumps)for(let i=0;i<6;i++){let dx=r()-.5,dy=r()-.5,dz=r()-.5;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const out=Math.cbrt(r());const ox=x*.6+dx*.5,oy=.45+dy*.5,oz=z*.6+dz*.5,ol=Math.hypot(ox,oy,oz)||1;card(x+dx*R*out,y+dy*R*out*.9,z+dz*R*out,ox/ol,oy/ol,oz/ol,.022+r()*.012,.6+out*.5);}
 const leaf=fromArrays(pos,nor,uv,col,idx);
 const white=[.74,.74,.68],parts=[];
 for(const s of stems){const g=lathe([[0,s.th],[s.h*.4,s.th*.72],[s.h*.75,s.th*.42],[s.h*.98,s.th*.14]],5,white);const k=s.lx/s.h,m=s.lz/s.h;g.applyMatrix4(new THREE.Matrix4().set(1,k,0,s.x,0,1,0,0,0,m,1,s.z,0,0,0,1));parts.push(g);}
 return {leaf,wood:mergeGeometries(parts)};
}

// Loads the pictures, builds each kind. -> [{name,label,defaultHeight,root,parts,soften,shape,sink,sway}], index in TREE_KINDS order.
async function crownTile(file){const t=await new THREE.TextureLoader().loadAsync(new URL('../trees/tex/'+file,import.meta.url).href);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
export async function buildTreeSpecies(baseUrl){
 const {scene:bush}=await new GLTFLoader().loadAsync(new URL('../models/big-bush.glb?v=bb3',import.meta.url).href);
 bush.updateMatrixWorld(true);
 let bushMesh=null;bush.traverse(o=>{if(o.isMesh)bushMesh=o;});
 const branch=bushMesh.material.map;branch.anisotropy=4;
 const bark=await new THREE.TextureLoader().loadAsync(new URL('../trees/tex/birch_color.jpg',import.meta.url).href);bark.wrapS=bark.wrapT=THREE.RepeatWrapping;bark.colorSpace=THREE.SRGBColorSpace;
 const needle=(color)=>new THREE.MeshStandardMaterial({map:branch,color,alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
 const juniperTile=await crownTile('juniper-crown.jpg'),firTile=await crownTile('fir-crown.jpg'),crownMat=t=>new THREE.MeshStandardMaterial({map:t,vertexColors:true,roughness:1,metalness:0,name:'crown'});
 const coreMat=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'core'});
 const pack=(name,label,defaultHeight,g,leafMat,woodMat,extra)=>{const root=new THREE.Group(),L=new THREE.Mesh(g.leaf,leafMat),W=new THREE.Mesh(g.wood,woodMat);root.add(W,L);return {name,label,defaultHeight,height:1,root,parts:[{geometry:g.wood,material:woodMat},{geometry:g.leaf,material:leafMat}],soften:.3,spec:.12,...extra};};
 const flame=tuftTexture(juniperTile.image,66),firTuft=tuftTexture(firTile.image,67),juniperMat=()=>{const m=needle(0xffffff);m.map=flame;return m;};
 const boughPic=boughTexture(68),boughLeaf=c=>{const m=needle(c);m.map=boughPic;return m;};
 const firLeaf=c=>{const m=needle(c);m.map=firTuft;m.color.multiplyScalar(2.3);return m;};
 // a real fir spray picture (the EZ-Tree pine leaf): stem at the foot of the card, needles out to the tips
 const sprayPic=await new THREE.TextureLoader().loadAsync(new URL('../vegetation-lab/tex/pine_leaf.png',import.meta.url).href);sprayPic.colorSpace=THREE.SRGBColorSpace;sprayPic.anisotropy=4;
 // (the picture is a brighter, yellower green than the firs in the July frames: inside his outlines they measured 90,107,75
 // against the photos' 70,77,75, so the sprays are darkened and cooled most of the way to that)
 const sprayLeaf=c=>{const m=needle(c);m.map=sprayPic;m.alphaTest=.38;m.color.multiply(new THREE.Color(.5,.47,1.0));return m;};
 const lump={lump:.05,mix:.8,dark:.38,tip:.3,olive:0,branchDark:.2,under:.2,glow:.12};
 // The tall firs lit as whole cones: the leaves smeared into masses about a metre across, so a crown has a lit side, a shaded side
 // and a bright top as the frames show, instead of every bough lit on its own (which read as stripes from the clearing).
 // (the leaves smeared at crown scale, so the sky each spray sees changes smoothly from the sunny outer top to the dark inside
 // and foot: each tree lit as one cone, not tier by tier, which read as stripes; half of each spray's own outward normal is kept)
 const CONE={...lump,lump:.5,mix:.4,dark:.95,tip:.6};
 const out=[];
 out.push(pack('fir','Full fir',22,sprayFir({seed:4101,radius:.28,whorls:50,perWhorl:6,sprays:6,dead:16}),sprayLeaf(0xffffff),crownMat(firTile),{shape:CONE,soften:.04,sway:.05}));
 out.push(pack('spruce','Narrow spruce',24,sprayFir({seed:4202,radius:.22,whorls:52,perWhorl:6,sprays:6,pointed:.95,droop:.4,dead:14}),sprayLeaf(0xe4eaf0),crownMat(firTile),{shape:CONE,soften:.04,sway:.05}));
 out.push(pack('fir_small','Young fir',9,sprayFir({seed:4303,radius:.32,whorls:22,perWhorl:5,sprays:4,pointed:.85,fade:.35}),sprayLeaf(0xf6f8e8),crownMat(firTile),{shape:{...lump,lump:.13},sway:.08}));
 // Junipers: the sprays are the branch picture of the big bush model; that model stays in the catalog as its own object.
 out.push(pack('juniper','Round juniper',4,juniper({seed:4404,radius:.47,outline:'round',clumps:26}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,wideBase:1.3,sway:.1}));
 {const g=aspen({seed:4505}),leafMat=new THREE.MeshStandardMaterial({map:(()=>{const t=leafTexture(77);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})(),color:new THREE.Color().setRGB(.8,.87,.72),alphaTest:.45,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'}),trunk=new THREE.MeshStandardMaterial({map:bark,color:0xf6f6ec,vertexColors:true,roughness:1,metalness:0,name:'bark'});
  out.push(pack('aspen','Lime aspen',12,g,leafMat,trunk,{shape:{...lump,lump:.06,dark:.36,tip:.3,olive:0,under:0,glow:0},coverage:true,sway:.2}));}
 out.push(pack('open_fir','Open fir',18,sprayFir({seed:4606,radius:.27,whorls:40,perWhorl:6,sprays:5,sparse:.08,pointed:.8,dead:12}),sprayLeaf(0xf4f6e6),crownMat(firTile),{shape:CONE,soften:.04,sway:.06}));
 out.push(pack('juniper_column','Column juniper',7,juniper({seed:4707,radius:.28,outline:'column',clumps:24,count:460,size:.075}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,sway:.07}));

 out.push(pack('juniper_low','Low spreading juniper',3.5,juniper({seed:4808,radius:.72,outline:'low',clumps:28,count:640,size:.11}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,sway:.1}));
 {const g=snag({seed:4909}),m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),root=new THREE.Group();root.add(new THREE.Mesh(g,m));
  out.push({name:'snag',label:'Dead snag',defaultHeight:7,height:1,root,parts:[{geometry:g,material:m}],soften:.1,spec:.1,sway:.02});}
 out.push(pack('juniper_cone','Broad cone juniper',5,juniper({seed:5001,radius:.39,outline:'egg',clumps:26}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,sway:.09}));
 out.push(pack('juniper_pyramid','Pointed juniper',6,juniper({seed:5102,radius:.34,outline:'pyramid',clumps:26,count:500,size:.09}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,sway:.08}));
 // Deep in the forest: the same spray fir, a little lighter on sprays, since only its upper half shows past the trees in front.
 out.push(pack('fir_back','Forest fir',22,sprayFir({seed:5203,radius:.29,whorls:38,perWhorl:5,sprays:4,fade:.5}),sprayLeaf(0xffffff),crownMat(firTile),{shape:CONE,soften:.04,sway:.05}));
 // Tall firs whose lower trunk is bare: the crown starts a third of the way up, with grey dead stubs on the trunk below, as on the forest edge.
 out.push(pack('fir_high','Fir, bare lower trunk',20,sprayFir({seed:5304,radius:.25,whorls:28,crownBase:.32,dead:20,fade:.35}),sprayLeaf(0xffffff),crownMat(firTile),{shape:CONE,soften:.04,sway:.05}));
 // A juniper widest a third of the way up, narrower at the foot (the few the frames show that way).
 out.push(pack('juniper_egg','Egg juniper, narrow foot',4.5,juniper({seed:5405,radius:.39,outline:'eggfoot',clumps:26}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.12,olive:0},soften:.32,coverage:true,sway:.09}));
 return out;
}
