import assert from 'node:assert/strict';
import {tallGrassCoverage,frontDoorGravel,TALL_GRASS_PATCHES} from '../assets/property-refinements.mjs';
import {campSurface,HORSESHOES} from '../assets/camp-approach.mjs';
import {applyReferenceEdits} from '../assets/reference-edits.mjs';
for(const [x,z] of [[-28,4],[-5,8]]){
 assert.ok(tallGrassCoverage(x,z)>.9);
 const surface=campSurface(x,z);assert.ok(surface.lawn<.1);assert.ok(surface.gravel<.1);
}
assert.ok(frontDoorGravel(-12,-6)>.9);assert.ok(campSurface(-12,-6).clear);
assert.equal(tallGrassCoverage(8,-8),0,'no grass inside house');
assert.equal(frontDoorGravel(-22,33),0,'camp stays lawn');
assert.ok(HORSESHOES[0].z>HORSESHOES[1].z);assert.ok(Math.abs(HORSESHOES[0].x-HORSESHOES[1].x)<1);
const records=new Map([['unchanged',{id:'unchanged',x:1}],['edited',{id:'edited',x:9}]]);
const state={get:id=>records.get(id),set:r=>records.set(r.id,r),remove:id=>records.delete(id)};
assert.equal(applyReferenceEdits(state,[{id:'unchanged',before:{x:1,id:'unchanged'},after:{id:'unchanged',x:2}},{id:'edited',before:{id:'edited',x:1},after:{id:'edited',x:2}},{id:'deleted',before:{id:'deleted',x:1},after:{id:'deleted',x:2}},{id:'new',before:null,after:{id:'new',x:3}}]),2);
assert.equal(records.get('edited').x,9);assert.ok(!records.has('deleted'));assert.equal(records.get('unchanged').x,2);
console.log('Marked meadow/gravel zones, pit placement and draft-preserving reference corrections passed');
