// OCTAHEDRAL IMPOSTERS. A tree rendered from a grid of directions into one atlas, then drawn far
// away as a single camera-facing quad that shows the view nearest the camera's own direction -
// blended from the three nearest so it does not snap as you move. The directions are laid out
// on an octahedron unfolded into a square (or half an octahedron, for things nobody looks at from
// underneath), so finding the cell for a direction is a few lines of arithmetic.
//
// Two atlases are baked: colour with the cut-out in alpha, and the normal in the tree's own frame
// (so the imposter is lit by the scene's sun, whichever way its instance is turned) with a depth
// hint in alpha. The instance carries its own spin, so a thousand trees spun differently each
// pick their own view.
import * as THREE from 'three';
import { WIND, WIND_GLSL } from './wind.js';

// direction (unit, in the tree's frame, y up) -> square [0,1]^2
export function octEncode(d, hemi) {
  const s = Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z);
  let x = d.x / s, z = d.z / s;
  if (hemi) return [(x + z) * 0.5 + 0.5, (z - x) * 0.5 + 0.5];          // the top half, turned 45 degrees to fill the square
  if (d.y < 0) { const nx = (1 - Math.abs(z)) * Math.sign(x || 1), nz = (1 - Math.abs(x)) * Math.sign(z || 1); x = nx; z = nz; }
  return [x * 0.5 + 0.5, z * 0.5 + 0.5];
}
// square -> direction
export function octDecode(u, v, hemi) {
  let x, y, z;
  if (hemi) { const a = u * 2 - 1, b = v * 2 - 1; x = (a - b) * 0.5; z = (a + b) * 0.5; y = 1 - Math.abs(x) - Math.abs(z); }
  else { x = u * 2 - 1; z = v * 2 - 1; y = 1 - Math.abs(x) - Math.abs(z); if (y < 0) { const nx = (1 - Math.abs(z)) * Math.sign(x || 1), nz = (1 - Math.abs(x)) * Math.sign(z || 1); x = nx; z = nz; } }
  return new THREE.Vector3(x, y, z).normalize();
}

