// Which kind of tree stands where. Positions come from LiDAR and hand edits and are never changed here; only the
// kind is chosen, from the tree's height and how crowded its surroundings are.
export const TREE_KINDS=['fir','spruce','fir_small','juniper','aspen','open_fir'];
export const LEGACY_TREE_ASSETS=new Set(['tree/pine_large','tree/pine_bush','tree/pine','tree/pine_mid','tree/pine_far']);
// Aspen stands seen in the May 2026 drone frames (scene metres; x east, z south).
export const ASPEN_STANDS=[{x:-46,z:12,r:8.5,planted:12,hMin:8,hMax:14}];
export function treeHash(id,salt=0){let h=2166136261^salt;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>13;h=Math.imul(h,1540483477);return ((h^h>>>15)>>>0)/4294967296;}

// Counts trees within `radius` of a spot; built once from the LiDAR list.
export function neighbourCounter(points,radius=14){
 const cells=new Map(),key=(i,j)=>i*65536+j,r2=radius*radius;
 for(const [x,z] of points){const k=key(Math.floor(x/radius),Math.floor(z/radius));let c=cells.get(k);if(!c)cells.set(k,c=[]);c.push(x,z);}
 return (x,z)=>{let n=0;const ci=Math.floor(x/radius),cj=Math.floor(z/radius);for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++){const c=cells.get(key(i,j));if(c)for(let q=0;q<c.length;q+=2){const a=c[q]-x,b=c[q+1]-z;if(a*a+b*b<r2&&(a||b))n++;}}return n;};
}

export function inAspenStand(x,z){return ASPEN_STANDS.some(s=>(x-s.x)**2+(z-s.z)**2<s.r*s.r);}

// neighbours: trees within 14 m (a median spot has 9). authored: placed or moved by hand, which on this property has
// meant matching a dark evergreen in a photo, so it never turns into an aspen here.
export function treeKind({id,x,z,h,neighbours,authored=false}){
 if(!authored&&h>=5&&inAspenStand(x,z))return 'aspen';
 const r=treeHash(id),open=neighbours<=7;
 // The open hill in the May frames: mostly round junipers from shrub to column size, some open firs and pines; spruce only in deep forest.
 if(h<=4)return 'juniper';
 if(open){if(h<=9)return r<.9?'juniper':'fir_small';if(h<=14)return r<.55?'juniper':'open_fir';return r<.7?'open_fir':'fir';}
 if(neighbours<=11){if(h<=7)return r<.7?'juniper':'fir_small';if(h<=13)return r<.45?'juniper':r<.8?'open_fir':'fir_small';return r<.45?'fir':r<.8?'open_fir':'spruce';}
 if(h<=6)return r<.45?'juniper':'fir_small';
 if(h<=13)return r<.75?'fir_small':'spruce';
 return r<.55?'fir':'spruce';
}
// How wide a tree stands for its height: big firs are narrower for their height than young ones; tall junipers are columns, small ones round.
export function treeWide(kind,id,h){const r=treeHash(id,4);
 if(kind==='juniper'){const t=Math.max(0,Math.min(1,(h-4)/4));return (1.15+r*.45)*(1-t)+(.6+r*.26)*t;}
 return (.78+r*.35)*Math.min(1,Math.sqrt(13/Math.max(1,h)));
}

// A saved record naming an old pine takes the kind its position calls for. Everything else about it stays.
export function migrateTreeAsset(record,kindOf){
 if(!record||!LEGACY_TREE_ASSETS.has(record.asset))return record;
 return {...record,asset:'tree/'+kindOf(record)};
}
