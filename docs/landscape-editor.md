# Landscape editor

Open **Tools → Edit landscape**, or open the scene with `?edit=1`. Entering
the editor stops the vehicle. **Done** returns to the normal tools.

## Objects

- Click a tree, rock or bush to select it; the selected model and its outline
  stay visible while you edit. The type filter helps select small rocks or
  bushes beneath tree canopies.
- Drag the selection along the ground. Use East X and North for exact placement,
  Above ground for burying/lifting it, Heading for rotation about the vertical
  axis, and Size multiplier for uniform resizing relative to its original size.
- Use Duplicate or Remove, or choose a model and click **Place on ground…**.
  Then click the ground to place one object. Escape cancels placement.
- Empty-space dragging orbits the camera; right-drag pans. **House view** and
  **Top view** help with placements around the buildings.

The catalog includes tall pine, bushy pine, aspen, four rock shapes, broadleaf
and evergreen bushes, and the supplied sagebrush. Trees retain matching
impostors after edits. Rocks and bushes remain instanced. Auto quality pauses
its measurements during editing and resumes on exit; manual quality changes
do not alter the saved layout. Added and edited objects are retained in density
budgets, and the selected object's temporary preview stays visible while editing.

## Terrain around the house

Choose **Terrain → House view → Top view**. **Hide buildings** exposes the
ground under their footprints, and **Show vertices** displays the nearby grid.
Click a vertex and enter its exact Y, or use the step buttons. Brush tools
raise, lower, flatten to an entered Y, or smooth adjacent heights. A complete
brush stroke is one undo step; cancelling a pointer gesture restores it.

Y is local scene height in metres at vertical scale 1, not sea-level elevation.
Changing the viewing exaggeration does not change exported heights. The fine
grid covers roughly 500 × 500 m; a narrow outer seam is protected. The coarse
underlay is removed beneath this grid so it cannot poke through lowered land.
Trees, rocks, bushes, grass and nearby props follow edited ground. Existing
building foundations keep their elevation while the terrain is shaped around
them. Pond water retains its authored, level surface.

## Saving and making a new default

Each committed edit saves a draft to this browser's local storage. Export JSON
to keep a portable copy and send it back for publication. **Import JSON**
restores a complete exported patch, replacing the current draft; it is
undoable. **Reset to published defaults** is also undoable. Undo/redo buttons
and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y cover both object and terrain edits.
History is limited to 30 transactions and approximately 8 MB of snapshots.
If browser storage is unavailable, the editor reports that and export still
works. Drafts and undo history do not publish anything to the site.

To publish an approved export, replace `assets/landscape-defaults.json` with
the exported file and deploy normally. The scene loads this file on startup,
then a compatible local draft if present. Reset to published defaults removes
the effect of an older local draft when checking a newly published layout.

## File contract

The version-1 `montana-landscape` document identifies a deterministic property
revision, map origin, and fine-grid dimensions/spacing. It contains:

- `objects.overrides`: complete replacement records for existing stable IDs.
- `objects.added`: new records with unique `added:` IDs.
- `objects.removed`: IDs of original objects to hide.
- `terrain.heights`: sparse `[vertexIndex, absoluteY]` pairs in the fine grid,
  applied after the original pond shaping and house-pad flattening.

Object records have `id`, `asset`, `x`, `z`, `offset`, `rotation`, `scale` and
`tint`. X points east and Z south. Offset is metres above the terrain; rotation
is an XYZ Euler array in radians. The UI changes heading and uniform size,
preserving the original rock proportions and aspen lean. IDs use LiDAR source
indices, deterministic grove indices, or seeded scatter coordinates, never a
GPU instance index or the current quality subset. If source scatter rules or
the terrain grid change incompatibly, update the property revision and migrate
old patches deliberately. Imports reject incompatible origins/grids, unknown
IDs or models, duplicates, invalid numbers and protected boundary vertices
before changing the scene.

Buildings, vehicle waypoints, meadow-grass blades, flowers and pond water are
outside this landscape patch. Existing building and route tools remain separate.

## Verification

`node tests/landscape-state.test.mjs` checks round trips, failed-import atomicity,
stable IDs, history and brush boundaries. Browser checks cover actual picking,
dragging, numeric transforms, duplicate/delete/undo, adding matching tree types,
vertex and brush edits, pointer cancellation, vertical exaggeration, JSON
download/import, local-draft reload and loading the same export as published
defaults in WebGL1 and WebGL2.
