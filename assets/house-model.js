// Shared house builder — used by the designer's live preview and by the terrain scene.
// Polygon-footprint spec (no more rectangular "shell"):
//   spec = {
//     floors: [ { outline:[[x,z],...], h:3, mats:{edgeIndex:matId},
//                 walls:[{x0,z0,x1,z1,mat}],           // interior partitions; on the TOP floor these become dormers
//                 openings:[ {on:'outline',edge,off,w,y0,y1,type} , {on:'wall',wi,off,w,y0,y1,type} ] } ],
//     roof:{style:'gable|hip|shed|flat',pitch,mat}, stairs:[{x,z,w,run,dir,floor}],
//     palette:[hex,...], colors:{wall,roof,trim}
//   }
// mats/mat are indices into palette. Wall groups & roof carry userData.surf for face-painting.
// Legacy {blocks:[...]} and older {floors:[{shell}]} specs are auto-converted.

export const VERSION = '38';   // bump on every house-model.js change; shown in the designer so we can confirm what's loaded

// ---------- procedural surface textures ----------------------------------------------------------
// Each pattern is a tileable GRAYSCALE luminance map; the swatch colour tints it (material.color
// multiplies the map). Shared by the designer's swatch thumbnails and the 3D build, so both match.
export const TEX_LIST = [
  {id:'',        name:'— none (flat colour) —'},
  {id:'wood',    name:'Wood plank (sideways boards)'},
  {id:'plaster', name:'Plaster (subtle noise)'},
  {id:'metal',   name:'Metal roof (standing seam)'},
  {id:'brick',   name:'Brick'},
  {id:'stone',   name:'Stone'},
  {id:'shingle', name:'Shingle'},
];
const TEX_REPEAT={wood:[2,2],plaster:[4,4],metal:[3,4],brick:[3,3],stone:[3,3],shingle:[4,4]}; // tiles per face (0..1 UV geometry)
const TEX_FEET  ={wood:4,plaster:6,metal:3,brick:2,stone:4,shingle:2};                          // feet per tile (world-UV geometry, e.g. floor slabs)
function _rng(seed){ let s=(seed>>>0)||1; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function _rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function paintTex(ctx,id,S){
  const rnd=_rng(1234);
  if(id==='wood'){
    const planks=4, ph=S/planks;
    for(let p=0;p<planks;p++){ const base=150+Math.floor(rnd()*45); ctx.fillStyle=`rgb(${base},${base},${base})`; ctx.fillRect(0,p*ph,S,ph);
      for(let i=0;i<44;i++){ const y=p*ph+rnd()*ph, a=0.04+rnd()*0.06; ctx.strokeStyle=`rgba(70,50,30,${a})`; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.bezierCurveTo(S*0.33,y+(rnd()-0.5)*5,S*0.66,y+(rnd()-0.5)*5,S,y); ctx.stroke(); }
      ctx.fillStyle='rgba(30,20,10,0.5)'; ctx.fillRect(0,p*ph,S,2); }                                   // plank seam
  } else if(id==='plaster'){
    ctx.fillStyle='rgb(236,236,236)'; ctx.fillRect(0,0,S,S);   // light base so a white tint reads near-white
    const n=Math.floor(S*S*0.45); for(let i=0;i<n;i++){ const x=rnd()*S,y=rnd()*S, v=rnd()<0.5?60:255, a=0.012+rnd()*0.016; ctx.fillStyle=`rgba(${v},${v},${v},${a})`; ctx.fillRect(x,y,2,2); }
  } else if(id==='metal'){
    ctx.fillStyle='rgb(158,161,166)'; ctx.fillRect(0,0,S,S);
    const seams=8, sw=S/seams;
    for(let i=0;i<=seams;i++){ const x=i*sw; const g=ctx.createLinearGradient(x-sw/2,0,x+sw/2,0);
      g.addColorStop(0,'rgba(255,255,255,0.10)'); g.addColorStop(0.5,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.12)');
      ctx.fillStyle=g; ctx.fillRect(x-sw/2,0,sw,S);
      ctx.fillStyle='rgba(40,45,50,0.7)'; ctx.fillRect(x-1,0,2,S);                                       // raised standing seam
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(x+1,0,1,S); }
  } else if(id==='brick'){
    ctx.fillStyle='rgb(115,115,115)'; ctx.fillRect(0,0,S,S);                                             // mortar
    const rows=8, bh=S/rows, bw=S/4;
    for(let r=0;r<rows;r++){ const off=(r%2)*bw/2;
      for(let c=-1;c<5;c++){ const b=150+Math.floor(rnd()*40); ctx.fillStyle=`rgb(${b},${b},${b})`; ctx.fillRect(c*bw+off+1.5,r*bh+1.5,bw-3,bh-3); } }
  } else if(id==='stone'){
    ctx.fillStyle='rgb(105,105,105)'; ctx.fillRect(0,0,S,S);
    for(let i=0;i<26;i++){ const b=140+Math.floor(rnd()*55); ctx.fillStyle=`rgb(${b},${b},${b})`;
      _rr(ctx,rnd()*S,rnd()*S,S*0.12+rnd()*S*0.16,S*0.1+rnd()*S*0.14,4); ctx.fill(); ctx.strokeStyle='rgba(55,55,55,0.4)'; ctx.stroke(); }
  } else if(id==='shingle'){
    ctx.fillStyle='rgb(118,118,118)'; ctx.fillRect(0,0,S,S);
    const rows=6, rh=S/rows, cols=6, cw=S/cols;
    for(let r=0;r<rows;r++){ const off=(r%2)*cw/2;
      for(let c=-1;c<=cols;c++){ const x=c*cw+off, y=r*rh, b=150+Math.floor(rnd()*40); ctx.fillStyle=`rgb(${b},${b},${b})`;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+cw,y); ctx.lineTo(x+cw,y+rh*0.7); ctx.quadraticCurveTo(x+cw/2,y+rh*1.15,x,y+rh*0.7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(50,50,50,0.35)'; ctx.stroke(); } }
  } else { ctx.fillStyle='rgb(160,160,160)'; ctx.fillRect(0,0,S,S); }
}
// 40px preview data-URL for a designer swatch (stays grayscale; swatch colour is applied via CSS blend)
export function texThumb(id,size){ size=size||40; const cv=document.createElement('canvas'); cv.width=cv.height=size;
  const ctx=cv.getContext('2d'); paintTex(ctx,id||'',size); return cv.toDataURL(); }
const _texCache={};
function makeMap(THREE,id,mode){ const key=id+'|'+(mode||'face'); if(_texCache[key]) return _texCache[key];
  const S=256, cv=document.createElement('canvas'); cv.width=cv.height=S; paintTex(cv.getContext('2d'),id,S);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; if('sRGBEncoding'in THREE) t.encoding=THREE.sRGBEncoding;
  if(mode==='world'){ const ft=TEX_FEET[id]||6; t.repeat.set(1/ft,1/ft); } else { const r=TEX_REPEAT[id]||[3,3]; t.repeat.set(r[0],r[1]); }
  _texCache[key]=t; return t; }
// rewrite a BoxGeometry's UVs into world feet, so a world-mode texture tiles evenly no matter the face size
function worldUVBox(geo, w,h,d){ const uv=geo.attributes.uv; if(!uv) return;
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];   // [uFeet,vFeet] per BoxGeometry face: +x,-x,+y,-y,+z,-z
  for(let f=0;f<6;f++){ const su=dims[f][0], sv=dims[f][1];
    for(let i=0;i<4;i++){ const k=f*4+i; uv.setX(k, uv.getX(k)*su); uv.setY(k, uv.getY(k)*sv); } }
  uv.needsUpdate=true; }

export function buildHouse(THREE, spec, opts){
  spec = normalize(spec); opts = opts || {};
  const g = new THREE.Group();
  const C = spec.colors || {};
  const PAL = (spec.palette && spec.palette.length) ? spec.palette
            : ['#6b5a45','#ffffff','#33363a','#8a6d4b','#aeb6bd','#241a12'];
  const defWall=C.wall||PAL[0], defRoof=C.roof||PAL[2], defTrim=C.trim||PAL[1], defInner=PAL[1];
  const pcol=(idx,fb)=> (idx==null||idx<0) ? fb : (PAL[idx]||fb);
  const PALTEX = spec.palTex || [];                                  // per-swatch texture id, parallel to palette

  const matCache={};
  const solid=(hex)=>{ if(!matCache[hex]) matCache[hex]=new THREE.MeshStandardMaterial({color:hex,roughness:1,flatShading:true,side:THREE.DoubleSide}); return matCache[hex]; };
  // material for a painted face: swatch colour tints an optional procedural texture.
  // mode 'face' = box faces (0..1 UV, tiles/face); 'world' = slabs (feet UV, tiles/foot).
  const swatchMat=(idx,fb,mode)=>{
    const hex=(idx==null||idx<0)?fb:(PAL[idx]||fb);
    const tex=(idx==null||idx<0)?'':(PALTEX[idx]||'');
    if(!tex) return solid(hex);
    const key='T|'+hex+'|'+tex+'|'+(mode||'face'); if(matCache[key]) return matCache[key];
    const metal=(tex==='metal');
    const m=new THREE.MeshStandardMaterial({color:hex,roughness:metal?0.5:1,metalness:metal?0.4:0,flatShading:false,side:THREE.DoubleSide});
    m.map=makeMap(THREE,tex,mode||'face'); matCache[key]=m; return m; };
  const M=(v)=> (v&&v.isMaterial)?v:solid(v);                        // accept a material OR a hex colour
  const WALL_T=0.5;                                                  // wall thickness (~6", units = feet)
  const winFrames = !!spec.windowFrames;                            // optional trim frame around each window
  const roofMat=new THREE.MeshStandardMaterial({color:defRoof,roughness:.6,metalness:.3,flatShading:true,side:THREE.DoubleSide});
  const trimMat=new THREE.MeshStandardMaterial({color:defTrim,roughness:1,flatShading:true,side:THREE.DoubleSide});
  const glassMat=new THREE.MeshStandardMaterial({color:0x2a3440,roughness:.2,metalness:.2,flatShading:true,transparent:true,opacity:.55});
  const doorMat=new THREE.MeshStandardMaterial({color:0x3a2c1e,roughness:.9,flatShading:true});

  const mesh=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;};
  const box=(w,h,d,x,y,z,mat)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const addTris=(verts,mat)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();g.add(new THREE.Mesh(geo,mat));};
  const triM=(a,b,c,mat)=>addTris([...a,...b,...c],mat);
  const quad=(a,b,c,d,mat)=>addTris([...a,...b,...c, ...a,...c,...d],mat);
  const P=(p,y)=>[p[0],y,p[1]];

  // ---- a wall between two points, openings punched out (off = metres from start point) ----
  function wallSeg(x0,z0,x1,z1, baseY,h, ops, wallColor, surf, inColor, outFace, butt){
    const dx=x1-x0, dz=z1-z0, len=Math.hypot(dx,dz); if(len<0.02) return;
    const wg=new THREE.Group(); wg.position.set((x0+x1)/2, baseY, (z0+z1)/2); wg.rotation.y=-Math.atan2(dz,dx);
    if(surf){ if(inColor!=null) surf.outFace=outFace; wg.userData.surf=surf; } g.add(wg);
    const t=WALL_T;
    // two-tone exterior wall: broad faces (+z=4, -z=5) get outside/inside colours; thin edges keep the outside colour
    // BoxGeometry material order is [ +x, -x, +y, -y, +z, -z ]
    const outM=M(wallColor);
    const inM=(inColor==null)?null:M(inColor);
    const wm = (inM==null) ? outM
      : [outM,outM,outM,outM, (outFace===4?outM:inM), (outFace===5?outM:inM)];
    // butt walls (outline corners) stop HALF a wall-width SHORT so a corner post fills the joint — no overlap, no z-fighting.
    // non-butt walls (partitions/dormers) still extend to bury their joint.
    const ext = butt ? -t/2 : t/2;
    const seg=(a,b,y0,y1,mat)=>{ const l=b-a; if(l<=0.002||y1-y0<=0.002) return;
      const geo=new THREE.BoxGeometry(l,y1-y0,t); worldUVBox(geo,l,y1-y0,t);   // world-feet UVs -> texture tiles evenly regardless of wall size
      const m=new THREE.Mesh(geo,mat); m.position.set((a+b)/2,(y0+y1)/2,0); wg.add(m); };
    const frame=(a,b,y0,y1)=>{ const fw=0.35, d=t+0.3, fo=0.06; a+=fo; b-=fo; y0+=fo; y1-=fo;   // lap the frame fo onto the opening so its inner edges aren't coplanar with the wall reveal (no z-fight)
      const cx=(a+b)/2, cy=(y0+y1)/2, w=b-a, hh=y1-y0;   // trim frame + centre mullion, proud of the wall
      const fb=(w2,h2,x,yy)=>{ const mf=new THREE.Mesh(new THREE.BoxGeometry(w2,h2,d),trimMat); mf.position.set(x,yy,0); wg.add(mf); };
      fb(fw, hh+2*fw, a-fw/2, cy); fb(fw, hh+2*fw, b+fw/2, cy);        // left + right jambs
      fb(w, fw, cx, y1+fw/2); fb(w, fw, cx, y0-fw/2);                  // head + sill
      fb(fw*0.55, hh, cx, cy); };                                     // centre mullion (the sliding-window divider)
    const os=(ops||[]).map(o=>{ const off=Math.max(0,Math.min(len-o.w,o.off));
      return {a:-len/2+off, b:-len/2+off+o.w, y0:o.y0, y1:Math.min(h,o.y1), type:o.type}; }).sort((p,q)=>p.a-q.a);
    let cur=-len/2-ext;
    for(const o of os){
      seg(cur,o.a,0,h, wm); seg(o.a,o.b,0,o.y0, wm); seg(o.a,o.b,o.y1,h, wm);
      if(o.type==='door'){                                    // real opening: swing the leaf aside so you can walk through
        const leaf=new THREE.Group(); leaf.position.set(o.a,(o.y0+o.y1)/2,0);
        const l=new THREE.Mesh(new THREE.BoxGeometry(o.b-o.a,o.y1-o.y0,0.15),doorMat); l.position.x=(o.b-o.a)/2; leaf.add(l);
        leaf.rotation.y=-1.9; wg.add(leaf);
      } else {                                                 // window: thin glass, sized JUST inside the frame opening and split around the mullion -> never intersects the frame
        const gi=0.09, gy0=o.y0+gi, gy1=o.y1-gi;
        const pane=(xa,xb)=>{ const gw=xb-xa, gh=gy1-gy0; if(gw>0.05&&gh>0.05){ const gm=new THREE.Mesh(new THREE.BoxGeometry(gw,gh,0.05),glassMat); gm.position.set((xa+xb)/2,(gy0+gy1)/2,0); wg.add(gm); } };
        if(winFrames){ frame(o.a,o.b,o.y0,o.y1); const mw=0.35*0.55, cx=(o.a+o.b)/2;   // two panes on either side of the centre mullion (matches a sliding window)
          pane(o.a+gi, cx-mw/2-gi); pane(cx+mw/2+gi, o.b-gi); }
        else pane(o.a+gi, o.b-gi);                              // frameless: one inset pane
      }
      cur=Math.max(cur,o.b);
    }
    seg(cur,len/2+ext,0,h, wm);
  }

  // ---- polygon floor slab / flat roof deck, with rectangular stairwell holes ----
  function slabPoly(outline, y, holes, mat, thick, surf){
    thick=thick||0.6;
    const sh=new THREE.Shape(); outline.forEach((p,i)=> i? sh.lineTo(p[0],-p[1]) : sh.moveTo(p[0],-p[1]));
    (holes||[]).forEach(ho=>{ const hp=new THREE.Path();
      const c = ho.poly ? ho.poly                                  // arbitrary cutout (open-to-below), or a rectangular stairwell
        : [[ho.x-ho.w/2,ho.z-ho.d/2],[ho.x+ho.w/2,ho.z-ho.d/2],[ho.x+ho.w/2,ho.z+ho.d/2],[ho.x-ho.w/2,ho.z+ho.d/2]];
      if(c.length<3) return;
      c.forEach((p,i)=> i? hp.lineTo(p[0],-p[1]) : hp.moveTo(p[0],-p[1])); sh.holes.push(hp); });
    const geo=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false});
    const m=new THREE.Mesh(geo, mat||trimMat); m.rotation.x=-Math.PI/2; m.position.y=y; if(surf) m.userData.surf=surf; g.add(m);
  }

  function centroid(o){ let sx=0,sz=0; o.forEach(p=>{sx+=p[0];sz+=p[1];}); return [sx/o.length, sz/o.length]; }
  function bboxOf(o){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; o.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}); return {x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0}; }

  // ---- a gabled dormer whose front is the given wall segment ----
  function dormer(w, baseY, floorH, ops, color, surf, outline){
    const x0=w.x0,z0=w.z0,x1=w.x1,z1=w.z1, L=Math.hypot(x1-x0,z1-z0); if(L<0.4) return;
    const ux=(x1-x0)/L, uz=(z1-z0)/L; let nx=-uz, nz=ux;
    const cen=centroid(outline), mx=(x0+x1)/2, mz=(z0+z1)/2;
    if((mx-cen[0])*nx+(mz-cen[1])*nz<0){ nx=-nx; nz=-nz; }     // face outward
    const ix=-nx, iz=-nz, depth=Math.min(5, L*0.9);
    const dH=Math.min(floorH,6), eave=baseY+dH, peak=eave+2.5;
    const FL=[x0,z0], FR=[x1,z1], BL=[x0+ix*depth,z0+iz*depth], BR=[x1+ix*depth,z1+iz*depth], midF=[mx,mz];
    const wm=M(color);
    wallSeg(x0,z0,x1,z1, baseY, dH, ops, color, surf);          // front (with window)
    wallSeg(FL[0],FL[1],BL[0],BL[1], baseY, dH, [], color, null);
    wallSeg(FR[0],FR[1],BR[0],BR[1], baseY, dH, [], color, null);
    triM(P(FL,eave),P(FR,eave),P(midF,peak), wm);               // front gable
    const RF=P(midF,peak), RB=P([midF[0]+ix*depth,midF[1]+iz*depth],peak);
    quad(RF, RB, P(BL,eave), P(FL,eave), roofMat);              // left slope
    quad(RF, P(FR,eave), P(BR,eave), RB, roofMat);              // right slope
  }

  // gable-fill above a wall segment: box top at y0, top edge follows the roof underside heights `tops`
  // (array of {t,y}, t in 0..1 along a->b, sorted) — so a wall crossing the ridge peaks in the middle.
  function infillWall(a,b, y0, tops, mat){
    const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz); if(len<0.05) return;
    const sh=new THREE.Shape(); sh.moveTo(-len/2,y0); sh.lineTo(len/2,y0);       // bottom edge
    for(let i=tops.length-1;i>=0;i--) sh.lineTo(-len/2+tops[i].t*len, Math.max(tops[i].y, y0+0.01));   // top edge, right->left
    sh.closePath();
    const geo=new THREE.ExtrudeGeometry(sh,{depth:WALL_T,bevelEnabled:false}); geo.translate(0,0,-WALL_T/2);
    const m=new THREE.Mesh(geo,mat); m.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2); m.rotation.y=-Math.atan2(dz,dx); g.add(m);
  }

  function roof(outline, topY, rs, sm){                        // sm = {pi} identifies which roof piece, for painting
    const pi = sm ? sm.pi : undefined;
    const pitch=rs.pitch??0.5, eave=2, style=rs.style||'gable', h=topY;
    const rmat = rs.mat!=null ? swatchMat(rs.mat,defRoof) : roofMat;
    if(style==='flat'){
      slabPoly(outline, topY, [], rmat, 0.6);
      for(let e=0;e<outline.length;e++){ const a=outline[e], b=outline[(e+1)%outline.length];
        wallSeg(a[0],a[1],b[0],b[1], topY, 1.5, [], defTrim, null); }
      return;
    }
    const {x,z,w,d}=bboxOf(outline);
    const rg=new THREE.Group(); rg.position.set(x,0,z); rg.userData.surf={kind:'roof',pi}; g.add(rg);
    let along=w>=d; if(rs.flipRidge) along=!along;              // ridge runs along the longer side by default; flipRidge turns it 90°
    const len=along?w:d, span=along?d:w;
    const rise=(span/2)*pitch, sln=Math.hypot(span/2+eave,rise), ang=Math.atan2(rise,span/2+eave);
    const sub=new THREE.Group(); sub.rotation.y=along?0:Math.PI/2; rg.add(sub);
    // one roof panel spanning eave -> ridge. s=+1 is the +z side, -1 the -z side.
    // ext extends the panel a touch PAST the ridge so the two sides cross and meet cleanly (no gap / no notch).
    const slope=(s,ext)=>{ ext=ext||0;
      const uz=-s*(span/2+eave)/sln, uy=rise/sln;             // unit vector, eave -> ridge
      const eaveZ=s*(span/2+eave), topZ=uz*ext, topY=(h+rise)+uy*ext;
      const cz=(eaveZ+topZ)/2, cy=(h+topY)/2;
      const m=new THREE.Mesh(new THREE.BoxGeometry(len+2*eave,0.4,sln+ext),rmat);
      m.position.set(0,cy,cz); m.rotation.x=s*ang; sub.add(m); };
    const gableEnd=(sx)=>{const eH=rise*eave/(span/2+eave); const shp=new THREE.Shape();   // top follows the roof rake (slope over span/2+eave) so it meets the roof with no gap
      shp.moveTo(-span/2,0); shp.lineTo(span/2,0); shp.lineTo(span/2,eH); shp.lineTo(0,rise); shp.lineTo(-span/2,eH); shp.closePath();  // paintable via roof.gableMat
      const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shp,{depth:0.5,bevelEnabled:false}),swatchMat(rs.gableMat,defWall,"world"));m.rotation.y=Math.PI/2;m.position.set(sx*len/2,h,-0.25);m.userData.surf={kind:'gable',pi};sub.add(m);};
    if(style==='shed'){
      const rise2=span*pitch*0.6, ang2=Math.atan2(rise2,span+eave), sll=Math.hypot(span+eave,rise2);
      const m=new THREE.Mesh(new THREE.BoxGeometry(len+2*eave,0.5,sll),rmat);m.position.set(0,h+rise2/2,0);m.rotation.x=ang2;sub.add(m);
      for(const sx of [-1,1]){const shp=new THREE.Shape();shp.moveTo(-span/2,0);shp.lineTo(span/2,0);shp.lineTo(span/2,rise2);shp.lineTo(-span/2,0);
        const t=new THREE.Mesh(new THREE.ExtrudeGeometry(shp,{depth:0.5,bevelEnabled:false}),swatchMat(rs.gableMat,defWall,"world"));t.rotation.y=Math.PI/2;t.position.set(sx*len/2,h,-0.25);t.userData.surf={kind:'gable'};sub.add(t);}
      return;
    }
    slope(1,0); slope(-1,0);                                   // panels now meet exactly along the ridge line
    if(style!=='hip'){ const cap=new THREE.Mesh(new THREE.BoxGeometry(len+2*eave,0.2,0.55),rmat); cap.position.set(0,h+rise-0.03,0); sub.add(cap); }   // ridge cap hides the seam between panels
    if(style==='hip'){
      const rl=Math.max(0.01,len-span), y0=h, y1=h+rise, Lx=len/2+eave, W=span/2+eave, R=rl/2;
      const Q=[[-Lx,y0,-W],[Lx,y0,-W],[Lx,y0,W],[-Lx,y0,W],[-R,y1,0],[R,y1,0]];
      const V=[], tri=(i,j,k)=>{for(const q of [i,j,k]) V.push(Q[q][0],Q[q][1],Q[q][2]);};
      tri(0,3,4); tri(1,4,2); tri(0,4,5); tri(0,5,1); tri(3,2,5); tri(3,5,4);
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(V,3)); geo.computeVertexNormals();
      sub.add(new THREE.Mesh(geo,rmat));
    } else { if(!rs.noGable){ gableEnd(-1); gableEnd(1); } }   // noGable: a wall-raising piece closes its ends with infill instead
  }

  function stairs(st, baseY, h){
    const run=st.run||10, w=st.w||3, n=Math.max(3,Math.round(h/0.65)), rise=h/n, tread=run/n;
    const dirs={N:[0,1],S:[0,-1],E:[1,0],W:[-1,0]}, [ux,uz]=dirs[st.dir||'N'];
    for(let i=0;i<n;i++){ const t=tread*(i+0.5)-run/2, cx=st.x+ux*t, cz=st.z+uz*t, sh=rise*(i+1);
      box(ux?tread:w, sh, ux?w:tread, cx, baseY+sh/2, cz, trimMat); }
  }

  // ---- assemble ----
  const F=spec.floors;
  const baseYs=[]; let acc=0; F.forEach(f=>{baseYs.push(acc); acc+=(f.h||10);});
  const holes=F.map(()=>[]);
  (spec.stairs||[]).forEach(st=>{ const fi=st.floor||0; if(fi+1<F.length){
    const horiz=(st.dir==='E'||st.dir==='W'); holes[fi+1].push({x:st.x,z:st.z,w:horiz?(st.run||10):(st.w||3),d:horiz?(st.w||3):(st.run||10)}); }});

  F.forEach((f,fi)=>{
    if(opts.upto!=null && fi>opts.upto) return;                    // level view: only build floors up to the selected one
    const o=f.outline, h=f.h||10, y=baseYs[fi], isTop=(fi===F.length-1), m=f.mats||{}, mi=f.matsIn||{};
    const cen=centroid(o);
    const slabHoles=[...holes[fi], ...(f.voids||[]).map(v=>({poly:v}))];   // stairwells + open-to-below cutouts
    slabPoly(o, y, slabHoles, swatchMat(f.floorMat, defTrim, 'world'), 0.6, {kind:'floor',floor:fi});   // paintable floor (wood, etc.)
    // which side is "outside" is set by the polygon winding — robust for concave shapes (a centroid test flips on a bay neck)
    let area2=0; for(let e=0;e<o.length;e++){ const a=o[e],b=o[(e+1)%o.length]; area2+=a[0]*b[1]-b[0]*a[1]; }
    const outFace = area2>0 ? 5 : 4;                                  // CCW -> exterior is local -z (face 5); CW -> +z (face 4)
    for(let e=0;e<o.length;e++){ const a=o[e], b=o[(e+1)%o.length];
      const ops=(f.openings||[]).filter(x=>x.on==='outline'&&x.edge===e);
      wallSeg(a[0],a[1],b[0],b[1], y,h, ops, swatchMat(m[e],defWall,'world'), {kind:'outline',floor:fi,edge:e}, swatchMat(mi[e],defInner,'world'), outFace, true); }   // butt=true: stop short for corner pieces
    for(let e=0;e<o.length;e++){ const v=o[e], p=o[(e-1+o.length)%o.length], n=o[(e+1)%o.length];   // corner piece filling each vertex
      const t1=Math.atan2(v[1]-p[1],v[0]-p[0]), t2=Math.atan2(n[1]-v[1],n[0]-v[0]);
      const turn=Math.abs(((t2-t1)*180/Math.PI+540)%360-180);        // 0 = straight, 90 = right angle
      const mat=swatchMat(m[e],defWall);
      if(turn<12){                                                    // ~straight (redundant vertex): just bridge the butt gap with a wall-aligned box — no visible post
        const fg=new THREE.BoxGeometry(WALL_T,h,WALL_T); worldUVBox(fg,WALL_T,h,WALL_T);
        const fm=new THREE.Mesh(fg, swatchMat(m[e],defWall,'world')); fm.position.set(v[0],y+h/2,v[1]); fm.rotation.y=-t2; g.add(fm); }
      else if(Math.abs(turn-90)<12) box(WALL_T,h,WALL_T,v[0],y+h/2,v[1],mat);                       // crisp square post at right angles
      else mesh(new THREE.CylinderGeometry(WALL_T*0.58,WALL_T*0.58,h,10),mat,v[0],y+h/2,v[1]); }    // round column fills 45°/odd corners with no gap or z-fight
    (f.walls||[]).forEach((w,wi)=>{
      const ops=(f.openings||[]).filter(x=>x.on==='wall'&&x.wi===wi);
      const surf={kind:'wall',floor:fi,wi};
      if(isTop && w.dormer) dormer(w, y, h, ops, swatchMat(w.mat,defWall,'world'), surf, o);   // dormer is now an opt-in per-wall flag
      else wallSeg(w.x0,w.z0,w.x1,w.z1, y,h, ops, swatchMat(w.mat,defInner,'world'), surf, swatchMat(w.matIn,defInner,'world'), 4, true);   // butt=true: stop short so a T-junction ends at the other wall's face, not through it
    });
    // posts only where two partitions share an endpoint (an interior corner). A T-junction into a wall's SIDE meets its face flush from the butt above, so it needs none.
    const near=(a,b)=>Math.abs(a[0]-b[0])<0.06 && Math.abs(a[1]-b[1])<0.06;
    const pend=[]; (f.walls||[]).forEach(w=>{ if(!(isTop&&w.dormer)){ const wm=swatchMat(w.mat,defInner,'world'); pend.push({p:[w.x0,w.z0],mat:wm},{p:[w.x1,w.z1],mat:wm}); } });
    const posted=o.map(v=>[v[0],v[1]]);                              // outline vertices are already posted above
    pend.forEach((it,i)=>{ const p=it.p; if(!pend.some((q,j)=>j!==i && near(p,q.p))) return;   // need a second partition end here (a real corner)
      if(posted.some(q=>near(q,p))) return;                                    // already a post at this point
      posted.push(p); const pg=new THREE.BoxGeometry(WALL_T,h,WALL_T); worldUVBox(pg,WALL_T,h,WALL_T);
      const pm=new THREE.Mesh(pg, it.mat); pm.position.set(p[0], y+h/2, p[1]); g.add(pm); });   // inherit the partition's material so it matches when painted
  });
  if(!opts.noRoof){ if(spec.roof && spec.roof.style && spec.roof.style!=='none') roof(F[F.length-1].outline, acc, spec.roof);   // legacy whole-house roof (new designs use a roof piece instead)
    const okPiece=rp=> rp.w>0.5&&rp.d>0.5&&isFinite(rp.x)&&isFinite(rp.z)&&isFinite(rp.base||0)&&isFinite(rp.pitch??0.5);
    (spec.roofPieces||[]).forEach((rp,pi)=>{ if(okPiece(rp))   // every roof (incl. the main house) is one of these
      roof(rectOutline(rp.x,rp.z,rp.w,rp.d), rp.base||0, {style:rp.style||'gable',pitch:rp.pitch??0.5,mat:rp.mat,gableMat:rp.gableMat,flipRidge:rp.flipRidge,noGable:rp.raiseWalls}, {pi}); });
    // raise the walls sitting under a roof piece up into its underside (opt-in, gable pieces)
    (spec.roofPieces||[]).forEach(rp=>{ if(!rp.raiseWalls||!okPiece(rp)||(rp.style||'gable')!=='gable') return;
      const rw=rp.w, rd=rp.d; let along=rw>=rd; if(rp.flipRidge) along=!along; const span=(along?rd:rw)||1, rise=(span/2)*(rp.pitch??0.5), base=rp.base||0, reave=2;
      const rHt=(x,z)=> base + rise*Math.max(0, 1-(along?Math.abs(z-rp.z):Math.abs(x-rp.x))/(span/2+reave));   // roof underside height — run includes the eave overhang so the wall slope matches the roof exactly
      const inFoot=(x,z)=> x>=rp.x-rw/2-0.6 && x<=rp.x+rw/2+0.6 && z>=rp.z-rd/2-0.6 && z<=rp.z+rd/2+0.6;
      F.forEach((f,fi)=>{ const ftop=baseYs[fi]+(f.h||10); if(Math.abs(ftop-base)>1.5) return;   // walls whose top meets this eave
        const o=f.outline, mm=f.mats||{};
        for(let e=0;e<o.length;e++){ const a=o[e], b=o[(e+1)%o.length];
          if(!inFoot((a[0]+b[0])/2,(a[1]+b[1])/2)) continue;
          const ts=[0,1];                                          // sample the roof underside at the ends AND where the ridge crosses (so a gable-end wall peaks in the middle)
          const denom = along ? (b[1]-a[1]) : (b[0]-a[0]);
          if(Math.abs(denom)>1e-6){ const cr=(along?(rp.z-a[1]):(rp.x-a[0]))/denom; if(cr>0.02 && cr<0.98) ts.push(cr); }
          ts.sort((p,q)=>p-q);
          const tops=ts.map(t=>({t, y: rHt(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)}));
          if(tops.every(tp=>tp.y<=ftop+0.03)) continue;            // whole edge at/below wall top (eave) -> no fill
          infillWall(a,b, ftop, tops, swatchMat(mm[e],defWall,'world')); } }); }); }
  (spec.stairs||[]).forEach(st=>{ const fi=st.floor||0; if(F[fi]) stairs(st, baseYs[fi], F[fi].h||3); });

  return g;
}

