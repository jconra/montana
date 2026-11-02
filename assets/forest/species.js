// THE PROPERTY'S TREES, built from cards at load: a tree is a dark inner shape that closes the view through it and cards of
// foliage on the outside, so it stays solid to the ground like the real ones, for about a tenth of the triangles of the
// old generated pines. All are one unit high with their base at y = 0; a placement's scale is then its height in metres.
// The needle picture is the branch texture of the big bush model; the juniper is that model itself.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function rnd(seed){let s=seed>>>0||1;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
const SPRAY={u0:.05,u1:.95,v0:.74,v1:.01};       // the spray in the branch picture: base (v0) to tip (v1)

function fromArrays(pos,nor,uv,col,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);return g;}

// A ribbon of `segs` quads from `at` outward along `yaw`, dropping as it goes; `roll` turns it about its own length.
function addBranch(a,at,yaw,len,width,droop,curve,roll,segs,shade){
 const {pos,nor,uv,col,idx}=a,base=pos.length/3,cy=Math.cos(yaw),sy=Math.sin(yaw);let x=0,y=0,ang=droop;
 const side=[-sy*Math.cos(roll),Math.sin(roll),cy*Math.cos(roll)];
 for(let i=0;i<=segs;i++){
  const t=i/segs,w=width*.5*(1-t*.45),px=at[0]+cy*x,pz=at[2]+sy*x,py=at[1]+y,v=SPRAY.v0+(SPRAY.v1-SPRAY.v0)*t;
  for(const e of [-1,1]){pos.push(px+side[0]*w*e,py+side[1]*w*e,pz+side[2]*w*e);const nx=cy*.75,nz=sy*.75,ny=.65,l=Math.hypot(nx,ny,nz);nor.push(nx/l,ny/l,nz/l);uv.push(e<0?SPRAY.u0:SPRAY.u1,v);const c=shade*(.72+.28*t);col.push(c,c,c);}
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

function conifer({seed,radius,tiers,perTier,droop,pointed=.9,core=.46}){
 const r=rnd(seed),a={pos:[],nor:[],uv:[],col:[],idx:[]};
 for(let t=0;t<tiers;t++){
  const f=t/(tiers-1),y=.03+Math.pow(f,1.06)*.955,reach=radius*Math.pow(1-f*.985,pointed)+.01,n=Math.max(4,Math.round(perTier*(1-f*.5)));
  for(let i=0;i<n;i++){
   const yaw=(i+r()*.8)/n*Math.PI*2+t*2.399,len=reach*(.95+r()*.55),w=Math.max(.03,reach*(.85+r()*.35)),dr=droop+(r()-.5)*.3,start=[Math.cos(yaw)*reach*.12,y,Math.sin(yaw)*reach*.12];
   // a skirt card, outward and down, its face turned out; the lowest reach the ground
   addBranch(a,start,yaw,len,w,dr,.1,(r()-.5)*.5,2,.78+r()*.4);
   // every other one a card on edge, so the outline stays jagged from every side
   if(i%2===0)addBranch(a,[start[0],y+.004,start[2]],yaw+.35,len*.95,w*.7,dr*.7,.12,Math.PI/2+(r()-.5)*.7,2,.7+r()*.3);
  }
 }
 const leaf=fromArrays(a.pos,a.nor,a.uv,a.col,a.idx);
 const dark=[.012,.02,.012],R=radius*core,inner=lathe([[0,R],[.25,R*.8],[.5,R*.55],[.75,R*.28],[.92,.002]],7,dark);
 return {leaf,wood:inner};
}

function leafTexture(seed){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=rnd(seed);
 g.clearRect(0,0,256,256);
 for(let i=0;i<340;i++){const a=r()*6.283,d=Math.sqrt(r())*110,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d,s=6+r()*8,k=r();
  g.fillStyle=`rgb(${(k<.25?110:148)+r()*26|0},${(k<.25?150:190)+r()*20|0},${(k<.25?38:48)+r()*18|0})`;
  g.save();g.translate(x,y);g.rotate(r()*6.283);g.beginPath();g.ellipse(0,0,s,s*.72,0,0,6.283);g.fill();g.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function aspen({seed}){
 const r=rnd(seed),pos=[],nor=[],uv=[],col=[],idx=[];
 const clumps=[];for(let i=0;i<12;i++){const y=.38+r()*.54,sp=.1*(1-Math.abs(y-.6)*.9),a=r()*6.283;clumps.push([Math.cos(a)*sp*(.3+r()*.9),y,Math.sin(a)*sp*(.3+r()*.9),.06+r()*.035]);}
 clumps.push([0,.93,0,.05]);
 const card=(cx,cy,cz,nx,ny,nz,s,shade)=>{const q=pos.length/3,u=[r()-.5,r()-.5,r()-.5],lu=Math.hypot(...u)||1;u.forEach((_,i)=>u[i]/=lu);
  const v=[u[1]*nz-u[2]*ny,u[2]*nx-u[0]*nz,u[0]*ny-u[1]*nx],lv=Math.hypot(...v)||1;v.forEach((_,i)=>v[i]/=lv);
  for(const [e,f] of [[-1,-1],[1,-1],[-1,1],[1,1]]){pos.push(cx+(u[0]*e+v[0]*f)*s,cy+(u[1]*e+v[1]*f)*s,cz+(u[2]*e+v[2]*f)*s);nor.push(nx,ny,nz);uv.push((e+1)/2,(f+1)/2);col.push(shade,shade,shade);}
  idx.push(q,q+1,q+2,q+1,q+3,q+2);};
 for(const [x,y,z,R] of clumps)for(let i=0;i<20;i++){let dx=r()-.5,dy=r()-.5,dz=r()-.5;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const out=Math.cbrt(r());const ox=x*.6+dx*.5,oy=.45+dy*.5,oz=z*.6+dz*.5,ol=Math.hypot(ox,oy,oz)||1;card(x+dx*R*out,y+dy*R*out*.9,z+dz*R*out,ox/ol,oy/ol,oz/ol,.036+r()*.022,.62+out*.42);}
 const leaf=fromArrays(pos,nor,uv,col,idx);
 const white=[1,1,1],parts=[lathe([[0,.0125],[.3,.0095],[.65,.0065],[.97,.002]],6,white)];
 for(let i=0;i<7;i++){const y=.36+i*.075,a=r()*6.283,l=.1+r()*.08,g=lathe([[0,.0055],[l,.0015]],4,white);g.rotateZ(-.72-r()*.3);g.rotateY(a);g.translate(0,y,0);parts.push(g);}
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
 const lump={lump:.07,mix:.8,dark:.88,tip:.3,olive:.1,branchDark:.2,under:.15,glow:.12};
 const out=[];
 out.push(pack('fir','Full fir',22,conifer({seed:4101,radius:.225,tiers:24,perTier:9,droop:.82}),needle(0x45604a),coreMat(),{shape:lump,sway:.05}));
 out.push(pack('spruce','Narrow spruce',24,conifer({seed:4202,radius:.175,tiers:27,perTier:7,droop:.98,pointed:.8}),needle(0x3f5a50),coreMat(),{shape:lump,sway:.05}));
 out.push(pack('fir_small','Young fir',9,conifer({seed:4303,radius:.32,tiers:15,perTier:9,droop:.7,pointed:1}),needle(0x4d6a50),coreMat(),{shape:{...lump,lump:.13},sway:.08}));
 // The big bush model, its stem sunk into the ground, and a dark inside so its hanging cards read as one mass.
 {const bounds=new THREE.Box3().setFromObject(bush),h=bounds.max.y-bounds.min.y;
  const g=bushMesh.geometry.clone().applyMatrix4(bushMesh.matrixWorld);g.translate(0,-bounds.min.y,0);g.scale(1/h,1/h,1/h);
  const n=g.attributes.position.count,c=new Float32Array(n*3).fill(1);g.setAttribute('color',new THREE.BufferAttribute(c,3));
  const inner=lathe([[.1,.05],[.3,.13],[.55,.13],[.78,.07],[.9,.02]],7,[.012,.022,.012]);
  const m=new THREE.MeshStandardMaterial({map:branch,color:0x5f7c5e,alphaTest:.42,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'});
  out.push(pack('juniper','Round juniper',4,{leaf:g,wood:inner},m,coreMat(),{shape:{...lump,lump:.14},sink:.07,wideBase:1.3,sway:.1}));}
 {const g=aspen({seed:4505}),leafMat=new THREE.MeshStandardMaterial({map:leafTexture(77),alphaTest:.45,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'}),trunk=new THREE.MeshStandardMaterial({map:bark,color:0xe6e6da,vertexColors:true,roughness:1,metalness:0,name:'bark'});
  out.push(pack('aspen','Lime aspen',12,g,leafMat,trunk,{shape:{...lump,lump:.06,dark:.5,tip:.3,olive:0,under:0,glow:0},sway:.2}));}
 return out;
}
