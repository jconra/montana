// SHRUBS, built from stems and small tufts at load. Big sagebrush in the May 2026 drone frames: a few dark twisted stems
// from one root, bare low down, each ending in shaggy silver tufts with gaps between them, and no two outlines alike.
// Forms are one unit high with their base at y = 0, so a placement's scale is its height in metres; widths are authored
// (wider than one for the low kinds) and a placement's own width multiplies them.
import * as THREE from 'three';

function rnd(seed){let s=seed>>>0||1;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function build(pos,nor,uv,col,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);return g;}

// A picture of four feathery sprays: fine wedge leaflets on thin stalks, dense at the middle and frayed at the edge.
export function sprayTexture(seed=91,size=512){
 const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),r=rnd(seed),cell=size/2;
 g.clearRect(0,0,size,size);g.lineCap='round';
 for(let q=0;q<4;q++){
  const ox=(q%2)*cell,oy=(q>>1)*cell,S=cell/256;
  for(let i=0;i<130+q*8;i++){
   const a=-Math.PI/2+(r()-.5)*(1.25+.2*q),len=(120+r()*110)*S,bx=ox+cell/2+(r()-.5)*44*S,by=oy+cell-8*S,tone=r(),
    shade=tone<.3?[132,136,128]:tone<.75?[170,174,166]:[204,206,198];
   let x=bx,y=by,ang=a;const steps=20;
   for(let k=0;k<steps;k++){
    const t=k/steps,nx=x+Math.cos(ang)*len/steps,ny=y+Math.sin(ang)*len/steps;
    g.strokeStyle=`rgb(${shade[0]*.72|0},${shade[1]*.72|0},${shade[2]*.72|0})`;g.lineWidth=Math.max(1,(2.2-t*1.6)*S);g.beginPath();g.moveTo(x,y);g.lineTo(nx,ny);g.stroke();
    if(t>.2)for(const side of [-1,1]){
     const l=(5+r()*11)*S*(1.15-t*.55),w=(1+r()*1.1)*S,b=ang+side*(.45+r()*.55),j=.86+r()*.28;
     g.fillStyle=`rgb(${shade[0]*j|0},${shade[1]*j|0},${shade[2]*j|0})`;
     g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(b+1.5)*w,y+Math.sin(b+1.5)*w);g.lineTo(x+Math.cos(b)*l,y+Math.sin(b)*l);g.lineTo(x+Math.cos(b-1.5)*w,y+Math.sin(b-1.5)*w);g.closePath();g.fill();
    }
    x=nx;y=ny;ang+=(r()-.5)*.22;
   }
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

// A plant is a few overlapping soft mounds of silver tufts, solid from the ground up. Stems only show low on the woody forms.
// spread: half-width in units of height. mounds: how many overlap. bare: height of bare stem under the woody forms.
function sageForm({seed,mounds,spread,tufts,size,bare=0,flat=1}){
 const r=rnd(seed),W={pos:[],nor:[],uv:[],c:[],idx:[]},L={pos:[],nor:[],uv:[],c:[],idx:[]};
 const blobs=[];for(let m=0;m<mounds;m++){const a=m/mounds*6.283+r()*.9,d=m?spread*(.32+r()*.42):0,R=spread*(.42+r()*.28)*(m?1:1.15);blobs.push({x:Math.cos(a)*d,z:Math.sin(a)*d,R,h:(m?.62+r()*.33:1)*flat});}
 const area=blobs.reduce((n,b)=>n+b.R*b.R,0);
 for(const b of blobs){
  const n=Math.max(8,Math.round(tufts*b.R*b.R/area));
  for(let i=0;i<n;i++){
   // a point on the dome, a little under the surface for some, so gaps show more foliage, never the ground
   const yaw=r()*6.283,el=Math.acos(1-r()*.98),deep=r()<.25?.62:.9+r()*.12,lump=1+.12*Math.sin(yaw*4+b.x*17+el*5)*Math.sin(el*7+b.z*13),
    rad=Math.sin(el)*b.R*deep*lump,hy=Math.cos(el)*b.h*deep*lump,y=bare+(b.h-bare)*Math.max(0,hy/b.h),x=b.x+Math.cos(yaw)*rad,z=b.z+Math.sin(yaw)*rad,
    t=y/b.h,shade=(deep<.7?.58:.72)+t*.42+(r()-.5)*.14;
   tuft(L,[x,y+size*.1,z],[Math.cos(yaw)*Math.sin(el),Math.cos(el)+.25,Math.sin(yaw)*Math.sin(el)],size*(.8+r()*.5),r,shade);
  }
 }
 // a few short dark stems into the root
 const stems=bare>0?7:3;for(let k=0;k<stems;k++){const a=r()*6.283,top=Math.max(bare,.12)*1.3,d=spread*(.08+r()*.22),col=BARK[Math.floor(r()*3)];tube(W,[[Math.cos(a)*d*.2,0,Math.sin(a)*d*.2],[Math.cos(a)*d*.6,top*.5,Math.sin(a)*d*.6],[Math.cos(a)*d,top,Math.sin(a)*d]],.03*(bare>0?1.1:.7),.012,col);}
 const leaf=build(L.pos,L.nor,L.uv,L.c,L.idx),wood=build(W.pos,W.nor,W.uv,W.c,W.idx);
 const box=new THREE.Box3().setFromBufferAttribute(leaf.attributes.position),k=1/box.max.y;
 for(const g of [leaf,wood]){g.scale(k,k,k);g.computeBoundingBox();g.computeBoundingSphere();}
 return {leaf,wood};
}

export const SAGE_FORMS=[
 {name:'sage_round',label:'Sage, tufted round',defaultHeight:1.1,form:{seed:7101,mounds:5,spread:.61,tufts:190,size:0.24}},
 {name:'sage_round2',label:'Sage, tufted lopsided',defaultHeight:1,form:{seed:7244,mounds:6,spread:.67,tufts:210,size:0.25}},
 {name:'sage_low',label:'Sage, low spreading patch',defaultHeight:.55,form:{seed:7355,mounds:7,spread:1.15,tufts:220,size:0.36,flat:.9}},
 {name:'sage_woody',label:'Sage, tall and woody',defaultHeight:2.2,form:{seed:7466,mounds:4,spread:.52,tufts:170,size:0.2,bare:.2}},
 {name:'sage_sprawl',label:'Sage, old and sprawling',defaultHeight:1.3,form:{seed:7577,mounds:7,spread:.84,tufts:200,size:0.24,bare:.08}},
];

// -> species for a Forest, in SAGE_FORMS order.
export function buildShrubSpecies(){
 const map=sprayTexture();
 return SAGE_FORMS.map(({name,label,defaultHeight,form})=>{
  const {leaf,wood}=sageForm(form);
  const woodMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),leafMat=new THREE.MeshStandardMaterial({map,color:new THREE.Color().setRGB(.78,.75,.62),alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
  const root=new THREE.Group();root.add(new THREE.Mesh(wood,woodMat),new THREE.Mesh(leaf,leafMat));
  return {name,label,defaultHeight,height:1,root,parts:[{geometry:wood,material:woodMat},{geometry:leaf,material:leafMat}],tint:false,soften:.25,spec:.08,coverage:true,sway:.12,
   shape:{lump:.14,mix:.7,dark:.42,tip:.18,olive:0,branchDark:.5,under:.12,glow:.05},triangles:(wood.index.count+leaf.index.count)/3};
 });
}
// Which form a placed sage takes when it doesn't name one: from its height and its own id, so it stays put between visits.
export function sageFormOf(id,h){
 let n=2166136261;for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);const v=(n>>>0)/4294967296;
 if(h<.6)return v<.55?2:v<.8?0:1;
 if(h>1.5)return v<.55?3:v<.85?4:0;
 return v<.38?0:v<.72?1:v<.86?4:2;
}
