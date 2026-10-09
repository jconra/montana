import * as THREE from 'three';
import {LandscapeState,EditHistory,brushVertices} from './landscape-state.mjs';

const clone=o=>JSON.parse(JSON.stringify(o));
const DRAFT_KEY='montanaLandscapeDraft:v1';
export async function createLandscapeEditor({scene,camera,controls,canvas,fine,catalog,base,reference,bridge,getVex,enter,leave}){
 const state=new LandscapeState(base,catalog.keys(),reference),history=new EditHistory(),baseline=fine.baseY.slice();
 let published=state.export();
 const response=await fetch(new URL('./landscape-defaults.json',import.meta.url));
 if(!response.ok)throw Error('Published landscape defaults could not load.');
 published=state.validate(await response.json());state.load(published);
 let restored=false,saveWarning='';
 try{const draft=localStorage.getItem(DRAFT_KEY);if(draft){state.load(JSON.parse(draft));restored=true;}}catch(e){saveWarning='Saved draft was not loaded: '+e.message;}
 const panel=document.createElement('section');panel.id='landscapeEditor';panel.hidden=true;panel.setAttribute('aria-label','Landscape editor');
 panel.innerHTML=`<div class="le-title"><h2>Landscape editor</h2><button id="leClose" title="Close editor">Done</button></div>
 <div class="le-row"><button id="leObjects" aria-pressed="true">Objects</button><button id="leTerrain" aria-pressed="false">Terrain</button></div>
 <div class="le-row"><button id="leHouse">House view</button><button id="leTop">Top view</button></div>
 <div id="leObjectTools"><label>Select type<select id="leFilter"><option value="">All objects</option><option value="tree/">Trees</option><option value="rock/">Rocks</option><option value="bush/">Bushes</option><option value="prop/">Property props</option></select></label>
 <p class="le-help">Click an object to select it. Drag the selected object to move it along the ground. Right-drag to pan; drag empty space to orbit.</p>
 <div id="leSelection">Nothing selected</div>
 <fieldset id="leTransform" disabled style="border:0;padding:0;margin:0"><div class="le-row"><label>East X (m)<input id="leX" type="number" step="0.1" min="-749" max="749"></label><label>North (m)<input id="leNorth" type="number" step="0.1" min="-749" max="749"></label></div>
 <label>Above ground (m)<input id="leOffset" type="number" step="0.1" min="-1000" max="1000"></label>
 <div class="le-row"><label>Heading (°)<input id="leHeading" type="number" step="5" min="-360" max="360"></label><label>Size multiplier<input id="leSize" type="number" step="0.05" min="0.05" max="10"></label></div>
 <div class="le-row"><button id="leDuplicate">Duplicate</button><button id="leDelete" class="le-danger">Remove</button></div></fieldset>
 <h3>Add an object</h3><label>Model<select id="leAsset"></select></label><div class="le-row"><button id="leAdd">Place on ground…</button><button id="leCancelAdd" hidden>Cancel</button></div></div>
 <div id="leTerrainTools" hidden><p class="le-help">Click a vertex for an exact Y value, or drag a brush on the ground. Heights use normal (1×) vertical scale. Objects follow the edited ground.</p>
 <label>Tool<select id="leTerrainTool"><option value="vertex">Select vertex</option><option value="raise">Raise brush</option><option value="lower">Lower brush</option><option value="flatten">Flatten brush</option><option value="smooth">Smooth brush</option></select></label>
 <div class="le-row"><label>Brush radius (m)<input id="leRadius" type="number" min="1" max="20" step="0.5" value="3"></label><label>Step (m)<input id="leStep" type="number" min="0.01" max="3" step="0.05" value="0.25"></label></div>
 <label>Flatten to Y (m)<input id="leFlatten" type="number" min="-1000" max="3000" step="0.1" value="0"></label>
 <div class="le-row"><label><input id="leGrid" type="checkbox" checked> Show vertices</label><label><input id="leHideBuildings" type="checkbox"> Hide buildings</label></div>
 <div id="leVertexInfo" class="le-help">No vertex selected. The fine terrain grid covers the house and nearby land.</div>
 <fieldset id="leVertexTools" disabled style="border:0;margin:0;padding:0"><label>Vertex Y (m)<input id="leVertexY" type="number" step="0.05" min="-1000" max="3000"></label><div class="le-row"><button id="leDown">− step</button><button id="leUp">+ step</button><button id="leSample">Use for flatten</button></div></fieldset></div>
 <div class="le-row"><button id="leUndo" disabled>Undo</button><button id="leRedo" disabled>Redo</button></div>
 <details open><summary>Save &amp; share</summary><p class="le-help">A draft is saved in this browser. Export the JSON and send it to me to make these changes the published defaults.</p><div class="le-row"><button id="leExport">Export JSON</button><button id="leImport">Import JSON</button></div><input id="leFile" type="file" accept=".json,application/json" hidden><button id="leReset">Reset to published defaults</button></details>
 <p id="leStatus" role="status" aria-live="polite"></p>`;
 document.body.append(panel);const $=id=>panel.querySelector('#'+id);
 for(const [key,asset] of catalog){const option=document.createElement('option');option.value=key;option.textContent=asset.label;$('leAsset').append(option);}
 let active=false,mode='objects',selected=null,vertex=null,adding=false,gesture=null,preview=null,lastGrid=null,dirtyTerrain=false;
 $('leFlatten').value=(bridge.heightAt(8,-8)/getVex()).toFixed(3);
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),object=new THREE.Object3D(),box=new THREE.Box3(),localRay=new THREE.Ray(),inverse=new THREE.Matrix4(),hitPoint=new THREE.Vector3();
 const outline=new THREE.Box3Helper(new THREE.Box3(),0x8cffe1);outline.material.depthTest=false;outline.renderOrder=30;outline.visible=false;scene.add(outline);
 const pointGeo=new THREE.BufferGeometry();pointGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(8192*3),3));pointGeo.setDrawRange(0,0);
 const points=new THREE.Points(pointGeo,new THREE.PointsMaterial({color:0x8bead1,size:4,sizeAttenuation:false,depthTest:false}));points.frustumCulled=false;points.renderOrder=25;points.visible=false;scene.add(points);
 const vertexMarker=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xffda7b,depthTest:false}));vertexMarker.renderOrder=30;vertexMarker.visible=false;scene.add(vertexMarker);
 const brushGeo=new THREE.BufferGeometry();brushGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3));
 const brush=new THREE.LineLoop(brushGeo,new THREE.LineBasicMaterial({color:0xffda7b,depthTest:false}));brush.renderOrder=30;brush.visible=false;scene.add(brush);
 for(const asset of catalog.values()){asset.bounds=new THREE.Box3();for(const part of asset.parts){part.geometry.computeBoundingBox();asset.bounds.union(part.geometry.boundingBox);}}
 let previousHeights=new Map();
 function status(text){$('leStatus').textContent=text;}
 function save(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(state.export()));saveWarning='';}catch(e){saveWarning='Browser draft could not be saved. Export JSON to keep your work.';}const count=state.overrides.size+state.added.size+state.removed.size;status(saveWarning||`Draft saved · ${count} object edits · ${state.heights.size} terrain vertices`);}
 function syncHistory(){$('leUndo').disabled=!history.undoStack.length;$('leRedo').disabled=!history.redoStack.length;}
 function applyHeights(){
  let changed=false;for(const i of new Set([...previousHeights.keys(),...state.heights.keys()])){const y=state.heights.get(i)??baseline[i];if(fine.baseY[i]!==y){fine.baseY[i]=y;fine.pos.setY(i,y*getVex());changed=true;}}
  previousHeights=new Map(state.heights);if(changed){fine.pos.needsUpdate=true;dirtyTerrain=true;}return changed;
 }
 function finishTerrain(){if(!dirtyTerrain)return;fine.pos.needsUpdate=true;fine.mesh.geometry.computeVertexNormals();fine.mesh.geometry.computeBoundingBox();fine.mesh.geometry.computeBoundingSphere();bridge.terrainChanged();dirtyTerrain=false;if(lastGrid)showGrid(lastGrid.x,lastGrid.z);showVertex();}
 function applyObjects(){bridge.apply(state.all(),new Set([...state.overrides.keys(),...state.added.keys()]));}
 function applyDocument(){clearPreview();applyHeights();finishTerrain();applyObjects();if(selected&&!state.get(selected))selected=null;showSelection();if(active&&mode==='objects')showPreview();syncHistory();}
 function commit(before){if(history.push(before,state.export())){previousHeights=new Map(state.heights);finishTerrain();applyObjects();save();}showSelection();if(active&&mode==='objects')showPreview();syncHistory();}
 function restore(data){state.load(data);applyDocument();save();}
 function worldMatrix(rec){object.position.set(rec.x,bridge.heightAt(rec.x,rec.z)+rec.offset,rec.z);object.rotation.set(...rec.rotation);object.scale.set(...rec.scale);object.updateMatrix();return object.matrix;}
 function clearPreview(){if(preview){scene.remove(preview);preview.traverse(o=>{if(o.isMesh)o.material.dispose();});preview=null;}outline.visible=false;bridge.hide(null);}
 function showPreview(){
  const rec=state.get(selected);if(!rec||!active||mode!=='objects'){clearPreview();return;}
  if(!preview||preview.userData.id!==rec.id){clearPreview();preview=new THREE.Group();preview.userData.id=rec.id;
   for(const part of catalog.get(rec.asset).parts){const material=part.material.clone();if(!part.geometry.hasAttribute('color'))material.color.multiplyScalar(rec.tint);preview.add(new THREE.Mesh(part.geometry,material));}scene.add(preview);
  }
  preview.position.set(rec.x,bridge.heightAt(rec.x,rec.z)+rec.offset,rec.z);preview.rotation.set(...rec.rotation);preview.scale.set(...rec.scale);preview.updateMatrixWorld(true);outline.box.setFromObject(preview,true);outline.visible=true;bridge.hide(rec.id);
 }
 function showSelection(){const rec=state.get(selected);$('leTransform').disabled=!rec;if(!rec){$('leSelection').textContent='Nothing selected';return;}const original=state.base.get(rec.id)||catalog.get(rec.asset).defaults;
  $('leSelection').textContent=catalog.get(rec.asset).label+' · '+rec.id;
  $('leX').value=rec.x.toFixed(2);$('leNorth').value=(-rec.z).toFixed(2);$('leOffset').value=rec.offset.toFixed(2);$('leHeading').value=THREE.MathUtils.radToDeg(rec.rotation[1]).toFixed(1);$('leSize').value=(rec.scale[1]/original.scale[1]).toFixed(3);
 }
 function select(id){selected=id;showSelection();showPreview();}
 function pickObject(){let best=null,nearest=Infinity;const filter=$('leFilter').value,visible=bridge.visibleIds();
  // Test bounds in object space; this also selects shader-facing impostors,
  // whose CPU plane geometry does not follow their billboard shader.
  for(const rec of state.all()){
   if(rec.id!==selected&&!visible.has(rec.id))continue;
   if(filter&&!rec.asset.startsWith(filter))continue;
   const asset=catalog.get(rec.asset),matrix=worldMatrix(rec);box.copy(asset.bounds).applyMatrix4(matrix);if(!ray.ray.intersectsBox(box))continue;
   inverse.copy(matrix).invert();localRay.copy(ray.ray).applyMatrix4(inverse);if(!localRay.intersectBox(asset.bounds,hitPoint))continue;
   hitPoint.applyMatrix4(matrix);const distance=ray.ray.origin.distanceTo(hitPoint);if(distance<nearest){nearest=distance;best=rec.id;}
  }return best;
 }
 function eventRay(ev){const r=canvas.getBoundingClientRect();camera.updateMatrixWorld();ndc.set((ev.clientX-r.left)/r.width*2-1,1-(ev.clientY-r.top)/r.height*2);ray.setFromCamera(ndc,camera);}
 function groundHit(){return bridge.groundHit(ray);}
 function editableIndex(point){const i=Math.round((point.x+fine.half)/fine.px),j=Math.round((point.z+fine.half)/fine.px);return i>=6&&i<fine.W-6&&j>=6&&j<fine.H-6?j*fine.W+i:null;}
 function showGrid(x,z){lastGrid={x,z};const positions=[];for(const p of brushVertices(fine,x,z,Math.max(8,Math.min(20,+$('leRadius').value||3)+2))){positions.push(fine.pos.getX(p.index),fine.baseY[p.index]*getVex()+.07,fine.pos.getZ(p.index));}pointGeo.attributes.position.array.set(positions);pointGeo.attributes.position.needsUpdate=true;pointGeo.setDrawRange(0,positions.length/3);points.visible=active&&mode==='terrain'&&$('leGrid').checked;}
 function showVertex(){if(vertex==null){vertexMarker.visible=false;return;}const y=fine.baseY[vertex],x=fine.pos.getX(vertex),z=fine.pos.getZ(vertex);vertexMarker.position.set(x,y*getVex()+.12,z);vertexMarker.visible=active&&mode==='terrain';$('leVertexTools').disabled=false;$('leVertexY').value=y.toFixed(3);$('leVertexInfo').textContent=`Vertex ${vertex} · E ${x.toFixed(2)} · N ${(-z).toFixed(2)} m`;}
 function writeHeight(i,y){if(!Number.isFinite(y)||y< -1000||y>3000)throw Error('Height must be between −1000 and 3000 metres.');y=Math.fround(y);if(Math.abs(y-baseline[i])<.00001)y=baseline[i];previousHeights.set(i,y);dirtyTerrain=true;fine.baseY[i]=y;fine.pos.setY(i,y*getVex());fine.pos.needsUpdate=true;if(y===baseline[i])state.heights.delete(i);else state.heights.set(i,y);}
 function paint(point){const radius=Math.max(1,Math.min(20,+$('leRadius').value||3)),step=Math.max(.01,Math.min(3,+$('leStep').value||.25)),tool=$('leTerrainTool').value,target=+$('leFlatten').value;
  if(tool==='flatten'&&(!Number.isFinite(target)||target< -1000||target>3000)){status('Flatten height must be between −1000 and 3000 metres.');return;}
  const changes=brushVertices(fine,point.x,point.z,radius).map(({index:i,weight:w})=>{const y=fine.baseY[i];let next=y;if(tool==='raise'||tool==='lower')next=y+w*step*(tool==='raise'?1:-1);else if(tool==='flatten')next=y+(target-y)*w;else if(tool==='smooth'){const average=(fine.baseY[i-1]+fine.baseY[i+1]+fine.baseY[i-fine.W]+fine.baseY[i+fine.W])/4;next=y+(average-y)*w*.5;}return [i,Math.max(-1000,Math.min(3000,next))];});
  for(const [i,y] of changes)writeHeight(i,y);showGrid(point.x,point.z);showVertex();
 }
 function brushAt(point){const positions=brush.geometry.attributes.position.array,radius=Math.max(1,Math.min(20,+$('leRadius').value||3));for(let i=0;i<64;i++){const a=i/64*Math.PI*2,x=point.x+Math.cos(a)*radius,z=point.z+Math.sin(a)*radius;positions.set([x,bridge.heightAt(x,z)+.1,z],i*3);}brush.geometry.attributes.position.needsUpdate=true;brush.geometry.computeBoundingSphere();brush.visible=$('leTerrainTool').value!=='vertex';}
 function addAt(point,source=null){const asset=source?.asset||$('leAsset').value,rec=clone(source||catalog.get(asset).defaults);rec.id='added:'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));rec.asset=asset;rec.x=point.x;rec.z=point.z;const before=state.export();state.set(rec);selected=rec.id;setAdding(false);commit(before);}
 function setAdding(on){adding=on;$('leAdd').textContent=on?'Click the ground…':'Place on ground…';$('leCancelAdd').hidden=!on;canvas.style.cursor=on?'crosshair':'';}
 function cancelGesture(){if(!gesture)return;const before=gesture.before;gesture=null;controls.enabled=true;restore(before);}
 function finishGesture(ev){if(!gesture)return;const g=gesture;gesture=null;controls.enabled=true;if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);commit(g.before);}
 canvas.addEventListener('pointerdown',ev=>{
  if(!active||ev.button!==0)return;
  // Captured pointer gestures prevent the browser's normal focus change.
  // Commit the old field before selecting a different object or vertex.
  if(panel.contains(document.activeElement))document.activeElement.blur();
  eventRay(ev);const point=groundHit();
  if(mode==='objects'){
   if(adding){ev.preventDefault();ev.stopImmediatePropagation();if(point)addAt(point);return;}
   const id=pickObject();if(!id)return;ev.preventDefault();ev.stopImmediatePropagation();select(id);
   if(point){gesture={kind:'object',before:state.export(),start:point.clone(),record:clone(state.get(id)),px:ev.clientX,py:ev.clientY,pointerId:ev.pointerId};controls.enabled=false;canvas.setPointerCapture(ev.pointerId);}
  }else{
   ev.preventDefault();ev.stopImmediatePropagation();if(!point)return;vertex=editableIndex(point);if(vertex==null){status('Terrain editing is available inside the fine grid, away from its outer seam.');return;}showGrid(point.x,point.z);showVertex();
   if($('leTerrainTool').value!=='vertex'){gesture={kind:'terrain',before:state.export(),last:point.clone(),pointerId:ev.pointerId};controls.enabled=false;canvas.setPointerCapture(ev.pointerId);paint(point);}
  }
 },true);
 canvas.addEventListener('pointermove',ev=>{
  if(!active)return;eventRay(ev);const point=groundHit();if(!point)return;
  if(mode==='terrain'){showGrid(point.x,point.z);brushAt(point);}
  if(!gesture)return;ev.preventDefault();ev.stopImmediatePropagation();
  if(gesture.kind==='object'){
   if(Math.hypot(ev.clientX-gesture.px,ev.clientY-gesture.py)<4)return;
   const rec=clone(gesture.record);rec.x=Math.max(-749,Math.min(749,rec.x+point.x-gesture.start.x));rec.z=Math.max(-749,Math.min(749,rec.z+point.z-gesture.start.z));state.set(rec);showSelection();showPreview();
  }else if(point.distanceTo(gesture.last)>Math.max(.4,+$('leRadius').value*.25)){paint(point);gesture.last.copy(point);}
 },true);
 canvas.addEventListener('pointerup',ev=>{if(!gesture)return;ev.preventDefault();ev.stopImmediatePropagation();finishGesture(ev);},true);
 canvas.addEventListener('pointercancel',cancelGesture,true);
 canvas.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
 function changeObject(id){const rec=clone(state.get(selected));if(!rec)return;const before=state.export(),original=state.base.get(rec.id)||catalog.get(rec.asset).defaults,value=+$(id).value;
  if(id==='leX')rec.x=value;else if(id==='leNorth')rec.z=-value;else if(id==='leOffset')rec.offset=value;else if(id==='leHeading')rec.rotation[1]=THREE.MathUtils.degToRad(value);else if(id==='leSize')rec.scale=original.scale.map(n=>n*value);
  const candidate=clone(before),list=state.base.has(rec.id)?candidate.objects.overrides:candidate.objects.added;const index=list.findIndex(o=>o.id===rec.id);if(index<0)list.push(rec);else list[index]=rec;
  try{state.load(candidate);commit(before);}catch(e){status(e.message);showSelection();}
 }
 for(const id of ['leX','leNorth','leOffset','leHeading','leSize']){let dirty=false;$(id).addEventListener('input',()=>{dirty=true;});$(id).addEventListener('change',()=>{if(dirty){dirty=false;changeObject(id);}});}
 function remove(){if(!selected)return;const before=state.export();state.remove(selected);selected=null;clearPreview();commit(before);}
 $('leDelete').onclick=remove;$('leDuplicate').onclick=()=>{const rec=state.get(selected);if(rec)addAt({x:Math.min(748,rec.x+2),z:rec.z},rec);};
 $('leAdd').onclick=()=>setAdding(!adding);$('leCancelAdd').onclick=()=>setAdding(false);
 function setMode(value){mode=value;setAdding(false);clearPreview();$('leObjectTools').hidden=mode!=='objects';$('leTerrainTools').hidden=mode!=='terrain';$('leObjects').setAttribute('aria-pressed',mode==='objects');$('leTerrain').setAttribute('aria-pressed',mode==='terrain');points.visible=mode==='terrain'&&$('leGrid').checked;brush.visible=false;showVertex();if(mode==='objects')showPreview();else{const p=controls.target;showGrid(p.x,p.z);}}
 $('leObjects').onclick=()=>setMode('objects');$('leTerrain').onclick=()=>setMode('terrain');
 $('leGrid').onchange=()=>{points.visible=active&&mode==='terrain'&&$('leGrid').checked;};$('leHideBuildings').onchange=()=>bridge.hideBuildings($('leHideBuildings').checked);
 function vertexChange(y){if(vertex==null)return;const before=state.export();try{writeHeight(vertex,y);commit(before);}catch(e){status(e.message);showVertex();}}
 let vertexDirty=false;$('leVertexY').oninput=()=>{vertexDirty=true;};$('leVertexY').onchange=()=>{if(vertexDirty){vertexDirty=false;vertexChange(+$('leVertexY').value);}};$('leDown').onclick=()=>vertexChange(fine.baseY[vertex]-(+$('leStep').value||.25));$('leUp').onclick=()=>vertexChange(fine.baseY[vertex]+(+$('leStep').value||.25));$('leSample').onclick=()=>{$('leFlatten').value=fine.baseY[vertex].toFixed(3);};
 function undo(){const data=history.undo();if(data)restore(data);}function redo(){const data=history.redo();if(data)restore(data);}
 $('leUndo').onclick=undo;$('leRedo').onclick=redo;
 $('leHouse').onclick=()=>{const y=bridge.heightAt(8,-8);camera.position.set(40,y+34,38);controls.target.set(8,y,-8);controls.update();if(mode==='terrain')showGrid(8,-8);};
 $('leTop').onclick=()=>{const p=controls.target,y=bridge.heightAt(p.x,p.z);camera.position.set(p.x,y+70,p.z+.01);controls.target.set(p.x,y,p.z);controls.update();};
 $('leExport').onclick=()=>{const blob=new Blob([JSON.stringify(state.export(),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='montana-landscape-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Export downloaded. Send that JSON file to publish this layout.');};
 $('leImport').onclick=()=>$('leFile').click();$('leFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>12e6)throw Error('Import is limited to 12 MB.');const before=state.export(),data=JSON.parse(await file.text());state.load(data);history.push(before,state.export());selected=null;applyDocument();save();status('Imported landscape. '+(saveWarning||'Draft saved in this browser.'));}catch(error){status('Import failed: '+error.message);}e.target.value='';};
 $('leReset').onclick=()=>{const before=state.export();state.load(published);history.push(before,state.export());selected=null;applyDocument();save();};
 function setActive(value){if(gesture)cancelGesture();active=value;panel.hidden=!value;setAdding(false);if(value){enter();showSelection();if(mode==='objects')showPreview();else{showGrid(controls.target.x,controls.target.z);showVertex();}bridge.hideBuildings($('leHideBuildings').checked);}else{clearPreview();points.visible=brush.visible=vertexMarker.visible=false;bridge.hideBuildings(false);controls.enabled=true;leave();}}
 $('leClose').onclick=()=>setActive(false);
 addEventListener('keydown',e=>{if(!active||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();e.key.toLowerCase()==='y'||e.shiftKey?redo():undo();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();if(mode==='objects')remove();}else if(e.key==='Escape'){e.preventDefault();if(gesture)cancelGesture();else if(adding)setAdding(false);else{selected=null;showSelection();clearPreview();}}},true);
 applyDocument();status(saveWarning||(restored?'Restored your saved browser draft.':'Ready. Changes are saved as a browser draft until you export them.'));
 return {state,setActive,get active(){return active;},refresh(){if(active){showPreview();showVertex();if(lastGrid)showGrid(lastGrid.x,lastGrid.z);}},setQuality:bridge.setQuality,update:bridge.update};
}
