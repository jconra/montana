// The plant census: one record per real plant, measured from solved drone cameras and LiDAR (assets/plant-census.json).
// It is applied as ordinary editor edits, so base ids never change: a plant that has a base id overrides that record,
// a plant with no base id becomes an added record, and a base plant the census found no real plant for is removed.
// `kind` is what the plant is; `asset` is the model drawing it, which may be the nearest available until a model exists.
export const CENSUS_KEY='montanaPlantCensus:v1';
// Measured colour per record id: [r,g,b] multipliers over the model's own green, read from the frames.
export const censusTone=new Map();

export function censusRecord(plant,previous=null){
 const id=plant.record||'added:census-'+plant.id;
 return {id,asset:plant.asset,x:plant.x,z:plant.z,offset:0,rotation:previous?.rotation||[plant.lean||0,censusYaw(plant.id),0],scale:plant.scale,tint:plant.tint??previous?.tint??censusTint(plant.id)};
}
function hash(id){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}
function censusYaw(id){return hash(id)*6.283;}
function censusTint(id){return .86+hash(id+'t')*.26;}

// Returns the edited {overrides,added,removed} lists. Ids the census names that this base no longer has are skipped,
// so a stale census can never make the published defaults fail validation. Record ids in `keep` were edited by hand after
// the census was applied (see censusHandEdits), so the census leaves them as they are.
export function applyCensusToObjects(objects,census,baseIds,keep=[]){
 const overrides=new Map(objects.overrides.map(o=>[o.id,o])),added=new Map(objects.added.map(o=>[o.id,o])),removed=new Set(objects.removed),kept=new Set(keep);
 for(const plant of census.plants){
  if(kept.has(censusId(plant)))continue;
  if(plant.record&&baseIds.has(plant.record)){const rec=censusRecord(plant,overrides.get(plant.record));overrides.set(rec.id,rec);removed.delete(rec.id);continue;}
  if(plant.record&&added.has(plant.record)){const rec=censusRecord(plant,added.get(plant.record));added.set(rec.id,rec);continue;}
  const rec=censusRecord({...plant,record:null});added.set(rec.id,rec);
 }
 for(const id of census.removed){if(!baseIds.has(id)||kept.has(id))continue;overrides.delete(id);removed.add(id);}
 return {overrides:[...overrides.values()],added:[...added.values()],removed:[...removed]};
}
const censusId=plant=>plant.record||'added:census-'+plant.id;
const near=(a,b)=>Math.abs(a-b)<.005;
// Which census plants differ from the census in these objects: moved, resized, retyped, deleted, or restored after the census
// removed them. Written into saved and exported documents, so loading one never undoes a hand edit.
export function censusHandEdits(objects,census,baseIds,previous=[]){
 const live=new Map([...objects.overrides,...objects.added].map(o=>[o.id,o])),out=new Set(previous);
 for(const plant of census.plants){
  const id=censusId(plant),o=live.get(id);if(plant.record&&!baseIds.has(plant.record)&&!live.has(plant.record)&&!live.has('added:census-'+plant.id))continue;
  const rec=o||live.get('added:census-'+plant.id);
  if(!rec){out.add(id);continue;}
  if(rec.asset!==plant.asset||!near(rec.x,plant.x)||!near(rec.z,plant.z)||Math.abs(rec.offset||0)>.005||!rec.scale.every((v,i)=>near(v,plant.scale[i])))out.add(rec.id);
 }
 const gone=new Set(objects.removed);for(const id of census.removed)if(baseIds.has(id)&&!gone.has(id))out.add(id);
 return [...out].sort();
}
export async function loadCensus(url){const r=await fetch(url);if(!r.ok)throw Error('Plant census could not load.');const c=await r.json();for(const p of c.plants)if(p.tone)censusTone.set(censusId(p),p.tone);return c;}
