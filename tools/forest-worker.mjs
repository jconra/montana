// No renderer or texture loading in this worker. The viewing page stays on r158.
import { Tree } from './node_modules/@dgreenheck/ez-tree/src/lib/tree.js';
import { loadPreset } from './node_modules/@dgreenheck/ez-tree/src/lib/presets/index.js';
import { BufferGeometry, BufferAttribute, Box3, Vector3 } from 'three';
const number=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
self.onmessage=({data:{id,recipe:r}})=>{
  try {
    const broadleaf=['aspen','bush'].includes(r.preset);
    const o=loadPreset(broadleaf?'Aspen Medium':'Pine Large');
    if(r.preset==='bush'){o.branch.length[0]=3;o.branch.length[1]=4;o.branch.length[2]=2;o.branch.radius[0]=.12;o.leaves.size=1.2;}
    if(r.preset==='evergreenBush'){o.branch.length[0]=12;o.branch.length[1]=6;o.branch.radius[0]=.3;o.leaves.size=1.8;}
    o.seed=number(r.seed,0,65535)|0;
    o.branch.levels=broadleaf?2:1;
    o.branch.children[0]=number(r.branches,4,100)|0;
    o.branch.children[1]=number(r.secondary,1,6)|0;
    o.branch.start[1]=number(r.crown,.05,.9);
    o.branch.angle[1]=number(r.angle,20,150);
    o.branch.length[1]*=number(r.length,.3,2);
    o.branch.radius[0]*=number(r.trunk,.3,2);
    o.branch.gnarliness[0]=number(r.bend,0,.15);
    for(let level=0;level<4;level++){
      o.branch.segments[level]=number(r.segments,3,8)|0;
      o.branch.sections[level]=number(r.sections,3,12)|0;
    }
    o.leaves.count=number(r.leaves,1,32)|0;
    o.leaves.size*=number(r.leafSize,.3,2);
    o.leaves.start=number(r.leafStart,0,.9);
    // Bound combinatorial work before generating. Deciduous terminal branches add one.
    const tips=o.branch.children[0]*(o.branch.levels===2?o.branch.children[1]+1:1);
    if(tips*(o.leaves.count+1)>6000)throw new Error('Too much branching: reduce branches, twigs, or foliage count.');
    o.bark.textured=false;
    const tree=new Tree(o);tree.generate();
    // Use original indices: upstream converts to Uint16 and can wrap dense meshes.
    const geometries=['branches','leaves'].map(key=>{
      const d=tree[key],g=new BufferGeometry();
      g.setAttribute('position',new BufferAttribute(new Float32Array(d.verts),3));
      g.setAttribute('uv',new BufferAttribute(new Float32Array(d.uvs),2));
      g.setIndex(new BufferAttribute(new Uint32Array(d.indices),1));return g;
    });
    const box=new Box3();for(const g of geometries){g.computeBoundingBox();box.union(g.boundingBox);}
    const size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Invalid tree dimensions.');
    const parts=geometries.map(g=>{
      const p=g.attributes.position;
      for(let i=0;i<p.count;i++)p.setXYZ(i,(p.getX(i)-center.x)/size.y*number(r.width,.5,2),(p.getY(i)-box.min.y)/size.y,(p.getZ(i)-center.z)/size.y*number(r.width,.5,2));
      g.computeVertexNormals();
      return {position:p.array,normal:g.attributes.normal.array,uv:g.attributes.uv.array,index:g.index.array};
    });
    const transfer=parts.flatMap(p=>Object.values(p).map(a=>a.buffer));
    self.postMessage({id,parts,options:o},transfer);
    for(const g of geometries)g.dispose();
    for(const mesh of [tree.branchesMesh,tree.leavesMesh]){mesh.geometry.dispose();mesh.material.dispose();}
  }catch(error){self.postMessage({id,error:error.message});}
};
