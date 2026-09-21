# Three.js browser runtime

These files are copied unchanged from the repository's Three.js 0.140.0:

- `build/three.module.js` → `three.module.js`
- `examples/jsm/controls/OrbitControls.js` → `addons/controls/OrbitControls.js`
- `examples/jsm/utils/BufferGeometryUtils.js` → `addons/utils/BufferGeometryUtils.js`

The upstream MIT license is included. Keep core and addons on the same version.
Static pages import from this folder because the deployed site does not serve
the previous `node_modules/` URLs as JavaScript. Include `vendor/`, `assets/`,
and `labs/` in hosting artifacts. The offline tools have separate dependencies.
