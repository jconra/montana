// Where was the photographer standing? Given pins — a spot in the photo (u, v from its top-left, 0..1) and the same spot in the
// model (x, y, z) — find the camera (position, turn, vertical field of view) that lands each model spot on its photo spot.
// Damped least squares (Levenberg–Marquardt) from a starting camera; plain math so it runs in the lab and in node tests.
// Cameras are three.js-style: they look down their own -z with +y up; q is a unit quaternion [x, y, z, w].

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qnorm = (q) => { const n = Math.hypot(...q) || 1; return q.map((v) => v / n); };
const qrotvec = (r) => { const t = Math.hypot(...r); if (t < 1e-12) return [r[0] / 2, r[1] / 2, r[2] / 2, 1]; const s = Math.sin(t / 2) / t; return [r[0] * s, r[1] * s, r[2] * s, Math.cos(t / 2)]; };
// v rotated by the inverse of q (world -> camera): the transpose of q's rotation matrix
function invRotate(q, v) {
  const [x, y, z, w] = q;
  const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w);
  const r10 = 2 * (x * y + z * w), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - x * w);
  const r20 = 2 * (x * z - y * w), r21 = 2 * (y * z + x * w), r22 = 1 - 2 * (x * x + y * y);
  return [r00 * v[0] + r10 * v[1] + r20 * v[2], r01 * v[0] + r11 * v[1] + r21 * v[2], r02 * v[0] + r12 * v[1] + r22 * v[2]];
}

// A wrong pin should not drag the camera: misses count fully up to about 15 pixels (of a 1067-pixel-high photo), then pull
// less and less (Cauchy), so the pins that agree win and the odd one out just shows a big miss.
const SOFT = .014, soft = (d) => SOFT * Math.sqrt(Math.log1p((d / SOFT) ** 2));

// a model spot -> photo spot (u, v in 0..1 from the top-left), or null when it is behind the camera
export function project(cam, p, aspect) {
  const c = invRotate(cam.q, [p[0] - cam.position[0], p[1] - cam.position[1], p[2] - cam.position[2]]);
  if (c[2] > -1e-6) return null;
  const t = Math.tan(cam.fov * Math.PI / 360);
  const nx = c[0] / -c[2] / (t * aspect), ny = c[1] / -c[2] / t;
  return [(nx + 1) / 2, (1 - ny) / 2];
}

