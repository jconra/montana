# RAV4

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
