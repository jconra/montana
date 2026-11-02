// Which kind of tree stands where. Positions come from LiDAR and hand edits and are never changed here; only the
// kind is chosen, from the tree's height and how crowded its surroundings are.
export const TREE_KINDS=['fir','spruce','fir_small','juniper','aspen','open_fir','juniper_column','juniper_low','snag','juniper_cone'];
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
 // A few dead silver snags stand in the deep forest.
 if(treeHash(id,21)<.045)return 'snag';
 return r<.55?'fir':'spruce';
}
// How wide a tree stands for its height: big firs are narrower for their height than young ones; tall junipers are columns, small ones round.
export function treeWide(kind,id,h){const r=treeHash(id,4);
 if(kind==='juniper'){const t=Math.max(0,Math.min(1,(h-4)/4));return (1.15+r*.45)*(1-t)+(.6+r*.26)*t;}
 return (1.25+r*.55)*Math.min(1,Math.pow(13/Math.max(1,h),.25));
}

// A saved record naming an old pine takes the kind its position calls for. Everything else about it stays.
export function migrateTreeAsset(record,kindOf){
 if(!record||!LEGACY_TREE_ASSETS.has(record.asset))return record;
 return {...record,asset:'tree/'+kindOf(record)};
}

// A plant's own measured colour. A record may carry `tone`: its crown's average colour in sunlight as '#rrggbb'. The model is then tinted so
// its average comes out at that colour; TONE_REF is a rough average of each model untinted, by eye from one render per kind, so treat a tone as close, not exact.
export const TONE_REF={fir:'#2f3a22',spruce:'#2c382c',fir_small:'#36422a',juniper:'#4c5c32',aspen:'#7d8652',open_fir:'#3a4628',juniper_column:'#4c5c32',juniper_low:'#4c5c32',juniper_cone:'#4c5c32',snag:'#8d8a82'};
export function toneTint(kind,tone){
 if(typeof tone!=='string'||!/^#[0-9a-f]{6}$/i.test(tone))return null;
 const ref=TONE_REF[kind]||'#4c5c32',ch=(h,i)=>Math.pow(parseInt(h.substr(1+i*2,2),16)/255,2.2);
 return [0,1,2].map(i=>Math.max(.35,Math.min(2.2,ch(tone,i)/Math.max(.002,ch(ref,i)))));
}

// Evergreen tones as the frames show them, tree to tree: yellow-olive, olive, grey-green, blue-grey, a rusty one now and then. r g b multipliers over the model's own colour.
export const EVERGREEN_TONES=[[1.14,1.05,.7],[1.04,1.02,.76],[.95,1.,.86],[.86,.97,.98],[1.16,.95,.68]];
export function evergreenTone(id,juniper=false){
 const a=treeHash(id,31),b=treeHash(id,32),i=juniper?(a<.5?0:a<.8?1:a<.95?2:4):(a<.22?0:a<.5?1:a<.78?2:a<.94?3:4),t=EVERGREEN_TONES[i],lift=(juniper?.78:.68)+b*.34;
 return [t[0]*lift,t[1]*lift,t[2]*lift];
}
