# Scene models

## Sagebrush

`sage.glb` is the user's corrected model (`sage_fixed.glb`), supplied October
2026 and retained unchanged. It has 698 triangles, Uint16 indices, one mesh and
material, and one embedded 256×256 RGBA texture (about 120 KB for the entire
asset). The texture contains leaf cutouts and a brown patch for the branches,
with filled RGB around transparent leaf edges. It needs no external texture or
decoder download. The asset URL includes a content revision to refresh cached
copies of earlier models.

`../sagebrush.js` uses the vendored r158 GLTFLoader, bakes the model's authored
transforms into their geometry, and normalizes the shrub to one metre high with
its root on the ground. The scene varies height (0.65–1.5 m), canopy proportions,
rotation and brightness. The revised export uses leaf roughness 1 and glTF
MASK mode with the default alpha cutoff of 0.5, reflecting the rounded alpha
in Blender. The loader preserves both settings and enables alpha-to-coverage;
overlapping instanced leaf cards write depth without transparency sorting.

Branches and leaves share each plant's instance transform, visibility, density
budget and subtle wind phase. There is one instanced draw per visible
28-metre sagebrush cell, rather than one draw for every shrub. Auto quality
reduces count and range; it does not reduce the supplied texture resolution.
If the model fails to load, the rest of the property still initializes and the
console reports the missing sagebrush asset.

Visual review: the corrected texture avoids white RGB outside the leaf
cutouts, but this remains a stylized shrub at close range. Broad, angular
branch bases and large, spiky leaf sprays are visible from several angles;
the reference hillside has finer twigs and softer, rounded grey-green crowns.
The source model is preserved rather than reshaped or recolored by the loader.

## RAV4

`rav4.glb` is the user-supplied Tripo model retrieved from the provided S3 link.
The original GLB is retained unchanged, including its embedded 2048×2048 JPEG.
No signed URLs or AWS credentials are stored in the project.

`../rav4-model.js` loads it with the vendored r158 GLTFLoader. The 10,639-triangle
mesh contains four disconnected wheel islands. Connectivity identifies them
without modifying the body, UVs, or normals. Each wheel gets a steering pivot
and spin pivot; positive local Z is the front. The model is scaled to 4.6 m long
and grounded at the tire bottoms. Its width including mirrors is about 2.26 m.
Indices are converted to Uint16 for the WebGL1 path. The body and four wheels
share the supplied material and texture, for five draws.

The main scene loads the local asset asynchronously and retains the procedural
car if loading or wheel identification fails. Front steering follows manual
inputs and route turns; wheel rotation follows distance traveled. Steering is
a visual approximation, not an Ackermann steering or suspension simulation.

## Rocks

`boulder-a.glb` and `boulder-b.glb` are the two lawn boulders, modelled from
solved drone frames (May 2026): shape carved from each frame's rock outline,
colour projected from the sharpest, most head-on frames. About 4,000 triangles
each, one 1024×1024 JPEG, 16-bit indices, in metres with the origin on the ground.
They load through `../rock-models.js` and stay ordinary editor objects. The sides
facing north and west were seen poorly, so their grain is filled from the same rock.

`central-rocks.glb` holds four cut-stone shapes of 279 triangles named after the
rock assets they replace (`11`, `27`, `43`, `61`), sharing one 512×512 texture
built from patches of both boulders. Rocks inside `../central-rocks.mjs` use
these; rocks further out use an 80-triangle shape. The choice depends on position
only, so saved object IDs and the scatter that makes them are unchanged.
