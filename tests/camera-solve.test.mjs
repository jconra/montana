import assert from 'node:assert/strict';
import { project, solveCamera, pinMiss } from '../assets/camera-solve.mjs';

// a known camera, the corners of a room, and a start that is well off: the solve should find the camera again
const yawPitch = (yaw, pitch) => {   // three.js Euler 'YXZ' (yaw about y, then pitch about x) as a quaternion
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  return [cy * sp, sy * cp, -sy * sp, cy * cp];
};
const truth = { position: [-10, 5.4, 6], q: yawPitch(-1.2, -.08), fov: 63.5 }, aspect = 1067 / 1600;
const corners = [];   // room corners, furniture corners: spread through the part of the room the camera faces
for (const x of [0, 4, 8]) for (const z of [-12, -6, 0, 6]) for (const y of [.6, 4, 9.3]) corners.push([x, y, z]);
const pins = corners.map((p) => ({ p, s: project(truth, p, aspect) })).filter((o) => o.s && o.s[0] > 0 && o.s[0] < 1 && o.s[1] > 0 && o.s[1] < 1).map(({ p, s }) => ({ p, u: s[0], v: s[1] }));
assert.ok(pins.length >= 5, `enough corners in view (${pins.length})`);

const start = { position: [-8, 5, 8], q: yawPitch(-1.0, 0), fov: 60 };   // the photo's recorded lens is close to the truth
const got = solveCamera(pins, start, aspect);
assert.ok(got.rms < 1e-5, `pins land on their spots (rms ${got.rms})`);
for (let i = 0; i < 3; i++) assert.ok(Math.abs(got.position[i] - truth.position[i]) < 1e-3, 'position found');
assert.ok(Math.abs(got.fov - truth.fov) < 1e-2, 'field of view found');

// with the lens locked, only position and turn move
const locked = solveCamera(pins, { ...start, fov: truth.fov }, aspect, { fov: true });
assert.equal(locked.fov, truth.fov);
assert.ok(locked.rms < 1e-5);

// two pins: only the turn is solved, position stays put
const two = solveCamera(pins.slice(0, 2), { ...truth, q: yawPitch(-1.1, -.05) }, aspect);
assert.deepEqual(two.position, truth.position);
assert.ok(two.rms < 1e-6);
// edges: each photo spot sits on a model edge, but not at the end the pin remembers; as lines they still find the camera
const edges = [[[0, .6, -12], [0, 9.3, -12]], [[8, .6, -6], [8, 9.3, -6]], [[0, 9.3, -12], [8, 9.3, -12]], [[4, .6, 0], [8, .6, 0]], [[0, .6, 6], [0, 4, 6]], [[4, 4, -6], [4, 4, 6]], [[8, .6, 6], [8, 9.3, 6]]];
const linePins = edges.map(([a, b]) => { const m = a.map((v, i) => v + (b[i] - v) * .37), s = project(truth, m, aspect); return s && { u: s[0], v: s[1], line: [a, b] }; }).filter(Boolean);
const mixed = solveCamera([...pins.slice(0, 3), ...linePins], start, aspect);
assert.ok(mixed.rms < 1e-5, `edge pins agree (rms ${mixed.rms})`);
for (let i = 0; i < 3; i++) assert.ok(Math.abs(mixed.position[i] - truth.position[i]) < 1e-3, 'position found from edges');
assert.ok(pinMiss(truth, linePins[0], aspect) < 1e-9);
// a level camera is found from anywhere in the house by the search
import('../assets/camera-solve.mjs').then(({ searchCamera }) => {
  const level = { position: [-6, 5.4, 4], q: yawPitch(2.1, -.1), fov: 44.8 };
  const pts = []; for (const x of [-24, -18, -12, -6]) for (const z of [-12, -4, 4, 12]) for (const y of [.6, 9]) pts.push([x, y, z]);
  const pp = pts.map((p) => ({ p, s: project(level, p, 1.5) })).filter((o) => o.s && o.s[0] > 0 && o.s[0] < 1 && o.s[1] > 0 && o.s[1] < 1).map(({ p, s }) => ({ p, u: s[0], v: s[1] })).slice(0, 7);
  const t0 = Date.now(), found = searchCamera(pp, 44.8, 1.5, { x0: -24, x1: 24, z0: -12, z1: 12 }, [5.9, 14.9]);
  assert.ok(found.rms < 1e-4, `search finds the camera (rms ${found.rms})`);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(found.position[i] - level.position[i]) < 1e-2, 'search position');
  console.log('camera solve ok; search took', Date.now() - t0, 'ms with', pp.length, 'pins');
});
