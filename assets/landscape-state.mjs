export const LANDSCAPE_FORMAT='montana-landscape';
export const LANDSCAPE_REVISION='property-20261006';
const copy=value=>JSON.parse(JSON.stringify(value));
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const canonical=o=>o&&typeof o==='object'?(Array.isArray(o)?o.map(canonical):Object.fromEntries(Object.keys(o).sort().map(k=>[k,canonical(o[k])]))):o;

// Files contain a patch against the deterministic property, never GPU instance
// indices or the currently visible LOD/density subset.
export class LandscapeState{
 constructor(base,assets,reference){
  this.base=new Map(base.map(o=>[o.id,copy(o)]));this.assets=new Set(assets);this.reference=copy(reference);
  this.overrides=new Map();this.added=new Map();this.removed=new Set();this.heights=new Map();
 }
 get(id){if(this.removed.has(id))return null;return this.added.get(id)||this.overrides.get(id)||this.base.get(id)||null;}
 all(){return [...this.base.keys(),...this.added.keys()].map(id=>this.get(id)).filter(Boolean);}
 set(value){const o=copy(value);if(this.base.has(o.id)){this.overrides.set(o.id,o);this.removed.delete(o.id);}else this.added.set(o.id,o);}
 remove(id){if(this.base.has(id)){this.removed.add(id);this.overrides.delete(id);}else this.added.delete(id);}
 export(){return {format:LANDSCAPE_FORMAT,version:1,revision:LANDSCAPE_REVISION,reference:copy(this.reference),objects:{overrides:[...this.overrides.values()].map(copy),added:[...this.added.values()].map(copy),removed:[...this.removed]},terrain:{heights:[...this.heights].sort((a,b)=>a[0]-b[0])}};}
 validate(input){
  if(!input||input.format!==LANDSCAPE_FORMAT||input.version!==1||input.revision!==LANDSCAPE_REVISION)throw Error('This is not a compatible Montana landscape export.');
  if(JSON.stringify(canonical(input.reference))!==JSON.stringify(canonical(this.reference)))throw Error('This file uses a different terrain grid or map origin.');
  const obj=input.objects,terrain=input.terrain;
  if(!obj||!terrain||![obj.overrides,obj.added,obj.removed,terrain.heights].every(Array.isArray))throw Error('The landscape file is missing object or terrain data.');
  if(obj.overrides.length+obj.added.length+obj.removed.length>100000||terrain.heights.length>this.reference.grid.W*this.reference.grid.H)throw Error('The landscape file is too large.');
  const seen=new Set();
  for(const [rows,added] of [[obj.overrides,false],[obj.added,true]])for(const o of rows){
   if(!o||typeof o.id!=='string'||o.id.length>150||seen.has(o.id)||(!added&&!this.base.has(o.id))||(added&&(!o.id.startsWith('added:')||this.base.has(o.id))))throw Error('An object ID is unknown or duplicated.');
   seen.add(o.id);
   if(!this.assets.has(o.asset)||!finite(o.x,-749,749)||!finite(o.z,-749,749)||!finite(o.offset,-1000,1000)||!finite(o.tint,0,2))throw Error('An object has an unknown model or invalid position.');
   if(!Array.isArray(o.rotation)||o.rotation.length!==3||!o.rotation.every(n=>finite(n,-100,100))||!Array.isArray(o.scale)||o.scale.length!==3||!o.scale.every(n=>finite(n,.01,100)))throw Error('An object has an invalid rotation or size.');
  }
  for(const id of obj.removed){if(typeof id!=='string'||!this.base.has(id)||seen.has(id))throw Error('A removed object ID is unknown or duplicated.');seen.add(id);}
  const vertices=new Set(),{W,H}=this.reference.grid;
  for(const entry of terrain.heights){if(!Array.isArray(entry)||entry.length!==2)throw Error('Invalid terrain vertex entry.');const [i,y]=entry;
   if(!Number.isInteger(i)||i<0||i>=W*H||vertices.has(i)||!finite(y,-1000,3000)||i%W<6||i%W>=W-6||Math.floor(i/W)<6||Math.floor(i/W)>=H-6)throw Error('Invalid terrain vertex height or boundary vertex.');vertices.add(i);
  }
  return copy(input);
 }
 load(input){const data=this.validate(input);this.overrides=new Map(data.objects.overrides.map(o=>[o.id,o]));this.added=new Map(data.objects.added.map(o=>[o.id,o]));this.removed=new Set(data.objects.removed);this.heights=new Map(data.terrain.heights);}
}

export class EditHistory{
 constructor(){this.undoStack=[];this.redoStack=[];}
 push(before,after){const a=JSON.stringify(before),b=JSON.stringify(after);if(a===b)return false;this.undoStack.push([a,b]);this.redoStack=[];while(this.undoStack.length>30||this.undoStack.length>1&&this.undoStack.reduce((n,p)=>n+p[0].length+p[1].length,0)>8e6)this.undoStack.shift();return true;}
 undo(){const item=this.undoStack.pop();if(!item)return null;this.redoStack.push(item);return JSON.parse(item[0]);}
 redo(){const item=this.redoStack.pop();if(!item)return null;this.undoStack.push(item);return JSON.parse(item[1]);}
}

export function brushVertices(grid,x,z,radius){
 const {W,H,px,half}=grid,rows=[];
 const x0=Math.max(6,Math.floor((x-radius+half)/px)),x1=Math.min(W-7,Math.ceil((x+radius+half)/px));
 const z0=Math.max(6,Math.floor((z-radius+half)/px)),z1=Math.min(H-7,Math.ceil((z+radius+half)/px));
 for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){const d=Math.hypot(i*px-half-x,j*px-half-z)/radius;if(d>=1)continue;const w=1-d*d*(3-2*d);rows.push({index:j*W+i,weight:w});}
 return rows;
}
