// Run with: node tests/forest-lod.cjs
// Exercise the lab's actual LOD allocator without requiring a GPU/browser.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../labs/forest.js'),'utf8');
const start=code.indexOf('function updateLOD('),end=code.indexOf('\nfunction frameForest',start);
const attribute=()=>({setX(){},setXYZW(){}});
const model=triangleCount=>({triangleCount,meshBatches:[{setMatrixAt(){},instanceMatrix:{},geometry:{attributes:{meshFade:attribute()}}}],sprite:{geometry:{attributes:{meshFade:attribute(),instanceData:attribute(),instanceYaw:attribute()}}}});
const context={forestSettings:{mode:'hybrid',near:50,budget:2,fade:.4},inspection:false,models:[model(100),model(200)],forest:[0,1,2,3].map((n)=>({model:n%2,x:n*10,z:0,height:10,yaw:0})),camera:{position:{x:0,y:5,z:0}},lodSelection:new Set(),transitioning:false,dummy:{position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},updateMatrix(){}},nearCount:0,farCount:0};
vm.createContext(context);vm.runInContext(code.slice(start,end),context);
const update=(dt=0,choose=true)=>context.updateLOD(dt,choose);
const fades=()=>context.forest.map(p=>p.fade);
update();assert.deepEqual(fades(),[1,1,0,0]);
context.camera.position.x=30;update(100);
assert.deepEqual(fades(),[.75,.75,0,0]);assert.equal(context.nearCount,2);assert.equal(context.farCount,4);
for(let i=0;i<3;i++)update(100,false);
assert.deepEqual(fades(),[0,0,.25,.25]);
for(let i=0;i<3;i++)update(100,false);
assert.deepEqual(fades(),[0,0,1,1]);assert.equal(context.transitioning,false);
// Reversal proceeds continuously from the current coverage.
context.camera.position.x=0;update(100);assert.deepEqual(fades(),[0,0,.75,.75]);
context.camera.position.x=30;update(100);assert.deepEqual(fades(),[0,0,1,1]);
// Zero-duration behavior and global triangle cap across model types.
context.forestSettings.fade=0;context.camera.position.x=0;update();assert.deepEqual(fades(),[1,1,0,0]);
context.models.forEach(m=>m.triangleCount=7000000);context.forest.forEach(p=>delete p.fade);update();assert.equal(context.nearCount,1);
context.forestSettings.budget=0;update();assert.equal(context.nearCount,0);assert.equal(context.farCount,4);
// Pure render modes bypass hybrid budgets.
context.forestSettings.mode='mesh';update();assert.equal(context.nearCount,4);assert.equal(context.farCount,0);
context.forestSettings.mode='impostor';update();assert.equal(context.nearCount,0);assert.equal(context.farCount,4);
console.log('PASS: crossfade progression, reversal, overlap, shared budgets, zero duration, pure modes');
