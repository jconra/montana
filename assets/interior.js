// THE HOUSE INSIDE: furniture placed from the marked-up floor plan (2026-11-16) and his July 2012 photos (the furniture is
// "basically the same now"). The layout is data, assets/montana-interior.json, so the Interior Lab (labs/interior/) can move pieces
// while looking through the photos and the game builds from the very same file.
//
// Every piece is drawn in its own frame: w across (x), d deep (z), its back toward -z, standing on y = 0. An item places it:
//   { id, type, label, floor, x, z, w, d, rot, y?, h?, color?, ... }   (house feet; +x east, +z south toward the drive)
// rot turns it (degrees, as three.js turns about y): 0 = back to the north, 90 = back to the west, 180 = south, 270 = east.
// In the game everything is merged by colour, so the whole inside is a few dozen draws; solid pieces become walls for walking.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stonePanel } from './stone/stonewall.js';
import { makeRubbleTexture } from './stone/stonetex.js';

export const COLORS = {                                  // a touch deeper than the photos: the scene's tone curve lifts darks
  leather: '#331d12', brown: '#523320', cushion: '#64412c', wood: '#7a4826', pine: '#b07a3e', pineDark: '#8a5a2c',
  top: '#c9b088', white: '#ecebe6', steel: '#7d8184', black: '#141416', stone: '#7a7266', teal: '#16736e',
  rug: '#5e2618', rugLight: '#94723f', quiltBlue: '#2c4f80', quiltGreen: '#3e5a32', quiltRed: '#7e2c25', pillow: '#f2efe8',
  bunk: '#244a8a', mattress: '#e9e6dd', cedar: '#b67a40',
  carpet: '#aaa294', tile: '#9a8d79', pineLight: '#c79a5e', blackLeather: '#17171a', microfibre: '#4e3a2e', darkLeather: '#2f1c13', runner: '#a8987a', cream: '#c9c2ae',
};
export const colorOf = (c) => COLORS[c] || c || '#888888';
export const FLOOR_TOPS = [0.6, 9.6];
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };                   // the floors' top faces, feet (the slab is 0.6 thick)

