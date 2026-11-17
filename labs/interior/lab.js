// INTERIOR LAB: line the house up with the 2012 photos, then move walls, doors and furniture until they sit on them.
// Everything is in the house's own feet (+x east, +z south toward the drive, ground floor top 0.6, upstairs 9.6), built by
// the game's own code (assets/house-model.js, assets/interior.js), so what lines up here is what the game shows.
//   1. pick a photo; 2. pin spots (a spot in the photo, then the same spot on the model; corners snap) and the camera solves;
//   3. move things (drag in the view or on the plan) until model and photo agree; 4. download the three files.
import * as THREE from 'three';
import { buildHouse } from '../../assets/house-model.js';
import { PIECES, COLORS, colorOf, buildItem, FLOOR_TOPS } from '../../assets/interior.js';
import { solveCamera, searchCamera, pinMiss } from '../../assets/camera-solve.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
const BASE = '../../assets/';
const KEY = { house: 'interiorLab:house', items: 'interiorLab:items', align: 'interiorLab:align', wins: 'interiorLab:windows', prefs: 'interiorLab:prefs2' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* private window */ } },
};
const status = (t) => { $('status').textContent = t; };
const fetchJSON = async (u) => (await fetch(u, { cache: 'no-cache' })).json();
const SNAP = 1 / 12;                                          // one inch
const snapLen = (v, on = true) => on ? Math.round(v / SNAP) * SNAP : v;
const ftin = (v) => { const s = v < 0 ? '−' : '', a = Math.abs(v), f = Math.floor(a + 1e-9), i = Math.round((a - f) * 12); return i === 12 ? `${s}${f + 1}′0″` : `${s}${f}′${i}″`; };
// "12.5", "12'6", "12' 6\"", "150\"" -> feet
const parseLen = (s) => { s = String(s).trim().replace(/[″”]/g, '"').replace(/[′’]/g, "'"); let m;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/))) return (+m[1] < 0 ? -1 : 1) * (Math.abs(+m[1]) + (+m[2] || 0) / 12);
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*"$/))) return +m[1] / 12;
  const v = parseFloat(s); return Number.isFinite(v) ? v : null; };

// ---- the data: the site's files, or this browser's draft of them ----------------------------------------------------
const site = {
  house: await fetchJSON(BASE + 'montana-home.json'), interior: await fetchJSON(BASE + 'montana-interior.json'),
  align: await fetchJSON(BASE + 'inside/alignments.json'), photos: await fetchJSON(BASE + 'inside/photos.json'),
};
// the house and furniture are kept here only once you change them (so until then the site's newest versions show)
const kept = (k) => { const d = store.get(k); return d?.lab === 2 ? d.data : null; };
let house = kept(KEY.house) || structuredClone(site.house);
let interior = kept(KEY.items) || structuredClone(site.interior);
let align = store.get(KEY.align) || structuredClone(site.align);
const photos = site.photos;
const prefs = Object.assign({ photo: null, opacity: .5, lines: false, cut: 30, doorsOpen: true, light: 1, lockLens: true, tool: 'pin', showItems: true }, store.get(KEY.prefs) || {});
const savePrefs = () => store.set(KEY.prefs, prefs);
let savedAt = null;
function saveDraft() {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), keep = (k, v, s) => { if (same(v, s)) { store.del(k); return true; } return store.set(k, { lab: 2, data: v }); };
  const ok = keep(KEY.house, house, site.house) & keep(KEY.items, interior, site.interior) & store.set(KEY.align, align); savedAt = new Date(); refreshSave(!!ok);
}
const tops = () => interior.floorTops || FLOOR_TOPS;
const alignOf = (id, make = false) => { let a = align.alignments.find((x) => x.photo === id); if (!a && make) { a = { photo: id, pins: [] }; align.alignments.push(a); } return a; };

// undo: whole snapshots of the three files (small)
const undo = [], redo = [];
const snap = () => JSON.stringify({ house, interior, align });
function pushUndo() { undo.push(snap()); if (undo.length > 80) undo.shift(); redo.length = 0; }
function restore(s) { const o = JSON.parse(s); house = o.house; interior = o.interior; align = o.align; rebuildHouse(); buildItems(); const a = photo && alignOf(photo.id); if (a?.position) toAlignment(a); refreshAll(); saveDraft(); }
function doUndo() { if (!undo.length) return; redo.push(snap()); restore(undo.pop()); status('Undone.'); }
function doRedo() { if (!redo.length) return; undo.push(snap()); restore(redo.pop()); status('Redone.'); }

// ---- the 3D view ----------------------------------------------------------------------------------------------------
const view = $('view'), canvas = $('c'), marks = $('marks'), photoImg = $('photo'), mctx = marks.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(), lineScene = new THREE.Scene(), SKY = new THREE.Color('#a9bccb');
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f6a, 1.5), amb = new THREE.AmbientLight(0xffffff, .55), sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
sun.position.set(30, 60, 40); scene.add(hemi, amb, sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6f7a4c', roughness: 1 }));
ground.position.y = -.05; scene.add(ground);
const camera = new THREE.PerspectiveCamera(60, 1, .05, 2000); camera.rotation.order = 'YXZ';
camera.position.set(-12, 5.4, 5); camera.rotation.set(0, -Math.PI / 2 + .3, 0);
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 30);
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

let houseGroup = null, doorLeaves = [], linesDirty = true;
const disposeTree = (o) => o.traverse((m) => { m.geometry?.dispose?.(); });
function rebuildHouse() {
  if (houseGroup) { scene.remove(houseGroup); disposeTree(houseGroup); }
  try { houseGroup = buildHouse(THREE, house); } catch (e) { console.error(e); status('The house could not build: ' + e.message); houseGroup = new THREE.Group(); }
  doorLeaves = []; houseGroup.traverse((o) => { if (o.userData.door) doorLeaves.push(o); });
  setDoors(); scene.add(houseGroup); linesDirty = true;
}
function setDoors() { for (const l of doorLeaves) l.rotation.y = prefs.doorsOpen && l.userData.door.startOpen ? l.userData.door.open : l.userData.door.closed; linesDirty = true; }
let rebuildTimer = 0, rebuildLast = 0;
function requestRebuild() {                                   // while dragging a wall: rebuild at most a few times a second
  if (rebuildTimer) return; const wait = Math.max(0, 140 - (performance.now() - rebuildLast));
  rebuildTimer = setTimeout(() => { rebuildTimer = 0; rebuildLast = performance.now(); rebuildHouse(); }, wait);
}

const itemsGroup = new THREE.Group(), itemObj = new Map(); scene.add(itemsGroup);
function buildItems() {
  for (const o of itemObj.values()) { itemsGroup.remove(o); disposeTree(o); } itemObj.clear();
  for (const it of interior.items) addItemObj(it);
  linesDirty = true; markSelection();
}
function addItemObj(it) { const g = buildItem(it, tops()); itemsGroup.add(g); itemObj.set(it.id, g); }
function rebuildItem(it) { const old = itemObj.get(it.id); if (old) { itemsGroup.remove(old); disposeTree(old); } if (interior.items.includes(it)) addItemObj(it); linesDirty = true; markSelection(); }

// outline mode: the model's edges over the full photo (the solid model only hides lines behind it)
const lineMat = new THREE.LineBasicMaterial({ color: '#3fe0ff' });
function rebuildLines() {
  for (const c of [...lineScene.children]) { lineScene.remove(c); c.geometry.dispose(); }
  const add = (root) => root.traverse((m) => {
    if (!m.isMesh || !m.visible) return; let v = true; for (let a = m; a; a = a.parent) if (!a.visible) v = false; if (!v) return;
    const e = new THREE.EdgesGeometry(m.geometry, 25); e.applyMatrix4(m.matrixWorld); lineScene.add(new THREE.LineSegments(e, lineMat));
  });
  scene.updateMatrixWorld(true); if (houseGroup) add(houseGroup); if (itemsGroup.visible) add(itemsGroup); linesDirty = false;
}

// selection outline
const selLines = new THREE.Group(); scene.add(selLines);
const selMat = new THREE.LineBasicMaterial({ color: '#f0a33a', depthTest: false, transparent: true });
let sel = null;                                                   // {kind:'item', id} | {kind:'wall', floor, wi} | {kind:'stairs', i}
function markSelection() {
  for (const c of [...selLines.children]) { selLines.remove(c); c.geometry.dispose(); }
  const pts = [], box = (poly, y0, h) => { for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length];
    pts.push(a[0], y0, a[1], b[0], y0, b[1], a[0], y0 + h, a[1], b[0], y0 + h, b[1], a[0], y0, a[1], a[0], y0 + h, a[1]); } };
  if (sel?.kind === 'item') { const g = itemObj.get(sel.id); for (const f of g?.userData.feet || []) box(f.poly, f.y0 + .02, Math.max(.1, f.h)); }
  if (sel?.kind === 'wall') { const w = wallOf(sel); if (w) { const fy = floorY(sel.floor), h = w.h ?? (house.floors[sel.floor].h || 9), n = wallNormal(w), t = .25;
    box([[w.x0 + n[0] * t, w.z0 + n[1] * t], [w.x1 + n[0] * t, w.z1 + n[1] * t], [w.x1 - n[0] * t, w.z1 - n[1] * t], [w.x0 - n[0] * t, w.z0 - n[1] * t]], fy - .6, h); } }
  if (sel?.kind === 'stairs') { const s = house.stairs[sel.i]; if (s) box(stairPoly(s), floorY(s.floor || 0) - .6, house.floors[s.floor || 0].h || 9); }
  if (pts.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineSegments(g, selMat); l.renderOrder = 9; selLines.add(l); }
}

