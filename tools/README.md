# Montana vegetation and terrain tools

## Reproducible vegetation bake

Node 18 or newer is required. From the repository root:

```sh
npm ci --prefix tools
npm run bake --prefix tools
python3 -m http.server 8000
```

Open `http://localhost:8000/labs/vegetation.html`. The generated files are committed,
so viewing the lab does not require Node or running the baker.

The toolchain pins `@dgreenheck/ez-tree` 1.1.0 and Three.js 0.167.1 in its own
`tools/node_modules`. The browser runtime is pinned separately to Three.js 0.158.0 for WebGL1 support.
The lockfile captures the selected toolchain, not the unrecovered historical
installation. In particular the recovered bush recipe does not reproduce the
committed production bush exactly (source height differs).

`tree-presets.mjs` contains the recovered recipes plus lab-only shrub candidates.
Each recipe has a fixed seed. Adjust branch structure, leaf size/count and spread
there, then bake again. Compact evergreen and low broadleaf shrubs are shape
studies, not species identification. Broadleaf shrubs currently reuse oak foliage;
they are not a faithful sagebrush asset.

The default output is `assets/vegetation-lab/`, resolved relative to the script,
regardless of the working directory. To generate a separate comparison:

```sh
node tools/bake-trees.mjs --out /tmp/montana-vegetation-check
```

The manifest records seeds, triangle counts, geometry byte sizes, suggested display
heights and tool versions. Geometry is grounded and normalized to unit height.
Textures and the upstream MIT license accompany each bake. See
https://github.com/dgreenheck/ez-tree for the source library.

The baker refuses to write directly to `assets/trees`. Promotion is a separate
step: compare silhouettes and foliage in the lab, measure performance on target
hardware, generate matching distant impostors, then update the main scene.
The current scene and its tree placement data are not changed by a lab bake.

## Comparison lab

### Forest & Tree Designer

Open `labs/forest.html` (append `?webgl=1` to force WebGL1). The committed worker
generates ez-tree geometry off the UI thread, with its own bundled Three.js
0.167.1. The viewer and atlas baker remain on r158. No server-side generator is
required. To rebuild the worker after editing `forest-worker.mjs`:

```sh
npm ci --prefix tools
npm run build:forest --prefix tools
```

The worker bundles upstream ez-tree source with texture loading replaced by null
stubs; materials and textures are supplied by the viewer. It reconstructs indices
from the original arrays to avoid upstream Uint16 overflow. Both upstream licenses
are shipped alongside the worker. The normal offline bake command is unchanged.

Tall crown pine defaults to branches starting 64% up the trunk, with independently
adjustable crown density, width, leaf size, branch angle, and geometry detail.
Recipe JSON exports the active recipe, full ez-tree options, and atlas metadata;
loading it restores tree controls, forest and atlas settings, pixel ratio, sampling,
and camera position. Press Generate & bake to apply tree changes.

The impostor is a full-sphere Y-up octahedral color atlas. Each cell is an
orthographic capture with the same bounding sphere and two-pixel gutter. The
shader selects the nearest view or blends the three vertices of the enclosing
octahedral grid triangle, projecting the billboard into each capture basis.
There is no depth atlas, parallax correction, relighting, or impostor shadow pass.
The linear RGBA8 atlas uses no mipmaps; exported PNGs convert to sRGB. Exported
images use top-left image coordinates; the runtime atlas uses bottom-left UVs.

Forest modes reuse deterministic positions, heights, and yaw. Mesh mode refuses
more than 25M triangles. Hybrid mode picks the closest trees within the distance
and count budgets, further bounded to 12M source triangles, with a hard LOD switch.
Trees outside the near budget remain impostors, even inside the distance threshold.
No per-tree frustum culling is implemented; displayed counts are submitted counts.
WebGL1 requires ANGLE_instanced_arrays, plus OES_element_index_uint for trees above
65,535 vertices per part. There is no requirement for WebGL2-only texture arrays.

For a fair comparison, keep camera, forest seed, count, and pixel ratio fixed.
Use Apply forest after changing forest settings. Single-tree inspection uses the
mesh; Frame forest restores the selected mode. The 10-second measurement reports
CPU/display frame intervals, not GPU timer results; atlas generation is excluded,
and hiding the tab cancels the measurement. High counts may be fill-rate limited
despite two triangles per impostor. Atlas memory shown excludes depth and driver
overhead. Normal automatic WebGL1 fallback is retained.

`labs/vegetation.html` compares two candidates with orbit/zoom, equal-height or
suggested-height modes, a one-meter grid, daylight/low sun, and repeated patches.
It displays geometry size and renderer statistics. Geometry KB excludes textures;
frame rate depends on device and is not a production-scene benchmark. Instancing
and production LOD integration remain a subsequent step.

## LiDAR tree extraction (archival)

`lidar-trees.py` reads `.laz` tiles from `/tmp/laz` in UTM 12N and writes
`/var/www/html/terrain/trees.bin`. Update those paths before rerunning it.
Install `laspy[lazrs]` and `numpy` to support compressed LAZ input.

The output is little-endian float32 `(x, z, height)` triples with `z = -North`.
The script rasterizes returns at 1.5 m spacing, uses minimum ground in 15 m
blocks, finds 3x3 canopy maxima above 2.5 m and suppresses peaks within 2.5 m.
This is an approximate canopy detector: sloping ground can inflate heights,
and buildings or other non-vegetation returns can become candidates. Missing
ground blocks use the global median, despite an old propagation comment.
Do not overwrite the existing tree data without comparing results and masks.

## Not recovered

- Terrain heightmap/aerial preparation script. Existing coarse/fine grids,
  manifest and aerial image remain usable for rendering and material work.
- Tree billboard crop helper. The lab does not regenerate or overwrite the
  production impostor; new silhouettes need a corresponding bake before promotion.