// Bake `object` (any Object3D; its meshes are used as they are) into two atlases of `grid` x `grid`
// cells, each `cell` pixels. Returns { colour, normal, radius, centre, grid, hemi }. Done in one go;
// bakeImposterSteps below does the same a row of views at a time, for baking across frames.
export function bakeImposter(renderer, object, opts) { const it = bakeImposterSteps(renderer, object, opts); for (;;) { const s = it.next(); if (s.done) return s.value; } }   // (for..of drops a generator's return value)
export function* bakeImposterSteps(renderer, object, { grid = 12, cell = 128, hemi = true, upNormals = false, floor = null } = {}) {   // upNormals: foliage lit like the ground, both sides of a card
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object), centre = box.getCenter(new THREE.Vector3()), ext = box.getSize(new THREE.Vector3());
  const radius = ext.length() / 2;
  // the views are framed to the tree's real extent, not its sphere: half its footprint's diagonal
  // across, and the taller of that and half its height up - about half the pixels of the sphere,
  // and every one of them is fill rate saved on each of thousands of quads
  const halfW = Math.hypot(ext.x, ext.z) / 2, halfH = Math.max(ext.y / 2, halfW);
  const size = grid * cell;
  // mipmaps keep far imposters from shimmering (a pre-filtered picture); WebGL1 needs a power-of-two edge for them
  const mips = renderer.capabilities.isWebGL2 || (size & (size - 1)) === 0;
  const mk = () => new THREE.WebGLRenderTarget(size, size, { minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: mips, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false });
  const colourRT = mk(), normalRT = mk();
  const scene = new THREE.Scene();
  const holder = new THREE.Group(); holder.position.copy(centre).negate();    // the tree centred on the origin
  scene.add(holder);
  const parent = object.parent; holder.add(object);
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, radius * 4);
  // floor (optional): nothing under this height (the object's own frame) goes into the views: the part of a plant that
  // stands under the ground (its root clump). A model's is hidden by the ground; a card turned to a camera looking down
  // would hold it up above the ground, the plant uprooted
  const clip = floor == null ? null : [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(floor - centre.y))], oldLocal = renderer.localClippingEnabled;
  // colour pass: the material's own map, unlit; normal pass: the normal in the tree's frame
  const materials = new Map();
  object.traverse(o => { if (o.isMesh) materials.set(o, o.material); });
  const colourMat = (m) => { const c = new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color, alphaTest: m.alphaTest || (m.transparent ? 0.5 : 0), side: THREE.DoubleSide, vertexColors: !!m.vertexColors });   // (the colour times the map, as the model draws it: the oak's leaves are greyed, the aspen's yellowed; vertex colours: shaped foliage's inside darkness)
  if (m.map) c.map.colorSpace = m.map.colorSpace; if (clip) c.clippingPlanes = clip; return c; };
  // the normal in the tree's frame, and in alpha the depth: 0 at the near face of the tree's sphere,
  // 0.5 at its centre plane (where the quad is drawn), 1 at the far face
  const normalMat = (m) => new THREE.ShaderMaterial({
    defines: { UP_NORMALS: upNormals ? 'true' : 'false' },
    uniforms: { map: { value: m.map || null }, useMap: { value: m.map ? 1 : 0 }, alphaTest: { value: m.alphaTest || (m.transparent ? 0.5 : 0) }, radius: { value: radius } },
    clipping: !!clip, clippingPlanes: clip,
    vertexShader: `#include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec2 vUv; varying float vZ; void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vZ = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
      }`,
    fragmentShader: `#include <clipping_planes_pars_fragment>
      uniform sampler2D map; uniform float useMap; uniform float alphaTest; uniform float radius; varying vec3 vN; varying vec2 vUv; varying float vZ;
      void main(){
      #include <clipping_planes_fragment>
      if (useMap > 0.5 && texture2D(map, vUv).a < alphaTest) discard; vec3 n = normalize(gl_FrontFacing || UP_NORMALS ? vN : -vN); gl_FragColor = vec4(n * 0.5 + 0.5, clamp((vZ - radius) / (2.0 * radius), 0.0, 1.0)); }`,
    side: THREE.DoubleSide });
  const oldTarget = renderer.getRenderTarget(), oldClear = renderer.getClearColor(new THREE.Color()), oldAlpha = renderer.getClearAlpha();
  let done = false; if (clip) renderer.localClippingEnabled = true;
  try {                                   // (a bake abandoned between rows, by .return(): the tree and renderer put back, the half-made atlases freed)
  for (const [rt, mkMat] of [[colourRT, colourMat], [normalRT, normalMat]]) {
    for (const [o, m] of materials) o.material = Array.isArray(m) ? m.map(mkMat) : mkMat(m);     // a mesh with a material per face keeps them
    rt.viewport.set(0, 0, size, size); rt.scissorTest = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    for (let j = 0; j < grid; j++) {
    // one row of views per step: the caller can yield to the browser between rows
    if (j) { renderer.setRenderTarget(oldTarget); yield null; renderer.setClearColor(0x000000, 0); }   // a scene drawn in the pause (with a background) leaves an opaque clear colour: each new cell must clear to nothing
    for (let i = 0; i < grid; i++) {
      const d = octDecode((i + 0.5) / grid, (j + 0.5) / grid, hemi);
      cam.position.copy(d).multiplyScalar(radius * 2);
      cam.up.set(0, 1, 0); if (Math.abs(d.y) > 0.995) cam.up.set(0, 0, -1);
      cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      // the cell's rectangle is set on the target itself: the renderer's own viewport is scaled by
      // the pixel ratio even when drawing into a texture, and on a phone at 2.6 that laid every
      // cell down too big, over its neighbours
      rt.viewport.set(i * cell, j * cell, cell, cell); rt.scissor.set(i * cell, j * cell, cell, cell); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
    } }
    rt.viewport.set(0, 0, size, size); rt.scissorTest = false;
  }
  done = true;
  } finally {
    renderer.localClippingEnabled = oldLocal;
    if (!done) { for (const [o, m] of materials) o.material = m; renderer.setRenderTarget(oldTarget); renderer.setClearColor(oldClear, oldAlpha); holder.remove(object); if (parent) parent.add(object); colourRT.dispose(); normalRT.dispose(); }
  }
  for (const [o, m] of materials) o.material = m;
  renderer.setRenderTarget(oldTarget); renderer.setClearColor(oldClear, oldAlpha);
  holder.remove(object); if (parent) parent.add(object);
  object.updateMatrixWorld(true);          // the meshes' world matrices carried the holder's offset: refreshed, or anything placed by them stands half a tree low
  return { colour: colourRT.texture, normal: normalRT.texture, targets: [colourRT, normalRT], radius, halfW, halfH, centre, grid, hemi, cell, floorY: box.min.y, height: ext.y };   // targets: to free the atlases (a render target's texture can't free itself)
}

