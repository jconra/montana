# Roof openings and wall dormers

Gable and shed roof pieces accept `holes` in the house's X/Z plan coordinates (feet). Each hole can be a rectangle `{x, z, w, d}`, a polygon `{poly: [[x,z], ...]}`, or a polygon array directly. Holes can cross the eave, a panel boundary, or the ridge; the ridge cap is cut too. Flat roof decks also accept enclosed holes through their existing slab builder.

Roof panel surfaces are triangulated around the openings, with an underside and cut edges. UVs use physical dimensions across the whole original panel rather than normalizing each remaining fragment. All metal roof pieces and dormer slopes share one eight-foot texture tile, so each standing seam remains approximately one foot apart regardless of panel size or cutouts.

Top-floor dormer walls use `roofPiece` (default `0`) to identify the main roof they join. Their roof slopes stop at that gable roof's surface, and the main roof is cut beneath them. When a dormer front lies on an outline wall, its opening continues through the eave. A conventional inset dormer's opening begins at its front wall. Set `dormerDepth` deep enough to reach both roof valleys.

The Montana house's dormer fronts now lie at Z=15, matching the front wall below, with their bases at the top of that wall. Siding courses use absolute height to stay aligned across floors and window fragments.
