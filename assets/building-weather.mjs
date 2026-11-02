// Per-pixel weathering for the buildings, worked out from world position and facing plus a four-channel noise texture:
// paint chipping and edge wear, grain-following peel, run marks below drip edges, splash and a dirt band near the ground,
// bevelled board edges. GLSL ES 1.0 (WebGL1 safe). One uniform switches it off at the lowest quality level.
import {sharedTextures} from './wood-sheet.mjs';
const amount={value:1};
const VERT_PARS=`varying vec3 vWxP;varying vec3 vWxL;varying vec3 vWxN;
#ifdef W_BOX
attribute vec4 aLocalTop;attribute vec4 aHalf;attribute vec4 aTintPaint;varying vec4 vLocalTop;varying vec4 vHalf;varying vec4 vTintPaint;
#endif
`;
const VERT_MAIN=`vWxL=transformed;vWxP=(modelMatrix*vec4(transformed,1.)).xyz;vWxP.y-=modelMatrix[3].y;vWxN=normalize((modelMatrix*vec4(objectNormal,0.)).xyz);
#ifdef W_BOX
vLocalTop=aLocalTop;vHalf=aHalf;vTintPaint=aTintPaint;
#endif
`;
const FRAG_PARS=`uniform sampler2D uNoise;uniform float uWxOn,uPatchScale,uGrimeAmt,uStreakLen,uStreakScale,uSplashH,uGrimeSoft,uEdgeAmt,uEdgeWidth,uEdgeBreak,uPaintChip,uEdgeDark,uEdgeDarkW,uBevel,uLogRound,uEaveDark,uWallBand,uBleach,uDirtBand,uCornerDirt,uFixedTop,uWxBoard,uWxPanelV;uniform vec3 uGrimeColor,uMudColor,uShadeDir;
varying vec3 vWxP;varying vec3 vWxL;varying vec3 vWxN;
#ifdef W_BOX
varying vec4 vLocalTop;varying vec4 vHalf;
#define W_TINT
varying vec4 vTintPaint;
#endif
float wxSq(float v){return v*v;}
vec4 wTri(vec3 p,vec3 w){return texture2D(uNoise,p.zy)*w.x+texture2D(uNoise,p.xz)*w.y+texture2D(uNoise,p.xy)*w.z;}
`;
const FRAG_COLOUR=`
float wPaintVisO=0.,wBareO=0.,wStreakO=0.,wRimHO=0.;
if(uWxOn>.5){
vec4 vWPosAO=vec4(vWxP,1.);

vec3 wP = vWPosAO.xyz;
vec3 wN = normalize(vWxN);   // the surface's facing, in the world
vec3 wTw = wN * wN; wTw *= wTw; wTw /= (wTw.x + wTw.y + wTw.z);            // triplanar blend weights
float wAO = vWPosAO.w;
vec4 wBig = wTri(wP * uPatchScale, wTw);    // big soft patches (R), blotches (G)
vec4 wFine = wTri(wP * 0.9, wTw);           // grit (B): 1.1 m to a repeat
float wLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
float wStreak = 0.0, wSplash = 0.0, wDirt = 0.0, wWear = 0.0, wBare = 0.0, wPaintVis = 0.0;
float wEdge = 1.0, wRim = 0.0, wRimH = 0.0;
// what kind of part this is, from the tint's fourth number: painted (1), a round log (2), mortar or chinking (3), a
// stone laid in a wall (4), a roof shake (below 0: minus how much of it shows below the next course, metres)
float wKind = 0.0;
#ifdef W_TINT
  wKind = vTintPaint.a;
#endif
float wIsPaint = step(0.5, wKind) * step(wKind, 1.5), wIsLog = step(1.5, wKind) * step(wKind, 2.5), wIsMortar = step(2.5, wKind) * step(wKind, 3.5), wIsLaid = step(3.5, wKind);
float wShakeE = max(-wKind, 0.0), wSetBack = 0.0;


  // ── EDGE WEAR ─ how far is this pixel from its box's nearest edge? (each corner knows where it sits in its box, so
  // in between, the shader gets that exactly; of the three "distance to a side" numbers, one is ~0 (the face we are
  // on), the next smallest is the distance to the nearest edge)
  #ifdef W_BOX
    vec3 wD = vHalf.xyz - abs(vLocalTop.xyz);
    
    float wMn = min(wD.x, min(wD.y, wD.z)), wMx = max(wD.x, max(wD.y, wD.z));
    wEdge = wD.x + wD.y + wD.z - wMn - wMx;
    float wTop = vLocalTop.w;
    #ifdef W_BEVEL
    {
      // BEVELLED EDGES: the face's own two directions (drop the one it looks along: its distance is ~0), how far this
      // pixel is from the edges along each, and a band that darkens toward them, curving in (brighter middle, darker
      // rim, darkest in the corners). The same band is a height that drops toward the edge (wRimH, metres): the normal
      // tilts over it, so the light catches a rounded edge without a single extra triangle.
      // The band's inner line wanders a little (ragged), and it is measured from a rectangle with rounded corners, so
      // the corners darken round, as on a worn stone or board.
      vec2 wF, wFH, wFP;
      if (wD.x <= wD.y && wD.x <= wD.z) { wF = wD.yz; wFH = vHalf.yz; wFP = vLocalTop.yz; }
      else if (wD.y <= wD.z) { wF = wD.xz; wFH = vHalf.xz; wFP = vLocalTop.xz; }
      else { wF = wD.xy; wFH = vHalf.xy; wFP = vLocalTop.xy; }
      float wW = max(min(uEdgeDarkW, 0.6 * min(wFH.x, wFH.y)), 0.0005) * (0.8 + 0.4 * wFine.b);
      if (wShakeE > 0.0) wW *= 0.5;                   // a shake: only a thin dark line along its sides (the gap)
      float wQ = min(length(max(wW - wF, 0.0)) / wW, 1.0);
      wRim = wQ * wQ;
      wRimH = -0.5 * uBevel * wW * wRim;
      // A LOG: round about its long axis (the longer of the face's two directions). Across it, the top and bottom
      // quarter darken, and the normal tilts as if over a cylinder, so the light rolls round it. (Its ends are the round
      // end-grain pictures.)
      if (wIsLog > 0.5 && min(wFH.x, wFH.y) * 2.5 < max(wFH.x, wFH.y)) {
        float wA = step(wFH.y, wFH.x);                 // 1: the face's second direction is the one round the log
        float wHa = mix(wFH.x, wFH.y, wA), wPa = mix(wFP.x, wFP.y, wA) / max(wHa, 0.001);
        wRim = max(wRim, 0.7 * smoothstep(0.76, 1.0, abs(wPa)));     // only the top and bottom eighth, softly
        wRimH = -0.5 * uLogRound * wHa * wPa * wPa;
      }
      // MORTAR AND CHINKING: set back between the stones or logs, so no lit lip: a shadow line along its top under the
      // stone or log over it, and otherwise its own light colour (from a distance a light web between the stones)
      if (wIsMortar > 0.5) {
        wRim = 0.0; wRimH = 0.0;
        wSetBack = 0.06 + 0.5 * (1.0 - smoothstep(0.0, 0.03, vHalf.y - vLocalTop.y));
      }
      // A STONE LAID IN A WALL: its top is seen only down in the joint, under the stone above: shaded, never a lit ledge
      if (wIsLaid > 0.5 && wD.y <= min(wD.x, wD.z) && vLocalTop.y > 0.0) wSetBack = 0.55;
      // A LOG's top and bottom are seen only down in the gap to the next log: in shadow, never a lit sliver
      if (wIsLog > 0.5 && wD.y <= min(wD.x, wD.z)) wSetBack = 0.7;
    }
    #endif
  #else
    float wTop = uFixedTop;
  #endif
  // a roof shake is open to the rain all over (the baked rain test is per corner, and would give each shake its own)
  float wShakeButt = 0.0;
  #ifdef W_BOX
  if (wShakeE > 0.0) { wShakeButt = 1.0 - smoothstep(0.0, wShakeE * 0.9, vHalf.z - vLocalTop.z); }
  #endif
  float wWearT = 1.0 - wEdge / max(uEdgeWidth, 0.0005) + (wFine.g - 0.5) * 2.6 * uEdgeBreak;
  wWear = smoothstep(0.35, 0.65, wWearT) * uEdgeAmt;

  #ifdef W_TINT
    // paint chips off a wider band than bare wood wears, and in random flecks where the noise is high
    float wPainted = wIsPaint;
    float wChipT = 1.0 - wEdge / max(uEdgeWidth * 0.8, 0.0005) + (wFine.b - 0.5) * 3.0 * uEdgeBreak;
    float wChip = clamp(smoothstep(0.45, 0.6, wChipT) * uEdgeAmt + smoothstep(1.04 - uPaintChip * 0.4, 1.08 - uPaintChip * 0.4, wFine.b * 0.55 + wBig.g * 0.55) * step(0.001, uEdgeAmt), 0.0, 1.0);
    vec3 wWood = diffuseColor.rgb * mix(vTintPaint.rgb, vec3(0.9, 0.82, 0.74), wPainted);
    vec3 wPaint = vTintPaint.rgb * (0.9 + 0.45 * wLum);                  // the grain shows a little through the paint
    #ifdef W_DECKWEAR
    if (wKind > 1.2) {
      // Sun-baked coat flaking away along the grain: worst to the north, on the walked path and by the door.
      vec3 wLc = vWxL / 0.3048;
      float wB = wLc.x / 0.46, wId = floor(wB);
      float wBoard = texture2D(uNoise, vec2(wId * 0.173, 0.37)).r;
      float wNorth = smoothstep(-3.0, 8.0, wLc.x);
      float wPath = exp(-wxSq((wLc.z - 10.8) / 2.3)) * smoothstep(0.0, 4.0, wLc.x);
      float wDoor = exp(-(wxSq((wLc.x - 4.3) / 3.0) + wxSq((wLc.z - 9.3) / 2.0)));
      float wW = clamp(0.26 + 0.56 * wNorth + 0.3 * wPath + 0.28 * wDoor + (wBoard - 0.5) * 0.5 + smoothstep(13.0, 13.6, wLc.x) * 0.2, 0.0, 1.0);
      float wFlk = clamp((texture2D(uNoise, vec2(wB * 0.11 + wId * 0.31, wLc.z * 0.09)).g - 0.5) * 2.6 + 0.5, 0.0, 1.0) * 0.62 + clamp((texture2D(uNoise, vec2(wB * 0.47, wLc.z * 0.31)).b - 0.5) * 2.4 + 0.5, 0.0, 1.0) * 0.38;
      wChip = max(wChip, smoothstep(1.0 - wW - 0.025, 1.0 - wW + 0.04, wFlk));
      wPaint = mix(wPaint * vec3(0.8), wPaint * vec3(1.15, 1.08, 1.05), smoothstep(0.3, 0.8, wBig.g * 0.55 + wBoard * 0.45));
    }
    #endif
    #ifdef USE_MAP
    if (wKind < 1.2 && wPainted > 0.5) {
      // Baked coat lifting in long flakes along the grain.
      float wG1 = texture2D(uNoise, vec2(vMapUv.x * 0.55, vMapUv.y * 7.0)).g, wG2 = texture2D(uNoise, vec2(vMapUv.x * 1.7, vMapUv.y * 19.0)).b;
      wChip = max(wChip, smoothstep(0.6, 0.64, wG1 * 0.7 + wG2 * 0.3 + (wBig.r - 0.5) * 0.25 + max(wN.y, 0.0) * 0.06));
    }
    #endif
    wPaintVis = wPainted * (1.0 - wChip);
    diffuseColor.rgb = mix(wWood, wPaint, wPaintVis);
  #else
    float wPainted = 0.0;
  #endif
  // worn bare edges: the grey, sun-baked surface rubbed through to lighter, fresher fibres
  wBare = wWear * (1.0 - wPaintVis);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.4 + vec3(0.02, 0.014, 0.006), wBare);
  // SUN-BLEACH on the logs: silver-grey streaks running along each log (noise stretched 8 to 1 along the wall), more of
  // them on the upper courses and on the walls facing the sun
  float wBl = 0.0;
  if (wIsLog > 0.5 && uBleach > 0.0) {
    float wAl = dot(wP.xz, vec2(-wN.z, wN.x));
    float wBn = texture2D(uNoise, vec2(wAl * 0.18, wP.y * 1.45)).g * 0.7 + texture2D(uNoise, vec2(wAl * 0.5, wP.y * 4.0)).b * 0.3;
    float wSunny = clamp(dot(wN, -uShadeDir) * 0.5 + 0.5, 0.0, 1.0);
    wBl = smoothstep(0.56, 0.7, wBn + 0.1 * smoothstep(0.8, 3.0, wP.y) + 0.06 * wSunny) * uBleach;
    float wL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(wL) * vec3(1.08, 0.99, 0.86) * 1.4 + vec3(0.02, 0.016, 0.01), wBl);
  }

  // ── GRIME ─ rain runs off the roof edge and down the wall (streaks), splashes mud up from the ground (splash), and
  // dirt gathers where the air is still (the tucked-in corners: low AO)
  float wBelow = wTop - wP.y;                                              // metres under the drip edge
  float wVert = 1.0 - abs(wN.y);                                           // 1 on walls, 0 on floors and roofs
  float wAlong = dot(wP.xz, vec2(-wN.z, wN.x));                            // across the wall, metres
  float wCol = texture2D(uNoise, vec2(wAlong * uStreakScale * 0.31, 0.53)).r;       // each column's own run length
  float wSN = texture2D(uNoise, vec2(wAlong * uStreakScale, wP.y * 0.05)).g;       // noise stretched tall: streaks
  float wFade = 1.0 - wBelow / max(uStreakLen * (0.25 + 1.5 * (wCol - 0.25)), 0.01);
  float wCols = smoothstep(0.5 - uGrimeSoft, 0.5 + uGrimeSoft, (wSN - 0.5) * 2.6 + 0.5 + (wFade - 0.5) * 0.5);   // fbm sits near 0.5: stretch it
  wStreak = max(wCols * smoothstep(0.0, 0.3, wFade), smoothstep(0.85, 1.0, wFade) * 0.6) * step(0.0, wFade) * step(-0.02, wBelow);
  wStreak *= wVert * wVert * uGrimeAmt;
  float wSplT = 1.0 - wP.y / max(uSplashH, 0.01);
  wSplash = smoothstep(0.5 - uGrimeSoft, 0.5 + uGrimeSoft, wSplT * 0.95 + (wFine.b - 0.5) * 1.2 + (wBig.g - 0.5) * 0.8) * uGrimeAmt * (1.0 - 0.5 * max(wN.y, 0.0));
  wDirt = clamp(uCornerDirt * smoothstep(0.12, 0.6, 1.0 - wAO) * (0.45 + wBig.b) * step(0.001, uGrimeAmt), 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(1.0), uGrimeColor * 2.2, clamp(wStreak + wDirt * 0.8, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, uMudColor * (0.55 + 1.6 * wLum), wSplash * 0.85);
  // the shade under an eave: the top 40-odd cm of a wall below the roof edge over it (a noisy lower line)
  float wEave = (1.0 - smoothstep(0.0, 0.6 + 0.15 * wFine.g, wBelow)) * step(-0.03, wBelow) * wVert * wVert;
  diffuseColor.rgb *= 1.0 - uEaveDark * wEave;
  // the stain fades unevenly: a darker, slightly purple band through the middle of the wall, redder near the ground and in the gable, broken into soft patches
  if (uWallBand > 0.0 && wLum < 0.35) {
    float wBandE = (wBig.g - 0.5) * 0.9 + (wFine.g - 0.5) * 0.25;
    float wBand = smoothstep(1.3, 2.5, wP.y + wBandE) * (1.0 - smoothstep(3.2, 4.4, wP.y + wBandE)) * smoothstep(0.1, 0.55, wBig.r + 0.15) * wVert * wVert;
    diffuseColor.rgb *= mix(vec3(1.0 + 0.1 * uWallBand), vec3(1.0 - 1.15 * uWallBand, 1.0 - 1.2 * uWallBand, 1.0 - 0.85 * uWallBand), wBand);
  }
  // the dirt band: the bottom 40-odd cm of everything standing on the ground (walls, piers, posts, barrels) darker and
  // browner from splashed mud and damp, fading upward through noise
  float wLowD = (1.0 - smoothstep(0.2, 0.85 + 0.4 * (wFine.g - 0.5), wP.y)) * (1.0 - 0.6 * max(wN.y, 0.0));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.44, 0.37), wLowD * uDirtBand);

  // the bevelled edges darken whatever is on top (as a real rounded edge would, turned away from the light)
  diffuseColor.rgb *= 1.0 - uEdgeDark * wRim;
  diffuseColor.rgb *= 1.0 - wSetBack;
  #ifdef W_BOX
  if (wShakeE > 0.0) {
    // A ROOF SHAKE: the next course up lies over it from wShakeE above its butt; just below that line, the course's
    // shadow, dark at the line and fading out over 9 cm (the dark band that makes a roof read as rows); and at the butt
    // a ragged dark lip
    float wFromButt = vHalf.z - vLocalTop.z;
    // (higher up, under the course, seen only through a gap, it eases off: a gap shows shadow, not a black hole)
    float wRow = smoothstep(wShakeE - 0.09, wShakeE - 0.005, wFromButt) * (1.0 - 0.45 * smoothstep(wShakeE + 0.03, wShakeE + 0.15, wFromButt));
    float wLip = 1.0 - smoothstep(0.0, 0.01 + 0.025 * wFine.b, wFromButt);
    diffuseColor.rgb *= (1.0 - 0.7 * wRow) * (1.0 - 0.4 * wLip);
  }
  #endif

  
#ifdef W_KIND
  #if W_KIND==2
    #ifdef USE_MAP
      // each pan between two seams differs a little from its neighbours (8 pans to a tile)
      diffuseColor.rgb*=.95+.1*texture2D(uNoise,vec2(floor(vMapUv.x*8.)*.211,.71)).r;
    #endif
    float wSunF=clamp(dot(wN,normalize(vec3(-.7,.45,.45))),0.,1.);
    #ifdef USE_MAP
      // on the slope turned from the light a seam stops catching it: pale lines fade toward the steel, as in the frames
      diffuseColor.rgb=mix(diffuse*.34,diffuseColor.rgb,.45+.55*smoothstep(.1,.6,wSunF));
    #endif
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.07,.057,.042),.07*smoothstep(.5,.8,wFine.g));
  #elif W_KIND==1
    // long unbroken courses: each differs slightly in tone, with no butt joints along it
    float wCo=floor(wP.y/uWxBoard);
    diffuseColor.rgb*=.9+.2*texture2D(uNoise,vec2(wCo*.137,.3)).r;
  #elif W_KIND==5
    diffuseColor.rgb*=.8+.4*texture2D(uNoise,vec2(floor(wAlong/.203)*.137,.3)).r;
  #else
    diffuseColor.rgb*=.86+.28*wBig.g;
    if(wN.y>.5)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.216,.16),(.32*smoothstep(.35,.7,wBig.b)+.1*wFine.g)*smoothstep(.03,.2,wLum));
  #endif
#endif

wPaintVisO=wPaintVis;wBareO=wBare;wStreakO=wStreak;wRimHO=wRimH;
}
`;
const FRAG_ROUGH=`
roughnessFactor=mix(roughnessFactor,.92,wPaintVisO*.8);
roughnessFactor=mix(roughnessFactor,.55,wBareO*.6);
`;
const FRAG_NORMAL=`
normal=normalize(mix(normal,nonPerturbedNormal,wPaintVisO*.7));
{vec3 wdx=dFdx(-vViewPosition),wdy=dFdy(-vViewPosition);float whx=dFdx(wRimHO),why=dFdy(wRimHO);
vec3 wr1=cross(wdy,normal),wr2=cross(normal,wdx);float wdet=dot(wdx,wr1);
normal=normalize(abs(wdet)*normal-sign(wdet)*(whx*wr1+why*wr2));}
`;
const col=(THREE,h)=>new THREE.Color(h);
const LOOKS={
 house:{uFixedTop:4.72,uGrimeAmt:.45,uWallBand:.4},garage:{uFixedTop:5.6,uGrimeAmt:.22,uStreakLen:1.2},cabin:{uFixedTop:4.05,uGrimeAmt:.55},shed:{uFixedTop:2.85,uGrimeAmt:.6}};
