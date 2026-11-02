// The plant census: one record per real plant, measured from solved drone cameras and LiDAR (assets/plant-census.json).
// It is applied as ordinary editor edits, so base ids never change: a plant that has a base id overrides that record,
// a plant with no base id becomes an added record, and a base plant the census found no real plant for is removed.
// `kind` is what the plant is; `asset` is the model drawing it, which may be the nearest available until a model exists.
export const CENSUS_KEY='montanaPlantCensus:v1';

export function censusRecord(plant,previous=null){
 const id=plant.record||'added:census-'+plant.id;
 return {id,asset:plant.asset,x:plant.x,z:plant.z,offset:0,rotation:previous?.rotation||[plant.lean||0,censusYaw(plant.id),0],scale:plant.scale,tint:previous?.tint??censusTint(plant.id)};
}
function hash(id){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}
function censusYaw(id){return hash(id)*6.283;}
function censusTint(id){return .86+hash(id+'t')*.26;}

// Returns the edited {overrides,added,removed} lists. Ids the census names that this base no longer has are skipped,
// so a stale census can never make the published defaults fail validation.
export function applyCensusToObjects(objects,census,baseIds){
 const overrides=new Map(objects.overrides.map(o=>[o.id,o])),added=new Map(objects.added.map(o=>[o.id,o])),removed=new Set(objects.removed);
 for(const plant of census.plants){
  if(plant.record&&baseIds.has(plant.record)){const rec=censusRecord(plant,overrides.get(plant.record));overrides.set(rec.id,rec);removed.delete(rec.id);continue;}
  if(plant.record&&added.has(plant.record)){const rec=censusRecord(plant,added.get(plant.record));added.set(rec.id,rec);continue;}
  const rec=censusRecord({...plant,record:null});added.set(rec.id,rec);
 }
 for(const id of census.removed){if(!baseIds.has(id))continue;overrides.delete(id);removed.add(id);}
 return {overrides:[...overrides.values()],added:[...added.values()],removed:[...removed]};
}

export async function loadCensus(url){const r=await fetch(url);if(!r.ok)throw Error('Plant census could not load.');return r.json();}
