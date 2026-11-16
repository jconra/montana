// THE ARRIVAL: when the car has parked by the garage, the family gets out (one from each door), walks across the apron and
// up the walkway between the log edgings, and goes in at the house's entry door. Dad stops on the walkway to wave first.
// The people are jconra.com's townsfolk (assets/people.js, Quaternius CC0 bodies, recoloured per person); they load in the
// background after the loading screen lifts, and their shaders are built while the car is still driving.
// Later: the visitor takes one of them over and walks them in themselves.
import * as THREE from 'three';
import { loadPeople, Person, STRIDE } from './people.js';

// world spots, measured from a straight-down render: the gravel apron clear of the root cellar, the walkway, the door
const APRON = { x: -10.2, z: -1.75 }, WALK = { x: -3.4, z: -1.6 }, DOOR = { x: -1.2, z: -1.75 };
const FAMILY = [
  { file: 'casual_m', height: 1.8, seat: [0.35, -1], role: 'dad', look: { skin: '#dba982', hair: '#3f2a1b', turn: [2.2, -.4, 0, 0], sat: [.7, .5, .4, 1], light: [.9, .8, .7, 1] } },
  { file: 'casual_f', height: 1.66, seat: [0.35, 1], look: { skin: '#e6bfa1', hair: '#5c3a22', turn: [-1.1, .3, 0, 0], sat: [.8, .5, .4, 1], light: [1, .8, .8, 1] } },
  { file: 'adventurer_f', height: 1.42, seat: [-0.6, 1], kid: true, look: { skin: '#e6bfa1', hair: '#b0306a', turn: [.6, 0, 0, 0], sat: [1, .7, .5, 1], light: [1, .9, .8, 1] } },
  { file: 'hoodie_m', height: 1.3, seat: [-0.6, -1], kid: true, run: true, look: { skin: '#dba982', hair: '#2b1d14', turn: [-2.4, 0, 0, 0], sat: [.9, .6, .5, 1], light: [.9, .8, .8, 1] } },
];

