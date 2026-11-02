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
function addBranch(a,at,yaw,len,width,droop,curve,roll,segs,shade,box=SPRAY){
 const {pos,nor,uv,col,idx}=a,base=pos.length/3,cy=Math.cos(yaw),sy=Math.sin(yaw);let x=0,y=0,ang=droop;
 const side=[-sy*Math.cos(roll),Math.sin(roll),cy*Math.cos(roll)];
 for(let i=0;i<=segs;i++){
  const t=i/segs,w=width*.5*(1-t*.45),px=at[0]+cy*x,pz=at[2]+sy*x,py=at[1]+y,v=box.v0+(box.v1-box.v0)*t;
  for(const e of [-1,1]){pos.push(px+side[0]*w*e,py+side[1]*w*e,pz+side[2]*w*e);const nx=cy*.75,nz=sy*.75,ny=.65,l=Math.hypot(nx,ny,nz);nor.push(nx/l,ny/l,nz/l);uv.push(e<0?box.u0:box.u1,v);const c=shade*(.72+.28*t);col.push(c,c,c);}
  x+=Math.cos(ang)*len/segs;y-=Math.sin(ang)*len/segs;ang+=curve;
 }
 for(let i=0;i<segs;i++){const q=base+i*2;idx.push(q,q+2,q+1,q+1,q+2,q+3);}
}

// Inner shape: a lathe of (height, radius) points in one colour.
function lathe(profile,sides,color){
 const pos=[],nor=[],uv=[],col=[],idx=[];
 profile.forEach(([y,r],j)=>{for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;pos.push(Math.cos(a)*r,y,Math.sin(a)*r);nor.push(Math.cos(a),.35,Math.sin(a));uv.push(i/sides*2,y*6);col.push(color[0],color[1],color[2]);}});
 const row=sides+1;for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){const q=j*row+i;idx.push(q,q+row,q+1,q+1,q+row,q+row+1);}
 return fromArrays(pos,nor,uv,col,idx);
}

function conifer({seed,radius,tiers,perTier,droop,pointed=.9,core=.46,open=false}){
 const r=rnd(seed),a={pos:[],nor:[],uv:[],col:[],idx:[]};
 for(let t=0;t<tiers;t++){
  const f=t/(tiers-1),y=.03+Math.pow(f,1.06)*.955,reach=radius*Math.pow(1-f*.985,pointed)*(.86+.34*Math.sin(t*2.7+seed))+.01,n=Math.max(4,Math.round(perTier*(1-f*.5)));
  for(let i=0;i<n;i++){
   if(open&&(f<.14||r()<.35+.25*(.5+.5*Math.sin(t*1.9+seed))))continue;   // gaps between limbs, a bare lower trunk
   const yaw=(i+r()*.8)/n*Math.PI*2+t*2.399,len=reach*(.95+r()*.55),w=Math.max(.03,reach*(.85+r()*.35)),dr=droop+(r()-.5)*.3,start=[Math.cos(yaw)*reach*.12,y,Math.sin(yaw)*reach*.12];
   // a skirt card, outward and down, its face turned out; the lowest reach the ground
   addBranch(a,start,yaw,len,w,dr,.1,(r()-.5)*.5,2,.78+r()*.4);
   // every other one a card on edge, so the outline stays jagged from every side
   if(i%2===0)addBranch(a,[start[0],y+.004,start[2]],yaw+.35,len*.95,w*.7,dr*.7,.12,Math.PI/2+(r()-.5)*.7,2,.7+r()*.3);
  }
 }
 const leaf=fromArrays(a.pos,a.nor,a.uv,a.col,a.idx);
 if(open)return {leaf,wood:lathe([[0,.016],[.3,.012],[.65,.008],[.97,.002]],6,[.2,.14,.09])};
 const dark=[.022,.034,.02],R=radius*core,inner=lathe([[0,R],[.25,R*.72],[.5,R*.42],[.7,R*.16],[.8,.002]],7,dark);
 return {leaf,wood:inner};
}

