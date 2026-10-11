import assert from 'node:assert/strict';
import {createSceneDiff,applySceneDiff} from '../assets/scene-diff.mjs';
const base={buildings:[{id:'house:0',position:[1,2,3],scale:[1,1,1]}],landscape:{revision:'test',objects:{overrides:[{id:'tree/a',x:3,z:4}],added:[{id:'added:a',x:1}],removed:['tree/b']},terrain:{heights:[[7,12],[9,18]]}}};
assert.equal(createSceneDiff(base,base).changes.length,0);
const current=structuredClone(base);current.buildings[0].position[0]=2;current.landscape.objects.overrides[0].x=8;current.landscape.objects.added=[];current.landscape.objects.removed=[];current.landscape.terrain.heights=[[9,20],[11,3]];
const diff=createSceneDiff(base,current);assert.equal(diff.changes.length,7);assert.deepEqual(applySceneDiff(base,diff),current);
assert.ok(!JSON.stringify(diff).includes('scale'),'unchanged fields omitted');
assert.deepEqual(createSceneDiff(base,current),diff,'copy does not reset baseline');
assert.throws(()=>applySceneDiff(current,diff),/baseline/);
const deleted=structuredClone(base);deleted.buildings[0].deleted=true;deleted.landscape.objects.removed.push('tree/a');assert.deepEqual(applySceneDiff(base,createSceneDiff(base,deleted)),deleted);
const fresh=structuredClone(base);fresh.landscape.objects.added.push({id:'added:new',x:3});assert.deepEqual(applySceneDiff(base,createSceneDiff(base,fresh)),fresh);
console.log('Diff-only export: empty, fields, additions, deletions, resets, heights, repeat copy and stale-baseline protection passed');

const paintedBase={...structuredClone(base),terrainPaint:[{id:'default-green',kind:'green',x:4,z:9,radius:10,opacity:.7}]};
const painted=structuredClone(paintedBase);painted.terrainPaint.push({id:'stroke-new',kind:'dry',x:5,z:8,radius:3,opacity:.5});
const pd=createSceneDiff(paintedBase,painted);assert.equal(pd.changes.length,1);assert.deepEqual(pd.changes[0].path,['terrainPaint','stroke-new']);assert.deepEqual(applySceneDiff(paintedBase,pd),painted);
assert.ok(!JSON.stringify(pd).includes('default-green'),'Unchanged published paint omitted');
const erased=structuredClone(paintedBase);erased.terrainPaint=[];assert.deepEqual(applySceneDiff(paintedBase,createSceneDiff(paintedBase,erased)),erased);
