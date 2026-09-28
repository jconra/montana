import assert from 'node:assert/strict';
import {AdaptiveQuality} from '../assets/adaptive-quality.mjs';
const changes=[];
const q=new AdaptiveQuality(level=>changes.push(level));
function run(fps,seconds,active=true){for(let i=0;i<fps*seconds;i++)q.sample(1/fps,active);}
run(10,4);assert.equal(q.level,1,'startup warmup');
run(10,10);assert.equal(q.level,0,'sustained slow frames reduce quality');
run(60,40);assert.equal(q.level,0,'downgrade cooldown prevents oscillation');
run(60,90);assert.equal(q.level,4,'sustained headroom reaches highest tier');
q.configure('2',30);run(10,30);assert.equal(q.level,2,'manual override remains fixed');
q.configure('auto',60);run(60,20);assert.ok(q.level>2,'60 Hz cap still allows upgrades at target 60');
const previous=q.level;run(5,30,false);assert.equal(q.level,previous,'background/loading samples are ignored');
run(5,3);assert.equal(q.level,previous,'resume warmup');
run(5,15);assert.ok(q.level<previous,'sustained very low FPS still lowers quality');
q.configure('3',30);q.configure('auto',30);run(60,6);q.sample(5);run(60,2);assert.equal(q.level,3,'one long stall does not reduce quality');
assert.ok(changes.length>0);
console.log('Adaptive quality timing, bounds, cooldown, manual override and pause checks passed');
