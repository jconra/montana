import assert from 'node:assert/strict';
import {correctedDriveway,grassReclaim,GRAVEL_EXCLUSIONS} from '../assets/driveway-refinements.mjs';
import {DRIVE_LINE,TRACK_OFFSET,roadCoverage} from '../assets/driveway-measured.mjs';
import {campSurface} from '../assets/camp-approach.mjs';
const original=[{x:130,z:-60},{x:126.1,z:-43.1},{x:120,z:-37},{x:40,z:-3}],saved=structuredClone(original),road=correctedDriveway(original);
assert.deepEqual(original,saved,'legacy scatter route must stay immutable');
assert.deepEqual(road.slice(0,2),[{x:130,z:-55.5},{x:126.1,z:-38.6}],'beyond the measured frames the line keeps its shape, shifted off the aerial');
assert.deepEqual(road.slice(2),DRIVE_LINE);
assert.ok(roadCoverage(-17,8)>.95,'arm toward camp is dirt');assert.ok(roadCoverage(-5,-5)<.05,'grass above the junction');
assert.ok(roadCoverage(12.5,5.3)<.05,'grass strip between the wheel tracks');assert.ok(roadCoverage(12.5,5.3+TRACK_OFFSET)>.95,'wheel track');assert.ok(roadCoverage(12.5,8)<.05,'beside the drive');
for(const polygon of GRAVEL_EXCLUSIONS){const x=polygon.outline.reduce((s,p)=>s+p.x,0)/polygon.outline.length,z=polygon.outline.reduce((s,p)=>s+p.z,0)/polygon.outline.length;assert.ok(grassReclaim(x,z)>.95);assert.ok(campSurface(x,z).gravel<.05);}
assert.equal(grassReclaim(0,30),0);assert.equal(grassReclaim(100,-100),0);
console.log('Straight house route, retained approach, grass overrides and stable scatter inputs passed');