// ---- house data helpers --------------------------------------------------------------------------------------------
const floorY = (fi) => { let y = 0; for (let i = 0; i < fi; i++) y += house.floors[i].h || 9; return y + .6; };
const wallOf = (s) => house.floors[s.floor]?.walls?.[s.wi];
const wallNormal = (w) => { const dx = w.x1 - w.x0, dz = w.z1 - w.z0, L = Math.hypot(dx, dz) || 1; return [-dz / L, dx / L]; };
const DIRS = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
function stairPoly(s) { const [ux, uz] = DIRS[s.dir || 'N'], run = s.run || 10, w = s.w || 3, px = -uz, pz = ux;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [s.x + ux * run / 2 * a + px * w / 2 * b, s.z + uz * run / 2 * a + pz * w / 2 * b]); }
const itemById = (id) => interior.items.find((i) => i.id === id);
const floorOfCamera = () => camera.position.y > tops()[1] - .2 ? 1 : 0;

// ---- layout: the view keeps the photo's shape ------------------------------------------------------------------------
let photo = null;                                                // the photo record being matched, or null
const aspectOf = (p) => p.width / p.height;
function layout() {
  const W = innerWidth, H = innerHeight; let w = W, h = H;
  if (photo) { const a = aspectOf(photo); if (W / H > a) w = H * a; else h = W / a; }
  Object.assign(view.style, { left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px', width: w + 'px', height: h + 'px' });
  renderer.setSize(w, h, false); marks.width = w * devicePixelRatio; marks.height = h * devicePixelRatio;
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', layout);
const inset = el('div', { style: 'position:fixed;z-index:5;pointer-events:none;border:2px solid #ffd84a;border-radius:6px;overflow:hidden;display:none;box-shadow:0 4px 18px #000a' });
const insetImg = el('img', { style: 'display:block;width:100%;height:100%' }), insetMark = el('div', { style: 'position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid #ffd84a;border-radius:50%;box-shadow:0 0 0 2px #000' });
inset.append(insetImg, insetMark); document.body.append(inset);
function showInset() {                                            // while choosing the model spot: the photo, small, with the spot marked
  if (!photo || !pinStage) { inset.style.display = 'none'; return; }
  const r = view.getBoundingClientRect(), w = Math.min(260, r.width * .32), h = w / aspectOf(photo);
  Object.assign(inset.style, { display: '', left: r.left + 10 + 'px', top: r.bottom - h - 10 + 'px', width: w + 'px', height: h + 'px' });
  insetImg.src = photoImg.src; insetMark.style.left = pinStage.u * 100 + '%'; insetMark.style.top = pinStage.v * 100 + '%';
}
function applyOverlay() { showInset();
  photoImg.style.display = photo ? '' : 'none';
  const hidePhoto = pinStage && pinStage.u != null;            // choosing the model spot: the model alone
  if (!photo || hidePhoto) { canvas.style.opacity = 1; photoImg.style.opacity = hidePhoto ? 0 : 1; }
  else if (prefs.lines) { canvas.style.opacity = 1; photoImg.style.opacity = 1; }
  else { canvas.style.opacity = 1 - prefs.opacity; photoImg.style.opacity = 1; }
}

function setPhoto(id) {
  pinStage = null;
  photo = photos.find((p) => p.id === id) || null; prefs.photo = photo?.id || null; savePrefs();
  if (photo) {
    photoImg.src = BASE + 'inside/' + photo.file;
    const a = alignOf(photo.id);
    if (a?.position) toAlignment(a); else { camera.fov = photo.vfov || 50; camera.rotation.z = 0; }
  }
  layout(); applyOverlay(); refreshPhotos(); refreshCamera();
  status(photo ? `${photo.label} · ${photo.taken}` + (alignOf(photo.id)?.position ? '' : ' — not placed yet: fly near where it was taken, then pin spots.') : 'No photo: fly anywhere.');
}
const sane = (a) => { if (!a?.position) return false; const [x, y, z] = a.position, q = a.q, up = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);
  return up > .3 && x > -34 && x < 26 && z > -14 && z < 15 && y > 1 && y < 18; };
for (const a of align.alignments) if (a.position && !sane(a)) { delete a.position; delete a.q; delete a.rms; }   // lost cameras from older solves
function toAlignment(a) { camera.position.fromArray(a.position); camera.quaternion.fromArray(a.q); camera.fov = a.fov; camera.updateProjectionMatrix(); }

// ---- flying ----------------------------------------------------------------------------------------------------------
const keys = new Set();
const typing = (e) => e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && /text|number/.test(e.target.type));
// sliders, ticks and buttons give the keyboard straight back, so WASD keeps flying after you touch them
addEventListener('change', (e) => { if (e.target.tagName === 'INPUT' && !/text|number/.test(e.target.type)) e.target.blur(); }, true);
addEventListener('pointerup', (e) => { if (/BUTTON/.test(e.target.tagName) || (e.target.tagName === 'INPUT' && !/text|number/.test(e.target.type))) setTimeout(() => e.target.blur(), 0); }, true);
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (k === 'escape') { pinStage = null; applyOverlay(); status('Cancelled.'); return; }
  if (k === 'v') return standUp();
  if (k === 'p') return setTool('pin'); if (k === 'm') return setTool('move'); if (k === 'l') return setTool('look');
  if (k === 'f' && photo) { prefs.opacity = prefs.opacity > .02 ? 0 : .5; savePrefs(); applyOverlay(); refreshView(); return; }
  if (k === 'g') { prefs.lines = !prefs.lines; savePrefs(); applyOverlay(); refreshView(); return; }
  if (k === 'pagedown' || k === 'pageup') { const i = photos.indexOf(photo), n = photos.length; setPhoto(photos[((i < 0 ? 0 : i + (k === 'pagedown' ? 1 : -1)) + n) % n].id); e.preventDefault(); return; }
  if (sel && (k === 'delete' || k === 'backspace')) { deleteSel(); e.preventDefault(); return; }
  if (sel?.kind === 'item' && k === 'r') { const it = itemById(sel.id); pushUndo(); it.rot = (((it.rot || 0) + (e.shiftKey ? -90 : 90)) % 360 + 360) % 360; changed(it); return; }
  if (sel && k.startsWith('arrow')) { nudge(k, e.shiftKey ? .5 : SNAP); e.preventDefault(); return; }
  keys.add(e.code); if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let moved = false;
function fly(dt) {
  if (!keys.size) return;
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 18 : 6) * (keys.has('AltLeft') ? .2 : 1) * dt;
  const yaw = camera.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = 0, mz = 0, my = 0;
  if (keys.has('KeyW')) { mx += fx; mz += fz; } if (keys.has('KeyS')) { mx -= fx; mz -= fz; }
  if (keys.has('KeyD')) { mx += rx; mz += rz; } if (keys.has('KeyA')) { mx -= rx; mz -= rz; }
  if (keys.has('Space')) my += 1; if (keys.has('KeyC')) my -= 1;
  if (keys.has('KeyQ')) camera.rotation.z += .25 * dt; if (keys.has('KeyE')) camera.rotation.z -= .25 * dt;
  camera.position.x += mx * sp; camera.position.z += mz * sp; camera.position.y += my * sp;
  if (mx || mz || my || keys.has('KeyQ') || keys.has('KeyE')) moved = true;
}

