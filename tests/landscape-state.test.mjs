import assert from 'node:assert/strict';
import {LandscapeState,EditHistory,brushVertices} from '../assets/landscape-state.mjs';
const ref={center:{lat:45,lon:-110},globalMin:1600,grid:{W:32,H:32,px:1}},tree={id:'lidar:17',asset:'tree/pine',x:5,z:-5,offset:0,rotation:[0,.3,0],scale:[12,12,12],tint:1};
const make=()=>new LandscapeState([tree],['tree/pine','bush/sage'],ref),state=make(),empty=state.export();
state.set({...tree,x:40,scale:[18,18,18]});state.set({...tree,id:'added:unique',asset:'bush/sage',scale:[1,1,1]});state.heights.set(400,112.125);
const saved=JSON.parse(JSON.stringify(state.export())),other=make();other.load(saved);assert.deepEqual(other.export(),saved);assert.equal(other.get(tree.id).x,40);assert.equal(tree.x,5);
other.remove(tree.id);assert.equal(other.get(tree.id),null);assert.equal(other.all().length,1);const removed=other.export();other.load(empty);assert.deepEqual(other.get(tree.id),tree);other.load(removed);assert.equal(other.get(tree.id),null);
for(const mutate of [x=>x.reference.grid.px=2,x=>x.objects.overrides[0].scale[0]=0,x=>x.objects.overrides[0].asset='remote/url',x=>x.objects.overrides[0].x=NaN,x=>x.objects.added[0].id=tree.id,x=>x.terrain.heights.push([400,10]),x=>x.terrain.heights[0][0]=0,x=>x.objects.removed.push(tree.id)]){
 const bad=structuredClone(saved);mutate(bad);const before=other.export();assert.throws(()=>other.load(bad));assert.deepEqual(other.export(),before,'failed imports are atomic');
}
const history=new EditHistory();assert.ok(history.push(empty,saved));assert.deepEqual(history.undo(),empty);assert.deepEqual(history.redo(),saved);history.undo();history.push(empty,removed);assert.equal(history.redo(),null);
const brush=brushVertices({W:32,H:32,half:15.5,px:1},0,0,3);assert.ok(brush.length>10);assert.ok(brush.every(p=>p.weight>0&&p.weight<=1&&p.index%32>=6&&p.index%32<26));assert.deepEqual(brushVertices({W:32,H:32,half:15.5,px:1},100,100,2),[]);
console.log('Landscape import/export, ID validation, atomic rejection, undo/redo and brush boundaries passed');
