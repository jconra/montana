// Which kind of tree stands where. Positions come from LiDAR and hand edits and are never changed here; only the
// kind is chosen, from the tree's height and how crowded its surroundings are.
import {driveLineDistance} from '../driveway-measured.mjs';
export const TREE_KINDS=['fir','spruce','fir_small','juniper','aspen','open_fir','juniper_column','juniper_low','snag','juniper_cone','juniper_pyramid','fir_back','fir_high','juniper_egg','fir_bare'];
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
 // At the forest edge the frames show grey lower trunks under the big firs' crowns: a share of the tall edge trees have them.
 if(neighbours<=11){if(h<=7)return r<.7?'juniper':'fir_small';if(h<=13)return r<.45?'juniper':r<.8?'open_fir':'fir_small';if(h>16&&treeHash(id,23)<.3)return 'fir_high';return r<.45?'fir':r<.8?'open_fir':'spruce';}
 if(h<=6)return r<.45?'juniper':'fir_small';
 // Deep in a close stand nobody looks at a tree up close: the full tufted cone, which reads right across the clearing.
 if(h<=13)return 'fir_back';
 // A few dead silver snags stand in the deep forest.
 if(!verifiable(x,z)&&treeHash(id,21)<.045)return 'snag';
 // Trees with many neighbours stand behind others, away from the clearings: the cheaper model is enough there.
 if(neighbours>9)return 'fir_back';
 return r<.55?'fir':'spruce';
}
// Bush silhouettes the juniper models are built to, widest = 1, listed from the tip down to the ground. The real junipers here keep their skirts: every one is
// widest right at the ground and narrows upward, and the forms differ only in how the top closes (pointed, egg, round, low, column).
// (The outlines drawn on the frames averaged narrower at the foot, but that was grass hiding the base and hand-drawn corners rounding.)
export const OUTLINE_SHAPES={"pyramid":[0.1,0.24,0.35,0.44,0.53,0.62,0.7,0.78,0.85,0.93,1.0],"egg":[0.06,0.26,0.42,0.56,0.67,0.76,0.84,0.9,0.95,0.98,1.0],"round":[0.08,0.38,0.56,0.7,0.8,0.87,0.92,0.96,0.99,1.0,1.0],"low":[0.15,0.59,0.73,0.82,0.88,0.93,0.96,0.98,0.99,1.0,1.0],"column":[0.06,0.3,0.48,0.62,0.72,0.8,0.86,0.91,0.95,0.98,1.0],
 // the exception he pointed out (picture 12): some are widest a third of the way up and tuck in at the foot
 "eggfoot":[0.12,0.4,0.62,0.8,0.93,1.0,0.99,0.93,0.84,0.76,0.7]};
export const KIND_OUTLINE={juniper:'round',juniper_column:'column',juniper_low:'low',juniper_cone:'egg',juniper_pyramid:'pyramid',juniper_egg:'eggfoot'};
export const fromTip=(list,y)=>{const u=Math.max(0,Math.min(.9999,1-y))*(list.length-1),i=Math.floor(u);return list[i]+(list[i+1]-list[i])*(u-i);};