// ---- pointer: look, pins, moving things ------------------------------------------------------------------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let drag = null, pinStage = null, hoverSnap = null;               // pinStage: {u, v} once the photo spot is chosen
const local = (e) => { const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
function castFrom(p) {
  ndc.set(p.x / p.w * 2 - 1, -(p.y / p.h) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([houseGroup, itemsGroup].filter(Boolean), true);
  return hits.filter((h) => h.point.y <= prefs.cut + 1e-3 && visibleUp(h.object) && h.object.material?.visible !== false);
}
const visibleUp = (o) => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
const toScreen = (v, p) => { const s = v.clone().project(camera); return [(s.x + 1) / 2 * p.w, (1 - s.y) / 2 * p.h, s.z]; };
// a hit snapped to the nearest real corner (14 px) or edge (8 px) of the thing it struck. Only creases count, where the surface
// turns by 20° or more: a flat wall's own triangles meet along hidden diagonals that are not edges in the room.
const creases = new WeakMap();
function creasesOf(geo) { let e = creases.get(geo); if (!e) { const g = new THREE.EdgesGeometry(geo, 20); e = g.attributes.position.array.slice(); g.dispose(); creases.set(geo, e); } return e; }
function snapped(hit, p, hits = [hit]) {
  // look at the creases of everything under the cursor (a door's edge and the floor it meets are different meshes)
  const objs = [...new Set(hits.slice(0, 4).map((h) => h.object))], near = Math.max(1.5, hit.distance * .15), A = new THREE.Vector3(), B = new THREE.Vector3();
  let corner = null, cd = 16, edge = null, ed = 10;
  for (const o of objs) { const E = creasesOf(o.geometry);
    for (let i = 0; i < E.length; i += 6) {
      A.set(E[i], E[i + 1], E[i + 2]).applyMatrix4(o.matrixWorld); B.set(E[i + 3], E[i + 4], E[i + 5]).applyMatrix4(o.matrixWorld);
      const sa = toScreen(A, p), sb = toScreen(B, p); if (sa[2] > 1 || sb[2] > 1) continue;
      for (const [v, sv] of [[A, sa], [B, sb]]) { const d = Math.hypot(sv[0] - p.x, sv[1] - p.y); if (d < cd && v.distanceTo(hit.point) < near) { cd = d; corner = v.clone(); } }
      const ex = sb[0] - sa[0], ey = sb[1] - sa[1], L2 = ex * ex + ey * ey; if (L2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((p.x - sa[0]) * ex + (p.y - sa[1]) * ey) / L2)), d = Math.hypot(sa[0] + ex * t - p.x, sa[1] + ey * t - p.y), q = A.clone().lerp(B, t);
      if (d < ed && q.distanceTo(hit.point) < Math.min(near, .6)) { ed = d; edge = q; }
    } }
  if (corner) return { p: corner, kind: 'corner' };
  if (edge) return { p: edge, kind: 'edge' };                // a point on the nearest edge: still just a point
  return { p: hit.point.clone(), kind: 'spot' };             // exactly where you clicked: just as good
}
const surfOf = (o) => { for (let a = o; a; a = a.parent) if (a.userData.surf) return a.userData.surf; return null; };
const itemOf = (o) => { for (let a = o; a; a = a.parent) if (a.userData.itemId) return PIECES[itemById(a.userData.itemId)?.type]?.fixed ? null : a.userData.itemId; return null; };   // floor coverings are picked on the Plan only
const planeHit = (p, y) => { ndc.set(p.x / p.w * 2 - 1, -(p.y / p.h) * 2 + 1); ray.setFromCamera(ndc, camera); const v = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), v) ? v : null; };
function pinNear(p) {
  if (!photo || pinStage) return null; const a = alignOf(photo.id); if (!a) return null;
  return a.pins.find((q) => Math.hypot(q.u * p.w - p.x, q.v * p.h - p.y) < 10) || null;
}
view.addEventListener('contextmenu', (e) => e.preventDefault());
view.addEventListener('pointerdown', (e) => {
  const p = local(e); view.setPointerCapture(e.pointerId); document.activeElement?.blur?.();
  const look = () => { drag = { kind: 'look', x: e.clientX, y: e.clientY }; };
  if (e.button === 2 || e.button === 1) return look();
  const pn = pinNear(p); if (pn) { pushUndo(); drag = { kind: 'pin', pin: pn }; return; }
  if (prefs.tool === 'look') return look();
  if (prefs.tool === 'pin') {
    if (!photo) { status('Pick a photo first (Photos window).'); return look(); }
    if (!pinStage) { pinStage = { u: p.x / p.w, v: p.y / p.h }; applyOverlay(); status('Now click the same corner on the model (the little photo shows which). Green ring = it snaps to the model\'s corner, teal = onto an edge, white = exactly where you click: all fine. Fly with WASD if you need to; Esc cancels.'); return; }
    const hits = castFrom(p), hit = hits[0]; if (!hit) { status('Nothing there to pin: click on the model.'); return; }
    const s = snapped(hit, p, hits);
    const a = alignOf(photo.id, true); pushUndo();
    const r4 = (v) => v.toArray().map((x) => +x.toFixed(4));
    a.pins.push({ u: pinStage.u, v: pinStage.v, p: r4(s.p), kind: s.kind });   // an edge pin: the spot is somewhere along it
    pinStage = null; applyOverlay();
    if (a.position) toAlignment(a);                           // back to the photo's camera before solving
    const res = solveNow(); refreshCamera(); refreshPhotos(); saveDraft();
    status(`Pin ${a.pins.length} added (${s.kind}).` + (res ? ` Off by ${(res.rms * photo.height).toFixed(1)} px on average.` + (res.rms * photo.height > 15 ? ' One of the pins may be wrong: check the numbers in Camera & pins.' : '') : ' Keep going: after 3 corners it finds where you stood.'));
    return;
  }
  // move
  const hits = castFrom(p), hit = hits[0];
  if (!hit) { select(null); return look(); }
  const id = itemOf(hit.object);
  if (id) { const it = itemById(id); select({ kind: 'item', id }); const y = tops()[it.floor || 0] + (it.y || 0), h0 = planeHit(p, y); if (h0) { pushUndo(); drag = { kind: 'item', it, y, x0: it.x, z0: it.z, h0 }; } return; }
  const surf = surfOf(hit.object);
  if (surf?.kind === 'wall') { select({ kind: 'wall', floor: surf.floor, wi: surf.wi }); const w = wallOf(sel), y = floorY(surf.floor), h0 = planeHit(p, y);
    if (h0) { pushUndo(); drag = { kind: 'wall', w, floor: surf.floor, y, h0, orig: wallSnapshot(surf.floor), n: wallNormal(w) }; } return; }
  select(null); look();
});
view.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (!drag) {
    hoverSnap = null;
    if (pinStage) { const hs = castFrom(p); if (hs[0]) hoverSnap = snapped(hs[0], p, hs); }
    return;
  }
  if (drag.kind === 'look') {
    const k = .0035 * camera.fov / 60; camera.rotation.y -= (e.clientX - drag.x) * k; camera.rotation.x = Math.max(-1.55, Math.min(1.55, camera.rotation.x - (e.clientY - drag.y) * k));
    drag.x = e.clientX; drag.y = e.clientY; moved = true; return;
  }
  if (drag.kind === 'pin') { drag.pin.u = Math.max(0, Math.min(1, p.x / p.w)); drag.pin.v = Math.max(0, Math.min(1, p.y / p.h)); return; }
  const h = planeHit(p, drag.y); if (!h) return;
  if (drag.kind === 'item') { drag.it.x = snapLen(drag.x0 + h.x - drag.h0.x, !e.shiftKey); drag.it.z = snapLen(drag.z0 + h.z - drag.h0.z, !e.shiftKey); rebuildItem(drag.it); refreshSelected(); drawPlan(); return; }
  if (drag.kind === 'wall') { const d = snapLen((h.x - drag.h0.x) * drag.n[0] + (h.z - drag.h0.z) * drag.n[1], !e.shiftKey); shiftWall(drag, d); requestRebuild(); markSelection(); refreshSelected(); drawPlan(); }
});
view.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.kind === 'pin') { if (photo) { const a = alignOf(photo.id); if (a.position) toAlignment(a); solveNow(); refreshCamera(); } saveDraft(); }
  if (drag.kind === 'item' || drag.kind === 'wall') { if (drag.kind === 'wall') rebuildHouse(); saveDraft(); }
  drag = null;
});
view.addEventListener('wheel', (e) => {
  e.preventDefault(); const d = (e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? .1 : .6);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); camera.position.addScaledVector(dir, d); moved = true;
}, { passive: false });

// a wall moved straight out from its line, dragging along the ends of any wall that meets it
function wallSnapshot(fi) { return house.floors[fi].walls.map((w) => ({ ...w })); }
function shiftWall(dg, d) {
  const walls = house.floors[dg.floor].walls, wi = walls.indexOf(dg.w), o = dg.orig[wi], dx = dg.n[0] * d, dz = dg.n[1] * d;
  const onLine = (x, z) => { const ex = o.x1 - o.x0, ez = o.z1 - o.z0, L2 = ex * ex + ez * ez, t = ((x - o.x0) * ex + (z - o.z0) * ez) / L2; return t > -.01 && t < 1.01 && Math.hypot(o.x0 + ex * t - x, o.z0 + ez * t - z) < .1; };
  walls.forEach((w, i) => { const s = dg.orig[i];
    if (i === wi) { w.x0 = s.x0 + dx; w.z0 = s.z0 + dz; w.x1 = s.x1 + dx; w.z1 = s.z1 + dz; return; }
    if (onLine(s.x0, s.z0)) { w.x0 = s.x0 + dx; w.z0 = s.z0 + dz; } if (onLine(s.x1, s.z1)) { w.x1 = s.x1 + dx; w.z1 = s.z1 + dz; } });
  for (const k of ['x0', 'z0', 'x1', 'z1']) for (const w of walls) w[k] = +w[k].toFixed(4);
}

// ---- solving the photo's camera ---------------------------------------------------------------------------------------
function solveNow(search = false) {
  if (!photo) return null; const a = alignOf(photo.id); if (!a || a.pins.length < 2) return null;
  const aspect = aspectOf(photo), pins = a.pins.map((q) => ({ u: q.u, v: q.v, p: q.p, line: q.line }));
  const n = pins.reduce((t, q) => t + (q.line ? 1 : 2), 0), lens = photo.vfov || camera.fov;
  // the camera stays upright, inside the house, at standing height on one of the floors
  const T = tops(), bounds = { x0: -33, x1: 25, z0: -13, z1: 14, y0: T[0] + 2.5, y1: T[1] + 7.5 };
  // once a photo has a camera it only ever adjusts from there; the whole-house search runs for its first placing, or on request
  const fresh = !a.position || search;
  const base = { position: camera.position.toArray(), q: camera.quaternion.toArray(), fov: a.position ? camera.fov : lens };
  let best = solveCamera(pins, base, aspect, { fov: true }, bounds);
  if (fresh && n >= 6) {
    const found = searchCamera(pins, lens, aspect, { x0: -30, x1: 24, z0: -12, z1: 13 }, [T[0] + 5.3, T[1] + 5.3], { fov: true }, bounds);
    if (found.rms < best.rms) best = found;
  }
  if (!prefs.lockLens && n >= 8) { const r = solveCamera(pins, best, aspect, {}, bounds); if (r.rms < best.rms) best = r; }   // then let the lens settle
  a.position = best.position.map((v) => +v.toFixed(4)); a.q = best.q.map((v) => +v.toFixed(6)); a.fov = +best.fov.toFixed(3); a.rms = best.rms;
  toAlignment(a); return best;
}
const pinError = (a, q) => pinMiss({ position: a.position, q: a.q, fov: a.fov }, q, aspectOf(photo)) * photo.height;

