# Property reference pass — 2026-10-10

Reviewed the 28 images in `assets/reference`, including the overhead DJI_121,
DJI_109 house front, both July 2025 ground photos, all 13 DJI phone exports,
and the cabin, camp, driveway and garage views. People, vehicles and loose
items were not used as permanent placement anchors. Green-trip photos govern
vegetation colour; dry-trip photos still inform layout.

## Changes

- The two blue polygons from `image(6).png` define longer grass inside the
  garage-side and house-side rock borders. They no longer inherit the broad
  camp mowing mask. Extra instanced tufts and sparse flowers fill both patches.
- The purple polygon defines a gravel connection from the garage turnaround
  to the house entrance. Terrain splatting and grass exclusion share the same
  footprint. Three sage shrubs and one rock move to its uphill edge.
- The red marks in `image(5).png` replace the old estimated horseshoe locations.
  Both three-log ends face each other, at (-10.05, 28.84) and (-10.76, 19.78).
  These are traced positions, not a claimed regulation-length court.
- DJI3, the cabin close-up and the cabin-facing ground view guide the tree
  immediately in front of the porch, four uneven evergreen groups at the
  forest edge, and two low rock landmarks on the camp/cabin approach.
- The garage front and DJI1/2/5/8/13 guide the full lower crowns beside the
  garage: one tall bare-trunk variant becomes a bushy pine, and the front
  corner tree moves closer to the building.

Markup registration uses the existing fire ring and the old horseshoe stakes
as ground anchors. The screenshot crops are not calibrated camera images, so
polygon boundaries and new tree positions are approximate and remain editable.
All 13 object corrections are listed with their evidence in
`assets/property-refinement-edits.json`. This is also a one-time three-way
migration for older browser drafts: independently edited/deleted objects are
left intact. Buildings, camera alignments and existing terrain heights are
preserved.

## Rendering and verification

Grass still uses the existing instanced chunks, quality density and distance
culling. The shader fade includes only 20% of camera altitude, so grass does
not disappear simply because the user looks down from a drone viewpoint.
The extra grass uses an independent seed after the stable sage scatter; saved
landscape IDs do not change. No remote textures or new large model assets.

Compared rendered overhead, DJI3, DJI5 and garage-front viewpoints in WebGL1.
The woodland silhouettes and individual species remain approximations of the
photos; this pass does not claim a photogrammetric reconstruction. Tests cover
blue/purple zone separation, the new court axis, valid landscape records and
draft migration that preserves newer user edits.
