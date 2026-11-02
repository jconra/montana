// Run with: node --test tests/roof-ridges.test.mjs
// A roof's ridge follows its longer side unless flipped, so resizing a piece can turn it 90 degrees.
import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync} from 'node:fs';
const pieces=name=>JSON.parse(readFileSync(new URL(`../assets/${name}.json`,import.meta.url))).roofPieces;
const ridgeAlongX=p=>(p.w>=p.d)!==Boolean(p.flipRidge);
test('measured ridge directions',()=>{
 const house=pieces('montana-home');
 assert.equal(ridgeAlongX(house[0]),true,'house main ridge runs along its length');
 assert.equal(ridgeAlongX(house[2]),true,'entry ridge runs west from the main body, gable facing west');
 assert.equal(ridgeAlongX(pieces('montana-garage')[0]),false,'garage ridge runs front to back, gable facing the deck');
});