// ---- editing helpers ---------------------------------------------------------------------------------------------------
function select(s) { sel = s; markSelection(); refreshSelected(); drawPlan(); }
function changed(it) { rebuildItem(it); refreshSelected(); drawPlan(); saveDraft(); }
function nudge(k, step) {
  const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k]; pushUndo();
  if (sel.kind === 'item') { const it = itemById(sel.id); it.x = +(it.x + d[0]).toFixed(4); it.z = +(it.z + d[1]).toFixed(4); changed(it); }
  else if (sel.kind === 'wall') { const w = wallOf(sel), n = wallNormal(w), dd = d[0] * n[0] + d[1] * n[1]; if (Math.abs(dd) < 1e-6) return; shiftWall({ floor: sel.floor, w, orig: wallSnapshot(sel.floor), n }, dd); rebuildHouse(); markSelection(); refreshSelected(); drawPlan(); saveDraft(); }
  else if (sel.kind === 'stairs') { const s = house.stairs[sel.i]; s.x = +(s.x + d[0]).toFixed(4); s.z = +(s.z + d[1]).toFixed(4); rebuildHouse(); markSelection(); refreshSelected(); drawPlan(); saveDraft(); }
}
function deleteSel() {
  if (!sel) return; pushUndo();
  if (sel.kind === 'item') { interior.items = interior.items.filter((i) => i.id !== sel.id); rebuildItem({ id: sel.id }); }
  if (sel.kind === 'wall') { const f = house.floors[sel.floor], wi = sel.wi; f.walls.splice(wi, 1);
    f.openings = (f.openings || []).filter((o) => !(o.on === 'wall' && o.wi === wi)).map((o) => o.on === 'wall' && o.wi > wi ? { ...o, wi: o.wi - 1 } : o); rebuildHouse(); }
  if (sel.kind === 'stairs') { house.stairs.splice(sel.i, 1); rebuildHouse(); }
  select(null); saveDraft(); status('Deleted (Ctrl+Z brings it back).');
}
const newId = (type) => { let n = 1; while (interior.items.some((i) => i.id === `${type}-${n}`)) n++; return `${type}-${n}`; };
function duplicateSel() {
  if (sel?.kind !== 'item') return; const it = itemById(sel.id); pushUndo();
  const c = { ...structuredClone(it), id: newId(it.type), x: it.x + 1 }; interior.items.push(c); addItemObj(c); select({ kind: 'item', id: c.id }); saveDraft();
}
function addItem(type) {
  const P = PIECES[type], dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize(); pushUndo();
  const it = { id: newId(type), type, label: P.label, floor: floorOfCamera(), x: +snapLen(camera.position.x + dir.x * 6).toFixed(3), z: +snapLen(camera.position.z + dir.z * 6).toFixed(3), w: P.size[0], d: P.size[1], rot: 0 };
  if (P.h) it.h = P.h; interior.items.push(it); addItemObj(it); select({ kind: 'item', id: it.id }); saveDraft(); setTool('move');
  status(`Added a ${P.label.toLowerCase()} in front of you. Drag it into place.`);
}

// ---- windows ------------------------------------------------------------------------------------------------------------
const winState = store.get(KEY.wins) || {};
const wins = {};
function makeWin(id, title, x, y, w, h, open) {
  const s = winState[id] || { x, y, open }; const body = el('div', { className: 'body' });
  if (id === 'menu') s.open = true;                                  // the menu always stays: it brings the others back
  const close = el('button', { title: 'Close', textContent: '×', style: id === 'menu' ? 'display:none' : '' });
  const head = el('header', {}, el('span', { textContent: title }), close);
  const win = el('div', { className: 'win' + (s.open ? '' : ' hidden') }, head, body); win.style.width = w + 'px'; if (h) win.style.height = h + 'px';
  const place = (px, py) => { px = Math.max(0, Math.min(innerWidth - 60, px)); py = Math.max(0, Math.min(innerHeight - 30, py)); win.style.left = px + 'px'; win.style.top = py + 'px'; s.x = px; s.y = py; };
  place(s.x, s.y); document.body.append(win);
  head.addEventListener('pointerdown', (e) => { if (e.target === close) return; const ox = e.clientX - s.x, oy = e.clientY - s.y; head.setPointerCapture(e.pointerId);
    const mv = (ev) => place(ev.clientX - ox, ev.clientY - oy), up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); winState[id] = s; store.set(KEY.wins, winState); };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); });
  const api = { win, body, get open() { return !win.classList.contains('hidden'); },
    show(on = !api.open) { win.classList.toggle('hidden', !on); s.open = on; winState[id] = s; store.set(KEY.wins, winState); refreshMenu(); if (on && id === 'plan') sizePlan(); } };
  close.onclick = () => api.show(false); wins[id] = api; return api;
}
const R = innerWidth - 12;
const menu = makeWin('menu', 'Interior Lab', 12, 12, 250, 0, true);
const wPhotos = makeWin('photos', 'Photos', 12, 190, 350, 380, true);
const wCam = makeWin('camera', 'Camera & pins', R - 330, 12, 330, 330, true);
const wView = makeWin('view', 'View', R - 330, 352, 330, 250, false);
const wPlan = makeWin('plan', 'Plan', R - 470, 12, 460, 460, false);
const wSel = makeWin('selected', 'Selected', 12, 190, 320, 340, false);
const wAdd = makeWin('add', 'Add', 340, 12, 300, 300, false);
const wSave = makeWin('save', 'Save', 340, 330, 320, 300, false);
const wHelp = makeWin('help', 'How it works', 280, 60, 420, 440, !store.get(KEY.wins));

// master menu: tools and the windows
const toolBtns = {};
const tools = el('div', { className: 'row tools' });
for (const [t, label, tip] of [['pin', 'Pin', 'P: pin a photo spot to the model'], ['move', 'Move', 'M: drag furniture and walls'], ['look', 'Look', 'L: drag to look around']]) {
  const b = el('button', { textContent: label, title: tip }); b.onclick = () => setTool(t); toolBtns[t] = b; tools.append(b);
}
const winBtns = el('div', { className: 'row' });
function refreshMenu() { for (const [id, b] of Object.entries(menuWinBtns)) b.classList.toggle('on', wins[id].open); }
const menuWinBtns = {};
for (const [id, label] of [['photos', 'Photos'], ['camera', 'Camera'], ['plan', 'Plan'], ['selected', 'Selected'], ['add', 'Add'], ['view', 'View'], ['save', 'Save'], ['help', 'Help']]) {
  const b = el('button', { textContent: label }); b.onclick = () => wins[id].show(); menuWinBtns[id] = b; winBtns.append(b);
}
const undoRow = el('div', { className: 'row' }, el('button', { textContent: '↶ Undo', onclick: doUndo }), el('button', { textContent: '↷ Redo', onclick: doRedo }),
  el('button', { textContent: 'Stand me up (V)', title: 'Upright, on the floor, inside the house', onclick: () => standUp() }));
menu.body.append(tools, winBtns, undoRow);
// lost? upright, eye height on the nearest floor, inside the house, looking the same way round
function standUp() {
  const p = camera.position, T = tops(), e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  const f = Math.abs(p.y - (T[1] + 5.3)) < Math.abs(p.y - (T[0] + 5.3)) ? 1 : 0;
  p.set(Math.max(-30, Math.min(22, p.x)), T[f] + 5.3, Math.max(-11, Math.min(11, p.z)));
  camera.rotation.set(0, e.y, 0); moved = true; refreshCamera(); drawPlan(); status('Standing up again. Pins and the photo camera are as they were ("Back to photo camera" returns there).');
}
function setTool(t) { prefs.tool = t; savePrefs(); pinStage = null; applyOverlay(); for (const [k, b] of Object.entries(toolBtns)) b.classList.toggle('on', k === t);
  status({ pin: 'Pin: click a spot in the photo, then the same spot on the model.', move: 'Move: drag furniture or a wall. Arrows nudge an inch (Shift: 6″), R turns, Delete removes.', look: 'Look: drag to look; WASD flies, Space/C up and down, Q/E tilt.' }[t]); }

// Photos
const thumbs = el('div', { className: 'thumbs' }), photoInfo = el('div', { className: 'dim' });
wPhotos.body.append(thumbs, photoInfo, el('div', { className: 'row' }, el('button', { textContent: 'No photo', onclick: () => setPhoto(null) }), el('small', { textContent: 'PageUp / PageDown flip through them' })));
function refreshPhotos() {
  thumbs.replaceChildren(...photos.map((p) => { const a = alignOf(p.id), b = el('button', { title: `${p.label}\n${p.taken}` }, el('img', { src: BASE + 'inside/thumbs/' + p.file, loading: 'lazy' }));
    if (a?.position) b.append(el('span', { className: 'badge', textContent: a.pins.length ? `✓ ${a.pins.length} pins · ${(a.rms * p.height).toFixed(0)}px` : '✓ by hand' }));
    b.classList.toggle('on', p === photo); b.onclick = () => setPhoto(p.id); return b; }));
  photoInfo.textContent = photo ? `${photo.label} · ${photo.taken} · ${photo.focal} mm` : 'No photo chosen.';
}

