import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const rows=JSON.parse(read('assets/scatter-frozen.json')),census=JSON.parse(read('assets/plant-census.json')),html=read('index.html');
// Ids are fixed by the list: unique, and never dealt by a seeded loop in the page again.
assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);assert.ok(!html.includes('rng(7719)'),'scatter must not be re-dealt from a seed');
// The census decides what stands in its zone: no invented sage survives it.
const gone=new Set(census.removed),kept=new Set(census.plants.map(p=>p.record)),{x0,x1,z0,z1}=census.zones.A;
const back=rows.filter(([id,,x,z])=>id.startsWith('sage2:')&&x>=x0&&x<=x1&&z>=z0&&z<=z1&&!gone.has(id)&&!kept.has(id));
assert.deepEqual(back.map(r=>r[0]),[],'invented sage in census zone A');
console.log('frozen scatter passed');
