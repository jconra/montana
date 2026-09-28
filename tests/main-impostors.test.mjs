import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=new URL('../assets/trees/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
const meta=JSON.parse(fs.readFileSync(new URL('tex/impostor_variants.json',base)));
assert.ok(meta.pixelsPerView>=160);
const occupied=new Set();
for(const variant of manifest.variants.filter(v=>!['mid','far'].includes(v.role))){
 const frame=meta.frames[variant.name];assert.ok(frame,variant.name);assert.equal(frame.source,variant.file);
 assert.equal(frame.views,meta.azimuthViews*meta.elevations.length);assert.equal(frame.pixelsPerView,meta.pixelsPerView);
 for(let i=frame.firstFrame;i<frame.firstFrame+frame.views;i++){
  assert.ok(!occupied.has(i),'atlas regions must not overlap');occupied.add(i);
  assert.ok((i%meta.columns+1)*meta.pixelsPerView<=meta.size);
  assert.ok((Math.floor(i/meta.columns)+1)*meta.pixelsPerView<=meta.size);
 }
 const data=JSON.parse(fs.readFileSync(new URL(variant.file,base)));
 for(const part of ['branches','leaves']){
  const bytes=Buffer.from(data[part].position,'base64');
  for(let i=0;i<bytes.length;i+=12){const x=bytes.readFloatLE(i),y=bytes.readFloatLE(i+4)-frame.centerY,z=bytes.readFloatLE(i+8);assert.ok(Math.hypot(x,y,z)<frame.span/2,'all geometry fits every camera view');}
 }
}
const png=fs.readFileSync(new URL('tex/'+meta.atlas,base));assert.equal(png.readUInt32BE(16),meta.size);assert.equal(png.readUInt32BE(20),meta.size);
console.log('Every main-scene tree has separate views, sufficient resolution and matching bounds');