// Camera & pins
const fovIn = el('input', { type: 'range', min: 15, max: 100, step: .1 }), fovOut = el('span'), rollIn = el('input', { type: 'range', min: -15, max: 15, step: .05 }), rollOut = el('span');
const lockIn = el('input', { type: 'checkbox' }), pinList = el('div', { className: 'pins' }), camInfo = el('div', { className: 'dim' });
fovIn.oninput = () => { camera.fov = +fovIn.value; camera.updateProjectionMatrix(); moved = true; fovOut.textContent = (+fovIn.value).toFixed(1) + '°'; };
rollIn.oninput = () => { camera.rotation.z = +rollIn.value * Math.PI / 180; moved = true; rollOut.textContent = (+rollIn.value).toFixed(1) + '°'; };
lockIn.onchange = () => { prefs.lockLens = lockIn.checked; savePrefs(); };
wCam.body.append(
  el('div', { className: 'grid2' }, el('span', { textContent: 'Lens' }), el('div', { className: 'row' }, fovIn, fovOut), el('span', { textContent: 'Tilt' }), el('div', { className: 'row' }, rollIn, rollOut)),
  el('label', { className: 'row' }, lockIn, el('span', { textContent: 'Keep the lens (only solve where I stood)' })),
  el('div', { className: 'row' },
    el('button', { textContent: 'Solve', title: 'Find the camera from the pins', onclick: () => { if (!photo) return; pushUndo(); const a = alignOf(photo.id); if (a?.position) toAlignment(a); const r = solveNow(); refreshCamera(); refreshPhotos(); saveDraft(); status(r ? `Solved: off by ${(r.rms * photo.height).toFixed(1)} px on average.` : 'Needs 2 pins or more.'); } }),
    el('button', { textContent: 'Find where I stood', title: 'Search the whole house for the camera that fits the pins best (use it if the camera is lost)', onclick: () => { if (!photo) return; pushUndo(); const r = solveNow(true); refreshCamera(); refreshPhotos(); saveDraft(); status(r ? `Searched the house: off by ${(r.rms * photo.height).toFixed(1)} px on average.` : 'Needs 3 corners first.'); } }),
    el('button', { textContent: 'Back to photo camera', onclick: () => { const a = photo && alignOf(photo.id); if (a?.position) { toAlignment(a); refreshCamera(); } } }),
    el('button', { textContent: 'Keep this view by hand', title: 'Only if you lined the view up yourself, without pins: keeps the camera as it is now as this photo\'s camera', onclick: () => { if (!photo) return; pushUndo(); const a = alignOf(photo.id, true);
      a.position = camera.position.toArray().map((v) => +v.toFixed(4)); a.q = camera.quaternion.toArray().map((v) => +v.toFixed(6)); a.fov = +camera.fov.toFixed(3); a.rms = a.pins.length ? Math.sqrt(a.pins.reduce((s, q) => s + (pinError(a, q) / photo.height) ** 2, 0) / a.pins.length) : 0; refreshCamera(); refreshPhotos(); saveDraft(); status('Saved this view as the photo\'s camera.'); } }),
    el('button', { textContent: 'Lens from photo', title: 'The field of view the camera recorded', onclick: () => { if (photo) { camera.fov = photo.vfov; camera.updateProjectionMatrix(); refreshCamera(); } } })),
  el('div', { className: 'dim', textContent: 'Pins: yellow circle = your spot in the photo, teal dot = that spot in the model. Lined up = on top of each other. The number is how far apart (pixels); a big one is usually a wrong pin: × removes it.' }), pinList,
  el('div', { className: 'row' }, el('button', { textContent: 'Start this photo over', onclick: () => { const a = photo && alignOf(photo.id); if (!a || !confirm('Remove this photo\'s pins and camera?')) return; pushUndo();
    align.alignments = align.alignments.filter((x) => x !== a); camera.fov = photo.vfov; camera.rotation.z = 0; camera.updateProjectionMatrix(); refreshCamera(); refreshPhotos(); saveDraft(); status('Starting over: pin 3 corners and it finds where you stood.'); } })),
  camInfo);
function refreshCamera() {
  fovIn.value = camera.fov; fovOut.textContent = camera.fov.toFixed(1) + '°'; const roll = camera.rotation.z * 180 / Math.PI; rollIn.value = roll; rollOut.textContent = roll.toFixed(1) + '°'; lockIn.checked = prefs.lockLens;
  const a = photo && alignOf(photo.id);
  pinList.replaceChildren(...(a?.pins || []).map((q, i) => { const err = a.position ? pinError(a, q) : null;
    return el('span', { title: `${q.kind || ''} at ${q.p.map((v) => v.toFixed(2)).join(', ')} ft` }, el('b', { textContent: i + 1 }), ' ' + (err == null ? '–' : err.toFixed(1) + 'px'),
      el('button', { textContent: '×', onclick: () => { pushUndo(); a.pins.splice(i, 1); if (a.position) toAlignment(a); solveNow(); refreshCamera(); refreshPhotos(); saveDraft(); } })); }));
  const p = camera.position; camInfo.textContent = `Standing at x ${ftin(p.x)}, z ${ftin(p.z)}, eye ${ftin(p.y - tops()[floorOfCamera()])} above the floor` + (a?.position ? ` · average miss ${(a.rms * photo.height).toFixed(1)} px` : '');
}

// View
const opIn = el('input', { type: 'range', min: 0, max: 1, step: .01 }), cutIn = el('input', { type: 'range', min: 1, max: 30, step: .25 }), cutOut = el('span'), lightIn = el('input', { type: 'range', min: .3, max: 2.5, step: .05 });
const linesIn = el('input', { type: 'checkbox' }), doorsIn = el('input', { type: 'checkbox' }), itemsIn = el('input', { type: 'checkbox' });
opIn.oninput = () => { prefs.opacity = +opIn.value; savePrefs(); applyOverlay(); };
cutIn.oninput = () => { prefs.cut = +cutIn.value; savePrefs(); cutOut.textContent = prefs.cut >= 30 ? 'off' : ftin(prefs.cut); };
lightIn.oninput = () => { prefs.light = +lightIn.value; savePrefs(); };
linesIn.onchange = () => { prefs.lines = linesIn.checked; savePrefs(); applyOverlay(); };
doorsIn.onchange = () => { prefs.doorsOpen = doorsIn.checked; savePrefs(); setDoors(); };
itemsIn.onchange = () => { prefs.showItems = itemsIn.checked; savePrefs(); linesDirty = true; };
wView.body.append(el('div', { className: 'grid2' },
  el('span', { textContent: 'Photo' }), opIn, el('span', { textContent: 'Cut above' }), el('div', { className: 'row' }, cutIn, cutOut), el('span', { textContent: 'Light' }), lightIn),
  el('label', { className: 'row' }, linesIn, el('span', { textContent: 'Outline the model over the full photo (G)' })),
  el('label', { className: 'row' }, doorsIn, el('span', { textContent: 'Doors open' })),
  el('label', { className: 'row' }, itemsIn, el('span', { textContent: 'Show furniture' })),
  el('small', { textContent: 'F flips the photo on and off. "Cut above" slices the house to look down into rooms.' }));
function refreshView() { opIn.value = prefs.opacity; cutIn.value = prefs.cut; cutOut.textContent = prefs.cut >= 30 ? 'off' : ftin(prefs.cut); lightIn.value = prefs.light; linesIn.checked = prefs.lines; doorsIn.checked = prefs.doorsOpen; itemsIn.checked = prefs.showItems; }

// Add
const typeSel = el('select'); for (const [k, P] of Object.entries(PIECES)) typeSel.append(el('option', { value: k, textContent: P.label }));
wAdd.body.append(el('div', { className: 'dim', textContent: 'Furniture appears in front of you on the floor you are on.' }),
  el('div', { className: 'row' }, typeSel, el('button', { textContent: 'Add', onclick: () => addItem(typeSel.value) })),
  el('div', { className: 'dim', textContent: 'Walls: use "Add wall" on the Plan, then click its two ends.' }),
  el('div', { className: 'row' }, el('button', { textContent: 'Add wall on the plan', onclick: () => { wPlan.show(true); planTool = 'wall'; planStart = null; status('Click the wall\'s first end on the plan.'); } }),
    el('button', { textContent: 'Add stairs', onclick: () => { pushUndo(); house.stairs = house.stairs || []; house.stairs.push({ x: +camera.position.x.toFixed(1), z: +camera.position.z.toFixed(1), w: 3, run: 12, dir: 'E', floor: 0 }); rebuildHouse(); select({ kind: 'stairs', i: house.stairs.length - 1 }); saveDraft(); } })));