// PLANT FORMS: a plant drawn wider or narrower at each height than its model, by a smooth curve (the cubic through four widths
// at the ground, a third up, two thirds up and the tip; assets/forest/species-rules.mjs fits them). Shared by the imposters and
// the forest's mesh stages, so a plant has one shape near and far. (1, 1, 1, 1): as modelled.
export const FORM_GLSL = `
      float formWidth(vec4 w, float y) {
        float t = clamp(y, 0.0, 1.0) * 3.0, a = t - 1.0, b = t - 2.0, c = t - 3.0;
        return max(0.03, -w.x * a * b * c / 6.0 + w.y * t * b * c / 2.0 - w.z * t * a * c / 2.0 + w.w * t * a * b / 6.0);
      }`;
// the model's floor and height in its own units (older bakes: the card's)
const formYOf = (bake) => new THREE.Vector2(bake.floorY ?? bake.centre.y - bake.halfH, Math.max(1e-4, bake.height ?? 2 * bake.halfH));

// The vertex stage shared by the drawing and the shadow-casting materials: the quad turned to
// the viewer (the camera, or the light when `useOverride` is set), and the atlas cell for the
// viewer's direction in the tree's own frame.
const VERTEX = `
      #include <common>
      #ifdef WIND
      ` + WIND_GLSL + `
      uniform float windSway;
      #endif
      #include <logdepthbuf_pars_vertex>
      #include <shadowmap_pars_vertex>
      #include <fog_pars_vertex>
      attribute vec3 iPos; attribute float iYaw; attribute float iScale; attribute float iWide; attribute vec3 iTint; attribute float iFade; attribute vec4 iForm;
      uniform vec2 formY; varying vec4 vForm; varying vec4 vFormMap;
      uniform float radius; uniform float halfW; uniform float halfH; uniform vec3 centre; uniform float grid; uniform float hemi;
      uniform vec3 viewDirOverride; uniform float useOverride; uniform float blendDist; uniform float blend; uniform float parallax;
      varying vec2 vC0; varying vec2 vC1; varying vec2 vC2; varying vec3 vW; varying vec2 vP0; varying vec2 vP1; varying vec2 vP2;
      // the square -> a direction (the inverse of octEncode), for the cell centres
      vec3 octDecode(vec2 uv) {
        float x, y, z;
        if (hemi > 0.5) { float a = uv.x * 2.0 - 1.0, b = uv.y * 2.0 - 1.0; x = (a - b) * 0.5; z = (a + b) * 0.5; y = 1.0 - abs(x) - abs(z); }
        else { x = uv.x * 2.0 - 1.0; z = uv.y * 2.0 - 1.0; y = 1.0 - abs(x) - abs(z); if (y < 0.0) { float nx = (1.0 - abs(z)) * (x >= 0.0 ? 1.0 : -1.0); float nz = (1.0 - abs(x)) * (z >= 0.0 ? 1.0 : -1.0); x = nx; z = nz; } }
        return normalize(vec3(x, y, z));
      }
      // PARALLAX. A cell's picture was taken from its own direction; the camera is a little off it.
      // A pixel that sits 'depth' in front of the card should appear shifted toward the camera's
      // side by depth x that offset. This is the offset, in the card's right/up axes, per unit of
      // depth, in atlas-cell units - the fragment multiplies it by the pixel's own depth.
      vec2 parallaxOf(vec2 cell, vec3 dTree, vec3 rightTree, vec3 upTree) {
        vec3 dc = octDecode((cell + 0.5) / grid);
        vec3 off = dTree - dc;                                        // how far the true direction is from the baked one
        return vec2(dot(off, rightTree), dot(off, upTree));
      }
      varying vec2 vQuad; varying vec2 vFrame; varying vec3 vTint; varying float vFade; varying float vYaw; varying vec3 vViewPos; varying vec3 vToCamView; varying float vRadius; varying vec4 vShadowToCam; varying vec4 vShadowToSun; uniform vec3 sunDir; varying vec2 vLand;
      // direction (in the tree's frame) -> the square
      vec2 octEncode(vec3 d) {
        float s = abs(d.x) + abs(d.y) + abs(d.z); float x = d.x / s, z = d.z / s;
        if (hemi > 0.5) return vec2((x + z) * 0.5 + 0.5, (z - x) * 0.5 + 0.5);
        if (d.y < 0.0) { float nx = (1.0 - abs(z)) * (x >= 0.0 ? 1.0 : -1.0); float nz = (1.0 - abs(x)) * (z >= 0.0 ? 1.0 : -1.0); x = nx; z = nz; }
        return vec2(x * 0.5 + 0.5, z * 0.5 + 0.5);
      }
      void main() {
        float c = cos(iYaw), s = sin(iYaw);
        vec3 localCentre = iPos + vec3(0.0, centre.y * iScale, 0.0) + vec3(c * centre.x + s * centre.z, 0.0, -s * centre.x + c * centre.z) * iScale;
        vec3 worldCentre = (modelMatrix * vec4(localCentre, 1.0)).xyz;     // the cards live in their group's frame (a forest set off at a distance)
        vec3 toCam = useOverride > 0.5 ? normalize(viewDirOverride) : normalize(cameraPosition - worldCentre);
        // the view direction in the tree's own frame: the instance's spin undone
        vec3 d = vec3(c * toCam.x - s * toCam.z, toCam.y, s * toCam.x + c * toCam.z);
        vFrame = octEncode(normalize(d));
        // the card faces the viewer. (Locking it to its view cell was tried: the card then jumps at
        // every cell boundary, trunk and all, and the trees look as if they are walking.)
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // PLANT FORM (see FORM_GLSL): the card widened to hold the widest the form asks for, and how the card's height maps to the
        // plant's (a point on the trunk at height y shows on the card up by y times the up axis's rise) and where the trunk is across it
        vec4 fd = abs(iForm - 1.0); float formK = fd.x + fd.y + fd.z + fd.w > 0.002 ? max(1.0, max(max(iForm.x, iForm.y), max(iForm.z, iForm.w)) * 1.06) : 0.0;
        { float vs = mix(1.0, iWide, abs(toCam.y)), span = 2.0 * halfH * vs / max(up.y, 0.3);
          vec3 rT = vec3(c * right.x - s * right.z, right.y, s * right.x + c * right.z);
          vFormMap = vec4((centre.y - formY.x - 0.5 * span) / formY.y, span / formY.y, formK, 0.5 - (rT.x * centre.x + rT.z * centre.z) / (2.0 * halfW)); vForm = iForm; }
        vec3 world = worldCentre + (right * position.x * halfW * 2.0 * iWide * max(formK, 1.0) + up * position.y * halfH * 2.0 * mix(1.0, iWide, abs(toCam.y))) * iScale;   // (iWide: a tree edited wider than tall; a card seen from above lies across its width)
        #ifdef WIND
        { float top = (centre.y + halfH) * iScale, above = world.y - (modelMatrix * vec4(iPos, 1.0)).y, k = clamp(above / max(top, 0.001), 0.0, 1.0);   // the card bends like the plant: its top in the breeze, its foot still
          world.xz += windAt(iPos.xz) * k * k * top * windSway; }
        #endif
        // Which atlas cells this card shows, and their weights: the three cells of the triangle the
        // view direction falls in (near, when blending), else the nearest one. Worked out here, once
        // per card and in full precision - done per pixel, a phone's GPU split one card between
        // neighbouring cells along straight lines.
        bool near = useOverride < 0.5 && distance(cameraPosition, worldCentre) < blendDist;
        vec2 g = vFrame * grid - 0.5; vec2 base = floor(g); vec2 f = g - base;
        if (blend > 0.5 && near) {
          if (f.x + f.y < 1.0) { vC0 = base; vC1 = base + vec2(1.0, 0.0); vC2 = base + vec2(0.0, 1.0); vW = vec3(1.0 - f.x - f.y, f.x, f.y); }
          else { vC0 = base + vec2(1.0, 1.0); vC1 = base + vec2(0.0, 1.0); vC2 = base + vec2(1.0, 0.0); vW = vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y); }
        } else { vC0 = vC1 = vC2 = floor(vFrame * grid); vW = vec3(1.0, 0.0, 0.0); }
        vC0 = clamp(vC0, 0.0, grid - 1.0); vC1 = clamp(vC1, 0.0, grid - 1.0); vC2 = clamp(vC2, 0.0, grid - 1.0);
        // the card's axes in the tree's frame, for the parallax
        vec3 dn = normalize(d);
        vec3 rightTree = vec3(c * right.x - s * right.z, right.y, s * right.x + c * right.z);
        vec3 upTree = vec3(c * up.x - s * up.z, up.y, s * up.x + c * up.z);
        vP0 = vP1 = vP2 = vec2(0.0);
        if (parallax > 0.5 && useOverride < 0.5) { vP0 = parallaxOf(vC0, dn, rightTree, upTree); vP1 = parallaxOf(vC1, dn, rightTree, upTree); vP2 = parallaxOf(vC2, dn, rightTree, upTree); }
        vQuad = uv; vTint = iTint; vFade = iFade; vYaw = iYaw; vRadius = radius * iScale; vLand = iPos.xz;
        vec4 mv = viewMatrix * vec4(world, 1.0); vViewPos = mv.xyz; vToCamView = (viewMatrix * vec4(toCam, 0.0)).xyz;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
        #ifdef USE_FOG
        vFogDepth = - mv.z;
        #endif
        vec4 worldPosition = vec4(world, 1.0); vec3 transformedNormal = vToCamView;
        #include <shadowmap_vertex>
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        vShadowToCam = directionalShadowMatrix[0] * vec4(toCam, 0.0);      // so the shadow can be looked up at the surface's depth, not the card's
        vShadowToSun = directionalShadowMatrix[0] * vec4(normalize(sunDir), 0.0);
        #endif
      }`;
