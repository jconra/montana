# Property photo matching

Open Tools (+), then **photo match**. The Reference menu contains 14 original
property images in `assets/reference/`. Photos load only when selected; normal
driving does not download the image collection.

1. Choose a reference photo. Four photos have starting viewpoints; the front
   house drone view was fitted against six roof/foundation landmarks. These are
   approximate registrations, not surveyed camera positions.
2. Use fade or hide/show to compare. Drag to orbit, right-drag to pan and use the
   wheel to change distance. FOV changes the lens; roll corrects a tilted frame.
   Keep “match photo proportions” enabled so the renderer and image have the
   same aspect ratio, including after resizing the window.
3. **Save alignment** stores that photo's camera in this browser. Repeat for
   other images. **Export saved alignments** downloads one JSON containing the
   photo IDs, original filenames, position, target, vertical FOV, aspect and
   roll. Send that JSON back to make the alignments published defaults.
4. **Export camera** also supports an individually uploaded local photo. Restore
   accepts either one camera or a collection of saved alignments. Invalid imports
   are rejected before any saved camera is changed.

`?photo=house-drone` opens the reference and tools directly. `?view=garage-camp`
opens a scene viewpoint without loading a photo. Published cameras live in
`assets/photo-alignments.json`; the image manifest is `assets/photo-references.json`.

Use the green-season photos for the landscape palette. Dry-season images still
help establish structure and location. People, vehicles and small loose items
are not placement anchors. The shed location and horseshoe pit spacing remain
estimates pending a closer shed image or measurements.

## Buildings and property edits

House, garage and shed now share builder version 39 with `jconra/building-designer`.
The designer has a Building menu, independent drafts, dormer dimensions, closed
and overhead doors, and editable skylights, chimney, balcony and arched window
details. Copy/Build and Save to Scene retain these fields. Choose **Load latest**
in the designer to replace an older building draft with the staged reference model.
Same-origin Save to Scene uses `montanaHouse`, `montanaGarage` or `montanaShed`.
On a different origin, transfer the JSON rather than relying on local storage.

The main house has a fixed `origin` in feet, preventing new porch/roof details
from shifting its authored terrain placement. Existing floor plans are retained.
The shed is added after the original scatter baseline is captured so older
landscape exports still identify the same trees, rocks and shrubs.

The garage-to-fire-pit surface is one shared footprint for the texture mask and
grass trimming. Gravel fades into mown lawn; tall banks remain outside it. Border
rocks, the propane tank and photo-based tree adjustments are ordinary landscape
editor records in `landscape-defaults.json`. All seven previous object overrides
and 861 authored terrain heights are preserved. Existing browser landscape drafts
still take priority: export one before using **Reset to published defaults** if
you want to retain those draft changes.

Current follow-ups: finer, denser juniper-like crowns and sage foliage would match
the photos better than the present tree/shrub models; terrain and some building
dimensions still need registered views or measurements. This pass does not claim
photogrammetric accuracy. Three.js remains r158, with WebGL1, shared instancing,
existing matching tree impostors and the adaptive rendering budgets retained.
