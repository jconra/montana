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

function conifer({seed,radius,tiers,perTier,droop,pointed=.9,core=.46,open=false,dead=0}){
 const r=rnd(seed),a={pos:[],nor:[],uv:[],col:[],idx:[]};
  const layers=Math.max(7,Math.round(tiers*.34)),p0=seed*.7,crown=(y,c=0)=>{const u=y*layers+.6*Math.sin(c*2+p0);return Math.max(.002,radius*1.02*Math.pow(1-y*.99,pointed)*(.68+.5*(1-(u-Math.floor(u))))*(1+.14*Math.sin(c*3+p0+y*5)));};
 if(!open)tuftLayer(a,r,crown,{count:Math.round(tiers*perTier*1.5),size:Math.max(.03,radius*.3),up:[-.5,.5],shade:[.72,1.2],tiers:layers});
 else for(let t=0;t<tiers;t++){const f=t/(tiers-1),y=.05+f*.94,reach=radius*Math.pow(1-f*.985,pointed)*(.86+.3*Math.sin(t*2.7+seed))+.008,n=Math.max(3,Math.round(perTier*(1-f*.55)));
  for(let i=0;i<n;i++){if(f<.14||r()<.12+.2*(.5+.5*Math.sin(t*1.9+seed)))continue;const yaw=(i+r()*.8)/n*Math.PI*2+t*2.399,limb=reach*(.74+r()*r()*.55);for(let k=1;k<=3;k++){const d=limb*k/3*.95,len=Math.max(.05,Math.min(.1,limb*.7));addBranch(a,[Math.cos(yaw)*d,y-d*.25,Math.sin(yaw)*d],yaw+(r()-.5)*.7,len,len,droop*.5,0,(r()-.5)*.6,1,.72+r()*.4,FLAME);}}}
 const leaf=fromArrays(a.pos,a.nor,a.uv,a.col,a.idx);
 if(open)return {leaf,wood:lathe([[0,.016],[.3,.012],[.65,.008],[.97,.002]],6,[.2,.14,.09])};
 const inner=crownShell({profile:y=>Math.max(.002,radius*.74*Math.pow(1-y*.99,pointed)),seed:seed+3,tufts:40,lobes:8,rows:18,sides:14,tile:9});
 return {leaf,wood:dead?mergeGeometries([inner,trunk(dead,seed)]):inner};
}
// Grey dead limbs and a bare grey trunk showing under the crown, as on the tall forest firs.
function trunk(limbs,seed){const r=rnd(seed+9),grey=[.22,.21,.195],parts=[lathe([[0,.012],[.34,.009]],5,grey)];for(let i=0;i<limbs;i++){const l=.05+r()*.075,g=lathe([[0,.0035],[l*.6,.002],[l,.0006]],3,grey);g.rotateZ(-1.1-r()*.9);g.rotateY(r()*6.283);g.translate(0,.05+r()*.3,0);parts.push(g);}return mergeGeometries(parts);}

