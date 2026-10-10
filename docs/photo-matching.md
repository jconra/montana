# Property photo matching

Open Tools (+), then **photo match**. The Reference menu contains 28 original
property images in `assets/reference/`. Photos load only when selected; normal
driving does not download the image collection.

1. Choose a reference photo. Four photos have starting viewpoints; the front
   house drone view was fitted against six roof/foundation landmarks. These are
   approximate registrations, not surveyed camera positions.
2. Use fade or hide/show to compare. Drag to orbit, right-drag to pan and use the
   wheel to change distance. The keyboard also pans with WASD; Space raises the
   camera and C lowers it without changing the viewing direction. Hold Shift
   while moving for fine, one-tenth-speed adjustments. FOV changes the lens;
   roll corrects a tilted frame. Keep “match photo proportions” enabled so the
   renderer and image have the same aspect ratio, including after resizing the
   window. When a photo or viewpoint is active, the compact bottom bar exposes
   rotation sensitivity, FOV, roll, opacity and an optional slow auto-fade. The
   Tools panel can be collapsed without hiding that bar.
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
The imported alignment set keeps the previous house-drone and house-east
presets while updating the nine alignments supplied for this pass.

The Structures section has an “edit existing” menu for selecting the cabin,
house, garage or shed even when the model is difficult to click from above.
Heading uses tenth-degree steps and size uses three-decimal steps. Enable
“lock geometry (camera only)” before orbiting if you want pointer movement to
leave buildings, vegetation and terrain untouched; the landscape editor has the
same lock control.

Use the green-season photos for the landscape palette. Dry-season images still
help establish structure and location. People, vehicles and small loose items
are not placement anchors. The shed location and horseshoe pit spacing remain
estimates pending camera alignment or measurements. DJI 03 now shows the shed,
partly obscured by vegetation, behind the cabin.

## Additional drone references

The newer set is listed as **DJI 01** through **DJI 13** in the Reference menu. The close-up `cabin-deck-drone` reference shows the cabin deck and stair orientation clearly.
These photos have no embedded EXIF camera/GPS metadata and no published camera
alignments yet. Selecting one keeps the current scene viewpoint until you adjust
it or restore a saved alignment. Their stable IDs are `drone-01` to `drone-13`;
for example, `?photo=drone-03` opens the cabin/shed reference directly.

| Photo | Most useful fixed landmarks |
| --- | --- |
| DJI 01 | House dormers, garage frontage, driveway junction and rock borders. |
| DJI 02 | Oblique building spacing, curved driveway, grass between wheel tracks and large border rocks. |
| DJI 03 | Cabin porch/stairs, small shed behind and left of the cabin in this image, fire ring and open mown lawn. |
| Cabin close-up | Continuous front deck, covered porch on the left portion, and an uncovered stair flight on the cabin's left side. |
| DJI 04 | House frontage, larger clearing outline, horseshoe area and isolated trees. |
| DJI 05 | Garage-to-lawn transition, both horseshoe frames, pale boulder beside the upper frame and gravel-edge rocks. |
| DJI 06 | Garage rear/side window arrangement, roof overhang, metal seams, skylight and adjacent trees. |
| DJI 07 | House side entry, garage roof and the grass strip between the two worn driveway tracks. |
| DJI 08 | House dormer/window proportions, garage frontage and the junction's rock-lined bank. |
| DJI 09 | Relative positions of all three main buildings, pale-trunked aspen grove and taller grass outside the lawn. |
| DJI 10 | Fire-pit clearing, irregular groups of conifers and the transition into the rougher foreground. |
| DJI 11 | Cabin deck/stairs, picnic/fire-pit area, garage, open lawn and intervening tree groups. |
| DJI 12 | Broad relationship of the three buildings, clearing boundary and surrounding tree groups. |
| DJI 13 | Garage upper sliding door/windows, black balcony railing, timber braces, lower personnel door and overhead opening. |

Useful next comparisons are DJI 03 for the shed and lawn, DJI 05/07 for worn
surfaces, and DJI 06/13 for the garage. In these views the clearing is mostly
short green lawn; taller straw/green clumps occupy banks and unmaintained areas.
The deciduous grove has slender pale trunks and a much lighter canopy than the
conifers. Keep those vegetation differences when refining models and placement.
The shed's visible tan wall and small dark window provide a reference, but trees
obscure enough of it that its full dimensions and roof shape remain uncertain.
Use major rocks and building corners for registration; picnic furniture is a
secondary clue because it can move between trips. The cabin porch and stair
orientation, plus the foreground tree placement, are now reflected in the
published scene defaults; the four existing camera alignments remain unchanged.

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