// Selected
function field(label, value, set, opts = {}) {
  const blank = value === '' || value == null, inp = el('input', { type: 'text', value: blank ? '' : opts.len ? (+value).toFixed(3).replace(/\.?0+$/, '') : value });
  const hint = el('small', { textContent: opts.len && !blank ? ftin(+value) : '' });
  inp.onchange = () => { const v = opts.len ? parseLen(inp.value) : opts.num ? parseFloat(inp.value) : inp.value; if (v == null || (opts.num && !Number.isFinite(v))) { inp.value = value; return; } pushUndo(); set(v); };
  return [el('span', { textContent: label }), el('div', {}, inp, hint)];
}
function selectField(label, value, options, set) { const s = el('select'); for (const [v, t] of options) s.append(el('option', { value: v, textContent: t, selected: String(v) === String(value) })); s.onchange = () => { pushUndo(); set(s.value); }; return [el('span', { textContent: label }), s]; }
function refreshSelected() {
  const b = wSel.body; b.replaceChildren();
  if (!sel) { b.append(el('div', { className: 'dim', textContent: 'Nothing selected. With Move, click furniture or a wall in the view, or anything on the Plan.' })); return; }
  if (!wSel.open) wSel.show(true);
  if (sel.kind === 'item') {
    const it = itemById(sel.id); if (!it) return; const P = PIECES[it.type], upd = (k) => (v) => { it[k] = v; changed(it); };
    const colors = [['', `(${P.color})`], ...Object.keys(COLORS).map((k) => [k, k])]; if (it.color && !COLORS[it.color]) colors.push([it.color, it.color]);
    b.append(el('div', { className: 'grid4' },
      ...field('Name', it.label, upd('label')), ...selectField('Floor', it.floor || 0, [[0, 'Ground'], [1, 'Upstairs']], (v) => { it.floor = +v; changed(it); }),
      ...field('x (east)', it.x, upd('x'), { len: 1 }), ...field('z (south)', it.z, upd('z'), { len: 1 }),
      ...field('Width', it.w ?? P.size[0], upd('w'), { len: 1 }), ...field('Depth', it.d ?? P.size[1], upd('d'), { len: 1 }),
      ...field('Height', it.h ?? P.h ?? '', upd('h'), { len: 1 }), ...field('Raise', it.y || 0, upd('y'), { len: 1 }),
      ...field('Turn °', it.rot || 0, (v) => { it.rot = ((v % 360) + 360) % 360; changed(it); }, { num: 1 }),
      ...selectField('Colour', it.color && COLORS[it.color] ? it.color : (it.color || ''), colors, (v) => { if (v) it.color = v; else delete it.color; changed(it); })),
      el('small', { textContent: `${P.label}. Turn 0 = its back to the north, 90 = west, 180 = south, 270 = east. Height only changes tables, counters, blocks and stools.` }),
      el('div', { className: 'row' }, el('button', { textContent: 'Duplicate', onclick: duplicateSel }), el('button', { textContent: 'Turn 90°', onclick: () => { pushUndo(); it.rot = ((it.rot || 0) + 90) % 360; changed(it); } }), el('button', { textContent: 'Delete', onclick: deleteSel })));
  }
  if (sel.kind === 'wall') {
    const f = house.floors[sel.floor], w = f.walls[sel.wi]; if (!w) return; const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    const upd = (k) => (v) => { w[k] = v; rebuildHouse(); markSelection(); refreshSelected(); drawPlan(); saveDraft(); };
    const doors = (f.openings || []).map((o, oi) => [o, oi]).filter(([o]) => o.on === 'wall' && o.wi === sel.wi);
    b.append(el('div', { className: 'dim', textContent: `${sel.floor ? 'Upstairs' : 'Ground floor'} wall ${sel.wi}${w.dormer ? ' (dormer)' : ''} · ${ftin(len)} long` }),
      el('div', { className: 'grid4' }, ...field('Start x', w.x0, upd('x0'), { len: 1 }), ...field('Start z', w.z0, upd('z0'), { len: 1 }), ...field('End x', w.x1, upd('x1'), { len: 1 }), ...field('End z', w.z1, upd('z1'), { len: 1 }),
        ...field('Height', w.h ?? '', (v) => upd('h')(v || undefined), { len: 1 }), el('span', { textContent: 'Railing' }), el('input', { type: 'checkbox', checked: !!w.rail, onchange: (e) => { pushUndo(); upd('rail')(e.target.checked || undefined); } })),
      el('div', { className: 'dim', textContent: doors.length ? 'Doors (from the start end):' : 'No doors in this wall.' }),
      ...doors.map(([o]) => el('div', { className: 'grid4' }, ...field('From start', o.off, (v) => { o.off = v; upd('x0')(w.x0); }, { len: 1 }), ...field('Width', o.w, (v) => { o.w = v; upd('x0')(w.x0); }, { len: 1 }),
        el('span', { textContent: 'Shut' }), el('input', { type: 'checkbox', checked: !!o.closed, onchange: (e) => { pushUndo(); o.closed = e.target.checked || undefined; upd('x0')(w.x0); } }),
        el('span'), el('button', { textContent: 'Remove door', onclick: () => { pushUndo(); f.openings.splice(f.openings.indexOf(o), 1); upd('x0')(w.x0); } }))),
      el('div', { className: 'row' }, el('button', { textContent: 'Add a door', onclick: () => { pushUndo(); (f.openings ||= []).push({ on: 'wall', wi: sel.wi, off: +Math.max(0, (len - 3) / 2).toFixed(2), w: 3, y0: 0, y1: 7, type: 'door' }); upd('x0')(w.x0); } }),
        el('button', { textContent: 'Delete wall', onclick: deleteSel })),
      el('small', { textContent: 'Drag the wall in the view to slide it; on the Plan, drag its ends. Walls touching it follow.' }));
  }
  if (sel.kind === 'stairs') {
    const s = house.stairs[sel.i]; if (!s) return; const upd = (k) => (v) => { s[k] = v; rebuildHouse(); markSelection(); refreshSelected(); drawPlan(); saveDraft(); };
    b.append(el('div', { className: 'dim', textContent: 'Stairs (x, z = the middle of the run; they rise toward Direction)' }),
      el('div', { className: 'grid4' }, ...field('x', s.x, upd('x'), { len: 1 }), ...field('z', s.z, upd('z'), { len: 1 }), ...field('Width', s.w || 3, upd('w'), { len: 1 }), ...field('Run', s.run || 10, upd('run'), { len: 1 }),
        ...selectField('Rises', s.dir || 'N', [['N', 'north'], ['S', 'south'], ['E', 'east'], ['W', 'west']], upd('dir'))),
      el('small', { textContent: 'Heads-up: the house file names "N" as +z, which is south on the plan: pick whichever looks right.' }),
      el('div', { className: 'row' }, el('button', { textContent: 'Delete stairs', onclick: deleteSel })));
  }
}

