# Property detail pass

The September photo/video references guide this scene layer:

- DJI_121 overhead: irregular pond outline, fire ring and chairs, picnic table,
  and woodpile relative to the main house and cabin.
- DJI_104 oblique: reed banks, meadow clearing and roadside shrubs.
- July 2025 ground views and the drone video: two worn gravel tire tracks,
  low grass in the median, taller verge grass, white/yellow flowers, grey-green
  shrubs, and short grass around the gathering area.
- October 2026 hillside reference: irregular, dense patches of woody sagebrush
  with open branches below the foliage. The user's `sage.glb` replaces the
  original pale geometric shrub clumps.

`assets/property-layout.mjs` keeps the reference registration and placement
rules in one place. The overhead image's house centre (1240,823) maps to
(8,-8) and cabin centre (835,252) maps to (-41,31), using the scene's existing
building layout. These are approximate visual anchors, not surveyed positions.
The pond outline and prop positions can be refined there without changing
rendering code. The pictured pond is seasonally shallow; its modelled depth and
water height are inferred from the DEM, not measured bathymetry.

`assets/property-nature.js` creates local grass, flowers, shrubs, reeds, outdoor
furniture and firewood. The fire ring is unlit. No external model downloads are
needed. Plant clumps are instanced in 28-metre cells; Auto quality controls their
counts and visibility distance (45–150 m), with a dithered distance fade. Road
plants avoid the two tire tracks and building footprints. The gathering area
has shorter plants. Pond plants are restricted to its bank; LiDAR tree roots
inside the pond are excluded.

Sagebrush uses the local Blender model in `assets/models/sage.glb`, loaded by
`assets/sagebrush.js`. The corrected `sage_fixed.glb` source combines its
branches and cutout foliage into one mesh and material, sharing transforms,
wind, culling and quality budgets. The 698-triangle
model is scattered in patches along both sides of the full drive, extending
roughly 37 m from it, with varied heights, proportions and rotations. Spacing
checks prevent coincident bushes; shrubs stay at least 3.5 m from the route
centre and outside the mown camp, pond and building exclusions. Auto quality
retains at least 35% of each nearby sagebrush cell and increases coverage and
range on faster systems. The older broadleaf/evergreen shrubs remain as other
vegetation types. The supplied model and texture are kept unchanged on disk.

The pond uses one horizontal mesh with animated procedural ripple shading and
view-dependent sky colour, rather than a reflection render pass. Both terrain
tiles are gently shaped into a local basin. Water and details follow the
vertical exaggeration setting. The existing aerial image remains the distant
terrain base. Ground texture splatting provides grass/soil/stone variation and
the driveway's tire tracks, with a fully worn turnaround at its end.

**View pond** and **view camp** focus the camera on the new details. Route guides
are hidden during normal viewing; the route editor can show them. The large
coordinate cone is also hidden until **inspect coordinates** is enabled.
Starting a drive exits coordinate inspection and waypoint editing.

Validation:

- `node tests/property-layout.test.mjs`
- `node tests/adaptive-quality.test.mjs`
- `node tests/main-impostors.test.mjs`
- Browser render checks in WebGL1 and WebGL2; verify camera presets, adaptive
  plant counts, pond/tree exclusions, and vertical-scale alignment.
- Sagebrush: inspect from multiple angles; check that branches/leaves stay
  together through quality changes and vertical exaggeration, that increasing
  quality after exaggeration does not leave stale culling bounds, and that
  cutout foliage renders without alpha-sorting artifacts in both WebGL paths.

Useful next references are close-ups of the picnic table, fire ring, woodpile,
rocks and typical plants, plus a low-angle pond shot showing its bank and water
level. Existing procedural props are approximations of these objects.
