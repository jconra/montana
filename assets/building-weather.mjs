// Per-pixel weathering for the buildings: dust, streaks, sun fade, board and panel variation, and peeling paint.
// World-space noise needs no UVs and never repeats on a wall, so it breaks up tiled siding and roof maps.
// GLSL ES 1.0 only (WebGL1 safe). The work sits behind one uniform, so the lowest quality level skips it.
const FT=.3048;
let noiseTexture=null;
const amount={value:1};
function makeNoise(THREE){
  if(noiseTexture)return noiseTexture;
  const S=256,data=new Uint8Array(S*S*4);
  const lattice=[];let seed=1234567;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const layer=period=>{const g=new Float32Array(period*period);for(let i=0;i<g.length;i++)g[i]=rnd();return g;};
  const sample=(g,period,u,v)=>{const x=u*period,y=v*period,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),at=(a,b)=>g[((b%period)*period)+(a%period)];
    return (at(x0,y0)*(1-sx)+at(x0+1,y0)*sx)*(1-sy)+(at(x0,y0+1)*(1-sx)+at(x0+1,y0+1)*sx)*sy;};
  const channels=[[4,8,16,32],[8,16,32,64],[16,32,64,128],[32,64,128,256]].map(ps=>ps.map(p=>[p,layer(p)]));
  for(let y=0;y<S;y++)for(let x=0;x<S;x++)channels.forEach((c,ch)=>{let n=0,w=.5,t=0;for(const [p,g] of c){n+=sample(g,p,x/S,y/S)*w;t+=w;w*=.55;}data[(y*S+x)*4+ch]=Math.round(255*n/t);});
  const t=new THREE.DataTexture(data,S,S,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
  return noiseTexture=t;
}
const KIND={plain:0,hsiding:1,roof:2,roofV:2,deck:3,rail:4,vboard:5};
const VERT_PARS='varying vec3 vWxP;varying vec3 vWxL;varying vec3 vWxN;\n';
const VERT_MAIN=`
  vWxL=transformed;vWxP=(modelMatrix*vec4(transformed,1.)).xyz;vWxN=normalize((modelMatrix*vec4(objectNormal,0.)).xyz);`;