// the pieces: label, a starting size, the colour key, and how to draw it in its own frame (b = drawing helpers)
export const PIECES = {
  sofa: { label: 'Sofa', size: [7.5, 2.7], color: 'leather', build(b, it) {
    const { x0, x1, z0, z1 } = b.r, c = it.color;
    b.box(c, x0, z0, x1, z1, 0, 1.4);
    b.box('cushion', x0 + .5, z0 + .7, x1 - .5, z1 - .1, 1.4, 1.75);
    b.box(c, x0, z0, x1, z0 + .75, 1.4, 2.9);                                // back
    b.box(c, x0, z0, x0 + .55, z1, 1.4, 2.15); b.box(c, x1 - .55, z0, x1, z1, 1.4, 2.15);   // arms
    b.foot(x0, z0, x1, z1, 2.9);
  } },
  armchair: { label: 'Armchair', size: [3, 2.4], color: 'leather', build(b, it) { PIECES.sofa.build(b, it); } },
  sectional: { label: 'Sectional', size: [9.9, 2.75], color: 'brown', build(b, it) {   // a sofa with a chaise reaching forward from one end
    PIECES.sofa.build(b, it);
    const { x0, x1, z1 } = b.r, c = it.color, cw = it.chaiseW ?? 2.8, cl = it.chaise ?? 3.6, side = it.side ?? 1;
    const a = side > 0 ? x1 - cw : x0, e = side > 0 ? x1 : x0 + cw;
    b.box(c, a, z1, e, z1 + cl, 0, 1.4); b.box('cushion', a + .3, z1, e - .3, z1 + cl - .3, 1.4, 1.75);
    if (side > 0) b.box(c, x1 - .75, z1, x1, z1 + cl, 1.4, 2.9); else b.box(c, x0, z1, x0 + .75, z1 + cl, 1.4, 2.9);
    b.foot(a, z1, e, z1 + cl, 2.9);
  } },
  table: { label: 'Table', size: [3, 5], color: 'pine', h: 2.5, build(b, it) {
    const { x0, x1, z0, z1 } = b.r, h = it.h ?? 2.5, legs = it.legs ?? it.color;
    b.box(it.color, x0, z0, x1, z1, h - .15, h);
    for (const [x, z] of [[x0 + .2, z0 + .2], [x1 - .4, z0 + .2], [x0 + .2, z1 - .4], [x1 - .4, z1 - .4]]) b.box(legs, x, z, x + .2, z + .2, 0, h - .15);
    b.foot(x0, z0, x1, z1, h);
  } },
  chair: { label: 'Dining chair', size: [1.5, 1.5], color: 'pine', build(b, it) {
    const { x0, x1, z0, z1 } = b.r, legs = it.legs ?? 'pineDark';
    b.box(it.color, x0, z0, x1, z1, 1.5, 1.65);
    for (const [x, z] of [[x0 + .05, z0 + .05], [x1 - .2, z0 + .05], [x0 + .05, z1 - .2], [x1 - .2, z1 - .2]]) b.box(legs, x, z, x + .15, z + .15, 0, 1.5);
    b.box(legs, x0 + .05, z0, x1 - .05, z0 + .14, 1.65, 3.2);              // the back
    b.foot(x0, z0, x1, z1, 3.2, false);
  } },
  stool: { label: 'Bar stool', size: [1.1, 1.1], color: 'pineDark', h: 2.55, build(b, it) {
    const h = it.h ?? 2.55; b.cyl(it.color, 0, 0, b.r.x1, h - .15, h); b.cyl('black', 0, 0, .08, 0, h - .15, 6);
    b.foot(b.r.x0, b.r.z0, b.r.x1, b.r.z1, h, false);
  } },
  bed: { label: 'Bed', size: [5, 6.7], color: 'quiltGreen', build(b, it) {   // the headboard at the back
    const { x0, x1, z0, z1 } = b.r, frame = it.frame ?? 'wood';
    b.box(frame, x0, z0, x1, z1, 0, 1.1);
    b.box('mattress', x0 + .1, z0 + .1, x1 - .1, z1 - .1, 1.1, 1.9);
    b.box(it.color, x0 + .05, z0 + 1.6, x1 - .05, z1 - .05, 1.9, 2.05);
    b.box(frame, x0, z0, x1, z0 + .35, 0, 3.6);
    b.box('pillow', x0 + .4, z0 + .45, x1 - .4, z0 + 1.45, 1.9, 2.3);
    b.foot(x0, z0, x1, z1, 2.1);
  } },
  bunk: { label: 'Bunk beds', size: [3.3, 6.6], color: 'bunk', build(b, it) {
    const { x0, x1, z0, z1 } = b.r, c = it.color;
    for (const [x, z] of [[x0, z0], [x1 - .15, z0], [x0, z1 - .15], [x1 - .15, z1 - .15]]) b.box(c, x, z, x + .15, z + .15, 0, 5.6);
    for (const y of [1.1, 4.4]) { b.box(c, x0, z0, x1, z1, y - .12, y); b.box('mattress', x0 + .1, z0 + .1, x1 - .1, z1 - .1, y, y + .55); b.box(it.quilt ?? 'quiltBlue', x0 + .1, z0 + 1.5, x1 - .1, z1 - .1, y + .55, y + .65); }
    b.box(c, x0, z0, x0 + .1, z1, 4.9, 5.5); b.box(c, x1 - .1, z0, x1, z1, 4.9, 5.5);
    b.foot(x0, z0, x1, z1, 5.6);
  } },
  futon: { label: 'Futon', size: [9.7, 2.85], color: 'black', build(b, it) {
    const { x0, x1, z0, z1 } = b.r;
    b.box(it.color, x0, z0, x1, z1, 0, 1.2); b.box('cushion', x0 + .2, z0 + .05, x1 - .2, z1 - .2, 1.2, 1.75); b.box('cushion', x0 + .2, z0, x1 - .2, z0 + .65, 1.75, 3.0);
    b.foot(x0, z0, x1, z1, 3);
  } },
  cabinets: { label: 'Cabinets + counter', size: [6, 2.1], color: 'pine', h: 2.85, build(b, it) {
    const { x0, x1, z0, z1 } = b.r, h = it.h ?? 2.85;
    b.box(it.color, x0, z0, x1, z1, 0, h); b.box(it.top ?? 'top', x0 - .05, z0 - .05, x1 + .05, z1 + .05, h, h + .2);
    b.foot(x0, z0, x1, z1, h + .2);
  } },
  block: { label: 'Block (fridge, dresser, tub…)', size: [2.5, 2.5], color: 'white', h: 3, build(b, it) {
    const { x0, x1, z0, z1 } = b.r, h = it.h ?? 3; b.box(it.color, x0, z0, x1, z1, 0, h); b.foot(x0, z0, x1, z1, h);
  } },
  inset: { label: 'Inset (sink, cooktop)', size: [1.4, 1.2], color: 'steel', h: .04, build(b, it) {   // a thin slab, usually raised onto a counter with y
    const { x0, x1, z0, z1 } = b.r; b.box(it.color, x0, z0, x1, z1, 0, it.h ?? .04); b.foot(x0, z0, x1, z1, it.h ?? .04, false);
  } },
  toilet: { label: 'Toilet', size: [1.4, 2.4], color: 'white', build(b, it) {
    const { x0, x1, z0, z1 } = b.r; b.box(it.color, x0, z0, x1, z0 + .7, 0, 2.6); b.box(it.color, x0 + .1, z0 + .6, x1 - .1, z1, 0, 1.4);
    b.foot(x0, z0, x1, z1, 1.4);
  } },
  stove: { label: 'Wood stove + hearth', size: [4.2, 3.7], color: 'stone', build(b, it) {
    const { x0, x1, z0, z1 } = b.r, pipe = it.pipe ?? 22;
    b.box(it.color, x0, z0, x1, z1, 0, .35);
    b.box('black', -1.1, -1, 1.1, 1, .35, 2.9); b.box('black', -1.25, -1.15, 1.25, 1.15, 2.9, 3.05);
    b.cyl('black', 0, 0, .32, 3.05, pipe);
    b.foot(x0, z0, x1, z1, 3);
  } },
  stonewall: { label: 'Stone wall', size: [5, .35], color: 'stone', h: 5, special: true, build(b, it) {   // real stones (Mathwood's Stone Lab): see stoneGroup
    const { x0, x1, z0, z1 } = b.r; b.foot(x0, z0, x1, z1, it.h ?? 5);
  } },
  floor: { label: 'Floor covering (carpet, tile)', size: [10, 10], color: 'carpet', fixed: true, build(b, it) {   // lies under everything; the lab does not pick it up by clicks in the view
    const { x0, x1, z0, z1 } = b.r; b.box(it.color, x0, z0, x1, z1, 0, .02); b.foot(x0, z0, x1, z1, .02, false);
  } },
  rug: { label: 'Rug', size: [5, 8], color: 'rug', build(b, it) {   // each rug its own thickness, so overlapping rugs never flicker
    const { x0, x1, z0, z1 } = b.r, t = .03 + (it.layer ?? (hash(it.id || '') % 8)) * .012;
    b.box(it.color, x0, z0, x1, z1, 0, t); b.foot(x0, z0, x1, z1, t, false);
  } },
};