// A juniper as the census crops show it: a solid dense mass to the ground, fine lumpy surface, with short sprays on it for a soft broken edge.
// Overlapping tufts cut from real crown pictures, tips up and out, laid over a dark inner mass that closes every gap. The tufts make the lumpy opaque surface and the soft edge; larger ones are the lobes.
function tuftLayer(a,r,profile,{count,size,up=[.35,1.25],shade=[.72,1.12],tiers=0}){
 for(let i=0;i<count;i++){const y=Math.pow(r(),.82)*.985,yaw=r()*6.283,R=profile(y,yaw),big=r()<.14?1.55:1,sz=size*(.72+r()*.56)*big,lift=up[0]+r()*(up[1]-up[0]),cy=Math.cos(yaw),sy=Math.sin(yaw);
  addBranch(a,[cy*R*.8,Math.max(.012,y-sz*.3),sy*R*.8],yaw+(r()-.5)*.9,sz,sz*(1+r()*.35),-lift,.08,(r()-.5)*.9,1,(shade[0]+r()*(shade[1]-shade[0]))*(.8+y*.3)*(tiers?.72+.56*(1-((y*tiers+.6*Math.sin(yaw*2))%1)):1),FLAME);}
}
function juniper({seed,radius,pointed=1.25,egg=0,count=520,size=.1}){
 const r=rnd(seed+1),a={pos:[],nor:[],uv:[],col:[],idx:[]},own=[r()*6.283,r()*6.283],
  base=y=>Math.max(.002,radius*(egg?Math.pow(Math.max(0,1-Math.pow(y,egg)),.62):Math.pow(Math.max(0,1-y),1/pointed)*Math.min(1,.72+y*2.4))),
  // no two plants one shape: big masses bulge out and bite in round the crown, more so toward the top
  profile=(y,c=0)=>base(y)*(1+(.13+.3*y)*Math.sin(c*2+own[0]+y*3.1)+(.1+.16*y)*Math.sin(c*3+own[1]-y*7.3)+.09*Math.sin(c*5+own[0]*2+y*13));
 tuftLayer(a,r,profile,{count,size});
 return {leaf:fromArrays(a.pos,a.nor,a.uv,a.col,a.idx),wood:crownShell({profile:(y,c)=>profile(y,c)*.84,seed:seed+3,tufts:50,lobes:9,rows:16,sides:18,tile:4})};
}
const FLAME={u0:0,u1:1,v0:0,v1:1};
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
  const tone=k<.33?[116,146,60]:k<.72?[146,172,72]:[174,192,92];g.fillStyle=`rgb(${tone[0]+r()*16|0},${tone[1]+r()*14|0},${tone[2]+r()*14|0})`;
  g.save();g.translate(x,y);g.rotate(r()*6.283);g.beginPath();g.ellipse(0,0,s,s*.72,0,0,6.283);g.fill();g.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function aspen({seed}){
 const r=rnd(seed),pos=[],nor=[],uv=[],col=[],idx=[];
 // Stems of one clone: thin, white, leaning a little apart, sharing a crown.
 const stems=[];for(let i=0;i<5;i++){const a=r()*6.283,d=i?.03+r()*.1:0;stems.push({x:Math.cos(a)*d,z:Math.sin(a)*d,lx:Math.cos(a)*(.07+r()*.13),lz:Math.sin(a)*(.07+r()*.13),h:i?.62+r()*.33:1,th:i?.004+r()*.0025:.006});}
 const clumps=[];for(let i=0;i<150;i++){const s=stems[Math.floor(r()*stems.length)],t=.3+r()*.7,y=t*s.h,sp=.24*(1-Math.abs(t-.58)*1.1),a=r()*6.283;clumps.push([s.x+s.lx*t+Math.cos(a)*sp*(.3+r()),y,s.z+s.lz*t+Math.sin(a)*sp*(.3+r()),.05+r()*.04]);}
 const card=(cx,cy,cz,nx,ny,nz,s,shade)=>{const q=pos.length/3,u=[r()-.5,r()-.5,r()-.5],lu=Math.hypot(...u)||1;u.forEach((_,i)=>u[i]/=lu);
  const v=[u[1]*nz-u[2]*ny,u[2]*nx-u[0]*nz,u[0]*ny-u[1]*nx],lv=Math.hypot(...v)||1;v.forEach((_,i)=>v[i]/=lv);
  for(const [e,f] of [[-1,-1],[1,-1],[-1,1],[1,1]]){pos.push(cx+(u[0]*e+v[0]*f)*s,cy+(u[1]*e+v[1]*f)*s,cz+(u[2]*e+v[2]*f)*s);nor.push(nx,ny,nz);uv.push((e+1)/2,(f+1)/2);col.push(shade,shade,shade);}
  idx.push(q,q+1,q+2,q+1,q+3,q+2);};
 for(const [x,y,z,R] of clumps)for(let i=0;i<8;i++){let dx=r()-.5,dy=r()-.5,dz=r()-.5;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;const out=Math.cbrt(r());const ox=x*.6+dx*.5,oy=.45+dy*.5,oz=z*.6+dz*.5,ol=Math.hypot(ox,oy,oz)||1;card(x+dx*R*out,y+dy*R*out*.9,z+dz*R*out,ox/ol,oy/ol,oz/ol,.022+r()*.012,.6+out*.5);}
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
 const firLeaf=c=>{const m=needle(c);m.map=firTuft;m.color.multiplyScalar(2.3);return m;};
 const lump={lump:.05,mix:.8,dark:.38,tip:.3,olive:0,branchDark:.2,under:.2,glow:.12};
 const out=[];
 out.push(pack('fir','Full fir',22,conifer({seed:4101,radius:.21,tiers:36,perTier:8,droop:.62,pointed:.85,dead:16}),firLeaf(0xffffff),crownMat(firTile),{shape:lump,sway:.05}));
 out.push(pack('spruce','Narrow spruce',24,conifer({seed:4202,radius:.19,tiers:38,perTier:7,droop:.72,pointed:.85,dead:14}),firLeaf(0xe8ecf0),crownMat(firTile),{shape:lump,sway:.05}));
 out.push(pack('fir_small','Young fir',9,conifer({seed:4303,radius:.38,tiers:22,perTier:9,droop:.5,pointed:.78}),firLeaf(0xfff8e4),crownMat(firTile),{shape:{...lump,lump:.13},sway:.08}));
 // Junipers: the sprays are the branch picture of the big bush model; that model stays in the catalog as its own object.
 out.push(pack('juniper','Round juniper',4,juniper({seed:4404,radius:.47,egg:2.1}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.25,olive:0},soften:.15,coverage:true,wideBase:1.3,sway:.1}));
 {const g=aspen({seed:4505}),leafMat=new THREE.MeshStandardMaterial({map:(()=>{const t=leafTexture(77);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})(),color:0xf0f0e0,alphaTest:.45,side:THREE.DoubleSide,roughness:1,metalness:0,vertexColors:true,name:'leaf'}),trunk=new THREE.MeshStandardMaterial({map:bark,color:0xf6f6ec,vertexColors:true,roughness:1,metalness:0,name:'bark'});
  out.push(pack('aspen','Lime aspen',12,g,leafMat,trunk,{shape:{...lump,lump:.06,dark:.5,tip:.3,olive:0,under:0,glow:0},coverage:true,sway:.2}));}
 out.push(pack('open_fir','Open fir',18,conifer({seed:4606,radius:.25,tiers:20,perTier:8,droop:.5,pointed:.62,open:true}),firLeaf(0xfff4dc),coreMat(),{shape:lump,sway:.06}));
 out.push(pack('juniper_column','Column juniper',7,juniper({seed:4707,radius:.28,pointed:1.5,count:440,size:.075}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.25,olive:0},soften:.15,coverage:true,sway:.07}));

 out.push(pack('juniper_low','Low spreading juniper',3.5,juniper({seed:4808,radius:.72,egg:1.5,count:640,size:.11}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.25,olive:0},soften:.15,coverage:true,sway:.1}));
 {const g=snag({seed:4909}),m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,name:'bark'}),root=new THREE.Group();root.add(new THREE.Mesh(g,m));
  out.push({name:'snag',label:'Dead snag',defaultHeight:7,height:1,root,parts:[{geometry:g,material:m}],soften:.1,spec:.1,sway:.02});}
 out.push(pack('juniper_cone','Broad cone juniper',5,juniper({seed:5001,radius:.39,pointed:1.2}),juniperMat(),crownMat(juniperTile),{shape:{...lump,lump:.05,dark:.62,branchDark:0,tip:.25,olive:0},soften:.15,coverage:true,sway:.09}));
 return out;
}
