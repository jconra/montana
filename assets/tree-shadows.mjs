export function shadowSettings(level,mode='auto',limit=4096){
 if(mode==='off'||level<2)return {size:0,radius:0};
 const tier=mode==='auto'?level:Math.max(2,Math.min(4,Number(mode)||2));
 return {size:Math.min(limit,[0,0,1024,2048,4096][tier]),radius:[0,0,55,75,95][tier]};
}
// Feather the camera-following shadow region so its edge cannot become a new
// traveling boundary. Preserve each material's existing shader customization.
export function fadeShadowEdges(THREE,material,uniforms){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 shadowWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 shadowLocal=vec4(transformed,1.);
    #ifdef USE_INSTANCING
    shadowLocal=instanceMatrix*shadowLocal;
    #endif
    shadowWorld=(modelMatrix*shadowLocal).xyz;`);
  shader.fragmentShader='uniform vec3 shadowFocus;uniform float shadowExtent;varying vec3 shadowWorld;\n'+shader.fragmentShader;
  const lights=THREE.ShaderChunk.lights_fragment_begin.replace(/getShadow\( directionalShadowMap\[ i \], ([^;]+?) \)/g,'mix(1.0,getShadow( directionalShadowMap[ i ], $1 ),1.0-smoothstep(shadowExtent*.55,shadowExtent*.85,length(shadowWorld.xz-shadowFocus.xz)))');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lights);
 };
 material.customProgramCacheKey=()=>key+'-soft-shadow-edge-v1';material.needsUpdate=true;
}
