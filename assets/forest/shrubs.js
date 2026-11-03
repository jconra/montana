// SHRUBS, built from stems and small tufts at load. Big sagebrush in the May 2026 drone frames: a few dark twisted stems
// from one root, bare low down, each ending in shaggy silver tufts with gaps between them, and no two outlines alike.
// Forms are one unit high with their base at y = 0, so a placement's scale is its height in metres; widths are authored
// (wider than one for the low kinds) and a placement's own width multiplies them.
import * as THREE from 'three';

function rnd(seed){let s=seed>>>0||1;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function build(pos,nor,uv,col,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);return g;}

// A picture of four rosettes of sage foliage: hundreds of short silver-green leaflets packed into a soft ragged ball over a dark
// shaded core, darker flecks between them and toward its foot. (A fan of stalks read as crisp stars up close; the real foliage is a fuzzy mass.)
export function sprayTexture(seed=91,size=512){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),r=rnd(seed),cell=size/2;
 g.clearRect(0,0,size,size);g.lineCap='round';
 for(let q=0;q<4;q++){
  const ox=(q%2)*cell,oy=(q>>1)*cell,S=cell/256,cx=ox+cell/2,cy=oy+cell*.56,R=104*S,lobes=[r()*6.283,r()*6.283,r()*6.283];
  const edge=a=>R*(.8+.12*Math.sin(a*3+lobes[0])+.08*Math.sin(a*5+lobes[1])+.06*Math.sin(a*9+lobes[2]));
  // the shaded inner foliage under the leaflets, so a card is a solid ball with a fuzzy edge, not a sprinkle you see the ground through
  g.fillStyle='rgb(64,76,70)';g.beginPath();for(let k=0;k<=48;k++){const a=k/48*6.283,d=edge(a)*.78;g[k?'lineTo':'moveTo'](cx+Math.cos(a)*d,cy+Math.sin(a)*d*.92);}g.fill();
  for(let i=0;i<1100;i++){
   const a=r()*6.283,u=Math.sqrt(r()),d=u*edge(a)*(.92+r()*.16),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d*.92,
    // leaflets point outward and a little up; the outer ones longer and paler, the inner and lower ones darker
    ang=a+(r()-.5)*1.2-(y<cy?.2:0),len=(5+r()*9)*S*(.7+.5*u),w=(1.4+r()*1.4)*S,low=(y-cy)/R,
    dark=r()<.22,base=dark?[84,96,92]:[150+r()*40,160+r()*38,152+r()*36],k=(1-.28*Math.max(0,low))*(dark?1:.9+.2*u);
   g.strokeStyle=`rgb(${base[0]*k|0},${base[1]*k|0},${base[2]*k|0})`;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(ang)*len,y+Math.sin(ang)*len);g.stroke();
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}

const BARK=[[.052,.042,.038],[.075,.062,.052],[.10,.09,.08]];

// A stem as a three-sided tube along its points; its thickness runs down to `r1`.
function tube(a,pts,r0,r1,col){
 const {pos,nor,uv,c,idx}=a,base=pos.length/3,sides=3;
 pts.forEach((p,j)=>{
  const q=pts[Math.min(j+1,pts.length-1)],o=pts[Math.max(j-1,0)];let dx=q[0]-o[0],dy=q[1]-o[1],dz=q[2]-o[2];const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
  let ux=-dz,uy=0,uz=dx;const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;if(ul<.01){ux=1;uz=0;}
  const vx=dy*uz-dz*uy,vy=dz*ux-dx*uz,vz=dx*uy-dy*ux,r=r0+(r1-r0)*j/(pts.length-1);
  for(let i=0;i<sides;i++){const s=i/sides*6.283,cs=Math.cos(s),sn=Math.sin(s),nx=ux*cs+vx*sn,ny=uy*cs+vy*sn,nz=uz*cs+vz*sn;pos.push(p[0]+nx*r,p[1]+ny*r,p[2]+nz*r);nor.push(nx,ny,nz);uv.push(0,0);c.push(col[0],col[1],col[2]);}
 });
 for(let j=0;j<pts.length-1;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides,A=base+j*sides+i,B=base+j*sides+n,C=A+sides,D=B+sides;idx.push(A,C,B,B,C,D);}
}

