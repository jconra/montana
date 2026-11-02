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
  for(let i=0;i<46+q*6;i++){
   const a=-Math.PI/2+(r()-.5)*(1.25+.2*q),len=(120+r()*110)*S,bx=ox+cell/2+(r()-.5)*44*S,by=oy+cell-8*S,tone=r(),
    shade=tone<.3?[150,156,142]:tone<.75?[182,188,174]:[212,216,202];
   let x=bx,y=by,ang=a;const steps=12;
   for(let k=0;k<steps;k++){
    const t=k/steps,nx=x+Math.cos(ang)*len/steps,ny=y+Math.sin(ang)*len/steps;
    g.strokeStyle=`rgb(${shade[0]*.72|0},${shade[1]*.72|0},${shade[2]*.72|0})`;g.lineWidth=Math.max(1,(2.2-t*1.6)*S);g.beginPath();g.moveTo(x,y);g.lineTo(nx,ny);g.stroke();
    if(t>.2)for(const side of [-1,1]){
     const l=(10+r()*24)*S*(1.15-t*.55),w=(1.8+r()*2)*S,b=ang+side*(.45+r()*.55),j=.86+r()*.28;
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

// shape: {seed, stems, spread (half-width, in units of height), lean, branch (side shoots per stem), bare (share of a stem without tufts), size (tuft), flat}
function sageForm({seed,stems,spread,bare,branch,size,lean=0,thick=.03,low=.3}){
 const r=rnd(seed),W={pos:[],nor:[],uv:[],c:[],idx:[]},L={pos:[],nor:[],uv:[],c:[],idx:[]};
 const p1=r()*6.283,p2=r()*6.283,leanYaw=r()*6.283;
 const reach=y=>spread*(1+.32*Math.sin(2*y+p1)+.22*Math.sin(3*y+p2));     // an uneven outline, not a circle
 const tall=y=>1-.28*(.5+.5*Math.sin(y*1.6+p2));                            // and an uneven top
 const shoot=(from,yaw,el,len,r0,col,depth)=>{
  const pts=[from],seg=[3,2,1][depth];let [x,y,z]=from,a=yaw,e=el;
  for(let i=0;i<seg;i++){const d=len/seg;x+=Math.cos(a)*Math.cos(e)*d;y+=Math.sin(e)*d;z+=Math.sin(a)*Math.cos(e)*d;a+=(r()-.5)*.7;e+=(r()-.5)*.5+(depth?.05:.1);pts.push([x,Math.max(y,.004),z]);}
  tube(W,pts,r0,r0*.42,col);
  // side shoots from the upper part
  if(depth<2)for(let b=0;b<(depth?1:branch);b++){const t=.3+r()*.6,at=pts[Math.round(t*(pts.length-1))],ya=a+(r()<.5?-1:1)*(.5+r()*.9);shoot(at,ya,Math.max(.15,e*.75+(r()-.5)*.3),len*(.42+r()*.28),r0*.5,col,depth+1);}
  const last=pts[pts.length-1],before=pts[pts.length-2],dl=[last[0]-before[0],last[1]-before[1],last[2]-before[2]],ll=Math.hypot(...dl)||1;
  if(last[1]>bare*.75||r()<.2)tuft(L,last,dl.map(v=>v/ll),size*(.85+r()*.55),r,.8+.4*Math.min(1,last[1]));
  // a tuft or two along the way, so the crown closes up in places and stays open in others
  if(depth>0&&r()<.7){const m=pts[Math.round(pts.length/2)];if(m[1]>bare)tuft(L,m,[0,1,0],size*.9,r,.72+.4*Math.min(1,m[1]));}
 };
 for(let s=0;s<stems;s++){
  const y=(s+r()*.8)/stems*6.283,col=BARK[Math.floor(r()*3)],rea=reach(y),h=tall(y)*(.72+r()*.28),len=Math.hypot(rea*.68,h*.62)*(.9+r()*.25),el=Math.atan2(h*.62,rea*.68),start=[Math.cos(y)*.03*(.5+r()),0,Math.sin(y)*.03*(.5+r())];
  shoot(start,y+lean*Math.cos(y-leanYaw),el,len,thick*(.7+r()*.6),col,0);
 }
 // dark inner tufts close the middle in places, as the older leaves and shade do
 for(let s=0;s<stems*1.5;s++){const y=r()*6.283,d=.15+r()*.65,rea=reach(y)*d,h=Math.max(bare*.6,.18)+r()*.5;tuft(L,[Math.cos(y)*rea,h,Math.sin(y)*rea],[Math.cos(y)*.4,.9,Math.sin(y)*.4],size*.85,r,.55+r()*.25);}
 // a few ground-hugging shoots: tufts low on the outside, so it meets the ground
 for(let s=0;s<Math.round(stems*low);s++){const y=r()*6.283,rea=reach(y)*.8,col=BARK[0];shoot([0,0,0],y,.28+r()*.4,rea*(.75+r()*.4),thick*.45,col,1);}
 // normalise: base at 0, height 1, centred on the root
 const leaf=build(L.pos,L.nor,L.uv,L.c,L.idx),wood=build(W.pos,W.nor,W.uv,W.c,W.idx);
 const box=new THREE.Box3().setFromBufferAttribute(leaf.attributes.position).union(new THREE.Box3().setFromBufferAttribute(wood.attributes.position)),k=1/(box.max.y-Math.min(0,box.min.y));
 for(const g of [leaf,wood]){g.scale(k,k,k);g.computeBoundingBox();g.computeBoundingSphere();}
 return {leaf,wood};
}

export const SAGE_FORMS=[
 {name:'sage_round',label:'Sage, tufted round',defaultHeight:1.1,form:{seed:7101,stems:7,spread:.62,bare:.34,branch:3,size:.34}},
 {name:'sage_round2',label:'Sage, tufted lopsided',defaultHeight:1,form:{seed:7244,stems:6,spread:.78,bare:.28,branch:3,size:.36,lean:.4}},
 {name:'sage_low',label:'Sage, low spreading patch',defaultHeight:.55,form:{seed:7355,stems:8,spread:1.5,bare:.1,branch:3,size:.62,low:.7,thick:.05}},
 {name:'sage_woody',label:'Sage, tall and woody',defaultHeight:2.2,form:{seed:7466,stems:6,spread:.55,bare:.52,branch:3,size:.27,thick:.024,low:.25}},
 {name:'sage_sprawl',label:'Sage, old and sprawling',defaultHeight:1.3,form:{seed:7577,stems:5,spread:.95,bare:.42,branch:4,size:.33,lean:.8,thick:.03}},
];

// -> species for a Forest, in SAGE_FORMS order.
export function buildShrubSpecies(){
 const map=sprayTexture();
 return SAGE_FORMS.map(({name,label,defaultHeight,form})=>{
  const {leaf,wood}=sageForm(form);
  const woodMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),leafMat=new THREE.MeshStandardMaterial({map,color:new THREE.Color().setRGB(.58,.585,.50),alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
  const root=new THREE.Group();root.add(new THREE.Mesh(wood,woodMat),new THREE.Mesh(leaf,leafMat));
  return {name,label,defaultHeight,height:1,root,parts:[{geometry:wood,material:woodMat},{geometry:leaf,material:leafMat}],tint:false,soften:.25,spec:.08,coverage:true,sway:.12,
   shape:{lump:.12,mix:.7,dark:.48,tip:.22,olive:0,branchDark:.5,under:.12,glow:.05},triangles:(wood.index.count+leaf.index.count)/3};
 });
}
// Which form a placed sage takes when it doesn't name one: from its height and its own id, so it stays put between visits.
export function sageFormOf(id,h){
 let n=2166136261;for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);const v=(n>>>0)/4294967296;
 if(h<.6)return v<.55?2:v<.8?0:1;
 if(h>1.5)return v<.55?3:v<.85?4:0;
 return v<.38?0:v<.72?1:v<.86?4:2;
}