// pins: [{u, v, p:[x,y,z]}] — or, for an edge, {u, v, line:[[x,y,z],[x,y,z]]}: the photo spot lies somewhere on that model edge, so only
// its distance across the edge counts (an edge pins one direction, a corner two).
// start: {position, q, fov}; aspect = photo width / height; lock: {fov, position}
// Two gentle pulls keep a few loose pins from inventing a wild camera: photos are held level (a tilt of 1° costs about what
// a 2-pixel miss does), and a freed lens stays near the one it started from (the photo's own focal length).
// returns {position, q, fov, rms} with rms in photo heights (multiply by the photo's pixel height for pixels)
// bounds (optional): {x0, x1, y0, y1, z0, z1}, the box the camera must stand in (the house): a firm pull back inside it.
export function solveCamera(pins, start, aspect, lock = {}, bounds = null) {
  const n = pins.reduce((a, q) => a + (q.line ? 1 : 2), 0);   // how many things the pins pin down
  const free = { position: !lock.position && n >= 6, fov: !lock.fov && n >= 8 };
  const base = { position: [...start.position], q: qnorm([...start.q]), fov: start.fov };
  // parameters: turn (3, a small rotation applied on top of base.q), position (3), log tan(fov/2) (1)
  const idx = [0, 1, 2]; if (free.position) idx.push(3, 4, 5); if (free.fov) idx.push(6);
  const camOf = (k) => ({
    q: qnorm(qmul(base.q, qrotvec([k[0], k[1], k[2]]))),
    position: [base.position[0] + k[3], base.position[1] + k[4], base.position[2] + k[5]],
    fov: k[6] ? Math.atan(Math.tan(base.fov * Math.PI / 360) * Math.exp(k[6])) * 360 / Math.PI : base.fov,
  });
  const resid = (k) => {
    const cam = camOf(k), r = [];
    const q = cam.q, side = 2 * (q[0] * q[1] + q[2] * q[3]);  // the camera's right-hand axis, its height: 0 when level
    r.push(.1 * side);
    const up = 1 - 2 * (q[0] * q[0] + q[2] * q[2]);            // the camera's up axis, its height: 1 upright, below 0 upside down
    r.push(3 * Math.max(0, .5 - up));
    if (bounds) { const p = cam.position, out = (v, a, b) => Math.max(0, a - v, v - b);
      r.push(.5 * out(p[0], bounds.x0, bounds.x1), .5 * out(p[1], bounds.y0, bounds.y1), .5 * out(p[2], bounds.z0, bounds.z1)); }
    if (free.fov) r.push(2 * Math.max(0, Math.abs(k[6]) - .1));   // free within about ±10% of the start, firm beyond
    for (const pin of pins) {
      if (pin.line) {                                       // distance from the photo spot to the projected edge's line
        const a = project(cam, pin.line[0], aspect), b = project(cam, pin.line[1], aspect);
        if (!a || !b) { r.push(5); continue; }
        const ex = (b[0] - a[0]) * aspect, ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1e-9;
        const d = ((pin.u - a[0]) * aspect * ey - (pin.v - a[1]) * ex) / L; r.push(Math.sign(d) * soft(Math.abs(d))); continue;
      }
      const s = project(cam, pin.p, aspect);
      if (!s) { r.push(5, 5); continue; }                    // behind the camera: a big, smooth-ish penalty
      const ex = (s[0] - pin.u) * aspect, ey = s[1] - pin.v, d = Math.hypot(ex, ey);   // measured in photo heights
      const w = d > 1e-12 ? soft(d) / d : 1; r.push(ex * w, ey * w);
    }
    return r;
  };
  const cost = (r) => r.reduce((a, b) => a + b * b, 0);
  let k = [0, 0, 0, 0, 0, 0, 0], r = resid(k), c = cost(r), lambda = 1e-3;
  for (let it = 0; it < 200 && pins.length; it++) {
    // numeric Jacobian over the free parameters
    const J = idx.map((j) => { const h = j < 3 ? 1e-5 : j < 6 ? 1e-4 : 1e-5, kk = [...k]; kk[j] += h; const r2 = resid(kk); return r2.map((v, i) => (v - r[i]) / h); });
    const n = idx.length, A = Array.from({ length: n }, () => new Array(n).fill(0)), g = new Array(n).fill(0);
    for (let a = 0; a < n; a++) { for (let b = 0; b < n; b++) for (let i = 0; i < r.length; i++) A[a][b] += J[a][i] * J[b][i]; for (let i = 0; i < r.length; i++) g[a] -= J[a][i] * r[i]; }
    let improved = false;
    for (let tries = 0; tries < 12; tries++) {
      const M = A.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (A[a][a] + 1e-9) : 0)));
      const dx = gauss(M, g); if (!dx) { lambda *= 10; continue; }
      const k2 = [...k]; idx.forEach((j, a) => { k2[j] += dx[a]; });
      const r2 = resid(k2), c2 = cost(r2);
      if (c2 < c) { const done = c - c2 < 1e-14; k = k2; r = r2; c = c2; lambda = Math.max(lambda / 3, 1e-9); improved = true; if (done) it = 1e9; break; }
      lambda *= 8;
    }
    if (!improved) break;
  }
  const cam = camOf(k), miss = pins.map((q) => pinMiss(cam, q, aspect));
  return { ...cam, rms: Math.sqrt(miss.reduce((s2, m) => s2 + m * m, 0) / Math.max(1, pins.length)), free };
}

// how far one pin misses with a camera, in photo heights (across the edge for an edge pin)
export function pinMiss(cam, pin, aspect) {
  if (pin.line) { const a = project(cam, pin.line[0], aspect), b = project(cam, pin.line[1], aspect); if (!a || !b) return Infinity;
    const ex = (b[0] - a[0]) * aspect, ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1e-9; return Math.abs(((pin.u - a[0]) * aspect * ey - (pin.v - a[1]) * ex) / L); }
  const s = project(cam, pin.p, aspect); return s ? Math.hypot((s[0] - pin.u) * aspect, s[1] - pin.v) : Infinity;
}

function gauss(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-15) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Where was I standing? Try the camera from all over the house (every few feet, both floors, eight ways round, eye height),
// solve each, and keep the best. eyes: the heights to try (feet); area: {x0, x1, z0, z1}.
export function searchCamera(pins, fov, aspect, area, eyes, lock = { fov: true }, bounds = null) {
  let best = null;
  for (const y of eyes) for (let x = area.x0; x <= area.x1; x += 6) for (let z = area.z0; z <= area.z1; z += 6) for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4, q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    const r = solveCamera(pins, { position: [x, y, z], q, fov }, aspect, lock, bounds);
    if (!best || r.rms < best.rms) best = r;
  }
  return best;
}