// One tuft: a few small crossed cards of spray at a stem's tip, faces tipped up and out so they show from above as well as from the side.
function tuft(a,tip,dir,size,r,shade){
 const n=2+(r()<.5?1:0);
 for(let k=0;k<n;k++){
  const yaw=r()*6.283,tilt=k===0?.85+r()*.4:.12+r()*.5,s=size*(.75+r()*.45);
  // the card rises along `up` from just under the tip; `side` is level, across it
  const sx=Math.cos(yaw),sz=Math.sin(yaw);let ux=dir[0]*.55+(-sz*Math.sin(tilt))*.8+(r()-.5)*.3,uy=dir[1]*.55+Math.cos(tilt)*.8,uz=dir[2]*.55+(sx*Math.sin(tilt))*.8+(r()-.5)*.3;const l=Math.hypot(ux,uy,uz)||1;ux/=l;uy/=l;uz/=l;
  let Nx=uy*sz,Ny=uz*sx-ux*sz,Nz=-uy*sx;const Nl=Math.hypot(Nx,Ny,Nz)||1;Nx/=Nl;Ny/=Nl;Nz/=Nl;if(Ny<0){Nx=-Nx;Ny=-Ny;Nz=-Nz;}
  const w=s*.38,bx=tip[0]-ux*s*.32,by=tip[1]-uy*s*.32,bz=tip[2]-uz*s*.32,cell=Math.floor(r()*4),u0=(cell%2)*.5,v0=(cell>>1)*.5,base=a.pos.length/3,j=shade*(.88+r()*.24);
  for(const [e,f] of [[-1,0],[1,0],[-1,1],[1,1]]){a.pos.push(bx+sx*w*e+ux*s*f,by+uy*s*f,bz+sz*w*e+uz*s*f);a.nor.push(Nx,Ny,Nz);a.uv.push(u0+(e+1)*.25,1-v0-.5+f*.5);const m=j*(.72+.28*f);a.c.push(m,m,m);}
  a.idx.push(base,base+1,base+2,base+1,base+3,base+2);
 }
}

