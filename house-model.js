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
export function buildHouse(THREE, spec, opts){
  spec = normalize(spec); opts = opts || {};
  const g = new THREE.Group();
  const C = spec.colors || {};
  const PAL = (spec.palette && spec.palette.length) ? spec.palette
            : ['#6b5a45','#ffffff','#33363a','#8a6d4b','#aeb6bd','#241a12'];
  const defWall=C.wall||PAL[0], defRoof=C.roof||PAL[2], defTrim=C.trim||PAL[1], defInner=PAL[1];
  const pcol=(idx,fb)=> (idx==null||idx<0) ? fb : (PAL[idx]||fb);

  const matCache={};
  const solid=(hex)=>{ if(!matCache[hex]) matCache[hex]=new THREE.MeshStandardMaterial({color:hex,roughness:1,flatShading:true,side:THREE.DoubleSide}); return matCache[hex]; };
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
  function wallSeg(x0,z0,x1,z1, baseY,h, ops, wallColor, surf, inColor, outFace){
    const dx=x1-x0, dz=z1-z0, len=Math.hypot(dx,dz); if(len<0.02) return;
    const wg=new THREE.Group(); wg.position.set((x0+x1)/2, baseY, (z0+z1)/2); wg.rotation.y=-Math.atan2(dz,dx);
    if(surf){ if(inColor!=null) surf.outFace=outFace; wg.userData.surf=surf; } g.add(wg);
    const t=0.5;   // ~6" walls (units = feet)
    // two-tone exterior wall: broad faces (+z=4, -z=5) get outside/inside colours; thin edges keep the outside colour
    // BoxGeometry material order is [ +x, -x, +y, -y, +z, -z ]
    const outM=solid(wallColor);
    const wm = (inColor==null) ? outM
      : [outM,outM,outM,outM, (outFace===4?outM:solid(inColor)), (outFace===5?outM:solid(inColor))];
    const ext=t/2;   // extend each end by half a wall-width so corners meet cleanly (overlap is buried inside the joint — no z-fight on visible faces)
    const seg=(a,b,y0,y1,mat)=>{ const l=b-a; if(l<=0.002||y1-y0<=0.002) return;
      const m=new THREE.Mesh(new THREE.BoxGeometry(l,y1-y0,t),mat); m.position.set((a+b)/2,(y0+y1)/2,0); wg.add(m); };
    const os=(ops||[]).map(o=>{ const off=Math.max(0,Math.min(len-o.w,o.off));
      return {a:-len/2+off, b:-len/2+off+o.w, y0:o.y0, y1:Math.min(h,o.y1), type:o.type}; }).sort((p,q)=>p.a-q.a);
    let cur=-len/2-ext;
    for(const o of os){
      seg(cur,o.a,0,h, wm); seg(o.a,o.b,0,o.y0, wm); seg(o.a,o.b,o.y1,h, wm);
      if(o.type==='door'){                                    // real opening: swing the leaf aside so you can walk through
        const leaf=new THREE.Group(); leaf.position.set(o.a,(o.y0+o.y1)/2,0);
        const l=new THREE.Mesh(new THREE.BoxGeometry(o.b-o.a,o.y1-o.y0,0.15),doorMat); l.position.x=(o.b-o.a)/2; leaf.add(l);
        leaf.rotation.y=-1.9; wg.add(leaf);
      } else { seg(o.a,o.b,o.y0,o.y1, glassMat); }            // window keeps its glass
      cur=Math.max(cur,o.b);
    }
    seg(cur,len/2+ext,0,h, wm);
  }

  // ---- polygon floor slab / flat roof deck, with rectangular stairwell holes ----
  function slabPoly(outline, y, holes, mat, thick){
    thick=thick||0.6;
    const sh=new THREE.Shape(); outline.forEach((p,i)=> i? sh.lineTo(p[0],-p[1]) : sh.moveTo(p[0],-p[1]));
    (holes||[]).forEach(ho=>{ const hp=new THREE.Path();
      const c = ho.poly ? ho.poly                                  // arbitrary cutout (open-to-below), or a rectangular stairwell
        : [[ho.x-ho.w/2,ho.z-ho.d/2],[ho.x+ho.w/2,ho.z-ho.d/2],[ho.x+ho.w/2,ho.z+ho.d/2],[ho.x-ho.w/2,ho.z+ho.d/2]];
      if(c.length<3) return;
      c.forEach((p,i)=> i? hp.lineTo(p[0],-p[1]) : hp.moveTo(p[0],-p[1])); sh.holes.push(hp); });
    const geo=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false});
    const m=new THREE.Mesh(geo, mat||trimMat); m.rotation.x=-Math.PI/2; m.position.y=y; g.add(m);
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
    const wm=solid(color);
    wallSeg(x0,z0,x1,z1, baseY, dH, ops, color, surf);          // front (with window)
    wallSeg(FL[0],FL[1],BL[0],BL[1], baseY, dH, [], color, null);
    wallSeg(FR[0],FR[1],BR[0],BR[1], baseY, dH, [], color, null);
    triM(P(FL,eave),P(FR,eave),P(midF,peak), wm);               // front gable
    const RF=P(midF,peak), RB=P([midF[0]+ix*depth,midF[1]+iz*depth],peak);
    quad(RF, RB, P(BL,eave), P(FL,eave), roofMat);              // left slope
    quad(RF, P(FR,eave), P(BR,eave), RB, roofMat);              // right slope
  }

  function roof(outline, topY, rs){
    const pitch=rs.pitch??0.5, eave=2, style=rs.style||'gable', h=topY;
    const rmat = rs.mat!=null ? solid(pcol(rs.mat,defRoof)) : roofMat;
    if(style==='flat'){
      slabPoly(outline, topY, [], rmat, 0.6);
      for(let e=0;e<outline.length;e++){ const a=outline[e], b=outline[(e+1)%outline.length];
        wallSeg(a[0],a[1],b[0],b[1], topY, 1.5, [], defTrim, null); }
      return;
    }
    const {x,z,w,d}=bboxOf(outline);
    const rg=new THREE.Group(); rg.position.set(x,0,z); rg.userData.surf={kind:'roof'}; g.add(rg);
    const along=w>=d, len=along?w:d, span=along?d:w;
    const rise=(span/2)*pitch, sln=Math.hypot(span/2+eave,rise), ang=Math.atan2(rise,span/2+eave);
    const sub=new THREE.Group(); sub.rotation.y=along?0:Math.PI/2; rg.add(sub);
    const slope=(pz,rx)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(len+2*eave,0.5,sln),rmat);m.position.set(0,h+rise/2,pz);m.rotation.x=rx;sub.add(m);};
    const gableEnd=(sx)=>{const shp=new THREE.Shape();shp.moveTo(-span/2,0);shp.lineTo(span/2,0);shp.lineTo(0,rise);shp.lineTo(-span/2,0);
      const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shp,{depth:0.5,bevelEnabled:false}),solid(defWall));m.rotation.y=Math.PI/2;m.position.set(sx*len/2,h,-0.25);sub.add(m);};
    if(style==='shed'){
      const rise2=span*pitch*0.6, ang2=Math.atan2(rise2,span+eave), sll=Math.hypot(span+eave,rise2);
      const m=new THREE.Mesh(new THREE.BoxGeometry(len+2*eave,0.5,sll),rmat);m.position.set(0,h+rise2/2,0);m.rotation.x=ang2;sub.add(m);
      for(const sx of [-1,1]){const shp=new THREE.Shape();shp.moveTo(-span/2,0);shp.lineTo(span/2,0);shp.lineTo(span/2,rise2);shp.lineTo(-span/2,0);
        const t=new THREE.Mesh(new THREE.ExtrudeGeometry(shp,{depth:0.5,bevelEnabled:false}),solid(defWall));t.rotation.y=Math.PI/2;t.position.set(sx*len/2,h,-0.25);sub.add(t);}
      return;
    }
    slope(+span/4,+ang); slope(-span/4,-ang);
    if(style==='hip'){
      const rl=Math.max(0.01,len-span), y0=h, y1=h+rise, Lx=len/2+eave, W=span/2+eave, R=rl/2;
      const Q=[[-Lx,y0,-W],[Lx,y0,-W],[Lx,y0,W],[-Lx,y0,W],[-R,y1,0],[R,y1,0]];
      const V=[], tri=(i,j,k)=>{for(const q of [i,j,k]) V.push(Q[q][0],Q[q][1],Q[q][2]);};
      tri(0,3,4); tri(1,4,2); tri(0,4,5); tri(0,5,1); tri(3,2,5); tri(3,5,4);
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(V,3)); geo.computeVertexNormals();
      sub.add(new THREE.Mesh(geo,rmat));
    } else { gableEnd(-1); gableEnd(1); }
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
    const o=f.outline, h=f.h||10, y=baseYs[fi], isTop=(fi===F.length-1), m=f.mats||{}, mi=f.matsIn||{};
    const cen=centroid(o);
    const slabHoles=[...holes[fi], ...(f.voids||[]).map(v=>({poly:v}))];   // stairwells + open-to-below cutouts
    slabPoly(o, y, slabHoles, trimMat, 0.6);
    for(let e=0;e<o.length;e++){ const a=o[e], b=o[(e+1)%o.length];
      const ops=(f.openings||[]).filter(x=>x.on==='outline'&&x.edge===e);
      const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;                     // outward face: local +z world-normal is (-dz, dx)
      const outFace = ((mx-cen[0])*-(b[1]-a[1]) + (mz-cen[1])*(b[0]-a[0])) > 0 ? 4 : 5;
      wallSeg(a[0],a[1],b[0],b[1], y,h, ops, pcol(m[e],defWall), {kind:'outline',floor:fi,edge:e}, pcol(mi[e],defInner), outFace); }
    (f.walls||[]).forEach((w,wi)=>{
      const ops=(f.openings||[]).filter(x=>x.on==='wall'&&x.wi===wi);
      const surf={kind:'wall',floor:fi,wi};
      if(isTop && w.dormer) dormer(w, y, h, ops, pcol(w.mat,defWall), surf, o);   // dormer is now an opt-in per-wall flag
      else wallSeg(w.x0,w.z0,w.x1,w.z1, y,h, ops, pcol(w.mat,defInner), surf, pcol(w.matIn,defInner), 4);   // two-sided partition (side A=+z uses .mat, side B=-z uses .matIn)
    });
  });
  if(!opts.noRoof) roof(F[F.length-1].outline, acc, spec.roof||{});
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