// PLANT FORMS. One model per kind, and each plant reshaped as it is drawn: its width multiplied by a smooth curve, the cubic
// through four numbers (at the ground, a third up, two thirds up and the tip). The forest's vertex and imposter stages do it
// (FORM_GLSL in imposter.js), so a reshaped plant costs nothing more to draw.
// Measured on picture 2 (the broad juniper below the camera, 2026-11-03): its sides follow a parabola, the half-width growing as
// the square root of the depth below the tip, with a little flare at the skirt. The junipers as modelled drew as bullets, straight
// sides and a blunt round top, because their sprays stand out past the outline most where it is narrow. So the forms narrow the
// upper part, the amounts being of the drawn plant's width (not its outline's):
//  parabola (s 0..1): the top third a tenth to two fifths narrower; most junipers
//  spire: a narrow pointed top over a full body
//  flare: a narrow top over a broad flared skirt, sides curved in (the witch's-hat cones)
// (the tapered ones a little wider low down, where the real ones spread widest: tapered alone, the crowns measured 2-4% small)
export const FORMS={parabola:(s=.5)=>[1.05,1.03,.9-.22*s,.82-.3*s],spire:()=>[1.05,.97,.6,.5],flare:()=>[1.1,.74,.45,.42]};
const lagrange=t=>{t*=3;const a=t-1,b=t-2,c=t-3;return [-a*b*c/6,t*b*c/2,-t*a*c/2,t*a*b/6];};
// the width multiplier at height y (0 ground .. 1 tip), as the shaders work it out
export function formWidth(w,y){const L=lagrange(Math.max(0,Math.min(1,y)));return Math.max(.03,w[0]*L[0]+w[1]*L[1]+w[2]*L[2]+w[3]*L[3]);}
// A plant's form: its own (a census record's `form`: a name, {name,s}, or the four widths), else one by rule. The pointed kinds
// (cone, pyramid, column) mostly the parabola, some spires, a few flared cones; the round and low ones mostly stay round mounds,
// as about a third of the real junipers are (the critic's seventh round: tapering every kind turned broad round bushes into
// pyramids). Each plant's widths nudged a little so no two are alike; the narrow-foot egg juniper as he pointed it out. null: as modelled.
export function plantForm(kind,id,h,own=null){
 if(Array.isArray(own)&&own.length===4)return own.map(Number);
 if(own){const name=typeof own==='string'?own:own.name;if(FORMS[name])return FORMS[name](own.s??.5);}
 if(!KIND_OUTLINE[kind]||kind==='juniper_egg')return null;
 const r=treeHash(id,61),s=treeHash(id,62),n=k=>1+(treeHash(id,63+k)-.5)*.1;
 const round=kind==='juniper'||kind==='juniper_low',base=round?(r<.25?FORMS.parabola(s*.5):[1,1,1,1]):r<.68?FORMS.parabola(s):r<.86?FORMS.spire():r<.94?FORMS.flare():[1,1,1,1];
 return base.map((v,k)=>+(v*n(k)).toFixed(3));
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
export const TONE_REF={fir:'#2f3a22',fir_back:'#2f3a22',fir_high:'#2f3a22',fir_bare:'#2f3a22',juniper_egg:'#4c5c32',spruce:'#2c382c',fir_small:'#36422a',juniper:'#4c5c32',aspen:'#7d8652',open_fir:'#3a4628',juniper_column:'#4c5c32',juniper_low:'#4c5c32',juniper_cone:'#4c5c32',juniper_pyramid:'#4c5c32',snag:'#8d8a82'};
export function toneTint(kind,tone){
 if(typeof tone!=='string'||!/^#[0-9a-f]{6}$/i.test(tone))return null;
 const ref=TONE_REF[kind]||'#4c5c32',ch=(h,i)=>Math.pow(parseInt(h.substr(1+i*2,2),16)/255,2.2);
 return [0,1,2].map(i=>Math.max(.35,Math.min(2.2,ch(tone,i)/Math.max(.002,ch(ref,i)))));
}

// Evergreen tones as the frames show them, tree to tree: yellow-olive, olive, grey-green, blue-grey, a rusty one now and then. r g b multipliers over the model's own colour.
// Firs and spruce against the July frames: inside his outlines the model drew them a third darker and much warmer than the photos
// (photo 70,76,73 against 52,58,43 at 40-150 m); with the spray-picture firs (2026-11-03) they came out 79,89,69 against
// 64,70,68, so this darkened the warm channels; the critic's third round measured the forest as a whole at L 68-78 against
// the photos' 42-58; seen from above (view 05) the near canopy is a deep plain green (44,52,38), the blue-grey comes only
// with distance, from the haze. So the firs are dark green and the haze does the cooling. Junipers turn a little cooler: the frames show
// them blue-green, the model drew them olive; the critic's fifth round measured sunlit junipers yellow-olive (70,76,40) and the
// model's ~10 L too dark and grey, so they are lifted and warmed.
const FIR_SKY=[.45,.47,.75],FIR_SKY0=[1.08,1.14,.86];
export const EVERGREEN_TONES=[[1.14,1.05,.7],[1.04,1.02,.76],[.95,1.,.86],[.86,.97,.98],[1.16,.95,.68]];
export function evergreenTone(id,juniper=false){
 const a=treeHash(id,31),b=treeHash(id,32),i=juniper?(a<.5?0:a<.8?1:a<.95?2:4):(a<.06?0:a<.26?1:a<.66?2:a<.98?3:4),t=EVERGREEN_TONES[i],lift=(juniper?.8:.74)+b*.3,red=juniper?.9:.97;
 const sky=juniper?FIR_SKY0:FIR_SKY;return [t[0]*lift*red*sky[0],t[1]*lift*sky[1],t[2]*lift*sky[2]];
}