// A plant grown from a skeleton, as the frames show big sagebrush: a few twisted stems from one root, forking outward, each fork
// ending in a clump of silver tufts; clumps of every size, lopsided, with deep dark gaps between them, and a few long wild limbs
// shooting up past the mass with small tufts at their ends. Each clump is lit on its own, bright on top and dark under, and a dark
// inner layer fills it, so the gaps show shadowed foliage, never the ground (he found the mounds too even, a puff ball).
// spread: half-width in units of height. mounds: how many main stems. bare: height of bare stem under the woody forms.
// wild: how many long limbs stick out past the mass.
export function sageForm({seed,mounds,spread,tufts,size,bare=0,flat=1,wild=3,aspect=1.1}){
 const r=rnd(seed),W={pos:[],nor:[],uv:[],c:[],idx:[]},L={pos:[],nor:[],uv:[],c:[],idx:[]},clumps=[];
 const grow=(p,dir,len,depth,thick)=>{
  // a limb: a slightly kinked tube, then forks, or a clump at the end
  const kink=[(r()-.5)*.35,(r()-.5)*.2,(r()-.5)*.35],mid=[p[0]+dir[0]*len*.5+kink[0]*len,p[1]+dir[1]*len*.5+kink[1]*len,p[2]+dir[2]*len*.5+kink[2]*len],end=[p[0]+dir[0]*len,p[1]+dir[1]*len,p[2]+dir[2]*len];
  if(depth<1||r()<.3)tube(W,[p,mid,end],thick,thick*.6,BARK[Math.floor(r()*3)]);   // (most twigs are inside the foliage)
  if(depth<=1)clumps.push({x:mid[0],y:mid[1],z:mid[2],R:spread*(depth?.26+r()*.12:.3+r()*.1),inner:true});   // (foliage the stems' whole length, down low too)
  if(depth>=1){clumps.push({x:end[0],y:end[1],z:end[2],R:spread*(.32+r()*.24),inner:false});return;}
  const forks=2+(r()<.4?1:0);
  for(let f=0;f<forks;f++){const yaw=Math.atan2(dir[2],dir[0])+(f-(forks-1)/2)*(.7+r()*.5)+(r()-.5)*.5,up=Math.max(.55,dir[1]*(.95+r()*.2)+.1),h=Math.hypot(dir[0],dir[2])*(.8+r()*.4)+.08,l=Math.hypot(h,up);
   grow(end,[Math.cos(yaw)*h/l,up/l,Math.sin(yaw)*h/l],len*(.9+r()*.5),depth+1,thick*.65);}
 };
 for(let m=0;m<mounds;m++){const yaw=m/mounds*6.283+r()*1.1,lean=.12+r()*.38,h=Math.sin(lean),v=Math.cos(lean);   // (stems from the root near upright, as a vase)
  grow([Math.cos(yaw)*.02,bare*.5,Math.sin(yaw)*.02],[Math.cos(yaw)*h,v,Math.sin(yaw)*h],(.2+r()*.12)*flat+bare*.6,0,.02*(bare>0?1.15:.8));}   // (forking low, so the foliage starts near the ground)
 // a skirt of low clumps, so the foliage comes down to the ground as the real ones' does
 // (as wide at the ground as through the middle: he found the lower part bare)
 for(let k=0;k<7;k++){const yaw=k/7*6.283+r()*.9,d=spread*(.45+r()*.35);clumps.push({x:Math.cos(yaw)*d,y:spread*(.06+r()*.12),z:Math.sin(yaw)*d,R:spread*(.32+r()*.14),inner:false,low:true});}
 // the mass drawn in to `aspect` times as wide as it is high (the old mounds' proportions, which the measured sizes were fitted
 // to), before the foliage goes on, so the sprays keep their size and close up
 {const top=Math.max(...clumps.map(c=>c.y+c.R)),half=Math.max(...clumps.map(c=>Math.hypot(c.x,c.z)+c.R)),k=aspect*top/(2*half);
  const grow=Math.min(1.35,Math.sqrt(Math.max(1,k)));for(const c of clumps){c.x*=k;c.z*=k;c.R*=grow;}for(let i=0;i<W.pos.length;i+=3){W.pos[i]*=k;W.pos[i+2]*=k;}}   // (an upright skeleton spread out: its clumps grow with it, so they still close up)
 // the wild limbs: sprigs shooting up and out past the mass, a chain of small clumps along a thin stem, smaller toward the tip
 const massHalf=Math.max(...clumps.map(c=>Math.hypot(c.x,c.z)+c.R)),hi=Math.max(...clumps.map(c=>c.y)),massTop=Math.max(...clumps.map(c=>c.y+c.R));
 for(let k=0;k<wild;k++){const yaw=r()*6.283,h0=hi*(.5+r()*.35),len=massHalf*(.75+r()*.25),up=Math.min(.9+r()*.8,(massTop*(1.02+r()*.1)-h0)/len);   // (tips a little over the crown)
  const at=t=>[Math.cos(yaw+.15*Math.sin(t*3))*len*t,h0+len*up*t*t,Math.sin(yaw+.15*Math.sin(t*3))*len*t];
  tube(W,[at(.6),at(.8),at(1)],.006,.003,BARK[Math.floor(r()*3)]);
  for(const t of [.62,.72,.82,.92,1.02]){const p=at(t);clumps.push({x:p[0],y:p[1],z:p[2],R:spread*(.1-.06*(t-.7)),inner:false,wild:true});}}
 // tufts over the clumps by their size; each clump's own light: top bright, underside dark, the low and inner ones darker still
 const top=Math.max(...clumps.map(c=>c.y+c.R)),area=clumps.reduce((n,c)=>n+c.R*c.R,0);
 for(const c of clumps){const n=Math.max(c.wild?2:3,Math.round(tufts*c.R*c.R/area)),out=Math.min(1,Math.hypot(c.x,c.z)/spread),high=c.y/top;
  for(let i=0;i<n;i++){const yaw=r()*6.283,el=Math.acos(1-r()*1.6),deep=r()<.42?.3+r()*.3:.85+r()*.2,R=c.R*deep*(.85+r()*.3),
    x=c.x+Math.cos(yaw)*Math.sin(el)*R,y=Math.max(.02,c.y+Math.cos(el)*R*.85),z=c.z+Math.sin(yaw)*Math.sin(el)*R,lit=Math.cos(el);
   const shade=Math.max(.1,(deep<.6?.18:c.low?.42:.36)+.9*Math.pow(Math.max(0,lit*.5+.5),1.8)*(.6+.4*Math.max(high,c.low?.45:0))*(c.inner?.7:1)*(.82+.25*out)+(r()-.5)*.1);
   tuft(L,[x,y+size*.08,z],[Math.cos(yaw)*Math.sin(el),Math.cos(el)+.3,Math.sin(yaw)*Math.sin(el)],size*(c.wild?.45:.45+r()*.35)*(deep<.6?1.15:1),r,shade);}}
 // one unit high to the top of the mass (the measured heights are the crown's; the sprigs stand a little over it)
 const leaf=build(L.pos,L.nor,L.uv,L.c,L.idx),wood=build(W.pos,W.nor,W.uv,W.c,W.idx);
 const k=1/massTop;
 for(const g of [leaf,wood]){g.scale(k,k,k);g.computeBoundingBox();g.computeBoundingSphere();}
 return {leaf,wood};
}

