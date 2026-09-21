# Three.js browser runtime

Pinned to **Three.js 0.158.0 (r158)** to match the other projects and retain
WebGL1 support for a thin client without a GPU. Do not upgrade past WebGL1
support without revisiting that requirement.

These files are copied unchanged from the npm `three@0.158.0` package:

- `build/three.module.js` → `three.module.js`
- `examples/jsm/controls/OrbitControls.js` → `addons/controls/OrbitControls.js`
- `examples/jsm/utils/BufferGeometryUtils.js` → `addons/utils/BufferGeometryUtils.js`
- `LICENSE` → `LICENSE`

Keep core and addons on the same version. Pages use r158 color-space APIs and
`mergeGeometries`. ColorManagement is disabled and legacy lighting is explicitly
enabled to retain the existing scene's authored colors and light intensities.
The legacy-lighting deprecation warning is expected on this pinned version.

The renderer automatically falls back from WebGL2 to WebGL1. Append `?webgl=1`
(or `&webgl=1` with existing parameters) to any scene or lab page to force WebGL1.
Software rendering still depends on the browser providing a WebGL context;
this option is not a guarantee of frame rate on thin clients.

Static pages import from this folder because the deployed site does not serve
the previous `node_modules/` URLs as JavaScript. Include `vendor/`, `assets/`,
`labs/`, and legacy `lab/` redirects in hosting artifacts. The offline baker
keeps its separate Three.js 0.167.1 dependencies under `tools/`.
