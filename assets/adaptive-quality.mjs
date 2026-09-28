// Rendering budgets, not asset downloads: preserve WebGL1 and reuse loaded models.
export const QUALITY_LEVELS = [
  {name:'Minimal', distance:65, meshes:24, density:.22, pixelRatio:.75},
  {name:'Low', distance:95, meshes:60, density:.4, pixelRatio:1},
  {name:'Medium', distance:130, meshes:150, density:.65, pixelRatio:1},
  {name:'High', distance:180, meshes:340, density:.85, pixelRatio:1.5},
  {name:'Ultra', distance:240, meshes:500, density:1, pixelRatio:2},
];
export class AdaptiveQuality {
  constructor(onChange){this.onChange=onChange;this.level=1;this.mode='auto';this.target=30;this.time=0;this.nextUpgrade=0;this.reset();}
  reset(warmup=5){this.warmup=warmup;this.samples=[];this.elapsed=0;this.slow=0;this.fast=0;}
  configure(mode,target){
    this.mode=mode;this.target=target;this.reset();
    if(mode!=='auto')this.setLevel(Number(mode));
  }
  setLevel(level){level=Math.max(0,Math.min(QUALITY_LEVELS.length-1,level));if(level===this.level)return;this.level=level;this.onChange(level);}
  sample(seconds,active=true){
    if(!active||!Number.isFinite(seconds)||seconds<=0){this.reset();return;}
    this.time+=seconds;
    if(this.mode!=='auto')return;
    if(this.warmup>0){this.warmup-=seconds;return;}
    // Cap an isolated long stall; sustained slow frames still lower the budget.
    this.samples.push(Math.min(seconds,1));this.elapsed+=Math.min(seconds,1);
    if(this.elapsed<2||this.samples.length<4)return;
    const times=this.samples.sort((a,b)=>a-b),trim=Math.floor(times.length*.1);
    const retained=times.slice(0,times.length-trim);
    const fps=retained.length/retained.reduce((a,b)=>a+b,0);
    this.samples=[];this.elapsed=0;
    this.slow=fps<this.target*.85?this.slow+1:0;
    // A capped 60 Hz display can still reach higher quality when targeting 60.
    this.fast=fps>=this.target*.97?this.fast+1:0;
    if(this.slow>=2&&this.level>0){this.nextUpgrade=this.time+60;this.setLevel(this.level-1);this.reset(3);}
    else if(this.fast>=5&&this.time>=this.nextUpgrade&&this.level<QUALITY_LEVELS.length-1){this.setLevel(this.level+1);this.reset(5);}
  }
}