// the atlas lookup shared by both fragment stages: colour (straight alpha = coverage) and normal + depth
const LOOKUP = `
      uniform sampler2D atlas; uniform sampler2D atlasN; uniform float grid; uniform float blend;
      varying vec2 vQuad; varying vec2 vFrame; varying vec3 vTint; varying float vFade; varying float vYaw; varying vec3 vViewPos; varying vec3 vToCamView; varying float vRadius; varying vec4 vShadowToCam; varying vec4 vShadowToSun; varying vec2 vLand;
      varying vec2 vC0; varying vec2 vC1; varying vec2 vC2; varying vec3 vW; varying vec2 vP0; varying vec2 vP1; varying vec2 vP2;
      varying vec4 vForm; varying vec4 vFormMap; uniform float formSpray;
      ` + FORM_GLSL + `
      uniform mat4 projectionMatrix; uniform float useDepth; uniform float parallax; uniform float halfWc; uniform float halfHc;
      vec4 cellSampleAt(sampler2D t, vec2 cell, vec2 q) { vec2 uv = (cell + clamp(q, 0.002, 0.998)) / grid; return texture2D(t, uv, -0.75); }   // (a sharper mip: the far firs read as soft cut-outs, the frames show their branch texture)
      vec4 cellSample(sampler2D t, vec2 cell) { return cellSampleAt(t, cell, vQuad); }
      // one cell's colour and normal, the sample shifted by the pixel's depth times the view offset
      // (the depth read first at the unshifted spot: one extra read)
      void cellRead(vec2 cell, vec2 par, vec2 q, out vec4 col, out vec4 nrm) {
        if (parallax > 0.5) {
          vec4 n0 = cellSampleAt(atlasN, cell, q);
          float a0 = cellSampleAt(atlas, cell, q).a;
          float depth = (0.5 - n0.a / max(a0, 0.001)) * 2.0;             // metres in front of the card, per unit radius: -1..1
          q += par * depth * vec2(vRadius / (halfWc * 2.0), vRadius / (halfHc * 2.0));
        }
        col = cellSampleAt(atlas, cell, q); nrm = cellSampleAt(atlasN, cell, q);
      }
      // the cells and weights come from the vertex stage, the same for the whole card
      void lookup(out vec4 col, out vec4 nrm) {
        // a reshaped plant: each row of the card read from the picture narrowed or widened about the trunk by the form's width at
        // that height (the card is wider by formK, so this row of the picture sits formK times further out than drawn)
        vec2 q = vQuad;
        // (formSpray: the share of a plant's width that is sprays hung from points; the model moves those points and keeps the sprays
        // nearly their size, so its outline narrows less than its points do, and the picture follows that)
        if (vFormMap.z > 0.5) { float fw = formWidth(vForm, vFormMap.x + vQuad.y * vFormMap.y), w = mix(fw, clamp(pow(fw, 0.75), 0.45, 1.25), formSpray), x = 0.5 + (vQuad.x - 0.5) * vFormMap.z;
          q.x = vFormMap.w + (x - vFormMap.w) / w;
          if (q.x < 0.0 || q.x > 1.0) { col = vec4(0.0); nrm = vec4(0.0); return; } }
        vec4 c0, n0; cellRead(vC0, vP0, q, c0, n0);
        if (vW.y + vW.z > 0.0005) {
          vec4 c1, n1, c2, n2; cellRead(vC1, vP1, q, c1, n1); cellRead(vC2, vP2, q, c2, n2);
          col = c0 * vW.x + c1 * vW.y + c2 * vW.z; nrm = n0 * vW.x + n1 * vW.y + n2 * vW.z;
        } else { col = c0; nrm = n0; }
      }
      // the fragment's depth moved to where the tree's surface is (the atlas's depth), so the
      // imposter sorts against the ground and its neighbours, and shadows itself, as a solid would
      float surfaceDepth(vec4 nrm) {
        float off = (0.5 - clamp(nrm.a, 0.0, 1.0)) * 2.0 * vRadius;                                     // toward the viewer
        vec3 p = vViewPos + vToCamView * off;
        vec4 clip = projectionMatrix * vec4(p, 1.0);
        return (clip.z / clip.w) * 0.5 + 0.5;
      }`;

