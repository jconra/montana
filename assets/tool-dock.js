import * as THREE from 'three';

// Existing controls retain their event handlers, but live in a single dock.
export function createToolDock({landscape,sceneTransform,paint,canvas,camera,controls,scene,heightAt,groundHit,stopDrive,stopRoute}){
 const $=id=>document.getElementById(id),rail=document.createElement('nav'),dock=document.createElement('section');
 rail.id='toolRail';rail.setAttribute('aria-label','Scene tools');dock.id='toolDock';dock.hidden=true;
 document.body.append(rail,dock);document.body.classList.add('tools-docked');
 const style=document.createElement('style');style.textContent=`
 .tools-docked #panel,.tools-docked #fab,.tools-docked #landscapeEditor,.tools-docked #photoBarToggle{display:none!important}
 #toolRail{position:fixed;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;z-index:60}
 #toolRail button,#toolRail a{box-sizing:border-box;width:49px;height:45px;display:grid;place-content:center;text-decoration:none;font:11px system-ui;padding:2px}
 #toolRail button,#toolRail a,#toolDock button{color:#ecf2f7;background:#203144eb;border:1px solid #657b91;border-radius:4px;cursor:pointer}
 #toolRail button[aria-pressed=true],#toolDock button[aria-pressed=true]{background:#21675c;border-color:#9debd7}
 #toolDock{position:fixed;bottom:0;left:0;right:0;z-index:55;background:#14202ef2;border-top:1px solid #63778b;color:#ecf2f7;font:12px system-ui;padding:6px 54px 6px 8px;max-height:35vh;overflow:auto;box-sizing:border-box}
 #toolDock [hidden]{display:none!important}#toolDock>div:not([hidden]),#toolDock #leTerrainTools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 #toolDock label{display:inline-flex;gap:5px;align-items:center;margin:0}#toolDock button{padding:7px}#toolDock button:disabled{opacity:.4;cursor:default}
 #toolDock input,#toolDock select{background:#203144;color:#fff;border:1px solid #657b91;border-radius:3px;padding:3px;max-width:220px}#toolDock input[type=number]{width:64px}#toolDock input[type=range]{width:85px}#toolDock #leTerrainTools>.le-help{display:none}#toolDock #leTerrainTools .le-row{flex-wrap:wrap}#toolDock fieldset{display:flex;gap:6px;align-items:center}
 #toolDock .le-row{display:flex;gap:6px;align-items:center}#toolDock p{margin:2px 0}#toolDock .le-help{max-width:380px;font-size:11px;color:#b7c5d1}
 #toolDock #sceneTransform,#toolDock #photoBar{position:static!important;max-width:none;width:100%;margin:0;padding:0;border:0;border-radius:0;background:none;font:inherit}
 #toolDock #photoBarTools{display:flex!important;flex-wrap:wrap;align-items:center;gap:8px}#toolDock #photoStatus{flex-basis:100%}
 #toolDock #sceneTransform{display:block}#toolDock #stStatus{margin-bottom:4px}#toolDock #stAsset{max-width:170px}
 .tools-docked #stats{bottom:auto;top:10px;left:10px;right:auto}.tools-docked #hud{top:45px}.tools-docked #info{max-width:190px}
 #dockClose{position:absolute;right:5px;top:5px}#toolDock textarea{max-width:240px}#toolDock summary{cursor:pointer}
 `;document.head.append(style);
 const panels=new Map(),buttons=new Map();let current=null,painting=false,stroke=null;
 const close=document.createElement('button');close.id='dockClose';close.textContent='×';close.title='Close toolbar';close.onclick=()=>open(null);dock.append(close);
 function panel(id,label){const p=document.createElement('div');p.hidden=true;p.id='dock-'+id;dock.append(p);panels.set(id,p);const b=document.createElement('button');b.textContent=label;b.title=label;b.setAttribute('aria-pressed','false');b.onclick=()=>open(current===id?null:id);rail.append(b);buttons.set(id,b);return p;}
 function move(p,id,label=false){const el=$(id);if(el)p.append(label?el.closest('label'):el);}
 const objects=panel('objects','Objects');move(objects,'sceneTransform');
 const terrain=panel('height','Height');move(terrain,'leTerrainTools');$('leTerrainTools').hidden=false;
 for(const id of ['leUndo','leRedo'])move(terrain,id);const heightCopy=document.createElement('button');heightCopy.textContent='Copy edits';heightCopy.onclick=async()=>{await $('stExport').onclick();$('leStatus').textContent=$('stStatus').textContent;};terrain.append(heightCopy);move(terrain,'leStatus');
 const surface=panel('paint','Paint');surface.innerHTML=`<label>Paint <select id="tpKind"><option value="green">Lush green</option><option value="dry">Dry grass</option><option value="grass">Grass surface</option><option value="gravel">Gravel</option><option value="erase">Erase paint</option></select></label><label>Radius (m) <input id="tpRadius" type="number" min="1" max="50" step="1" value="10"></label><label>Strength <input id="tpStrength" type="range" min="0.05" max="1" step="0.05" value="0.4"></label><button id="tpUndo">Undo</button><button id="tpRedo">Redo</button><button id="tpCopy">Copy edits</button><span id="tpStatus" role="status">Drag to paint with soft edges. Right-drag to navigate.</span>`;
 $('tpUndo').onclick=()=>paint.undo();$('tpRedo').onclick=()=>paint.redo();$('tpCopy').onclick=async()=>{await $('stExport').onclick();$('tpStatus').textContent=$('stStatus').textContent;};
 const photo=panel('photo','Photo');move(photo,'photoBar');$('photoBar').classList.remove('collapsed');
 const car=panel('car','Car');for(const id of ['drive','dU','dD','dL','dR'])move(car,id);const help=document.createElement('span');help.textContent='Drive / exit · WASD or arrow keys';car.append(help);
 const route=panel('route','Route');for(const id of ['routeGuides','radd','rclear','rdrive','rintro','rcopy'])move(route,id,id==='routeGuides');move(route,'rdump');
 const settings=panel('settings','Settings');for(const id of ['qualityMode','shadowQuality','targetFPS','groundDetail','groundGreen'])move(settings,id,true);move(settings,'qualityStatus');
 const advanced=document.createElement('details');advanced.innerHTML='<summary>Inspect & backups</summary>';settings.append(advanced);for(const id of ['coordinateMode','vex'])move(advanced,id,true);for(const id of ['mode','stand','dropcam','pondView','campView','leExport','leImport','leFile','leReset'])move(advanced,id);
 const labs=document.createElement('a');labs.href='./labs/';labs.textContent='Labs ↗';labs.title='Open experiments';rail.append(labs);
 // Height tools have their own history; object history includes placement/deletion.
 function open(id){
  finishPaint();painting=false;brush.visible=false;sceneTransform.disable();if(landscape.active)landscape.setActive(false);stopRoute();
  current=id;for(const [key,p] of panels){p.hidden=key!==id;buttons.get(key).setAttribute('aria-pressed',String(key===id));}dock.hidden=!id;
  if(id&&id!=='car'&&id!=='route')stopDrive();
  if(id==='height'){landscape.setActive(true);landscape.setMode('terrain');$('leTerrainTools').hidden=false;}
  if(id==='paint')painting=true;
  canvas.style.cursor=painting?'crosshair':'';
 }
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const brush=new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3)),new THREE.LineBasicMaterial({color:0xffdc89,depthTest:false}));brush.frustumCulled=false;brush.visible=false;brush.renderOrder=100;scene.add(brush);
 const clamp=(n,min,max,fallback)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
 function radius(){return clamp(+$('tpRadius').value,1,50,10);}
 function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);return groundHit(ray);}
 function mark(p){for(let i=0;i<64;i++){const a=i/64*Math.PI*2,x=p.x+Math.cos(a)*radius(),z=p.z+Math.sin(a)*radius();brush.geometry.attributes.position.setXYZ(i,x,heightAt(x,z)+.12,z);}brush.geometry.attributes.position.needsUpdate=true;brush.visible=true;}
 function dab(p){paint.dab({kind:$('tpKind').value,x:p.x,z:p.z,radius:radius(),opacity:clamp(+$('tpStrength').value,.05,1,.4)});}
 function consume(e){e.preventDefault();e.stopImmediatePropagation();}
 function finishPaint(){if(!stroke)return;const id=stroke.id;stroke=null;paint.finish();controls.enabled=true;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);$('tpStatus').textContent='Paint saved in this browser. Copy edits to share it.';}
 canvas.addEventListener('pointerdown',e=>{if(!painting||e.button!==0)return;const p=hit(e);if(!p)return;consume(e);paint.begin();stroke={id:e.pointerId,last:p.clone()};dab(p);mark(p);controls.enabled=false;canvas.setPointerCapture(e.pointerId);},true);
 canvas.addEventListener('pointermove',e=>{if(!painting)return;const p=hit(e);if(!p)return;mark(p);if(!stroke)return;consume(e);const distance=p.distanceTo(stroke.last),spacing=Math.max(.5,radius()*.2);if(distance>=spacing){const count=Math.min(200,Math.ceil(distance/spacing));for(let i=1;i<=count;i++)dab(stroke.last.clone().lerp(p,i/count));stroke.last.copy(p);}},true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(stroke){consume(e);finishPaint();}},true);
 addEventListener('keydown',e=>{if(!painting||e.target.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){consume(e);finishPaint();(e.shiftKey||e.key.toLowerCase()==='y')?paint.redo():paint.undo();}else if(e.key==='Escape'){finishPaint();open(null);}},true);
 open(null);return {open,get active(){return current;}};
}