// Save
const saveInfo = el('div', { className: 'dim' });
const dl = (name, data) => { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const files = { 'montana-home.json': () => house, 'montana-interior.json': () => interior, 'inside-alignments.json': () => align };
const loader = el('input', { type: 'file', accept: '.json,application/json', multiple: true, style: 'display:none' });
loader.onchange = async () => { pushUndo(); for (const f of loader.files) { const o = JSON.parse(await f.text());
  if (o.format === 'montana-interior-lab') { house = o.house; interior = o.interior; align = o.align; } else if (o.format === 'montana-interior') interior = o; else if (o.format === 'montana-inside-alignments') align = o; else if (o.floors) house = o; }
  rebuildHouse(); buildItems(); refreshAll(); saveDraft(); status('Loaded.'); loader.value = ''; };
wSave.body.append(saveInfo,
  el('div', { className: 'row' }, el('button', { textContent: 'Download everything (one file)', onclick: () => dl('interior-lab.json', { format: 'montana-interior-lab', version: 1, saved: new Date().toISOString(), house, interior, align }) })),
  el('div', { className: 'row' }, ...Object.entries(files).map(([n, f]) => el('button', { textContent: n.replace('.json', ''), onclick: () => dl(n, f()) }))),
  el('small', { textContent: 'interior-lab.json lands in Downloads with all of it: the house shape, the furniture, the photo cameras and pins. Tell Claude and it picks it up. (The three buttons above save the parts one at a time.)' }),
  el('div', { className: 'row' }, el('button', { textContent: 'Load files…', onclick: () => loader.click() }),
    el('button', { textContent: 'Start over from the site', onclick: () => { if (!confirm('Throw away this browser\'s changes and load the site\'s files?')) return; pushUndo();
      house = structuredClone(site.house); interior = structuredClone(site.interior); align = structuredClone(site.align); rebuildHouse(); buildItems(); refreshAll(); saveDraft(); } })), loader);
function refreshSave(ok = true) {
  const solved = align.alignments.filter((a) => a.position).length;
  saveInfo.textContent = (ok ? `Kept in this browser${savedAt ? ' at ' + savedAt.toLocaleTimeString() : ''}.` : 'This browser would not keep it (storage full or blocked): download to be safe.') + ` ${solved} of ${photos.length} photos placed, ${interior.items.length} pieces of furniture.`;
}

// Help
wHelp.body.className = 'body help';
wHelp.body.innerHTML = `
<p><b>1. Pick a photo</b> (Photos). The view takes the photo's shape and its camera's lens.</p>
<p><b>2. Pin it</b> (<kbd>P</kbd>). Click a sharp <b>corner</b> in the photo: a window or door corner, where two walls meet the ceiling,
the corner of a counter. A <b style="color:#ffd84a">yellow circle</b> marks it, the photo hides, and a small copy in the corner shows
your spot. Now click the <b>same corner</b> on the model. The ring shows where the pin will go: green snaps to a corner the model has, teal onto an edge, white is exactly where you click (fine too: some corners, like a door frame meeting the floor, aren't stored as corners). After 3 corners the lab works out
where you stood by itself (after that it only fine-tunes; "Find where I stood" searches again), and each yellow circle gets a
<b style="color:#3fe0ff">teal dot</b>: where the model puts that corner. On top of each other = lined up. The number on each pin in
Camera &amp; pins is how far apart they are; one big number is usually a wrong pin (it barely moves the camera): remove it with ×.
6–8 corners spread near and far is best. Esc cancels a pin.</p>
<p class="dim">Flying: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, <kbd>Space</kbd> up, <kbd>C</kbd> down, <kbd>Shift</kbd> faster,
right-drag to look, wheel to step. "Start this photo over" (Camera &amp; pins) wipes a photo's pins and camera.</p>
<p><b>3. Fix the room</b> (<kbd>M</kbd>). Fade the photo (View) or press <kbd>G</kbd> for outlines over the full photo. Drag furniture
and walls until they sit on the photo; <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> nudge an inch (<kbd>Shift</kbd> 6″), <kbd>R</kbd> turns 90°,
<kbd>Delete</kbd> removes, <kbd>Ctrl</kbd>+<kbd>D</kbd> copies. Then flip to other photos (<kbd>PgUp</kbd>/<kbd>PgDn</kbd>): a change that's right holds in all of them.</p>
<p><b>4. Save</b>. It keeps itself in this browser as you go; Save › Download everything when you're done, and tell Claude.</p>
<p class="dim">The photos are straightened for the lens's barrel bend, so straight walls stay straight. Lengths take feet and inches: 12'6".</p>`;

// ---- the plan -----------------------------------------------------------------------------------------------------------
const plan = el('canvas', { className: 'plan' }), pctx = plan.getContext('2d');
let planFloor = 0, planTool = null, planStart = null, pv = { s: 7, ox: 0, oz: 0 };
const floorBtns = [0, 1].map((f) => { const b = el('button', { textContent: f ? 'Upstairs' : 'Ground' }); b.onclick = () => { planFloor = f; floorBtns.forEach((x, i) => x.classList.toggle('on', i === f)); drawPlan(); }; return b; });
floorBtns[0].classList.add('on');
wPlan.body.append(el('div', { className: 'row' }, ...floorBtns, el('button', { textContent: 'Fit', onclick: () => { fitPlan(); drawPlan(); } }), el('small', { textContent: 'drag to move · wheel zooms · right-drag pans' })), plan);
function sizePlan() { const r = plan.getBoundingClientRect(); plan.width = r.width * devicePixelRatio; plan.height = r.height * devicePixelRatio; if (!pv.fit) { fitPlan(); pv.fit = true; } drawPlan(); }
new ResizeObserver(() => wPlan.open && sizePlan()).observe(plan);
function fitPlan() { const W = plan.width / devicePixelRatio, H = plan.height / devicePixelRatio; pv.s = Math.min(W / 70, H / 34); pv.ox = W / 2 - (-2) * pv.s; pv.oz = H / 2 - 1 * pv.s; }
const P2 = (x, z) => [pv.ox + x * pv.s, pv.oz + z * pv.s], F2 = (sx, sy) => [(sx - pv.ox) / pv.s, (sy - pv.oz) / pv.s];
function drawPlan() {
  if (!wPlan.open || !plan.width) return; const c = pctx, dpr = devicePixelRatio; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, plan.width, plan.height);
  const f = house.floors[planFloor]; if (!f) return;
  c.lineCap = 'round';
  // the grid every 2 ft
  c.strokeStyle = '#1d2126'; c.lineWidth = 1; for (let x = -40; x <= 40; x += 2) { c.beginPath(); c.moveTo(...P2(x, -20)); c.lineTo(...P2(x, 20)); c.stroke(); } for (let z = -20; z <= 20; z += 2) { c.beginPath(); c.moveTo(...P2(-40, z)); c.lineTo(...P2(40, z)); c.stroke(); }
  // floor
  c.beginPath(); f.outline.forEach(([x, z], i) => i ? c.lineTo(...P2(x, z)) : c.moveTo(...P2(x, z))); c.closePath(); c.fillStyle = '#2a2722'; c.fill(); c.strokeStyle = '#8b8378'; c.lineWidth = 4; c.stroke();
  for (const v of f.voids || []) { c.beginPath(); v.forEach(([x, z], i) => i ? c.lineTo(...P2(x, z)) : c.moveTo(...P2(x, z))); c.closePath(); c.fillStyle = '#111316'; c.fill(); }
  // stairs
  (house.stairs || []).forEach((s, i) => { if ((s.floor || 0) !== planFloor && (s.floor || 0) + 1 !== planFloor) return; const P = stairPoly(s); c.beginPath(); P.forEach(([x, z], k) => k ? c.lineTo(...P2(x, z)) : c.moveTo(...P2(x, z))); c.closePath();
    c.fillStyle = (s.floor || 0) === planFloor ? '#3b3a52' : '#22222e'; c.fill(); c.strokeStyle = sel?.kind === 'stairs' && sel.i === i ? '#f0a33a' : '#6c6a92'; c.lineWidth = 2; c.stroke();
    const [ux, uz] = DIRS[s.dir || 'N']; c.beginPath(); c.moveTo(...P2(s.x - ux * (s.run || 10) * .35, s.z - uz * (s.run || 10) * .35)); c.lineTo(...P2(s.x + ux * (s.run || 10) * .35, s.z + uz * (s.run || 10) * .35)); c.stroke(); });
  // furniture: rugs first
  const flatness = (it) => it.type === 'floor' ? 0 : it.type === 'rug' ? 1 : 2;
  const its = interior.items.filter((it) => (it.floor || 0) === planFloor).sort((a, b) => flatness(a) - flatness(b));
  for (const it of its) { const g = itemObj.get(it.id); for (const ft of g?.userData.feet || []) { c.beginPath(); ft.poly.forEach(([x, z], i) => i ? c.lineTo(...P2(x, z)) : c.moveTo(...P2(x, z))); c.closePath();
    c.globalAlpha = it.type === 'floor' ? .25 : it.type === 'rug' ? .45 : .8; c.fillStyle = colorOf(it.color ?? PIECES[it.type]?.color); c.fill(); c.globalAlpha = 1; c.strokeStyle = sel?.kind === 'item' && sel.id === it.id ? '#f0a33a' : '#0008'; c.lineWidth = sel?.id === it.id ? 2.5 : 1; c.stroke(); } }
  // walls and their doors
  (f.walls || []).forEach((w, wi) => { const on = sel?.kind === 'wall' && sel.floor === planFloor && sel.wi === wi;
    c.strokeStyle = on ? '#f0a33a' : w.rail ? '#b98552' : '#d8d2c6'; c.lineWidth = w.rail ? 2.5 : 4; c.setLineDash(w.rail ? [5, 4] : []); c.beginPath(); c.moveTo(...P2(w.x0, w.z0)); c.lineTo(...P2(w.x1, w.z1)); c.stroke(); c.setLineDash([]);
    const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0), ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L;
    for (const o of (f.openings || []).filter((o) => o.on === 'wall' && o.wi === wi)) { const a = Math.max(0, Math.min(L - o.w, o.off)); c.strokeStyle = o.closed ? '#5b8f5b' : '#7bd88f'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(...P2(w.x0 + ux * a, w.z0 + uz * a)); c.lineTo(...P2(w.x0 + ux * (a + o.w), w.z0 + uz * (a + o.w))); c.stroke(); }
    if (on) for (const [x, z] of [[w.x0, w.z0], [w.x1, w.z1]]) { c.fillStyle = '#f0a33a'; c.beginPath(); c.arc(...P2(x, z), 5, 0, 7); c.fill(); } });
  // outline doors and windows
  f.outline.forEach((a, e) => { const b = f.outline[(e + 1) % f.outline.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (const o of (f.openings || []).filter((o) => o.on === 'outline' && o.edge === e)) { c.strokeStyle = o.type === 'door' ? '#7bd88f' : '#7fc3ff'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(...P2(a[0] + ux * o.off, a[1] + uz * o.off)); c.lineTo(...P2(a[0] + ux * (o.off + o.w), a[1] + uz * (o.off + o.w))); c.stroke(); } });
  // where the camera stands and what it sees
  if (floorOfCamera() === planFloor) { const p = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d); const yaw = Math.atan2(d.x, d.z), hf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    c.fillStyle = '#3fe0ff33'; c.strokeStyle = '#3fe0ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(...P2(p.x, p.z));
    for (const t of [-hf, hf]) c.lineTo(...P2(p.x + Math.sin(yaw + t) * 10, p.z + Math.cos(yaw + t) * 10)); c.closePath(); c.fill(); c.stroke(); }
  if (planTool === 'wall' && planStart) { c.fillStyle = '#f0a33a'; c.beginPath(); c.arc(...P2(...planStart), 5, 0, 7); c.fill(); }
}
const distSeg = (px, pz, w) => { const ex = w.x1 - w.x0, ez = w.z1 - w.z0, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((px - w.x0) * ex + (pz - w.z0) * ez) / L2)); return Math.hypot(w.x0 + ex * t - px, w.z0 + ez * t - pz); };
const inPoly = (x, z, P) => { let r = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) r = !r; return r; };
let pdrag = null;
plan.addEventListener('contextmenu', (e) => e.preventDefault());
plan.addEventListener('pointerdown', (e) => {
  const r = plan.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [x, z] = F2(sx, sy), f = house.floors[planFloor], tol = 7 / pv.s; plan.setPointerCapture(e.pointerId);
  if (e.button !== 0) { pdrag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: pv.ox, oz: pv.oz }; return; }
  if (planTool === 'wall') {
    const pt = [snapLen(x, !e.shiftKey), snapLen(z, !e.shiftKey)];
    if (!planStart) { planStart = pt; drawPlan(); status('Now click the other end.'); return; }
    pushUndo(); f.walls.push({ x0: planStart[0], z0: planStart[1], x1: pt[0], z1: pt[1], dormer: false }); planTool = null; planStart = null;
    rebuildHouse(); select({ kind: 'wall', floor: planFloor, wi: f.walls.length - 1 }); saveDraft(); status('Wall added.'); return;
  }
  // ends of the selected wall
  if (sel?.kind === 'wall' && sel.floor === planFloor) { const w = wallOf(sel);
    for (const end of [0, 1]) { const ex = end ? w.x1 : w.x0, ez = end ? w.z1 : w.z0; if (Math.hypot(ex - x, ez - z) < tol * 1.3) {
      const joined = f.walls.flatMap((o, i) => [0, 1].filter((k) => !(o === w && k === end) && Math.hypot((k ? o.x1 : o.x0) - ex, (k ? o.z1 : o.z0) - ez) < .05).map((k) => [o, k]));
      pushUndo(); pdrag = { kind: 'end', w, end, joined, x0: ex, z0: ez, fx: x, fz: z }; return; } } }
  // furniture (topmost, skipping rugs if anything else is there)
  const flat = (it) => it.type === 'floor' ? 2 : it.type === 'rug' ? 1 : 0;
  const its = interior.items.filter((it) => (it.floor || 0) === planFloor).sort((a, b) => flat(a) - flat(b));
  for (const it of its) { const g = itemObj.get(it.id); if ((g?.userData.feet || []).some((ft) => inPoly(x, z, ft.poly))) { select({ kind: 'item', id: it.id }); pushUndo(); pdrag = { kind: 'item', it, x0: it.x, z0: it.z, fx: x, fz: z }; return; } }
  // walls
  let best = -1, bd = tol; (f.walls || []).forEach((w, wi) => { const d = distSeg(x, z, w); if (d < bd) { bd = d; best = wi; } });
  if (best >= 0) { select({ kind: 'wall', floor: planFloor, wi: best }); pushUndo(); pdrag = { kind: 'wall', orig: wallSnapshot(planFloor), w: f.walls[best], fx: x, fz: z }; return; }
  const si = (house.stairs || []).findIndex((s) => (s.floor || 0) === planFloor && inPoly(x, z, stairPoly(s)));
  if (si >= 0) { select({ kind: 'stairs', i: si }); pushUndo(); const s = house.stairs[si]; pdrag = { kind: 'stairs', s, x0: s.x, z0: s.z, fx: x, fz: z }; return; }
  select(null); pdrag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: pv.ox, oz: pv.oz };
});
plan.addEventListener('pointermove', (e) => {
  if (!pdrag) return; const r = plan.getBoundingClientRect(), [x, z] = F2(e.clientX - r.left, e.clientY - r.top), sn = !e.shiftKey;
  if (pdrag.kind === 'pan') { pv.ox = pdrag.ox + e.clientX - pdrag.sx; pv.oz = pdrag.oz + e.clientY - pdrag.sy; drawPlan(); return; }
  const dx = x - pdrag.fx, dz = z - pdrag.fz;
  if (pdrag.kind === 'item') { pdrag.it.x = +snapLen(pdrag.x0 + dx, sn).toFixed(4); pdrag.it.z = +snapLen(pdrag.z0 + dz, sn).toFixed(4); rebuildItem(pdrag.it); refreshSelected(); drawPlan(); }
  if (pdrag.kind === 'stairs') { pdrag.s.x = +snapLen(pdrag.x0 + dx, sn).toFixed(4); pdrag.s.z = +snapLen(pdrag.z0 + dz, sn).toFixed(4); requestRebuild(); markSelection(); drawPlan(); }
  if (pdrag.kind === 'end') { const nx = +snapLen(pdrag.x0 + dx, sn).toFixed(4), nz = +snapLen(pdrag.z0 + dz, sn).toFixed(4);
    const set = (w, k) => { if (k) { w.x1 = nx; w.z1 = nz; } else { w.x0 = nx; w.z0 = nz; } }; set(pdrag.w, pdrag.end); for (const [o, k] of pdrag.joined) set(o, k); requestRebuild(); markSelection(); refreshSelected(); drawPlan(); }
  if (pdrag.kind === 'wall') { const ddx = snapLen(dx, sn), ddz = snapLen(dz, sn), f = house.floors[planFloor], wi = f.walls.indexOf(pdrag.w), o = pdrag.orig[wi];
    // the whole wall moves; ends of other walls that met it come along
    f.walls.forEach((w, i) => { const s = pdrag.orig[i]; if (i === wi) { w.x0 = s.x0 + ddx; w.z0 = s.z0 + ddz; w.x1 = s.x1 + ddx; w.z1 = s.z1 + ddz; return; }
      for (const k of [0, 1]) { const ex = k ? s.x1 : s.x0, ez = k ? s.z1 : s.z0; if (distSeg(ex, ez, o) < .1) { if (k) { w.x1 = ex + ddx; w.z1 = ez + ddz; } else { w.x0 = ex + ddx; w.z0 = ez + ddz; } } } });
    requestRebuild(); markSelection(); refreshSelected(); drawPlan(); }
});
plan.addEventListener('pointerup', () => { if (pdrag && pdrag.kind !== 'pan') { if (pdrag.kind !== 'item') rebuildHouse(); markSelection(); saveDraft(); } pdrag = null; });
plan.addEventListener('wheel', (e) => { e.preventDefault(); const r = plan.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, [x, z] = F2(sx, sy);
  pv.s = Math.max(2, Math.min(80, pv.s * (e.deltaY > 0 ? .88 : 1.14))); pv.ox = sx - x * pv.s; pv.oz = sy - z * pv.s; drawPlan(); }, { passive: false });

