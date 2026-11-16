// Visitor controls: a menu in the top-right (Settings, Build, Labs), and along the bottom a Free Camera toggle and a
// Photos strip. A photo thumbnail puts the camera where the photo was taken and splits the screen: the 3D model on the
// left, the photo on the right, with a divider that drags sideways. Build mode swaps all of this for the tool rail.
export function createVisitorUI({controls,photoMatch,getToolDock,freeCamera,followCar}){
  const $=id=>document.getElementById(id),el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
  const style=el('style');style.textContent=`
  #vMenuBtn{position:fixed;top:10px;right:10px;z-index:70;width:44px;height:44px;border-radius:10px;font-size:22px;line-height:1;padding:0;background:#14202ee6;border:1px solid #657b91;color:#ecf2f7}
  #vMenu{position:fixed;top:60px;right:10px;z-index:70;display:flex;flex-direction:column;gap:4px;min-width:130px}
  #vMenu[hidden]{display:none}
  #vMenu button,#vMenu a{box-sizing:border-box;display:block;text-align:left;font:14px system-ui;padding:10px 14px;border-radius:8px;background:#14202ef2;border:1px solid #657b91;color:#ecf2f7;text-decoration:none;cursor:pointer}
  #vMenu [aria-pressed=true]{background:#21675c;border-color:#9debd7}
  #vBar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;display:flex;gap:10px}
  #vBar button{font:15px system-ui;padding:11px 18px;border-radius:22px;background:#14202ee6;border:1px solid #657b91;color:#ecf2f7;white-space:nowrap}
  #vBar button[aria-pressed=true]{background:#21675c;border-color:#9debd7}
  #vStrip{position:fixed;left:8px;top:10px;bottom:70px;z-index:60;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:2px;scrollbar-width:thin}
  #vStrip[hidden]{display:none}
  #vStrip button{flex:none;width:84px;height:63px;padding:0;border-radius:7px;overflow:hidden;border:2px solid #ffffff55;background:#203144;cursor:pointer}
  #vStrip button img{width:100%;height:100%;object-fit:cover;display:block}
  #vStrip button[aria-pressed=true]{border-color:#ffd479;box-shadow:0 0 0 2px #ffd47999}
  @media (orientation:portrait){#vStrip{top:10px;bottom:auto;right:62px;left:8px;flex-direction:row;overflow-x:auto;overflow-y:hidden}#vStrip button{width:76px;height:57px}}
  #vSplit{position:fixed;z-index:58;width:44px;margin-left:-22px;cursor:ew-resize;touch-action:none}
  #vSplit[hidden]{display:none}
  #vSplit::before{content:'';position:absolute;left:21px;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 4px #0008}
  #vSplit span{position:absolute;left:5px;top:50%;width:34px;height:34px;margin-top:-17px;border-radius:50%;background:#fff;color:#14202e;display:grid;place-content:center;font:bold 14px system-ui;box-shadow:0 1px 6px #0008}
  .vTag{position:fixed;top:14px;z-index:58;font:12px system-ui;color:#fff;background:#0009;padding:3px 8px;border-radius:10px;pointer-events:none}
  .vTag[hidden]{display:none}
  body.building #vBar,body.building #vStrip,body.dock-open #vBar{display:none}
  body:not(.building) #toolRail{display:none}
  `;document.head.append(style);

  // ---- menu ----
  const menuBtn=el('button',{id:'vMenuBtn',textContent:'☰',title:'Menu'});menuBtn.setAttribute('aria-label','Menu');
  const settingsBtn=el('button',{textContent:'Settings'}),buildBtn=el('button',{textContent:'Build'}),labs=el('a',{href:'./labs/',textContent:'Labs ↗'});
  const menu=el('nav',{id:'vMenu',hidden:true},settingsBtn,buildBtn,labs);menu.setAttribute('aria-label','Menu');
  menuBtn.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;};
  addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==menuBtn)menu.hidden=true;});
  settingsBtn.onclick=()=>{menu.hidden=true;const dock=getToolDock();if(dock)dock.open(dock.active==='settings'?null:'settings');};
  buildBtn.onclick=()=>{menu.hidden=true;setBuild(!document.body.classList.contains('building'));};
  function setBuild(on){
    document.body.classList.toggle('building',on);buildBtn.setAttribute('aria-pressed',String(on));buildBtn.textContent=on?'Leave build':'Build';
    if(on){closeCompare();setStrip(false);}else getToolDock()?.open(null);
  }

  // ---- bottom bar ----
  const camBtn=el('button',{textContent:'Free Camera'}),photosBtn=el('button',{textContent:'Photos'});
  photosBtn.setAttribute('aria-pressed','false');
  const bar=el('div',{id:'vBar'},camBtn,photosBtn);
  let following=true;
  function setFollowing(on,who='car'){following=on;camBtn.textContent=on?'Free Camera':who==='person'?'Back to Dad':'Back to Car';camBtn.setAttribute('aria-pressed','false');}
  camBtn.onclick=()=>{closeCompare();if(following)freeCamera();else followCar();};

  // ---- photos ----
  const strip=el('div',{id:'vStrip',hidden:true});strip.setAttribute('aria-label','Property photos');
  const split=el('div',{id:'vSplit',hidden:true},el('span',{textContent:'⇔'})),tagModel=el('div',{className:'vTag',textContent:'3D model',hidden:true}),tagPhoto=el('div',{className:'vTag',textContent:'Photo',hidden:true});
  let comparing=null,splitX=.5,thumbs=new Map();
  photoMatch.ready.then(()=>{for(const ref of photoMatch.solved()){
    const b=el('button',{title:ref.label},el('img',{src:`./assets/reference/thumbs/${ref.id}.jpg`,alt:ref.label,loading:'lazy'}));b.setAttribute('aria-pressed','false');
    b.onclick=()=>comparing===ref.id?closeCompare():openCompare(ref.id);strip.append(b);thumbs.set(ref.id,b);}});
  function setStrip(on){strip.hidden=!on;photosBtn.setAttribute('aria-pressed',String(on));if(!on)closeCompare();}
  photosBtn.onclick=()=>setStrip(strip.hidden);
  // The canvas is letterboxed to the photo, so the divider lives inside that frame.
  const frame=()=>document.querySelector('canvas#c').getBoundingClientRect();
  function placeSplit(){if(!comparing)return;const r=frame(),x=r.left+r.width*splitX,ov=$('ov');
    split.style.left=x+'px';split.style.top=r.top+'px';split.style.height=r.height+'px';ov.style.clipPath=`inset(0 0 0 ${x}px)`;
    tagModel.style.left=Math.max(r.left+8,x-90)+'px';tagPhoto.style.left=Math.min(r.right-60,x+10)+'px';tagModel.style.top=tagPhoto.style.top=Math.max(14,r.top+8)+'px';}
  function openCompare(id){
    getToolDock()?.open(null);photoMatch.choosePhoto(id);comparing=id;controls.enabled=false;setFollowing(false);
    const ov=$('ov');ov.classList.remove('photo-auto-fade');ov.style.opacity=1;
    for(const [k,b] of thumbs)b.setAttribute('aria-pressed',String(k===id));
    split.hidden=tagModel.hidden=tagPhoto.hidden=false;splitX=.5;placeSplit();if(!$('ov').complete)$('ov').addEventListener('load',placeSplit,{once:true});
  }
  function closeCompare(){if(!comparing)return;comparing=null;photoMatch.clear();controls.enabled=true;split.hidden=tagModel.hidden=tagPhoto.hidden=true;for(const b of thumbs.values())b.setAttribute('aria-pressed','false');}
  split.addEventListener('pointerdown',e=>{split.setPointerCapture(e.pointerId);e.preventDefault();});
  split.addEventListener('pointermove',e=>{if(!split.hasPointerCapture(e.pointerId))return;const r=frame();splitX=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));placeSplit();});
  addEventListener('resize',()=>requestAnimationFrame(placeSplit));
  addEventListener('keydown',e=>{if(e.key==='Escape'&&comparing)closeCompare();});

  document.body.append(menuBtn,menu,bar,strip,split,tagModel,tagPhoto);
  return {setBuild,setFollowing,closeCompare,dockChanged(id){document.body.classList.toggle('dock-open',!!id);if(id&&id!=='settings'&&id!=='photo'&&!document.body.classList.contains('building'))setBuild(true);if(id==='photo')closeCompare();}};
}