const KIND={plain:0,hsiding:1,roof:2,roofV:2,vboard:5};
function patch(THREE,m,type,o){
  const T=sharedTextures(THREE),box=!!o.box,defs={...(m.defines||{})};
  if(box){defs.W_BOX='';defs.W_BEVEL='';defs.W_DECKWEAR='';}
  else defs.W_KIND=KIND[o.kind||'plain'];
  m.defines=defs;
  const look=LOOKS[type]||{};
  const u={uNoise:{value:T.noise},uWxOn:amount,uPatchScale:{value:1/5.6},uGrimeAmt:{value:box?.7:look.uGrimeAmt},uStreakLen:{value:look.uStreakLen??2.2},uStreakScale:{value:14/8},uSplashH:{value:.5},uGrimeSoft:{value:.2},uEdgeAmt:{value:box?1:0},uEdgeWidth:{value:.014},uEdgeBreak:{value:.75},uPaintChip:{value:o.chip??.75},uEdgeDark:{value:.5},uEdgeDarkW:{value:.03},uBevel:{value:.6},uLogRound:{value:.55},uEaveDark:{value:.15},uWallBand:{value:box?0:look.uWallBand??0},uBleach:{value:.5},uDirtBand:{value:box?.5:.45},uCornerDirt:{value:0},uFixedTop:{value:look.uFixedTop??4},uWxBoard:{value:o.board??.2},uWxPanelV:{value:o.kind==='roofV'?1:0},uGrimeColor:{value:col(THREE,'#5e574d')},uMudColor:{value:col(THREE,'#5a4430')},uShadeDir:{value:new THREE.Vector3(0,0,-1)}};
  const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=function(s,r){previous.call(this,s,r);Object.assign(s.uniforms,u);
    s.vertexShader=VERT_PARS+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+VERT_MAIN);
    let f=FRAG_PARS+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+FRAG_COLOUR);
    if(box)f=f.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+FRAG_ROUGH).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+FRAG_NORMAL);
    s.fragmentShader=f;};
  m.customProgramCacheKey=()=>key+'-wx2-'+(box?'box':o.kind||'plain');m.needsUpdate=true;
}
export function weatherBuilding(THREE,group,type){
  const done=new Set();
  group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(done.has(m)||m.transparent||m.userData.wxDone)continue;done.add(m);m.userData.wxDone=true;patch(THREE,m,type,m.userData.wx||{});}});
}
export function setWeatherQuality(level){amount.value=level>=1?1:0;}
