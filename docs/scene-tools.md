# Scene editing controls

The right-hand rail opens one toolbar at the bottom edge. Clicking the selected rail button, or ×, closes it. Opening a toolbar does not reposition the camera.

| Toolbar | Controls |
| --- | --- |
| Objects | Move, Rotate, Scale, Buildings only, model dropdown, Add, Delete, Undo, Redo, Copy edits |
| Height | Vertex Y, raise/lower/flatten/smooth brushes, grid, temporarily hide buildings, Undo/Redo, Copy edits |
| Paint | Lush green, dry grass, grass surface, gravel, erase; radius and strength; Undo/Redo; Copy edits |
| Photo | Reference, Save alignment, Export alignments, aspect fit, rotation sensitivity, FOV, roll, fade, animated fade, show/hide reference |
| Car | Enter/exit driving and directional buttons |
| Route | Show guides, add/clear waypoints, drive route, intro, copy route |
| Settings | Automatic/manual quality, shadows, target FPS, ground detail and global greenery. Inspect & backups contains coordinates, elevation tools, viewpoints, and landscape backup/import/reset. |

Object editing is enabled only when Move, Rotate, or Scale is selected. Clicking the active transform button again returns to camera navigation. The old background building-drag handler is disabled. There is no separate geometry Lock control.

Choose a model and press Add, then click the terrain. Placement selects the new object with a Move gizmo. Escape cancels pending placement. Delete removes the selected object; Undo restores it. The catalog includes all main-scene tree, shrub, and rock models, plus propane tanks, campfires, picnic tables, wood stacks, horseshoe pits and camp chairs. Each existing camp chair is independently selectable. Buildings remain selectable as whole designer-compatible structures.

Paint affects ground texture and color. Gravel also suppresses existing procedural grass/flower blades. Grass surface restores the ground's grass texture; it does not generate additional blades where none were scattered. Lush/dry paint tints existing grass as well as the ground. Erase removes authored paint to reveal the underlying terrain treatment. All brush edges are feathered. Initial color strokes approximate the marked woodland and dry meadow in the October 10 reference; they are adjustable with the same brush.

Paint drafts are saved in `montanaTerrainPaint:v1`; published strokes live in `assets/terrain-paint.json`. Copy edits includes only changed strokes, with IDs and ordering, alongside object and terrain-height changes. Object and paint toolbars provide their own undo/redo controls. Landscape backup/import/reset is explicitly for objects and vertex heights; use Copy edits to share paint changes.

Removed from the visible UI: legacy building heading/size/nudge controls, separate selected-building drag UI, duplicate transform controls, Lock, old layout dump, obsolete tree style/billboard tuning, and the separate landscape editor panel. Their data hooks remain hidden where still used by scene initialization; they cannot capture ordinary camera gestures.
