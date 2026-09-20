# tools — data generation for the Montana terrain

Offline scripts used to build the terrain + forest data in `../assets/`.
They're archival — kept for reproducibility. Paths inside them point at the
pre-reorg `/var/www/html/terrain/` location; update output paths to
`../assets/` (and `../assets/trees/`) if you re-run them.

## `lidar-trees.py` — tree detection from LiDAR
Reads USGS 1 m LiDAR `.laz` tiles and extracts individual tree positions.
- **Input:** `.laz` tiles in `/tmp/laz/` (UTM 12N; scene centered on the property pin `CX,CY`).
- **Method:** rasterize to a 1.5 m grid → ground min (class 2) + canopy max → height-above-ground →
  3×3 local-maxima peaks with HAG > 2.5 m → non-max suppression at 2.5 m spacing.
- **Output:** `trees.bin` — packed little-endian `float32 (x, z, height)` triples (`z = -North`).
- **Deps:** `pip install laspy numpy` · run `python3 lidar-trees.py`

## `bake-trees.mjs` — ez-tree geometry baking
Generates the pine/aspen tree meshes from [ez-tree](https://github.com/dgreenheck/ez-tree)
presets, offline in Node (stubs `document` since ez-tree touches it on import).
- **Input:** `@dgreenheck/ez-tree` + `three` in `node_modules`; bark/leaf textures from the ez-tree assets.
- **Method:** load presets (Pine Large/Small, Aspen), tweak, normalize (center X/Z, base y=0, unit height,
  horizontal `spread` for fullness), pack geometry to base64.
- **Output:** `trees/<variant>.json` (+ `trees/manifest.json`) and copied textures in `trees/tex/`.
- **Run:** `node bake-trees.mjs` (needs Node ≥ 18 and three ≥ 0.167 for ez-tree).

## Not recovered
Two one-off shell scripts weren't saved as editor files, so they're gone:
- **Terrain heightmap generator** — built `coarse.bin` / `fine.bin` / `manifest.json` from the LiDAR
  ground surface + draped the NAIP aerial (`aerial.jpg`). The *outputs* live in `../assets/`.
- **Pure-Python PNG cropper** — tight-cropped the tree impostor billboard to its alpha bbox.
