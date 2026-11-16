// WALKING: the buildings' walls as lines to walk against (with their door gaps), the doors that swing open as someone comes
// up to them, a person the visitor steers (WASD / arrow keys, Shift to run, or a thumb joystick on a touch screen), and a
// follow camera that stays on the near side of walls and under ceilings indoors.
//
// Walls come from the house builder itself (house-model.js records each wall it draws; the page's bake carries them into
// metres), so what blocks you is exactly what you see. Doors are the hinged groups the bake keeps out of the merged walls.
import * as THREE from 'three';
import { STRIDE } from './people.js';

const R = 0.28;                                          // a person's radius against walls
const OPEN_NEAR = 1.7;                                   // metres from a door's middle at which it swings open

// ---- the buildings: walls (world lines with door gaps), floors and doors -------------------------------------------------
export function surveyBuildings(placed) {
  const walls = [], doors = [], floors = [];
  const v = new THREE.Vector3();
  for (const rec of placed) {
    const g = rec.group;if (rec.deleted || !g) continue;
    g.updateMatrixWorld(true);
    const local = g.userData.walls || [];
    const s = g.getWorldScale(new THREE.Vector3()).x;
    for (const w of local) {
      const a = v.set(w.x0, 0, w.z0).applyMatrix4(g.matrixWorld).clone(), b = v.set(w.x1, 0, w.z1).applyMatrix4(g.matrixWorld).clone();
      const len = Math.hypot(b.x - a.x, b.z - a.z);if (len < .05) continue;
      walls.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, len, y0: g.position.y + w.y0 * s, y1: g.position.y + (w.y0 + w.h) * s, gaps: w.gaps.map(([p, q]) => [p * s, q * s]) });
    }
    g.traverse((o) => { if (o.name === 'door' && o.userData.door) {
      const d = o.userData.door;o.updateMatrixWorld(true);
      // the leaf's middle when shut: half its width along the hinge's local x
      const box = new THREE.Box3().setFromObject(o), mid = box.getCenter(new THREE.Vector3());
      doors.push({ group: o, base: o.quaternion.clone(), angle: 0, target: 0, open: d.open, mid, timer: 0 });
    } });
    if (g.userData.outline) {                                // where the house's ground floor is (the terrain is cut inside it)
      const poly = g.userData.outline.map((p) => p.clone().applyMatrix4(g.matrixWorld));
      floors.push({ poly, y: g.position.y + 0.05 });
    }
  }
  return { walls, doors, floors };
}

