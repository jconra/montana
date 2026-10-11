# Sharing scene changes

Use **Copy edits** in the bottom-right toolbar, then paste into chat. The clipboard contains compact `montana-scene-diff` version 1 JSON. If clipboard access is unavailable or denied, the same diff downloads as `montana-scene-diff.json`. No changes produces a status message instead of an empty export.

The baseline is the published building transforms and landscape defaults loaded by that page, captured before restoring browser drafts. Copying never advances it. Existing unsent drafts therefore remain in the diff, and unchanged terrain heights and placements are omitted. Photo alignments still use the photo menu's separate export.

`assets/scene-diff.mjs` normalizes buildings, landscape overrides/additions/removals and vertex heights into keyed maps. `changes` contains add/remove/replace operations with array paths and previous values for replacements/removals. IDs with slashes remain unambiguous. Transform vectors are exported as one small array; object fields and individual terrain vertices diff independently. A baseline fingerprint and landscape revision prevent applying against stale defaults. The fingerprint is a change detector, not a security hash.

To consume a pasted diff, call `applySceneDiff({buildings,landscape}, diff)` using the matching published defaults. It returns the original full export shape; validate the resulting landscape and building data before publishing, as with uploaded files. A changed baseline must be reconciled explicitly, never blindly overwritten. Legacy full exports remain readable and the landscape editor's full backup/import is retained.

Terrain paint is included as an optional `terrainPaint` stroke array in the source scene. Diffs normalize it by stable stroke ID, with an `order` field to preserve compositing order when reconstructed. Adding one stroke exports one addition rather than all existing paint. Published paint defaults are in `assets/terrain-paint.json`.