export const SAGE_FORMS=[
 {name:'sage_round',label:'Sage, tufted round',defaultHeight:1.1,form:{seed:7101,mounds:5,spread:.44,tufts:360,size:0.25,aspect:1.03}},
 {name:'sage_round2',label:'Sage, tufted lopsided',defaultHeight:1,form:{seed:7244,mounds:6,spread:.48,tufts:380,size:0.26,aspect:1.1}},
 {name:'sage_low',label:'Sage, low spreading patch',defaultHeight:.55,form:{seed:7355,mounds:7,spread:.85,tufts:380,size:0.37,flat:.9,wild:2,aspect:1.9}},
 {name:'sage_woody',label:'Sage, tall and woody',defaultHeight:2.2,form:{seed:7466,mounds:4,spread:.38,tufts:320,size:0.21,bare:.2,aspect:1.1}},
 {name:'sage_sprawl',label:'Sage, old and sprawling',defaultHeight:1.3,form:{seed:7577,mounds:7,spread:.6,tufts:380,size:0.25,bare:.08,aspect:1.56}},
];

// -> species for a Forest, in SAGE_FORMS order.
export function buildShrubSpecies(){
 const map=sprayTexture();
 return SAGE_FORMS.map(({name,label,defaultHeight,form})=>{
  const {leaf,wood}=sageForm(form);
  const woodMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),leafMat=new THREE.MeshStandardMaterial({map,color:new THREE.Color().setRGB(.88,1.0,.94),alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
  const root=new THREE.Group();root.add(new THREE.Mesh(wood,woodMat),new THREE.Mesh(leaf,leafMat));
  return {name,label,defaultHeight,height:1,root,parts:[{geometry:wood,material:woodMat},{geometry:leaf,material:leafMat}],tint:false,soften:.25,spec:.08,coverage:true,sway:.12,
   shape:{lump:.14,mix:.7,dark:.75,tip:0,olive:0,branchDark:.6,under:.4,glow:.05},triangles:(wood.index.count+leaf.index.count)/3};
 });
}
// Which form a placed sage takes when it doesn't name one: from its height and its own id, so it stays put between visits.
export function sageFormOf(id,h){
 let n=2166136261;for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);const v=(n>>>0)/4294967296;
 if(h<.6)return v<.55?2:v<.8?0:1;
 if(h>1.5)return v<.55?3:v<.85?4:0;
 return v<.38?0:v<.72?1:v<.86?4:2;
}