function rectOutline(x,z,w,d){ return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]; }
function normalize(spec){
  if(spec && spec.floors && spec.floors.length){
    spec.floors.forEach(f=>{
      if(!f.outline){
        if(f.shell){ const s=f.shell; f.outline=rectOutline(s.x,s.z,s.w,s.d);
          if(f.mats && ('S'in f.mats||'N'in f.mats||'E'in f.mats||'W'in f.mats)){ const map={S:0,E:1,N:2,W:3}, nm={};
            for(const k in f.mats) if(map[k]!=null) nm[map[k]]=f.mats[k]; f.mats=nm; }
          (f.openings||[]).forEach(o=>{ if(o.on==='shell'){ o.on='outline'; o.edge={S:0,E:1,N:2,W:3}[o.side]; delete o.side; } });
        } else f.outline=rectOutline(0,0,60,30);
      }
      f.walls=f.walls||[]; f.openings=f.openings||[]; f.mats=f.mats||{}; f.matsIn=f.matsIn||{}; f.voids=f.voids||[]; f.h=f.h||10;
    });
    return spec;
  }
  if(spec && spec.blocks && spec.blocks.length){ const b=spec.blocks[0];
    return { floors:[{outline:rectOutline(b.x,b.z,b.w,b.d), h:b.h||6, walls:[], openings:[], mats:{}}],
             roof:{style:b.roof||'gable',pitch:b.pitch??0.5}, stairs:[], colors:spec.colors||{} }; }
  return { floors:[{outline:rectOutline(0,0,60,30), h:10, walls:[], openings:[], mats:{}}], roof:{style:'gable',pitch:0.5}, stairs:[], colors:(spec&&spec.colors)||{} };
}
