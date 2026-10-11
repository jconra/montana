// Diffs compare with published defaults, never the last export or browser draft.
const copy=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const keyed=rows=>Object.fromEntries(rows.map(({id,...fields})=>[id,fields]));
export function normalizeScene(scene){const l=scene.landscape;return {...(scene.terrainPaint?{terrainPaint:keyed(scene.terrainPaint.map((s,order)=>({...s,order})))}:{}),buildings:keyed(scene.buildings),landscape:{overrides:keyed(l.objects.overrides),added:keyed(l.objects.added),removed:Object.fromEntries(l.objects.removed.map(id=>[id,true])),heights:Object.fromEntries(l.terrain.heights)}};}
function fingerprint(v){let h=2166136261;for(const c of JSON.stringify(canonical(v)))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0');}
export function createSceneDiff(base,current){
 const a=normalizeScene(base),b=normalizeScene(current),changes=[];
 function walk(a,b,path){
  if(equal(a,b))return;
  if(a===undefined){changes.push({op:'add',path,value:b});return;}
  if(b===undefined){changes.push({op:'remove',path,old:a});return;}
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
   for(const k of [...new Set([...Object.keys(a),...Object.keys(b)])].sort())walk(a[k],b[k],[...path,k]);
  }else changes.push({op:'replace',path,old:a,value:b});
 }
 walk(a,b,[]);
 return {format:'montana-scene-diff',version:1,base:fingerprint(a),revision:base.landscape.revision,changes};
}
// For applying pasted exports: reject stale defaults rather than silently
// overwriting intervening edits. Paths are arrays so IDs containing / are safe.
export function applySceneDiff(base,diff){
 const result=normalizeScene(base);
 if(diff.format!=='montana-scene-diff'||diff.version!==1||diff.base!==fingerprint(result)||diff.revision!==base.landscape.revision)throw Error('Scene diff has a different baseline.');
 for(const c of diff.changes){
  if(!Array.isArray(c.path)||!c.path.length||c.path.some(k=>typeof k!=='string'||['__proto__','prototype','constructor'].includes(k)))throw Error('Invalid diff path');
  let parent=result;for(const k of c.path.slice(0,-1)){if(!Object.hasOwn(parent,k))throw Error('Unknown diff path');parent=parent[k];}
  const key=c.path.at(-1);
  if(c.op==='add'){if(Object.hasOwn(parent,key))throw Error('Existing diff path');parent[key]=copy(c.value);}
  else {if(!Object.hasOwn(parent,key)||!equal(parent[key],c.old))throw Error('Changed diff value');if(c.op==='remove')delete parent[key];else if(c.op==='replace')parent[key]=copy(c.value);else throw Error('Unknown diff operation');}
 }
 const out=copy(base);if(result.terrainPaint)out.terrainPaint=Object.entries(result.terrainPaint).map(([id,s])=>({id,...s})).sort((a,b)=>a.order-b.order).map(({order,...s})=>s);const rows=map=>Object.entries(map).map(([id,fields])=>({id,...fields}));out.buildings=rows(result.buildings);
 out.landscape.objects={overrides:rows(result.landscape.overrides),added:rows(result.landscape.added),removed:Object.keys(result.landscape.removed)};
 out.landscape.terrain.heights=Object.entries(result.landscape.heights).map(([i,y])=>[Number(i),y]).sort((a,b)=>a[0]-b[0]);return out;
}