// one item's shapes in house feet: parts [{color, geo}] and its footprints [{poly, y0, h, solid}]
export function itemShapes(it, tops = FLOOR_TOPS) {
  const P = PIECES[it.type]; if (!P) return { parts: [], feet: [] };
  const w = it.w ?? P.size[0], d = it.d ?? P.size[1], item = { ...it, color: it.color ?? P.color };
  const rot = (it.rot || 0) * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
  const y0 = (tops[it.floor || 0] ?? 0) + (it.y || 0);
  const place = (x, z) => [it.x + x * cs + z * sn, it.z - x * sn + z * cs];   // three's turn about y
  const parts = [], feet = [];
  const b = {
    r: { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 },
    box(c, x0, z0, x1, z1, ya, yb) {
      if (x1 - x0 <= 0 || z1 - z0 <= 0 || yb - ya <= 0) return;
      const g = new THREE.BoxGeometry(x1 - x0, yb - ya, z1 - z0); g.translate((x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2); parts.push({ color: colorOf(c), geo: g });
    },
    cyl(c, x, z, r, ya, yb, seg = 14) { const g = new THREE.CylinderGeometry(r, r, yb - ya, seg); g.translate(x, (ya + yb) / 2, z); parts.push({ color: colorOf(c), geo: g }); },
    foot(x0, z0, x1, z1, h, solid = true) { feet.push({ poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => place(x, z)), y0, h, solid }); },
  };
  P.build(b, item);
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(it.x, y0, it.z);
  for (const p of parts) p.geo.applyMatrix4(m);
  return { parts, feet };
}

