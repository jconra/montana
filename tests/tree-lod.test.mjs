import assert from 'node:assert/strict';
import {lodOffset,meshCoverage,approachCoverage} from '../assets/tree-lod.mjs';
const offsets=Array.from({length:1000},(_,i)=>lodOffset(`lidar:${i}`));
assert.ok(Math.min(...offsets)<-18&&Math.max(...offsets)>18);
for(let i=0;i<1000;i++){assert.equal(offsets[i],lodOffset(`lidar:${i}`));assert.ok(Math.abs(offsets[i])<=20);}
assert.equal(meshCoverage(60,95),1);assert.equal(meshCoverage(95,95),0);assert.equal(meshCoverage(77.5,95),.5);
for(let distance=60;distance<=95;distance+=.01){assert.ok(meshCoverage(distance,95)>=0&&meshCoverage(distance,95)<=1);assert.ok(Math.abs(meshCoverage(distance+.01,95)-meshCoverage(distance,95))<.001);}
for(const fps of [15,30,60,120]){let coverage=0;for(let i=0;i<fps;i++)coverage=approachCoverage(coverage,1,1/fps);assert.ok(Math.abs(coverage-1/1.1)<1e-10);for(let i=0;i<fps*2;i++)coverage=approachCoverage(coverage,0,1/fps);assert.equal(coverage,0);}
assert.ok(approachCoverage(0,1,20)<.1,'Long stalls cannot skip the handoff');
assert.ok(approachCoverage(1,0,1/60)>.98,'Budget removal starts softly');
console.log('Stable stagger distribution, smooth distance coverage and time-continuous fades passed');
const {shadowSettings}=await import('../assets/tree-shadows.mjs');
for(const level of [0,1])for(const mode of ['auto','2','3','4'])assert.equal(shadowSettings(level,mode).size,0);
assert.equal(shadowSettings(2).size,1024);assert.equal(shadowSettings(3).size,2048);assert.equal(shadowSettings(4).size,4096);
assert.equal(shadowSettings(4,'off').size,0);assert.equal(shadowSettings(4,'auto',2048).size,2048);
