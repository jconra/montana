import {parseAlignments,validCamera} from './photo-camera.mjs';
// Camera presets are estimates from fixed photo landmarks. Reference photos
// are loaded individually, never as part of the normal driving scene.
export const PHOTO_VIEWS={
  'house-drone':{label:'House · front drone',position:[15.5437, 150.3768, 48.1141],target:[12.2452, 136.162, 10.8708],fov:33.062,aspect:16/9},
  'garage-camp':{label:'Garage → fire pit',position:[-24,126.5,-4],target:[-24,124.5,32],fov:65,aspect:4/3},
  'house-cabin':{label:'House → cabin',position:[-3,127.6,-2],target:[-32,126.5,19],fov:65,aspect:4/3},
  'house-east':{label:'House, tank & clearing',position:[70,149,17],target:[-4,127,12],fov:52,aspect:16/9},
};
export function createPhotoMatch({camera,controls,renderer,stopDrive,onLens}){
  const $=id=>document.getElementById(id),overlay=$('ov'),canvas=renderer.domElement,bar=$('photoBar');
  const STORAGE='montanaPhotoAlignments:v1',baseRotateSpeed=controls.rotateSpeed||1;
  let photoURL=null,aspect=null,photo=null,roll=0,references=[],saved={},defaults={};
  let photoMode=false,rotateSpeed=+$('photoRotateSpeed')?.value||0.35,autoFade=false;
  const status=text=>$('photoStatus').textContent=text;
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(saved));return true;}catch(e){status('Browser storage is full. Export your alignments to keep them.');return false;}}
  function snapshot(){const ref=references.find(r=>r.id===photo);return {format:'montana-photo-camera',version:1,photo,filename:ref?.original||$('photo').files[0]?.name||null,position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,aspect:camera.aspect,roll};}
  function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function resize(){
    const locked=$('photoAspect').checked&&aspect;
    const width=locked?Math.min(innerWidth,innerHeight*aspect):innerWidth,height=locked?width/aspect:innerHeight;
    Object.assign(canvas.style,{position:'absolute',left:(innerWidth-width)/2+'px',top:(innerHeight-height)/2+'px',width:width+'px',height:height+'px'});
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  }
  function applyRoll(){if(roll){camera.lookAt(controls.target);camera.rotateZ(roll*Math.PI/180);}}
  function stopAutoFade(){overlay.classList.remove('photo-auto-fade');}
  function setOverlayOpacity(){if(!autoFade){const value=+$('ovop').value;overlay.style.opacity=value;$('ovopv').textContent=Math.round(value*100)+'%';}}
  function setAutoFade(value){
    autoFade=Boolean(value);stopAutoFade();
    if(autoFade){overlay.style.setProperty('--photo-fade-peak',Math.max(0,+$('ovop').value));overlay.style.removeProperty('opacity');overlay.classList.add('photo-auto-fade');}
    else setOverlayOpacity();
  }
  function setPhotoMode(active){
    photoMode=Boolean(active);if(bar)bar.hidden=!photoMode;
    if(photoMode){controls.rotateSpeed=rotateSpeed;}else{controls.rotateSpeed=baseRotateSpeed;stopAutoFade();}
  }
  function setView(v){
    stopDrive();setPhotoMode(true);controls.enabled=true;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
    camera.position.fromArray(v.position);controls.target.fromArray(v.target);camera.fov=v.fov;camera.up.set(0,1,0);controls.update();controls.enableDamping=damping;
    roll=v.roll||0;$('photoRoll').value=roll;$('photoRollValue').textContent=roll.toFixed(1)+'°';
    const ref=references.find(r=>r.id===photo);
    aspect=ref?ref.width/ref.height:overlay.naturalWidth?overlay.naturalWidth/overlay.naturalHeight:(v.aspect||aspect);onLens(v.fov);resize();applyRoll();
  }
  function loadPhoto(url){
    overlay.onload=()=>{aspect=overlay.naturalWidth/overlay.naturalHeight;$('photoAspect').checked=true;resize();if(autoFade)setAutoFade(true);};
    overlay.onerror=()=>status('The reference photo could not load.');overlay.src=url;overlay.style.display='block';$('ovtog').textContent='hide photo';setOverlayOpacity();
  }
  function choosePhoto(id,restore=true){
    const ref=references.find(r=>r.id===id);if(!ref)return;
    stopDrive();photo=id;$('photoReference').value=id;$('photoSource').href=ref.file;$('photoSource').hidden=false;setPhotoMode(true);
    aspect=ref.width/ref.height;
    const view=saved[id]||defaults[id]||PHOTO_VIEWS[ref.view];
    if(restore&&view)setView({...view,aspect});
    loadPhoto(ref.file);status(saved[id]?'Restored your saved alignment.':view?'Starting viewpoint loaded. Adjust and save the alignment.':'Photo loaded. Position the camera, then save the alignment.');
  }
  const ready=(async()=>{
    try{
      const response=await fetch('./assets/photo-references.json');if(!response.ok)throw Error('Photo list could not load.');references=await response.json();
      for(const ref of references)$('photoReference').add(new Option(ref.label,ref.id));
      const known=new Set(references.map(r=>r.id));
      try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');for(const [id,v] of Object.entries(raw))if(known.has(id)&&validCamera(v))saved[id]=v;}catch(e){status('Saved alignments could not be read. Import an exported file to restore them.');}
      const res=await fetch('./assets/photo-alignments.json');if(res.ok){const data=await res.json();for(const v of parseAlignments(data,known))if(v.photo)defaults[v.photo]=v;}
    }catch(error){status(error.message);}
  })();
  $('photoReference').onchange=e=>{if(e.target.value)choosePhoto(e.target.value);else{photo=null;overlay.style.display='none';$('photoSource').hidden=true;$('ovtog').textContent='show photo';setPhotoMode(false);}};
  for(const [id,v] of Object.entries(PHOTO_VIEWS))$('photoView').add(new Option(v.label,id));
  $('photoView').onchange=e=>{if(PHOTO_VIEWS[e.target.value])setView(PHOTO_VIEWS[e.target.value]);else setPhotoMode(false);};
  $('photo').onchange=e=>{const file=e.target.files[0];if(!file)return;stopDrive();photo=null;$('photoReference').value='';$('photoSource').hidden=true;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);setPhotoMode(true);loadPhoto(photoURL);status('Local photo loaded. Export camera includes its filename.');};
  $('ovop').oninput=e=>{$('ovopv').textContent=Math.round(+e.target.value*100)+'%';if(autoFade)overlay.style.setProperty('--photo-fade-peak',Math.max(0,+e.target.value));else setOverlayOpacity();};
  $('photoAutoFade').onchange=e=>setAutoFade(e.target.checked);
  $('photoRotateSpeed').oninput=e=>{rotateSpeed=+e.target.value;$('photoRotateValue').textContent=rotateSpeed.toFixed(2)+'×';if(photoMode)controls.rotateSpeed=rotateSpeed;};
  $('photoBarToggle').onclick=()=>{const collapsed=bar.classList.toggle('collapsed');$('photoBarToggle').setAttribute('aria-expanded',String(!collapsed));$('photoBarToggle').textContent=collapsed?'photo controls ▸':'photo controls';};
  $('ovtog').onclick=()=>{const on=overlay.style.display!=='none';overlay.style.display=on?'none':'block';$('ovtog').textContent=on?'show photo':'hide photo';if(on){stopAutoFade();}else if(autoFade)setAutoFade(true);};
  $('photoAspect').onchange=resize;
  $('photoRoll').oninput=e=>{roll=+e.target.value;$('photoRollValue').textContent=roll.toFixed(1)+'°';};
  $('photoSave').onclick=()=>{if(!photo){status('Choose a reference photo to save an alignment, or export the camera for a local photo.');return;}saved[photo]=snapshot();if(persist())status('Alignment saved in this browser. Export saved alignments to share it.');};
  $('photoExport').onclick=()=>download(snapshot(),'montana-camera-'+(photo||'local')+'.json');
  $('photoExportAll').onclick=()=>{if(photo){saved[photo]=snapshot();persist();}if(!Object.keys(saved).length){status('Save a photo alignment first.');return;}download({format:'montana-photo-alignments',version:1,alignments:Object.values(saved)},'montana-photo-alignments.json');};
  $('photoCamera').onchange=async e=>{
    try{const file=e.target.files[0];if(!file)return;await ready;const rows=parseAlignments(JSON.parse(await file.text()),new Set(references.map(r=>r.id)));
      for(const v of rows)if(v.photo)saved[v.photo]=v;const persisted=persist(),v=rows[0];
      if(v.photo)choosePhoto(v.photo);else{photo=null;$('photoReference').value='';setView(v);} $('photoView').value='';if(persisted)status(rows.length+' alignment(s) restored.');
    }catch(error){status(error.message);}finally{e.target.value='';}
  };
  addEventListener('resize',resize);resize();
  return {setView,resize,applyRoll,ready,choosePhoto};
}