function blob() {                                    // one soft shadow under each person, shared
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

export function createArrival({ scene, heightAt, renderer, camera }) {
  let lib = null, loading = null, folk = [], started = false, ground = heightAt, inside = [], onOut = null, doorOut = DOOR, doorIn = null;
  const shadowMat = blob(), shadowGeo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);
  const col = (s) => new THREE.Color(s);

  // load the bodies and build the family out of sight, and get their shaders compiled while the car is still driving
  function prepare() {
    if (loading) return loading;
    loading = (async () => {
      lib = await loadPeople(new URL('./models/people/', import.meta.url).href);
      const pause = () => new Promise((r) => setTimeout(r, 0));
      for (const f of FAMILY) {
        await pause();
        const kind = lib.kinds.find((k) => k.file === f.file);
        const look = { ...f.look, skin: col(f.look.skin), hair: col(f.look.hair) };
        const p = new Person(lib, kind, { look, kid: f.kid });
        p.mesh.receiveShadow = true;
        p.root.updateMatrixWorld(true);                            // (the compressed meshes carry their scale in a node: measure in world units)
        const box = new THREE.Box3().setFromObject(p.root);       // the body's own height, so it can be set in metres
        p.root.scale.multiplyScalar(f.height / Math.max(0.1, box.max.y - box.min.y));
        p.root.position.set(DOOR.x, heightAt(DOOR.x, DOOR.z) - 50, DOOR.z);
        const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.renderOrder = 1; sh.visible = false;
        scene.add(sh); p.play('Idle', { fade: 0 });
        folk.push({ p, f, sh, path: [], leg: 0, state: 'wait', t: 0 });
      }
      // their one shared shader, built by drawing just them into a single scissored pixel (as the loading screen does for
      // the rest): only their program is made, with the scene's own lights, instead of re-checking the whole scene
      for (const o of folk) scene.add(o.p.root);
      const LAYER = 30, mask = camera.layers.mask;
      for (const o of folk) o.p.root.traverse((m) => { m.layers.enable(LAYER); m.userData.fc = m.frustumCulled; m.frustumCulled = false; });
      camera.layers.set(LAYER); renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
      try { renderer.render(scene, camera); } catch (e) { /* compiled on first draw instead */ }
      renderer.setScissorTest(false); camera.layers.mask = mask;
      for (const o of folk) { o.p.root.traverse((m) => { m.layers.disable(LAYER); m.frustumCulled = m.userData.fc ?? true; }); o.p.root.visible = false; }
    })().catch((e) => { console.warn('The family could not load:', e); folk = []; });
    return loading;
  }

  // the car has parked: each person stands at their door, then sets off along their own slightly different path
  async function start(car) {
    if (started) return; started = true;
    await prepare();
    const h = car.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    folk.forEach((o, i) => {
      const [along, side] = o.f.seat, jit = (i - 1.5) * 0.35;
      const door = { x: car.x + fx * along + rx * side * 0.95, z: car.z + fz * along + rz * side * 0.95 };
      const out = { x: door.x + rx * side * 0.7, z: door.z + rz * side * 0.7 };
      // through the door and on to a spot of their own in the great room (when the house gave us its rooms)
      o.path = [door, out, { x: APRON.x, z: APRON.z + jit }, { x: WALK.x, z: WALK.z + jit * 0.4 }, doorOut, ...(doorIn && inside.length ? [doorIn, inside[i % inside.length]] : [])];
      o.leg = 0; o.t = -0.5 * i; o.state = 'out';
      const pos = o.p.root.position; pos.set(door.x, heightAt(door.x, door.z), door.z);
      o.p.root.rotation.y = Math.atan2(out.x - door.x, out.z - door.z);
      o.p.root.visible = o.sh.visible = false;
    });
  }

  const SPEED = { walk: 1.25, run: 2.6 };
  function update(dt) {
    for (const o of folk) {
      if (o.state === 'wait' || o.state === 'player') continue;
      if (o.state === 'inside') { o.p.update(dt); continue; }   // standing about in the house
      o.t += dt; if (o.t < 0) continue;                      // the doors open one after another
      const { p } = o, pos = p.root.position;
      if (!p.root.visible) { p.root.visible = o.sh.visible = true; }
      if (o.state === 'wave') {                              // turned to whoever is watching
        const want = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);let turn = want - p.root.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn)); p.root.rotation.y += turn * Math.min(1, dt * 6);
        if (o.t > 2.6) { o.state = 'go'; p.play('Walk', { speed: SPEED.walk / STRIDE[p.kind.body].Walk }); }
        p.update(dt); continue;
      }
      const target = o.path[o.leg + 1];
      if (!target) { o.state = 'inside'; p.play('Idle', { fade: .4 }); if (!inside.length) p.root.visible = o.sh.visible = false; continue; }   // arrived (no rooms: gone in at the door)
      const run = o.f.run && o.leg >= 1 && o.leg < 3, speed = o.leg === 0 ? 0.7 : run ? SPEED.run : SPEED.walk;
      const clip = run ? 'Run' : 'Walk';
      if (p.curName !== clip || o.state === 'out') { p.play(clip, { speed: speed / STRIDE[p.kind.body][clip] }); o.state = 'go'; }
      const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz), step = speed * dt;
      if (d <= step) {
        pos.x = target.x; pos.z = target.z; o.leg++;
        if (o.leg === 1 && o.f.role === 'dad' && onOut) onOut(o);   // the driver is out of the car
        if (o.f.role === 'dad' && o.leg === 3 && !o.waved) { o.waved = true; o.state = 'wave'; o.t = 0; p.play('Wave', { fade: 0.25 }); }
      } else {
        pos.x += dx / d * step; pos.z += dz / d * step;
        const want = Math.atan2(dx, dz); let turn = want - p.root.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn)); p.root.rotation.y += turn * Math.min(1, dt * 8);
      }
      pos.y = ground(pos.x, pos.z);
      o.sh.position.set(pos.x, pos.y + 0.04, pos.z);
      p.update(dt);
    }
  }
  return {
    prepare, start, update, get folk() { return folk; },
    get driver() { return folk.find((o) => o.f.role === 'dad'); },
    get started() { return started; },
    // ground: what to stand on (house floors inside); rooms: spots inside the house, the first just in from the door
    setGround(fn) { ground = fn; }, setInside(spots) { inside = spots; }, onDriverOut(fn) { onOut = fn; },
    setDoor(out, inn) { doorOut = out; doorIn = inn; },   // the real doorway: a step outside it and a step in
  };
}
