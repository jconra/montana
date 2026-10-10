import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

// One transform target per authored object, including an editable proxy for
// instanced vegetation. Never transform a shared instanced geometry itself.
export function createSceneTransform({scene,camera,controls,canvas,landscape,placed,heightAt,getVex,onBuilding,stopDrive}){
 const gizmo=new TransformControls(camera,canvas);for(const [event,fn] of [['pointerdown','_onPointerDown'],['pointermove','_onPointerHover'],['pointermove','_onPointerMove'],['pointerup','_onPointerUp']])canvas.removeEventListener(event,gizmo[fn]);gizmo.setSize(.85);scene.add(gizmo);
 for(const mode of ['translate','scale','rotate'])for(const h of gizmo._gizmo.gizmo[mode].children)if(h.name==='XYZ'||h.name==='XYZE'){h.geometry.dispose();h.geometry=new THREE.SphereGeometry(.1,16,12);}
 const center=new THREE.Mesh(new THREE.SphereGeometry(.1,16,12),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthTest:false,depthWrite:false}));center.name='XYZE';center.renderOrder=Infinity;gizmo._gizmo.gizmo.rotate.add(center);
 const bar=document.createElement('div');bar.id='sceneTransform';bar.innerHTML=`<div id="stStatus" role="status">Select a tool, then an object</div><div class="st-buttons"><button data-mode="translate" title="Move along an axis; center sphere follows the ground" aria-pressed="false">Move</button><button data-mode="rotate" title="Rotate around an axis or freely with the center sphere" aria-pressed="false">Rotate</button><button data-mode="scale" title="Resize on an axis; center sphere resizes uniformly" aria-pressed="false">Scale</button><button id="stLock" aria-pressed="false">Lock</button><button id="stExport">Export edits</button></div>`;
 const style=document.createElement('style');style.textContent=`#sceneTransform{position:fixed;bottom:calc(var(--photo-bar-height, 32px) + 4px);right:0;z-index:45;background:#14202eea;color:#e6edf3;padding:8px;border:1px solid #526478;border-radius:10px;font:12px system-ui;max-width:calc(100vw - 36px)}#sceneTransform .st-buttons{display:flex;gap:5px;flex-wrap:wrap}#sceneTransform button{background:#28394b;color:inherit;border:1px solid #617080;border-radius:5px;padding:7px;cursor:pointer}#sceneTransform button[aria-pressed=true]{background:#26675f;border-color:#8cffe1}#stStatus{margin-bottom:6px}#stats{bottom:calc(var(--photo-bar-height, 32px) + 90px)}`;document.head.append(style);document.body.append(bar);
 const status=bar.querySelector('#stStatus'),lock=document.getElementById('lockGeometry'),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 let active=false,target=null,building=null,gesture=null;
 const buildingKey='montanaBuildingTransforms:v1';
 const buildingRows=()=>placed.map((r,i)=>({id:`${r.type}:${i}`,position:r.group.position.toArray(),rotation:r.group.rotation.toArray().slice(0,3),scale:r.group.scale.toArray()}));
 function applyBuildings(rows){for(const [i,r] of placed.entries()){const row=rows.find(v=>v.id===`${r.type}:${i}`);if(!row)continue;if(![row.position,row.rotation,row.scale].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||row.scale.some(v=>v<.01||v>100))continue;r.group.position.fromArray(row.position);r.group.rotation.set(...row.rotation);r.group.scale.fromArray(row.scale);r.x=row.position[0];r.z=row.position[2];r.foundationY=row.position[1]/getVex();}}
 try{applyBuildings(JSON.parse(localStorage.getItem(buildingKey)||'[]'));}catch(e){status.textContent='Building draft could not load';}
 function saveBuildings(){try{localStorage.setItem(buildingKey,JSON.stringify(buildingRows()));}catch(e){status.textContent='Export edits to save: browser storage is full';}}
 function pointerAt(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);return {x:pointer.x,y:pointer.y,button:e.button};}
 function ground(){return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-target.position.y),new THREE.Vector3());}
 function cancel(){if(!gesture)return;target.position.copy(gesture.position);target.quaternion.copy(gesture.quaternion);target.scale.copy(gesture.scale);gizmo.pointerUp({button:0});gesture=null;controls.enabled=true;}
 function disable(){cancel();active=false;gizmo.detach();target=null;building=null;landscape.setGizmoMode(false);for(const b of bar.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed','false');}
 function setMode(mode){if(lock.checked){status.textContent='Unlock geometry to edit';return;}if(active&&gizmo.mode===mode){disable();return;}if(!active){stopDrive();landscape.setGizmoMode(true);}active=true;gizmo.setMode(mode);for(const b of bar.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b.dataset.mode===mode);status.textContent=target?'Drag a colored axis or the center handle':'Click a building, tree, bush, rock, or property prop';}
 for(const b of bar.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
 function syncLock(){if(lock.checked)disable();bar.querySelector('#stLock').setAttribute('aria-pressed',lock.checked);bar.querySelector('#stLock').textContent=lock.checked?'Unlock':'Lock';}
 bar.querySelector('#stLock').onclick=()=>{lock.checked=!lock.checked;lock.dispatchEvent(new Event('change'));};lock.addEventListener('change',syncLock);syncLock();
 document.getElementById('leLockGeometry').addEventListener('change',syncLock);
 function consume(e){e.preventDefault();e.stopImmediatePropagation();}
 canvas.addEventListener('pointerdown',e=>{
  if(!active||lock.checked||e.button!==0)return;const p=pointerAt(e);scene.updateMatrixWorld(true);gizmo.pointerHover(p);
  if(target&&gizmo.axis){consume(e);gesture={before:landscape.beginTransform(),position:target.position.clone(),quaternion:target.quaternion.clone(),scale:target.scale.clone(),axis:gizmo.axis,ground:ground(),offset:target.position.y-heightAt(target.position.x,target.position.z)};controls.enabled=false;gizmo.pointerDown(p);canvas.setPointerCapture(e.pointerId);return;}
  const bh=ray.intersectObjects(placed.filter(r=>r.group.visible).map(r=>r.group),true)[0],lh=landscape.pick(e);
  if(bh&&(!lh||bh.distance<lh.distance)){let g=bh.object;while(g&&!placed.some(r=>r.group===g))g=g.parent;building=placed.find(r=>r.group===g);landscape.clearGizmoSelection();target=g;onBuilding(building);}
  else if(lh){building=null;target=landscape.selectForGizmo(lh.id);}else {gizmo.detach();target=null;return;}
  consume(e);gizmo.attach(target);status.textContent=building?`Selected ${building.type}`:'Selected landscape object';
 },true);
 canvas.addEventListener('pointermove',e=>{
  if(!active)return;const p=pointerAt(e);p.button=-1;if(!gesture){gizmo.pointerHover(p);return;}consume(e);
  if(gizmo.mode==='translate'&&gesture.axis==='XYZ'){
   // Project onto a horizontal plane, rather than the screen-facing drag
   // plane: camera tilt must never lift the object off the terrain.
   const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-gesture.position.y),hit=ray.ray.intersectPlane(plane,new THREE.Vector3());
   if(hit&&gesture.ground){target.position.copy(gesture.position).add(hit.sub(gesture.ground));target.position.y=heightAt(target.position.x,target.position.z)+gesture.offset;}
  }else {gizmo.pointerMove(p);if(gizmo.mode==='translate'&&gesture.axis==='XZ')target.position.y=heightAt(target.position.x,target.position.z)+gesture.offset;}
  target.scale.clampScalar(.01,100);target.updateMatrixWorld(true);
 },true);
 function finish(e){if(!gesture)return;consume(e);gizmo.pointerUp({button:0});if(building){building.x=target.position.x;building.z=target.position.z;building.foundationY=target.position.y/getVex();onBuilding(building);saveBuildings();}else{landscape.finishTransform(gesture.before);target=landscape.selectForGizmo(target.userData.id);gizmo.attach(target);}gesture=null;controls.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
 canvas.addEventListener('pointerup',finish,true);canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel,true);
 addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){cancel();gizmo.detach();target=null;landscape.clearGizmoSelection();}});
 bar.querySelector('#stExport').onclick=()=>{const data={format:'montana-scene-edits',version:1,buildings:buildingRows(),landscape:landscape.state.export()},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='montana-scene-edits.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 document.getElementById('editLandscape').addEventListener('click',()=>{if(active){disable();landscape.setActive(true);}});
 return {disable,get active(){return active;}};
}
