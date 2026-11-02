import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inCentralArea} from '../assets/central-rocks.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL('../assets/'+f,import.meta.url)));
const defaults=read('landscape-defaults.json'),edits=read('property-refinement-edits.json');
// Both lawn boulders stay editable rows on their own assets, at their measured spots.
for(const [id,asset,x,z] of [['added:photo-lawn-boulder','rock/boulder-a',-17.75,28.15],['added:reference-camp-flat-rock','rock/boulder-b',-10.56,21.08]]){
 const row=defaults.objects.added.find(o=>o.id===id);assert.equal(row.asset,asset);assert.ok(Math.hypot(row.x-x,row.z-z)<.3);
 assert.ok(fs.existsSync(new URL('../assets/models/'+asset.slice(5)+'.glb',import.meta.url)));
 // A browser draft holding any earlier version of the row must reach the same final row.
 const steps=edits.changes.filter(c=>c.id===id);assert.ok(steps.length>=1);for(const s of steps)assert.deepEqual(s.after,row);
}
// The detailed set is decided by position: the middle yes, far down the drive no.
assert.ok(inCentralArea(-14,3));assert.ok(inCentralArea(8.8,-4.9));assert.ok(inCentralArea(-40,36));assert.ok(!inCentralArea(40,-120));
// Each GLB stays within budget and uses 16-bit indices for the WebGL1 path.
for(const [file,maxTris] of [['boulder-a',6000],['boulder-b',6000],['central-rocks',1200]]){
 const b=fs.readFileSync(new URL('../assets/models/'+file+'.glb',import.meta.url)),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len));
 let tris=0;for(const m of g.meshes)for(const p of m.primitives){const a=g.accessors[p.indices];assert.equal(a.componentType,5123);tris+=a.count/3;}assert.ok(tris<=maxTris,file+' '+tris);
}
console.log('rocks ok');
