import * as THREE from 'three';
export function createTerrainPaint(half){
 const size=2048,make=()=>{const c=document.createElement('canvas');c.width=c.height=size;const texture=new THREE.CanvasTexture(c);texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;return {c,g:c.getContext('2d'),texture};};
 const moisture=make(),surface=make(),uniforms={paintMoisture:{value:moisture.texture},paintSurface:{value:surface.texture},paintHalf:{value:half}};
 let published=[],strokes=[],undo=[],redo=[];const copy=v=>JSON.parse(JSON.stringify(v));
 function draw(stroke){const layer=['green','dry'].includes(stroke.kind)?moisture:surface,g=layer.g,s=size/(2*half),x=(stroke.x+half)*s,y=(stroke.z+half)*s,r=stroke.radius*s;
  g.globalCompositeOperation=stroke.kind==='erase'?'destination-out':'source-over';
  const value=['green','gravel'].includes(stroke.kind)?255:0,gradient=g.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,`rgba(${value},0,0,${stroke.opacity})`);gradient.addColorStop(.25,`rgba(${value},0,0,${stroke.opacity*.85})`);gradient.addColorStop(1,`rgba(${value},0,0,0)`);
  g.fillStyle=gradient;g.fillRect(x-r,y-r,r*2,r*2);layer.texture.needsUpdate=true;
  if(stroke.kind==='erase'){const other=moisture.g;other.globalCompositeOperation='destination-out';other.fillStyle=gradient;other.fillRect(x-r,y-r,r*2,r*2);moisture.texture.needsUpdate=true;}
 }
 function rebuild(){for(const l of [moisture,surface]){l.g.clearRect(0,0,size,size);l.texture.needsUpdate=true;}strokes.forEach(draw);}
 function save(){try{localStorage.setItem('montanaTerrainPaint:v1',JSON.stringify(strokes));}catch(e){console.warn('Terrain paint draft could not be saved',e);}}
 function valid(rows){return Array.isArray(rows)&&rows.length<=50000&&new Set(rows.map(s=>s.id)).size===rows.length&&rows.every(s=>typeof s.id==='string'&&['green','dry','grass','gravel','erase'].includes(s.kind)&&[s.x,s.z,s.radius,s.opacity].every(Number.isFinite)&&Math.abs(s.x)<=half&&Math.abs(s.z)<=half&&s.radius>0&&s.radius<=100&&s.opacity>0&&s.opacity<=1);}
 const ready=(async()=>{const res=await fetch(new URL('./terrain-paint.json',import.meta.url));if(!res.ok)throw Error('Terrain paint defaults unavailable');published=await res.json();if(!valid(published))throw Error('Invalid terrain paint defaults');strokes=copy(published);try{const saved=JSON.parse(localStorage.getItem('montanaTerrainPaint:v1'));if(valid(saved))strokes=saved;}catch(e){}rebuild();})();
 return {uniforms,ready,published:()=>copy(published),export:()=>copy(strokes),begin(){undo.push(copy(strokes));if(undo.length>30)undo.shift();redo=[];},dab(s){const stroke={id:crypto.randomUUID(),...s};strokes.push(stroke);draw(stroke);},finish:save,undo(){if(!undo.length)return;redo.push(copy(strokes));strokes=undo.pop();rebuild();save();},redo(){if(!redo.length)return;undo.push(copy(strokes));strokes=redo.pop();rebuild();save();}};
}
