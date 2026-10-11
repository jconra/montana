import assert from 'node:assert/strict';
import {correctedDriveway,grassReclaim,GRAVEL_EXCLUSIONS} from '../assets/driveway-refinements.mjs';
import {campSurface} from '../assets/camp-approach.mjs';
const original=[{x:40,z:-3},{x:26.5,z:-1.2},{x:10.7,z:2.3},{x:-4.1,z:1.4},{x:-22.9,z:-6.4}],saved=structuredClone(original),road=correctedDriveway(original);
assert.deepEqual(original,saved,'legacy scatter route must stay immutable');assert.deepEqual(road.slice(0,2),original.slice(0,2));assert.deepEqual(road.at(-1),original.at(-1));
for(const p of road.filter(p=>p.x<=20&&p.x>=-5))assert.ok(Math.abs(p.z-(.6-.07*p.x))<1e-8,'house section is straight');
for(const polygon of GRAVEL_EXCLUSIONS){const x=polygon.outline.reduce((s,p)=>s+p.x,0)/polygon.outline.length,z=polygon.outline.reduce((s,p)=>s+p.z,0)/polygon.outline.length;assert.ok(grassReclaim(x,z)>.95);assert.ok(campSurface(x,z).gravel<.05);}
assert.equal(grassReclaim(0,30),0);assert.equal(grassReclaim(100,-100),0);
console.log('Straight house route, retained approach, grass overrides and stable scatter inputs passed');
