import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyCensusToObjects,censusRecord} from '../assets/plant-census.mjs';
import {LandscapeState} from '../assets/landscape-state.mjs';
const ref={center:{lat:45,lon:-110},globalMin:1600,grid:{W:32,H:32,px:1}};
const tree=id=>({id,asset:'tree/fir',x:1,z:1,offset:0,rotation:[0,.3,0],scale:[9,9,9],tint:1});
const census={plants:[{id:'L1',asset:'tree/juniper',x:5,z:6,scale:[3,3,3],record:'lidar:1'},{id:'X1',asset:'bush/sage',x:7,z:8,scale:[1,1,1],record:null},{id:'L2',asset:'tree/aspen',x:2,z:2,scale:[8,8,8],record:'lidar:gone'}],removed:['lidar:2','lidar:gone']};
const state=new LandscapeState([tree('lidar:1'),tree('lidar:2'),tree('lidar:3')],['tree/fir','tree/juniper','tree/aspen','bush/sage'],ref);
const objects=applyCensusToObjects({overrides:[{...tree('lidar:1'),tint:.7}],added:[],removed:[]},census,state.base);
assert.equal(objects.overrides.length,1);assert.equal(objects.overrides[0].x,5);assert.equal(objects.overrides[0].asset,'tree/juniper');
assert.equal(objects.overrides[0].tint,.7,'an edited record keeps its tint');assert.deepEqual(objects.removed,['lidar:2'],'an unknown id is never written');
assert.deepEqual(objects.added.map(o=>o.id).sort(),['added:census-L2','added:census-X1']);
const data={...state.export(),objects};assert.doesNotThrow(()=>state.load(data));assert.equal(state.get('lidar:2'),null);assert.equal(state.get('lidar:3').x,1);
assert.deepEqual(censusRecord({id:'X1',asset:'bush/sage',x:1,z:2,scale:[1,1,1]}),censusRecord({id:'X1',asset:'bush/sage',x:1,z:2,scale:[1,1,1]}),'stable between loads');
// The shipped file: unique plants, no plant both kept and removed, pending aspen untouched.
const real=JSON.parse(readFileSync(new URL('../assets/plant-census.json',import.meta.url)));
const ids=real.plants.map(p=>p.id),recs=real.plants.map(p=>p.record).filter(Boolean);
assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(recs).size,recs.length,'one plant per base record');
assert.ok(recs.every(r=>!real.removed.includes(r)));
for(const id of real.pending){assert.ok(!recs.includes(id)&&!real.removed.includes(id),id+' stays pending');}
assert.ok(real.plants.every(p=>p.kind&&p.scale.every(s=>s>=.01&&s<=100)));
console.log('plant census tests passed');