const FRAG_PARS=`uniform sampler2D uWxNoise;uniform float uWxAmt,uWxEave,uWxBoard,uWxWear,uWxPanelV;varying vec3 vWxP;varying vec3 vWxL;varying vec3 vWxN;
float wxSq(float v){return v*v;}
float wxStretch(float n,float k){return clamp((n-.5)*k+.5,0.,1.);}
`;
const FRAG_MAIN=`
if(uWxAmt>.5){
  vec3 wP=vWxP,wL=vWxL,wN=normalize(vWxN);
  float wVert=1.-abs(wN.y),wAlong=dot(wP.xz,vec2(-wN.z,wN.x)),wH=wL.y;
  vec2 wFlat=abs(wN.y)>.6?wP.xz:vec2(wAlong,wP.y);
  vec4 wBig=texture2D(uWxNoise,wFlat*.043+.17);
  vec4 wFine=texture2D(uWxNoise,wFlat*.61);
  float wLum=dot(diffuseColor.rgb,vec3(.3,.59,.11));
  vec3 wDust=vec3(.17,.135,.1);
  float wSun=clamp(dot(wN,normalize(vec3(-.7,.45,.45))),0.,1.);
  #if W_KIND==3
    // Deck boards: red coat sun-baked and flaking to grey wood, worst on the north section and on the walked path.
    float wX=wL.x/${FT},wZ=wL.z/${FT},wB=wX/.46,wId=floor(wB),wF=fract(wB);
    float wGap=1.-smoothstep(.015,.055,min(wF,1.-wF));
    float wBoard=texture2D(uWxNoise,vec2(wId*.173,.37)).r;
    float wNorth=smoothstep(-3.,8.,wX);
    float wPath=exp(-wxSq((wZ-10.8)/2.3))*smoothstep(0.,4.,wX);
    float wDoor=exp(-(wxSq((wX-4.3)/3.)+wxSq((wZ-9.3)/2.)));
    float wBench=exp(-(wxSq((wX+2.)/4.)+wxSq((wZ-10.)/2.)));
    float wUndisturbed=smoothstep(12.2,13.8,wZ)*.22;
    float wStep=smoothstep(13.,13.6,wX);
    float wW=clamp(.26+.56*wNorth+.3*wPath+.28*wDoor+.16*wBench-wUndisturbed+(wBoard-.5)*.5+wStep*.2,0.,1.);
    float wFlk=wxStretch(texture2D(uWxNoise,vec2(wB*.11+wId*.31,wZ*.09)).g,2.6)*.62+wxStretch(texture2D(uWxNoise,vec2(wB*.47,wZ*.31)).b,2.4)*.38;
    float wPaint=1.-smoothstep(1.-wW-.025,1.-wW+.04,wFlk);
    vec3 wRed=mix(vec3(.105,.012,.016),vec3(.2,.055,.05),smoothstep(.3,.8,wBig.g*.55+wBoard*.45+wNorth*.15));
    wRed*=.85+.3*wFine.b;
    float wGrain=texture2D(uWxNoise,vec2(wB*.9,wZ*.14+wId*.37)).b;
    vec3 wWood=vec3(.215,.185,.15)*(.62+.62*wBoard+.5*(wGrain-.5))*(.9+.2*wBig.r);
    diffuseColor.rgb=mix(wWood,wRed,wPaint);
    diffuseColor.rgb*=1.-.72*wGap;
    if(wN.y<.5)diffuseColor.rgb*=.8;
    diffuseColor.rgb=mix(diffuseColor.rgb,wDust,.1*wBig.b*max(wN.y,0.));
  #elif W_KIND==4
    // Rails, rim boards and posts: brown stain baked off along the grain to silvery wood.
    vec2 wG=abs(wN.y)>.6?wP.xz*1.15:(uWxPanelV>.5?vec2(wAlong*.42,wP.y*4.2):vec2(wAlong*4.2,wP.y*.42));
    float wN1=wxStretch(texture2D(uWxNoise,wG*.42).g,2.5),wN2=wxStretch(texture2D(uWxNoise,wG*1.1).b,2.2);
    float wPeel=smoothstep(1.-uWxWear-.05,1.-uWxWear+.08,wN1*.65+wN2*.35+max(wN.y,0.)*.22+(wBig.r-.5)*.3);
    vec3 wStain=diffuseColor.rgb*(.82+.4*wFine.g);
    vec3 wBare=vec3(.28,.25,.205)*(.72+.56*wN2);
    diffuseColor.rgb=mix(wStain,wBare,wPeel);
  #elif W_KIND==2
    // Metal roof: panel-to-panel tone, long run marks and soft sun fade.
    #ifdef USE_MAP
      float wPC=(uWxPanelV>.5?vMapUv.y:vMapUv.x)*2.,wPI=floor(wPC);
      float wAl=uWxPanelV>.5?vMapUv.x:vMapUv.y;
      float wPanel=texture2D(uWxNoise,vec2(wPI*.211,.71)).r;
      diffuseColor.rgb*=.8+.42*wPanel;
      float wRun=wxStretch(texture2D(uWxNoise,vec2(wPC*.9,wAl*.05)).g,2.8);
      diffuseColor.rgb*=1.-.2*smoothstep(.56,.85,wRun);
    #endif
    float wFade=smoothstep(.42,.72,wBig.r)*(.45+.55*wSun);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(wLum)*vec3(1.2,1.16,1.22)+vec3(.012,.011,.013),.5*wFade);
    diffuseColor.rgb=mix(diffuseColor.rgb,wDust*.42,.16*smoothstep(.5,.8,wFine.g));
  #else
    #if W_KIND==1
      // Lap siding: every course its own tone, changing where a board ends.
      float wCo=floor(wH/uWxBoard),wEnd=floor((wAlong+wCo*1.7)/3.7);
      float wT=texture2D(uWxNoise,vec2(wCo*.137+wEnd*.073,wEnd*.19+.3)).r;
      diffuseColor.rgb*=.76+.5*wT;
    #elif W_KIND==5
      float wBd=floor(wAlong/.406),wT=texture2D(uWxNoise,vec2(wBd*.137,.3)).r;
      diffuseColor.rgb*=.8+.4*wT;
      diffuseColor.rgb*=.9+.2*wxStretch(texture2D(uWxNoise,vec2(wAlong*2.4,wP.y*.14)).b,2.);
    #else
      float wT=wBig.r;
      diffuseColor.rgb*=.86+.28*wBig.g;
      if(wN.y>.5)diffuseColor.rgb=mix(diffuseColor.rgb,wDust*1.6,.32*smoothstep(.35,.7,wBig.b)+.1*wFine.g);
    #endif
    diffuseColor.rgb*=.92+.16*wFine.b;
    #if W_KIND==1||W_KIND==5
      // Sun fade on faces that take the low sun.
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(wLum)*1.25+.008,.22*wSun*smoothstep(.35,.7,wBig.r));
      // Run marks below the eave.
      float wBelow=uWxEave-wH;
      float wColN=texture2D(uWxNoise,vec2(wAlong*.17,.53)).r;
      float wS=wxStretch(texture2D(uWxNoise,vec2(wAlong*.62,wP.y*.05)).g,2.6);
      float wRunD=clamp(1.-wBelow/(.6+3.2*wColN),0.,1.)*smoothstep(-1.6,0.,wBelow);
      diffuseColor.rgb*=1.-.42*wVert*smoothstep(.45,.75,wS)*wRunD;
    #endif
    // Dust and splash near the ground.
    float wLow=1.-smoothstep(.05,.55+.55*wFine.g,wH);
    diffuseColor.rgb=mix(diffuseColor.rgb,wDust*(.7+.5*wFine.b),.42*wLow*wVert*smoothstep(.25,.6,wFine.r+.25*wLow));
  #endif
}
`;
function patch(THREE,material,kind,props){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  const u={uWxNoise:{value:makeNoise(THREE)},uWxAmt:amount,uWxEave:{value:props.eave??4},uWxBoard:{value:props.board??.2},uWxWear:{value:props.wear??.45},uWxPanelV:{value:props.panelV?1:0}};
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);Object.assign(shader.uniforms,u);
    shader.vertexShader=VERT_PARS+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>'+VERT_MAIN);
    shader.fragmentShader=`#define W_KIND ${KIND[kind]}\n`+FRAG_PARS+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>'+FRAG_MAIN);
  };
  material.customProgramCacheKey=()=>key+'-wx-'+kind;material.needsUpdate=true;
}
const EAVES={house:4.72,garage:5.6,cabin:4.05,shed:2.85};
// Every opaque material of a placed building gets its kind from userData.wx, or the plain treatment.
export function weatherBuilding(THREE,group,type){
  const done=new Set();
  group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(done.has(m)||m.transparent||m.userData.wxDone)continue;done.add(m);m.userData.wxDone=true;
    const w=m.userData.wx||{kind:'plain'};
    patch(THREE,m,w.kind,{eave:EAVES[type],board:w.board,wear:w.wear,panelV:w.kind==='roofV'||w.horiz});
  }});
}
// The lowest quality level skips the weathering work.
export function setWeatherQuality(level){amount.value=level>=1?1:0;}
