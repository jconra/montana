// Which kind of tree stands where. Positions come from LiDAR and hand edits and are never changed here; only the
// kind is chosen, from the tree's height and how crowded its surroundings are.
import {driveLineDistance} from '../driveway-measured.mjs';
export const TREE_KINDS=['fir','spruce','fir_small','juniper','aspen','open_fir','juniper_column','juniper_low','snag','juniper_cone','juniper_pyramid','fir_back','fir_high','juniper_egg'];
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

// Where frames, census or mosaic let anyone check a tree: census zone A, the drive corridor, and the whole drone mosaic. Nothing invented stands here.
export function verifiable(x,z){
 if(x>=-160&&x<=200&&z>=-140&&z<=180)return true;
 return driveLineDistance(x,z)<40;
}
// Which juniper form a plant with no measured shape takes: columns, pointed cones, round and broad ones, each plant its own, stable by id.
export function juniperVariety(id,h){const r=treeHash(id,41);
 if(h<2.5)return r<.5?'juniper':r<.8?'juniper_cone':'juniper_low';
 return r<.14?'juniper_column':r<.58?'juniper_cone':r<.9?'juniper':'juniper_low';
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
 // Deep in a close stand nobody looks at a tree up close: the full tufted cone, which reads right across the clearing.
 if(h<=13)return 'fir_back';
 // A few dead silver snags stand in the deep forest.
 if(!verifiable(x,z)&&treeHash(id,21)<.045)return 'snag';
 // Trees with many neighbours stand behind others, away from the clearings: the cheaper model is enough there.
 if(neighbours>9)return 'fir_back';
 return r<.55?'fir':'spruce';
}
// How wide a tree stands for its height: big firs are narrower for their height than young ones; tall junipers are columns, small ones round.
export function treeWide(kind,id,h){const r=treeHash(id,4);
 if(kind.startsWith('juniper'))return .82+r*.42;
 return (1.+r*.45)*Math.min(1,Math.pow(13/Math.max(1,h),.25));
}

// A saved record naming an old pine takes the kind its position calls for. Everything else about it stays.
export function migrateTreeAsset(record,kindOf){
 if(!record||!LEGACY_TREE_ASSETS.has(record.asset))return record;
 return {...record,asset:'tree/'+kindOf(record)};
}

// A plant's own measured colour. A record may carry `tone`: its crown's average colour in sunlight as '#rrggbb'. The model is then tinted so
// its average comes out at that colour; TONE_REF is a rough average of each model untinted, by eye from one render per kind, so treat a tone as close, not exact.
export const TONE_REF={fir:'#2f3a22',fir_back:'#2f3a22',fir_high:'#2f3a22',juniper_egg:'#4c5c32',spruce:'#2c382c',fir_small:'#36422a',juniper:'#4c5c32',aspen:'#7d8652',open_fir:'#3a4628',juniper_column:'#4c5c32',juniper_low:'#4c5c32',juniper_cone:'#4c5c32',juniper_pyramid:'#4c5c32',snag:'#8d8a82'};
export function toneTint(kind,tone){
 if(typeof tone!=='string'||!/^#[0-9a-f]{6}$/i.test(tone))return null;
 const ref=TONE_REF[kind]||'#4c5c32',ch=(h,i)=>Math.pow(parseInt(h.substr(1+i*2,2),16)/255,2.2);
 return [0,1,2].map(i=>Math.max(.35,Math.min(2.2,ch(tone,i)/Math.max(.002,ch(ref,i)))));
}

// Evergreen tones as the frames show them, tree to tree: yellow-olive, olive, grey-green, blue-grey, a rusty one now and then. r g b multipliers over the model's own colour.
// Firs and spruce against the July frames: inside his outlines the model drew them a third darker and much warmer than the photos
// (photo 70,76,73 against 52,58,43 at 40-150 m); with the spray-picture firs (2026-11-03) they came out 79,89,69 against
// 64,70,68, so this now darkens the warm channels and keeps the blue. Junipers turn a little cooler: the frames show
// them blue-green, the model drew them olive.
const FIR_SKY=[1.0,.88,2.1],FIR_SKY0=[.88,1,1.14];
export const EVERGREEN_TONES=[[1.14,1.05,.7],[1.04,1.02,.76],[.95,1.,.86],[.86,.97,.98],[1.16,.95,.68]];
export function evergreenTone(id,juniper=false){
 const a=treeHash(id,31),b=treeHash(id,32),i=juniper?(a<.5?0:a<.8?1:a<.95?2:4):(a<.06?0:a<.26?1:a<.66?2:a<.98?3:4),t=EVERGREEN_TONES[i],lift=(juniper?.8:.74)+b*.3,red=juniper?.9:.97;
 const sky=juniper?FIR_SKY0:FIR_SKY;return [t[0]*lift*red*sky[0],t[1]*lift*sky[1],t[2]*lift*sky[2]];
}
