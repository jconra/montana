import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TREE_KINDS,LEGACY_TREE_ASSETS,ASPEN_STANDS,treeKind,treeHash,neighbourCounter,migrateTreeAsset,inAspenStand} from '../assets/forest/species-rules.mjs';
import {LandscapeState} from '../assets/landscape-state.mjs';
// Kinds follow height and crowding, and stay the same on every run.
const at={x:300,z:300,neighbours:12,id:'lidar:1'};
assert.equal(treeKind({...at,h:3}),'juniper');
assert.ok(['fir','spruce','fir_back'].includes(treeKind({...at,h:25})));
assert.ok(['fir_small','spruce'].includes(treeKind({...at,h:10})));
assert.ok(['juniper','open_fir'].includes(treeKind({...at,neighbours:2,h:10})));
for(let i=0;i<200;i++)assert.ok(TREE_KINDS.includes(treeKind({id:'lidar:'+i,x:i,z:i,h:2+i/5,neighbours:i%20})));
assert.equal(treeKind({...at,h:9}),treeKind({...at,h:9}));
assert.ok(Math.abs(treeHash('a')-treeHash('a'))===0&&treeHash('a')!==treeHash('b'));
// Aspens only where a stand is, and never in place of a hand-placed evergreen.
const s=ASPEN_STANDS[0];assert.ok(inAspenStand(s.x,s.z));
assert.equal(treeKind({id:'lidar:2',x:s.x,z:s.z,h:12,neighbours:8}),'aspen');
assert.notEqual(treeKind({id:'lidar:2',x:s.x,z:s.z,h:12,neighbours:8,authored:true}),'aspen');
// Neighbour counts leave the spot itself out.
const count=neighbourCounter([[0,0],[3,0],[0,10],[100,100]]);assert.equal(count(0,0),2);assert.equal(count(100,100),0);
// Saved ids migrate; nothing else about a record moves, and other assets are untouched.
const kindOf=r=>treeKind({id:r.id,x:r.x,z:r.z,h:r.scale[1],neighbours:9,authored:true});
const old={id:'lidar:7',asset:'tree/pine_bush',x:5,z:-5,offset:.2,rotation:[0,.3,0],scale:[8,6.5,8],tint:.9},done=migrateTreeAsset(old,kindOf);
assert.ok(TREE_KINDS.includes(done.asset.slice(5)));assert.deepEqual({...done,asset:0},{...old,asset:0});
const rock={id:'rock/1:0:0',asset:'rock/11'};assert.equal(migrateTreeAsset(rock,kindOf),rock);
// Every hand edit in the published defaults keeps its id and placement through a load.
const defaults=JSON.parse(fs.readFileSync(new URL('../assets/landscape-defaults.json',import.meta.url)));
const rows=[...defaults.objects.overrides,...defaults.objects.added],assets=new Set(rows.map(o=>o.asset).filter(a=>!LEGACY_TREE_ASSETS.has(a)));TREE_KINDS.forEach(k=>assets.add('tree/'+k));
const base=defaults.objects.overrides.map(o=>({...o}));for(const id of defaults.objects.removed)base.push({id,asset:'rock/11',x:0,z:0,offset:0,rotation:[0,0,0],scale:[1,1,1],tint:1});
const state=new LandscapeState(base,assets,defaults.reference,r=>migrateTreeAsset(r,kindOf));state.load(defaults);
for(const o of rows){const now=state.get(o.id);assert.ok(now,o.id);assert.deepEqual({...now,asset:0},{...o,asset:0},o.id);assert.ok(!LEGACY_TREE_ASSETS.has(now.asset),o.id);}
assert.ok(state.export().objects.overrides.length===defaults.objects.overrides.length);
console.log('Tree kinds, aspen stands, saved id migration and hand edits passed');
// The first six kinds keep their places: saved lists and sp indices depend on the order.
assert.deepEqual(TREE_KINDS.slice(0,6),['fir','spruce','fir_small','juniper','aspen','open_fir']);
