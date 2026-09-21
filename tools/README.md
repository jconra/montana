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
`tools/node_modules`. The site's existing Three.js 0.140.0 stays unchanged.
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