// The imposter material for an InstancedBufferGeometry of quads with per-instance `iPos` (vec3),
// `iYaw` (radians), `iScale`, `iTint` (vec3) and `iFade` (0 gone .. 1 solid, dithered).
// `soften` (0..1) bends the foliage's normals toward straight up, the usual trick for leaves (cards
// facing every way, half of them 'away' from the sun, read as black otherwise)
// wind (0..1): sway in the shared breeze (src/objects/wind.js), 0 still
export function imposterMaterial(bake, { sunDir = new THREE.Vector3(0.5, 1, 0.3), blend = true, depth = true, shadows = true, soften = 0, wind = 0, glow = 0, sheen = 0 } = {}) {   // sheen (0..1): the faint white sunlight a MeshStandardMaterial adds even fully rough; 1 for a model drawn with one   // glow: the tree's own even light (its material's light map), so far matches near
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, { soften: { value: soften },
    atlas: { value: null }, atlasN: { value: null }, grid: { value: bake.grid }, hemi: { value: bake.hemi ? 1 : 0 },
    radius: { value: bake.radius }, halfW: { value: bake.halfW }, halfH: { value: bake.halfH }, centre: { value: bake.centre.clone() }, formY: { value: formYOf(bake) }, formSpray: { value: 0 }, sunDir: { value: sunDir.clone().normalize() },
    blend: { value: blend ? 1 : 0 }, blendDist: { value: 400 }, parallax: { value: 0 }, halfWc: { value: bake.halfW }, halfHc: { value: bake.halfH }, ambient: { value: 0.45 }, glowLight: { value: glow }, sheen: { value: sheen }, shadowNudge: { value: 0.8 }, lowSun: { value: 0 }, lowSunK: { value: 0.7 }, useDepth: { value: depth ? 1 : 0 }, useShadow: { value: shadows ? 1 : 0 },   // (lowSunK 0.7: a wood at 190 m matched its models within 3% from the sun's side and against it, sun 3-8° up)
    viewDirOverride: { value: new THREE.Vector3(0, 1, 0) }, useOverride: { value: 0 },
    calmCol: { value: new THREE.Color(0.3, 0.4, 0.15) }, calmFrom: { value: 60 }, calmTo: { value: 250 }, calmAmt: { value: 0 },
    landShade: { value: null }, landShadeSize: { value: 1600 }, landShadeK: { value: new THREE.Vector4() },
    shadowAt: { value: new THREE.Vector3() }, shadowRange: { value: 0 }, edgeFrom: { value: 0.55 }, edgeTo: { value: 0.97 }, edgeShade: { value: 0.55 }, edgeJitter: { value: 0.12 },   // (the shadow edge: see Forest)
  }]);
  uniforms.atlas.value = bake.colour; uniforms.atlasN.value = bake.normal;
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: false, side: THREE.DoubleSide, lights: true, fog: true, extensions: { fragDepth: true },
    vertexShader: VERTEX,
    fragmentShader: `
      #include <common>
      #include <packing>
      #include <logdepthbuf_pars_fragment>
      #include <shadowmap_pars_fragment>
      #include <lights_pars_begin>
      #include <fog_pars_fragment>
      uniform vec3 sunDir; uniform float ambient; uniform float useShadow; uniform float soften; uniform float glowLight; uniform float sheen; uniform float shadowNudge; uniform float lowSun, lowSunK;
      uniform vec3 calmCol; uniform float calmFrom, calmTo, calmAmt;
      uniform sampler2D landShade; uniform float landShadeSize; uniform vec4 landShadeK;
      uniform vec3 shadowAt; uniform float shadowRange, edgeFrom, edgeTo, edgeShade, edgeJitter;
      float edgeHash(vec2 c) { vec3 p = fract(vec3(c.xyx) * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      ` + LOOKUP + `
      #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
      // a page with a logarithmic depth buffer (the jconra.com film): the surface's depth written as the log depth everything
      // else writes (three's own sum), not the ordinary depth, which a WebGL1 card would otherwise get here
      float surfaceLogDepth(vec4 nrm) {
        float off = (0.5 - clamp(nrm.a, 0.0, 1.0)) * 2.0 * vRadius;
        vec4 clip = projectionMatrix * vec4(vViewPos + vToCamView * off, 1.0);
        return log2(1.0 + clip.w) * logDepthBufFC * 0.5;
      }
      #endif
      void main() {
        #include <logdepthbuf_fragment>
        // dithered fade, the COMPLEMENT of the mesh's: the mesh keeps the pixels where its fade beats the dither, the imposter the others, so in the crossfade every pixel is drawn by exactly one of them
        float dither = 1.0 - fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (vFade < dither) discard;
        vec4 col; vec4 nrm; lookup(col, nrm);
        if (col.a < 0.45) discard;
        #ifdef GL_EXT_frag_depth
        #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
        if (useDepth > 0.5) gl_FragDepthEXT = surfaceLogDepth(nrm / max(col.a, 0.001));   // (else the log depth written above stands: every path writes it)
        #else
        gl_FragDepthEXT = useDepth > 0.5 ? surfaceDepth(nrm / max(col.a, 0.001)) : gl_FragCoord.z;   // (written on every path: left unwritten on one, a WebGL1 card's depth is anything)
        #endif
        #endif
        nrm /= max(col.a, 0.001); vec3 n = normalize(nrm.rgb * 2.0 - 1.0);   // read through the colour's coverage: filtered against the empty background otherwise
        float c = cos(vYaw), s = sin(vYaw);
        vec3 nw = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);          // the tree's normal, turned as the instance is
        // CALM WITH DISTANCE: far off, a plant's own colour and shading give way to a shared colour lit
        // like the ground, so a far field of them reads as one tone instead of speckle
        float calm = calmAmt * smoothstep(calmFrom, calmTo, length(vViewPos));
        nw = normalize(mix(nw, vec3(0.0, 1.0, 0.0), max(soften, calm * 0.5)));   // (only half way: fully flat lighting made a far field one even, bright tone)
        vec3 nv = normalize((viewMatrix * vec4(nw, 0.0)).xyz);              // in view space, where three keeps its lights
        float off = (0.5 - nrm.a) * 2.0 * vRadius;
        // lit the way MeshStandardMaterial's diffuse is: the sun (shadowed) and the sky/ground light,
        // over pi, so a mesh and its imposter come out the same colour
        vec3 irradiance = vec3(0.0), sheenLight = vec3(0.0);
        // the land's baked shade where the plant stands, if given (landShadeK = hill, hollow, tree strengths, on): the hill's
        // shadow and the trees' are SUN shadows, so they take the sun's light only (in a shadowed valley at dusk the sky still
        // lights it, bluish); the hollows, and a little of the trees' shade, darken it all, as the sky sees less of it there
        float landSun = 1.0, landAll = 1.0;
        if (landShadeK.w > 0.5) { vec3 sd = texture2D(landShade, vLand / landShadeSize + 0.5).rgb;
          landSun = mix(1.0, sd.r, landShadeK.x) * (1.0 - landShadeK.z * sd.b);
          landAll = mix(1.0, 0.3 + 0.7 * sd.g, landShadeK.y) * (1.0 - landShadeK.z * sd.b * 0.6); }
        #if NUM_DIR_LIGHTS > 0
        {
          float shadow = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          if (useShadow > 0.5) shadow = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0] + vShadowToCam * (useDepth > 0.5 ? off : 0.0) + vShadowToSun * vRadius * shadowNudge);   // (shadowNudge: a fraction of the radius toward the sun. Below about 0.7 a lone plant's flat shadow caster cuts through its own quad and draws a hard diagonal across it; woods come out somewhat lighter for it, measured 10-15% at 0.25)
          if (useShadow > 0.5 && shadowRange > 0.0) shadow = mix(shadow, edgeShade, smoothstep(edgeFrom, edgeTo, length(vLand - shadowAt.xz) / shadowRange + edgeHash(floor(vLand * 4.0)) * edgeJitter));   // (near the shadows' edge: eased into the even shade, as the models are: round, each tree its own start)
          #endif
          shadow *= landSun;
          float nl = max(0.0, dot(nv, directionalLights[0].direction));
          // a low sun: a crown's leaves catch it on the side facing it and show their dark backs against it, which a card lit
          // through its leaves' averaged way can't; lowSun (0 high sun .. 1 low, from the page) leans the sun's share by
          // which side you see it from (lowSunK: how far, matched to the models)
          float facing = dot(normalize(-vViewPos), directionalLights[0].direction);
          irradiance += directionalLights[0].color * nl * shadow * max(0.0, 1.0 + lowSun * lowSunK * facing);
          // the sheen: three's GGX at roughness 1 (D = 1 / pi, V = 0.5 / (NL + NV)) with Schlick's F from 0.04, as a fully
          // rough MeshStandardMaterial lights its model: dark leaves get a real share of white from it, cards seen from behind most
          if (sheen > 0.0) { vec3 vd = normalize(-vViewPos), hd = normalize(directionalLights[0].direction + vd);
            float nvd = max(0.0, dot(nv, vd)), vh = max(0.0, dot(vd, hd)), fr = 0.04 + 0.96 * exp2((-5.55473 * vh - 6.98316) * vh);
            sheenLight = directionalLights[0].color * (nl * shadow * fr * 0.5 / max(nl + nvd, 1e-6) * RECIPROCAL_PI * sheen); }
        }
        #endif
        #if NUM_HEMI_LIGHTS > 0
        irradiance += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, dot(nv, hemisphereLights[0].direction) * 0.5 + 0.5);
        #endif
        irradiance += vec3(glowLight);                                     // (as a light map adds it to the mesh)
        vec3 albedo = mix(col.rgb / max(col.a, 0.001) * vTint, calmCol, calm);
        albedo *= landAll;
        gl_FragColor = vec4(albedo * irradiance * RECIPROCAL_PI + sheenLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  if (wind > 0) { mat.defines = { ...(mat.defines || {}), WIND: '' }; Object.assign(mat.uniforms, WIND.uniforms, { windSway: { value: wind } }); }
  // the shadow pass: the same quad, turned to the light, its depth from the atlas, packed the way
  // three's shadow maps expect
  mat.userData.depthMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([{ atlas: { value: null }, atlasN: { value: null }, grid: { value: bake.grid }, hemi: { value: bake.hemi ? 1 : 0 }, radius: { value: bake.radius }, halfW: { value: bake.halfW }, halfH: { value: bake.halfH }, centre: { value: bake.centre.clone() }, formY: { value: formYOf(bake) }, formSpray: { value: 0 },
      blend: { value: blend ? 1 : 0 }, blendDist: { value: 0 }, parallax: { value: 0 }, halfWc: { value: bake.halfW }, halfHc: { value: bake.halfH }, useDepth: { value: depth ? 1 : 0 }, viewDirOverride: { value: sunDir.clone().normalize() }, useOverride: { value: 1 } }]),
    side: THREE.DoubleSide, extensions: { fragDepth: true },
    vertexShader: VERTEX,
    fragmentShader: `
      #include <common>
      #include <packing>
      ` + LOOKUP + `
      void main() {
        // in the shadow map a card casts whole once it is at least half faded in (the mesh casts whole too while
        // it's drawn; a shadow is there or not, so both casting at once does no harm). The screen-door fade used here
        // before was a pattern in the shadow map's own pixels: it crawled as the map moved, and shadows flickered
        if (vFade < 0.5) discard;
        vec4 col; vec4 nrm; lookup(col, nrm);
        if (col.a < 0.45) discard;
        float z = gl_FragCoord.z;
        #ifdef GL_EXT_frag_depth
        if (useDepth > 0.5) z = surfaceDepth(nrm / max(col.a, 0.001));
        gl_FragDepthEXT = z;
        #endif
        gl_FragColor = packDepthToRGBA(z);
      }`,
  });
  mat.userData.depthMaterial.uniforms.atlas.value = bake.colour; mat.userData.depthMaterial.uniforms.atlasN.value = bake.normal;
  return mat;
}