// ---- drawing ------------------------------------------------------------------------------------------------------------
function drawMarks() {
  const w = marks.width, h = marks.height, c = mctx, dpr = devicePixelRatio; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = w / dpr, H = h / dpr;
  if (photo) { const a = alignOf(photo.id);
    (a?.pins || []).forEach((q, i) => {
      const scr = (v) => { const s = new THREE.Vector3(...v).project(camera); return s.z < 1 ? [(s.x + 1) / 2 * W, (1 - s.y) / 2 * H] : null; }, px = q.u * W, py = q.v * H;
      if (!pinStage && q.line) { const A = scr(q.line[0]), B = scr(q.line[1]); if (A && B) { c.strokeStyle = '#3fe0ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(...A); c.lineTo(...B); c.stroke(); } }   // an edge pin: its edge
      else if (!pinStage) { const M = scr(q.p); if (M) { c.strokeStyle = '#ffffffaa'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(...M); c.stroke(); c.fillStyle = '#3fe0ff'; c.beginPath(); c.arc(...M, 3.5, 0, 7); c.fill(); } }
      c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, 6, 0, 7); c.stroke(); c.strokeStyle = '#ffd84a'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 6, 0, 7); c.stroke();
      c.font = 'bold 12px system-ui'; c.fillStyle = '#000'; c.fillText(i + 1, px + 8, py - 6); c.fillStyle = '#ffd84a'; c.fillText(i + 1, px + 7, py - 7);
    });
    if (pinStage) { const px = pinStage.u * W, py = pinStage.v * H; c.strokeStyle = '#ffd84a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px - 14, py); c.lineTo(px + 14, py); c.moveTo(px, py - 14); c.lineTo(px, py + 14); c.stroke();
      if (hoverSnap) { const s = hoverSnap.p.clone().project(camera); c.strokeStyle = hoverSnap.kind === 'corner' ? '#7bd88f' : hoverSnap.kind === 'edge' ? '#3fe0ff' : '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc((s.x + 1) / 2 * W, (1 - s.y) / 2 * H, 7, 0, 7); c.stroke(); } }
  }
}
let last = performance.now(), camTick = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; fly(dt);
  hemi.intensity = 1.5 * prefs.light; amb.intensity = .55 * prefs.light; sun.intensity = 1.1 * prefs.light;
  itemsGroup.visible = prefs.showItems;
  cutPlane.constant = prefs.cut; renderer.clippingPlanes = prefs.cut < 30 ? [cutPlane] : [];
  if (prefs.lines) {
    if (linesDirty) rebuildLines();
    renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.clear(); scene.background = null;
    scene.overrideMaterial = depthOnly; renderer.render(scene, camera); scene.overrideMaterial = null; renderer.render(lineScene, camera); renderer.autoClear = true;
  } else { scene.background = SKY; renderer.render(scene, camera); }
  drawMarks();
  if (moved && (camTick += dt) > .15) { camTick = 0; moved = false; refreshCamera(); drawPlan(); }
  requestAnimationFrame(frame);
}

function refreshAll() { refreshPhotos(); refreshCamera(); refreshView(); refreshSelected(); refreshSave(); markSelection(); drawPlan(); }
rebuildHouse(); buildItems();
setTool(prefs.tool); refreshView(); refreshMenu();
setPhoto(prefs.photo); refreshAll();
requestAnimationFrame(frame);
window.interiorLab = { THREE, camera, scene, houseGroup: () => houseGroup, itemsGroup, get house() { return house; }, get interior() { return interior; }, get align() { return align; }, setPhoto, solveNow, select, rebuildHouse };