const inPoly = (x, z, P) => { let c = false;for (let i = 0, j = P.length - 1;i < P.length;j = i++) { const a = P[i], b = P[j];if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };

// ---- the joystick (touch screens only) -------------------------------------------------------------------------------
function joystick() {
  const el = document.createElement('div'), knob = document.createElement('div');
  el.id = 'joystick';el.append(knob);el.hidden = true;
  const st = document.createElement('style');st.textContent = `
  #joystick{position:fixed;left:22px;bottom:80px;width:120px;height:120px;border-radius:50%;background:#14202e66;border:2px solid #ffffff55;z-index:62;touch-action:none}
  #joystick[hidden]{display:none}
  #joystick div{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:#ffffffcc;box-shadow:0 1px 6px #0006;pointer-events:none}`;
  document.head.append(st);document.body.append(el);
  const out = { x: 0, y: 0, active: false };let id = null;
  const set = (e) => { const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / 45, dy = (e.clientY - cy) / 45;const m = Math.hypot(dx, dy);if (m > 1) { dx /= m;dy /= m; }
    out.x = dx;out.y = -dy;knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; };
  el.addEventListener('pointerdown', (e) => { id = e.pointerId;el.setPointerCapture(id);out.active = true;set(e);e.preventDefault();e.stopPropagation(); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = (e) => { if (e.pointerId !== id) return;id = null;out.active = false;out.x = out.y = 0;knob.style.transform = ''; };
  el.addEventListener('pointerup', end);el.addEventListener('pointercancel', end);
  return { el, out };
}

export function createWalking({ heightAt, keys, camera, controls }) {
  let B = { walls: [], doors: [], floors: [] };
  const stick = joystick(), touch = matchMedia('(pointer:coarse)').matches;
  let person = null;                                     // the one the visitor steers (a family member from arrival.js)
  const others = [];                                     // everyone else who opens doors by walking up to them

  // the ground under a spot: a house's floor inside its walls, the terrain outside
  const floorAt = (x, z) => { for (const f of B.floors) if (inPoly(x, z, f.poly)) return f.y;return heightAt(x, z); };
  const indoors = (x, z) => B.floors.some((f) => inPoly(x, z, f.poly));

  // push a position out of any wall it is too close to, unless it is in a door gap
  function collide(p, y) {
    for (let it = 0;it < 2;it++) for (const w of B.walls) {
      if (w.y1 < y + .3 || w.y0 > y + 1.6) continue;
      const dx = w.bx - w.ax, dz = w.bz - w.az, t = Math.max(0, Math.min(1, ((p.x - w.ax) * dx + (p.z - w.az) * dz) / (w.len * w.len)));
      const along = t * w.len;if (w.gaps.some(([a, b]) => along > a + R * .6 && along < b - R * .6)) continue;
      const cx = w.ax + dx * t, cz = w.az + dz * t, ox = p.x - cx, oz = p.z - cz, d = Math.hypot(ox, oz);
      if (d < R && d > 1e-6) { p.x = cx + ox / d * R;p.z = cz + oz / d * R; }
    }
  }

  // how far a camera can sit from a head before a wall is in the way (2D, against walls tall enough to matter)
  function clear(hx, hz, cx, cz, y) {
    let best = 1;
    for (const w of B.walls) {
      if (w.y1 < y || w.y0 > y) continue;
      const rx = cx - hx, rz = cz - hz, sx = w.bx - w.ax, sz = w.bz - w.az, den = rx * sz - rz * sx;if (Math.abs(den) < 1e-9) continue;
      const t = ((w.ax - hx) * sz - (w.az - hz) * sx) / den, u = ((w.ax - hx) * rz - (w.az - hz) * rx) / den;
      if (t > 0 && t < best && u >= 0 && u <= 1) { const along = u * w.len;if (!w.gaps.some(([a, b]) => along > a && along < b)) best = t; }
    }
    return best;
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function input() {
    const k = keys, x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0) + stick.out.x;
    const y = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0) + stick.out.y;
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), run: !!k.shift || Math.hypot(stick.out.x, stick.out.y) > .92, any: !!(x || y) };
  }

  // the steered person: camera-relative walking, turning toward the way they go, Walk / Run / Idle
  function steer(dt) {
    if (!person) return;
    const { p } = person, pos = p.root.position, inp = input();
    camera.getWorldDirection(fwd);fwd.y = 0;fwd.normalize();right.crossVectors(fwd, camera.up).normalize();
    let mx = fwd.x * inp.y + right.x * inp.x, mz = fwd.z * inp.y + right.z * inp.x;const m = Math.min(1, Math.hypot(mx, mz));
    if (m > .05) {
      const l = Math.hypot(mx, mz);mx /= l;mz /= l;
      const speed = (inp.run ? 3.1 : 1.4) * m, clip = inp.run ? 'Run' : 'Walk';
      p.play(clip, { speed: speed / STRIDE[p.kind.body][clip] });
      const want = Math.atan2(mx, mz);let turn = want - p.root.rotation.y;turn = Math.atan2(Math.sin(turn), Math.cos(turn));p.root.rotation.y += turn * Math.min(1, dt * 10);
      pos.x += mx * speed * dt;pos.z += mz * speed * dt;
    } else p.play('Idle', { fade: .25 });
    pos.y = floorAt(pos.x, pos.z);collide(pos, pos.y);pos.y = floorAt(pos.x, pos.z);
    person.sh.position.set(pos.x, pos.y + .04, pos.z);
    p.update(dt);
  }

  // doors: open while anyone is near the middle of the leaf, close a moment after they have gone
  const qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function doors(dt) {
    const walkers = [person, ...others].filter((o) => o && o.p.root.visible).map((o) => o.p.root.position);
    for (const d of B.doors) {
      const near = walkers.some((w) => Math.hypot(w.x - d.mid.x, w.z - d.mid.z) < OPEN_NEAR);
      if (near) d.timer = 1.2;else d.timer -= dt;
      d.target = d.timer > 0 ? d.open : 0;
      if (Math.abs(d.target - d.angle) < 1e-3) continue;
      d.angle += Math.sign(d.target - d.angle) * Math.min(Math.abs(d.target - d.angle), dt * 2.4);
      d.group.quaternion.copy(d.base).multiply(qy.setFromAxisAngle(up, d.angle));
    }
  }

  return {
    stick, touch,
    survey(placed) { B = surveyBuildings(placed); return B; },
    get buildings() { return B; },
    floorAt, indoors, clear, input,
    get person() { return person; },
    take(o) { person = o;o.state = 'player'; },          // the visitor has this person now
    release() { person = null; },
    watch(list) { others.length = 0;others.push(...list); },
    showStick(on) { stick.el.hidden = !(on && touch); },
    update(dt, steering = true) { if (steering) steer(dt);else if (person) { person.p.play('Idle', { fade: .3 });person.p.update(dt); } doors(dt); },
  };
}