// A juniper as the May frames show it: uneven masses of short shaggy sprays round a dark middle, down to the ground, one to three tips. No two sides alike.
function juniperForm({seed,radius,clumps,pointed=1.25,tips=1,sprays=4}){
 const r=rnd(seed),a={pos:[],nor:[],uv:[],col:[],idx:[]},p1=r()*6.283,p2=r()*6.283,tip=[];
 for(let i=0;i<tips;i++){const y=r()*6.283,d=i?radius*(.3+r()*.25):0;tip.push([Math.cos(y)*d,Math.sin(y)*d,i?.72+r()*.18:1]);}
 for(let c=0;c<clumps;c++){
  const f=Math.pow(r(),.92),t=tip[Math.floor(r()*tips)],y0=f*t[2],Rm=radius*Math.pow(Math.max(0,1-f),1/pointed)*(1+.1*Math.sin(c*.7)),yaw=r()*6.283,lobes=1+.15*Math.sin(2*yaw+p1+f*3)+.1*Math.sin(5*yaw+p2),
   dist=Rm*(.68+.3*r())*lobes,cx=t[0]*f+Math.cos(yaw)*dist,cz=t[1]*f+Math.sin(yaw)*dist,cy=Math.max(.012,y0),size=(.105+r()*.07)*(1-f*.45),shade=.74+r()*.42;
  for(let k=0;k<sprays;k++){
   const ya=yaw+(r()-.5)*2.4,up=.35+r()*.95;
   addBranch(a,[cx,cy,cz],ya,size*(.8+r()*.35),size*(1.05+r()*.35),-up,.1,(r()-.5)*.7,1,shade,FLAME);
  }
 }
 return a;
}
function juniper(opts){const a=juniperForm(opts),R=opts.radius*.6,leaf=fromArrays(a.pos,a.nor,a.uv,a.col,a.idx);return {leaf,wood:lathe([[0,R*.9],[.25,R*.9],[.5,R*.55],[.68,R*.22],[.76,.002]],7,[.03,.036,.016])};}
const FLAME={u0:0,u1:1,v0:0,v1:1};
// A soft flame of juniper foliage: fine scaly strokes, dark olive at the base going to yellow at the tips.
function flameTexture(seed){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=rnd(seed);g.clearRect(0,0,256,256);g.lineCap='round';
 // a solid flame first, ragged at the edge, so it covers what's behind it at any distance
 g.fillStyle='rgb(66,78,34)';g.beginPath();g.moveTo(128,252);for(let k=0;k<=24;k++){const t=k/24,w=Math.pow(Math.sin(Math.PI*Math.pow(Math.min(1,t*.97+.03),.72)),.8)*108+3;g.lineTo(128-w*(.82+r()*.3),250-t*234);}for(let k=24;k>=0;k--){const t=k/24,w=Math.pow(Math.sin(Math.PI*Math.pow(Math.min(1,t*.97+.03),.72)),.8)*108+3;g.lineTo(128+w*(.82+r()*.3),250-t*234);}g.closePath();g.fill();
 for(let i=0;i<260;i++){
  const t=Math.pow(r(),.75),half=(1-t)*(1-t*.15)*96+6,x=128+(r()-.5)*2*half,y=250-t*226,a=-Math.PI/2+(x-128)/128*.9+(r()-.5)*.7,l=14+r()*22,tone=t+(r()-.5)*.5;
  const col=tone<.35?[58,70,30]:tone<.7?[92,108,46]:[150,162,72];g.strokeStyle=`rgb(${col[0]+r()*16|0},${col[1]+r()*16|0},${col[2]+r()*12|0})`;g.lineWidth=2.2+r()*3;
  g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
 }
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
 for(let i=0;i<220;i++){const a=r()*6.283,d=Math.sqrt(r())*118,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d,s=5+r()*7,k=r();
  const tone=k<.33?[127,168,60]:k<.72?[159,200,74]:[184,212,90];g.fillStyle=`rgb(${tone[0]+r()*16|0},${tone[1]+r()*14|0},${tone[2]+r()*14|0})`;
  g.save();g.translate(x,y);g.rotate(r()*6.283);g.beginPath();g.ellipse(0,0,s,s*.72,0,0,6.283);g.fill();g.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function aspen({seed}){
 const r=rnd(seed),pos=[],nor=[],uv=[],col=[],idx=[];
 const clumps=[];for(let i=0;i<36;i++){const y=.26+r()*.7,sp=.2*(1-Math.abs(y-.58)*1.15),a=r()*6.283;clumps.push([Math.cos(a)*sp*(.25+r()*.9),y,Math.sin(a)*sp*(.25+r()*.9),.045+r()*.035]);}
 clumps.push([0,.93,0,.05]);
 const card=(cx,cy,cz,nx,ny,nz,s,shade)=>{const q=pos.length/3,u=[r()-.5,r()-.5,r()-.5],lu=Math.hypot(...u)||1;u.forEach((_,i)=>u[i]/=lu);
  const v=[u[1]*nz-u[2]*ny,u[2]*nx-u[0]*nz,u[0]*ny-u[1]*nx],lv=Math.hypot(...v)||1;v.forEach((_,i)=>v[i]/=lv);
  for(const [e,f] of [[-1,-1],[1,-1],[-1,1],[1,1]]){pos.push(cx+(u[0]*e+v[0]*f)*s,cy+(u[1]*e+v[1]*f)*s,cz+(u[2]*e+v[2]*f)*s);nor.push(nx,ny,nz);uv.push((e+1)/2,(f+1)/2);col.push(shade,shade,shade);}
  idx.push(q,q+1,q+2,q+1,q+3,q+2);};
 for(const [x,y,z,R] of clumps)for(let i=0;i<12;i++){let dx=r()-.5,dy=r()-.5,dz=r()-.5;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const out=Math.cbrt(r());const ox=x*.6+dx*.5,oy=.45+dy*.5,oz=z*.6+dz*.5,ol=Math.hypot(ox,oy,oz)||1;card(x+dx*R*out,y+dy*R*out*.9,z+dz*R*out,ox/ol,oy/ol,oz/ol,.026+r()*.016,.58+out*.5);}
 const leaf=fromArrays(pos,nor,uv,col,idx);
 const white=[1,1,1],parts=[lathe([[0,.021],[.3,.015],[.65,.0095],[.97,.003]],6,white)];
 for(let i=0;i<11;i++){const y=.3+i*.058,a=r()*6.283,l=.08+r()*.07,g=lathe([[0,.0075],[l,.002]],4,white);g.rotateZ(-.62-r()*.35);g.rotateY(a);g.translate(0,y,0);parts.push(g);}
 return {leaf,wood:mergeGeometries(parts)};
}

// Loads the pictures, builds each kind. -> [{name,label,defaultHeight,root,parts,soften,shape,sink,sway}], index in TREE_KINDS order.
export async function buildTreeSpecies(baseUrl){
 const {scene:bush}=await new GLTFLoader().loadAsync(new URL('../models/big-bush.glb?v=bb3',import.meta.url).href);
 bush.updateMatrixWorld(true);
 let bushMesh=null;bush.traverse(o=>{if(o.isMesh)bushMesh=o;});
 const branch=bushMesh.material.map;branch.anisotropy=4;
 const bark=await new THREE.TextureLoader().loadAsync(new URL('../trees/tex/birch_color.jpg',import.meta.url).href);bark.wrapS=bark.wrapT=THREE.RepeatWrapping;bark.colorSpace=THREE.SRGBColorSpace;
 const needle=(color)=>new THREE.MeshStandardMaterial({map:branch,color,alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
 const coreMat=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'core'});
 const pack=(name,label,defaultHeight,g,leafMat,woodMat,extra)=>{const root=new THREE.Group(),L=new THREE.Mesh(g.leaf,leafMat),W=new THREE.Mesh(g.wood,woodMat);root.add(W,L);return {name,label,defaultHeight,height:1,root,parts:[{geometry:g.wood,material:woodMat},{geometry:g.leaf,material:leafMat}],soften:.3,spec:.12,...extra};};
 const lump={lump:.09,mix:.8,dark:.8,tip:.5,olive:.22,branchDark:.2,under:.2,glow:.12};
 const out=[];
 out.push(pack('fir','Full fir',22,conifer({seed:4101,radius:.27,tiers:24,perTier:9,droop:.72,pointed:.72}),needle(0x667a4e),coreMat(),{shape:lump,sway:.05}));
 out.push(pack('spruce','Narrow spruce',24,conifer({seed:4202,radius:.235,tiers:27,perTier:7,droop:.85,pointed:.7}),needle(0x567064),coreMat(),{shape:lump,sway:.05}));
 out.push(pack('fir_small','Young fir',9,conifer({seed:4303,radius:.38,tiers:15,perTier:9,droop:.62,pointed:.78}),needle(0x6c8052),coreMat(),{shape:{...lump,lump:.13},sway:.08}));
 // Junipers: the sprays are the branch picture of the big bush model; that model stays in the catalog as its own object.
 const flame=flameTexture(66),juniperMat=()=>{const m=needle(0xffffff);m.map=flame;return m;};
 out.push(pack('juniper','Round juniper',4,juniper({seed:4404,radius:.4,clumps:170,tips:2}),juniperMat(),coreMat(),{shape:{...lump,lump:.09,dark:.62,tip:.42,olive:.05},coverage:true,wideBase:1.3,sway:.1}));
 {const g=aspen({seed:4505}),leafMat=new THREE.MeshStandardMaterial({map:leafTexture(77),color:0xb4c47e,alphaTest:.45,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'}),trunk=new THREE.MeshStandardMaterial({map:bark,color:0xf6f6ec,vertexColors:true,roughness:1,metalness:0,name:'bark'});
  out.push(pack('aspen','Lime aspen',12,g,leafMat,trunk,{shape:{...lump,lump:.06,dark:.5,tip:.3,olive:0,under:0,glow:0},coverage:true,sway:.2}));}
 out.push(pack('open_fir','Open fir',18,conifer({seed:4606,radius:.25,tiers:14,perTier:8,droop:.6,pointed:.62,open:true}),needle(0x74864f),coreMat(),{shape:lump,sway:.06}));
 out.push(pack('juniper_column','Column juniper',7,juniper({seed:4707,radius:.2,clumps:170,pointed:1.7,tips:1,sprays:3}),juniperMat(),coreMat(),{shape:{...lump,lump:.08,dark:.62,tip:.42,olive:.05},coverage:true,sway:.07}));

 out.push(pack('juniper_low','Low spreading juniper',3.5,juniper({seed:4808,radius:.8,clumps:190,pointed:1.05,tips:3}),juniperMat(),coreMat(),{shape:{...lump,lump:.09,dark:.62,tip:.42,olive:.05},coverage:true,sway:.1}));
 {const g=snag({seed:4909}),m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),root=new THREE.Group();root.add(new THREE.Mesh(g,m));
  out.push({name:'snag',label:'Dead snag',defaultHeight:7,height:1,root,parts:[{geometry:g,material:m}],soften:.1,spec:.1,sway:.02});}
 return out;
}