// the stone wall's stones: built in metres by the Stone Lab's builder, stacked ledgestone, their face toward the piece's front
let stoneMat = null, stoneTex = null;
function stoneMaterial() {
  if (stoneMat) return stoneMat;
  stoneTex = makeRubbleTexture();
  stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex.map, normalMap: stoneTex.normalMap, roughness: .93 });
  stoneMat.onBeforeCompile = (sh) => {                      // each stone's own colour and its shading in the joints
    sh.vertexShader = 'attribute vec4 aTintPaint;\nattribute float aAO;\nvarying vec3 vStoneTint;\nvarying float vStoneAO;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStoneTint = aTintPaint.rgb; vStoneAO = aAO;');
    sh.fragmentShader = 'varying vec3 vStoneTint;\nvarying float vStoneAO;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vStoneTint * vStoneAO;');
  };
  stoneMat.customProgramCacheKey = () => 'montana-stone';
  stoneMat.userData.wxDone = true; stoneMat.userData.noShadow = true;
  return stoneMat;
}
// one stone wall as a group in house feet (scale it by FT for metres)
export function stoneGroup(it, tops = FLOOR_TOPS) {
  const M = 0.3048, P = PIECES.stonewall, w = (it.w ?? P.size[0]) * M, d = (it.d ?? P.size[1]) * M, h = (it.h ?? P.h) * M;
  stoneMaterial();
  const wall = stonePanel({ style: 'ledgestone', palette: it.palette || 'buff', mortar: 'grey', seed: it.seed || 3, size: .2, irregularity: .4 }, { texMean: stoneTex.mean }, { w, h, t: d });
  const g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(1 / M); g.add(inner);
  for (const geo of [wall.stone, wall.mortar]) { const m = new THREE.Mesh(geo, stoneMat); m.receiveShadow = true; inner.add(m); }
  g.rotation.y = (it.rot || 0) * Math.PI / 180; g.position.set(it.x, (tops[it.floor || 0] ?? 0) + (it.y || 0), it.z);
  return g;
}

const MATS = new Map();
export function interiorMaterial(color) {
  if (!MATS.has(color)) {
    const steel = color === COLORS.steel;
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: steel ? .45 : .85, metalness: steel ? .5 : 0 });
    m.userData.wxDone = true; m.userData.noShadow = true;                     // no outdoor weathering, no sun shadows indoors
    MATS.set(color, m);
  }
  return MATS.get(color);
}
const merged = (geos) => mergeGeometries(geos.map((g) => g.index ? g.toNonIndexed() : g));

// one item as its own group (the lab picks and drags these)
export function buildItem(it, tops = FLOOR_TOPS) {
  const { parts, feet } = itemShapes(it, tops), byColor = new Map(), g = new THREE.Group();
  for (const p of parts) (byColor.get(p.color) || byColor.set(p.color, []).get(p.color)).push(p.geo);
  for (const [c, geos] of byColor) g.add(new THREE.Mesh(merged(geos), interiorMaterial(c)));
  if (PIECES[it.type]?.special) try { g.add(stoneGroup(it, tops)); } catch (e) { console.warn('Stone wall could not build:', e); }
  g.userData.itemId = it.id; g.userData.feet = feet; g.name = 'item:' + it.id;
  return g;
}

// the whole inside for the game: merged by colour, scaled to metres by FT, with the solid footprints as walls for walking
export function buildInterior(FT, data) {
  const byColor = new Map(), walls = [], tops = data?.floorTops || FLOOR_TOPS;
  for (const it of data?.items || []) {
    const { parts, feet } = itemShapes(it, tops);
    for (const p of parts) { p.geo.scale(FT, FT, FT); (byColor.get(p.color) || byColor.set(p.color, []).get(p.color)).push(p.geo); }
    for (const f of feet) if (f.solid) for (let k = 0; k < 4; k++) {
      const a = f.poly[k], c = f.poly[(k + 1) % 4];
      walls.push({ x0: a[0] * FT, z0: a[1] * FT, x1: c[0] * FT, z1: c[1] * FT, y0: f.y0 * FT, h: f.h * FT, gaps: [] });
    }
  }
  const group = new THREE.Group(); group.name = 'interior';
  for (const it of data?.items || []) if (PIECES[it.type]?.special) try { const sg = stoneGroup(it, tops); sg.position.multiplyScalar(FT); sg.scale.setScalar(FT); group.add(sg); } catch (e) { console.warn('Stone wall could not build:', e); }
  for (const [c, geos] of byColor) { const mesh = new THREE.Mesh(merged(geos), interiorMaterial(c)); mesh.castShadow = false; mesh.receiveShadow = true; group.add(mesh); }
  return { group, walls };
}
