// Cheap real-looking glass: see-through, plus a Fresnel reflection of a sky gradient. No environment map.
export function makeGlass(THREE,{tint=0x10161a,alpha=.45,reflect=1,base=.06}={}){
  const m=new THREE.MeshBasicMaterial({color:tint,transparent:alpha<1,opacity:1,depthWrite:alpha>=1,side:THREE.DoubleSide});
  m.userData.noShadow=true;m.userData.wxDone=true;
  m.onBeforeCompile=s=>{
    s.vertexShader='varying vec3 vGV;varying vec3 vGN;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vGV=-(modelViewMatrix*vec4(position,1.)).xyz;vGN=normalMatrix*normal;`);
    s.fragmentShader='varying vec3 vGV;varying vec3 vGN;\n'+s.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 gV=normalize(vGV),gN=normalize(vGN);if(dot(gN,gV)<0.)gN=-gN;
      float gC=1.-clamp(dot(gN,gV),0.,1.),gC2=gC*gC,gF=clamp(${base.toFixed(2)}+.94*gC2*gC2*gC+.22*gC2,0.,1.)*${reflect.toFixed(2)};
      vec3 gR=inverseTransformDirection(reflect(-gV,gN),viewMatrix);float gU=clamp(gR.y,0.,1.);
      vec3 gSky=mix(vec3(.62,.68,.74),vec3(.2,.33,.58),sqrt(gU));
      gSky=mix(vec3(.05,.06,.035),gSky,smoothstep(-.06,.03,gR.y));
      outgoingLight=mix(vec3(.006,.009,.012),gSky,gF);
      diffuseColor.a=mix(${alpha.toFixed(2)},1.,gF);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=>`glass-${alpha}-${reflect}-${base}`;return m;
}
