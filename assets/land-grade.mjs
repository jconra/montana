// THE PHOTO GRADE. Measured against the drone frames, the whole model sat 10-20 L darker than the photos, buildings included: the
// renderer showed linear light as it was, with no camera curve. A curve on every material lifts shadows the way the camera does, and
// land materials (marked with LAND_GRADE) also lose some saturation, since land alone was about twice as saturated as the photos.
// It runs in each material's own fragment stage, through three's custom tone mapping slot, so it costs no extra pass and works on WebGL1.
export const CURVE=.82,LAND_SATURATION=.94;
export function installGrade(THREE,renderer){
 const chunk=THREE.ShaderChunk.tonemapping_pars_fragment,slot='vec3 CustomToneMapping( vec3 color ) { return color; }';
 if(!chunk.includes(slot))throw new Error('Photo grade: three tone mapping slot not found');
 THREE.ShaderChunk.tonemapping_pars_fragment=chunk.replace(slot,`vec3 CustomToneMapping( vec3 color ) {
  color = pow( max( color, vec3( 0.0 ) ), vec3( ${CURVE.toFixed(3)} ) );
  #ifdef LAND_GRADE
  color = mix( vec3( dot( color, vec3( 0.2126, 0.7152, 0.0722 ) ) ), color, ${LAND_SATURATION.toFixed(3)} );
  #endif
  return color; }`);
 renderer.toneMapping=THREE.CustomToneMapping;renderer.toneMappingExposure=1;
}
export function gradeLand(material){material.defines={...(material.defines||{}),LAND_GRADE:''};return material;}
