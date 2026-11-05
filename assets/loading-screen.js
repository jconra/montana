// Loading screen: the campfire in front of the cabin at sunset, built from SVG pieces that grow into place as the page loads
// (sky, mountains, forest, cabin, then the fire pit, the chairs and the flowers), with grass growing along the bottom as the
// progress bar. Each piece is its own outer <svg>, and every moving part is a transform or opacity transition/animation, which
// the browser runs off the main thread: the fire keeps flickering and pieces keep growing while the 3D scene is being built.
// The page reports progress with montanaLoading.at(0..1, label) and finishes with montanaLoading.done().
// Stage: a 1600 x 900 picture that covers the window from the bottom (--u is one stage unit), fire at its centre.
(function(){
'use strict';
let seed=20261104;const R=()=>(seed=(seed*16807)%2147483647)/2147483647,rr=(a,b)=>a+(b-a)*R();
const f=n=>Math.round(n*10)/10,U=n=>`calc(var(--u)*${f(n)})`;
// Tree and treeline silhouettes from the math-games South Park scene (same author). The tree's snow patches, which lie on its
// layers of branches, are drawn here as those branches in sunlight.
const TREE='M53 0C48 9 48 23 48 29L44 37 48 43C42 46 40 49 38 54L38 57 36 60 34 69 38 66 40 71 38 74 40 74 38 83 36 86 34 91 29 97 27 97 27 103 25 106 27 106 25 109 29 111 17 129 19 131 17 134 21 134 17 140 17 143 21 143 13 151 15 154 11 157 4 169 4 180 0 189 4 191 8 191 6 197 11 197 13 194 15 197 13 200 23 197 27 200 29 197 34 200 36 194 38 197 44 197 46 200 48 200 50 197 50 194 55 194 55 197 59 200 61 197 65 197 67 197 69 200 71 191 76 191 76 197 80 191 82 194 86 191 88 197 92 191 97 191 97 186 99 183 97 177 97 171 90 157 92 154 95 157 95 153 95 150 90 146 86 137 86 134 82 130 86 130 86 127 84 121 80 120 76 111 74 106 76 104 76 101 78 100 76 97 74 97 76 91 74 93 69 89 65 86 65 80 63 73 63 70 65 74 67 70 69 71 67 66 65 60 63 57 63 53 57 47 57 40 59 40 59 37 61 37 57 30 59 29 57 24 57 21C53 14 50 9 53 0Z';
const TREE_LAYERS='<path d="M 55 37 L 57 40 C 57 43 57 43 59 46 L 63 51 L 63 57 L 59 54 L 55 54 L 55 60 C 55 66 53 66 53 60 C 50 63 46 63 48 59 C 42 63 46 54 44 51 C 42 57 40 57 38 54 L 40 49 L 42 46 L 46 40 C 48 34 53 37 55 37"/><path d="M 48 89 C 50 97 42 100 40 91 C 40 100 36 100 29 97 L 34 90 L 36 84 L 38 81 L 40 74 L 42 73 L 44 77 L 46 73 L 46 79 L 48 76 L 50 81 L 53 77 L 55 80 L 57 74 L 59 77 L 59 74 L 63 74 L 65 79 L 65 86 L 71 91 C 69 94 67 97 63 90 C 61 111 59 100 57 93 L 55 94 L 53 91 L 50 91"/><path d="M 59 120 C 63 137 71 131 69 117 C 76 131 76 126 78 120 L 82 121 L 84 120 L 76 111 L 74 106 L 74 103 L 71 104 L 69 100 L 67 104 L 67 101 L 61 99 L 59 99 C 59 106 55 109 53 110 L 50 107 L 46 116 L 44 114 L 44 109 L 40 111 L 40 114 L 38 111 L 36 116 L 36 111 L 34 110 L 34 106 L 29 109 L 29 111 L 19 124 C 23 131 25 129 27 123 C 27 129 29 126 32 123 C 29 143 38 131 40 126 C 40 131 44 129 46 126 C 48 140 55 121 59 120"/><path d="M 38 151 C 36 166 42 163 44 143 C 46 149 48 151 48 144 C 50 149 50 149 53 146 C 55 151 55 151 59 147 C 61 157 65 154 69 149 C 69 154 71 151 71 149 C 74 151 74 151 76 149 C 76 151 80 154 78 147 C 80 149 82 154 82 144 C 86 151 90 149 92 144 L 86 137 L 82 139 L 76 130 L 69 126 L 67 131 L 74 136 L 74 140 L 69 141 L 67 136 L 67 139 L 65 136 L 65 139 L 63 136 L 61 133 L 59 136 L 57 130 L 57 129 L 53 133 L 55 124 L 42 123 L 46 133 L 42 133 L 42 140 L 40 137 L 40 140 L 38 137 L 36 141 L 36 140 L 34 143 L 32 137 L 34 131 L 32 127 L 25 133 L 25 136 L 23 133 L 21 134 L 17 139 L 21 143 L 15 149 L 15 153 L 19 149 C 19 160 23 154 27 149 C 23 169 29 157 34 150 C 34 160 36 151 38 151"/><path d="M 53 169 C 59 183 65 186 65 174 C 67 186 69 177 69 174 C 71 189 74 180 74 174 C 76 177 78 174 78 171 C 80 177 84 180 88 174 C 90 191 90 171 92 169 L 97 171 L 90 157 L 90 161 L 88 159 L 82 157 L 82 161 L 80 164 L 78 159 L 76 163 L 74 159 L 74 163 L 71 157 C 67 163 63 163 67 149 L 61 150 C 65 157 63 163 61 163 L 61 160 L 59 161 L 57 156 L 55 163 L 53 159 C 53 166 48 169 44 164 L 42 169 L 42 164 C 38 169 38 169 36 161 L 34 164 L 32 167 L 32 163 L 29 164 L 27 160 L 25 161 L 23 167 L 21 160 L 19 164 L 19 163 L 15 164 L 15 161 L 13 163 L 13 160 L 11 159 L 4 169 L 4 179 L 6 179 L 8 174 C 8 183 11 180 13 174 C 13 189 17 186 17 177 C 17 197 21 183 21 179 C 23 186 25 183 27 176 L 29 176 C 29 191 38 183 38 177 L 38 180 L 40 177 C 44 191 48 177 48 171 C 50 180 53 174 55 171"/>';
const LINE='M92 200L11 200 19 40 21 190 25 120 26 190 29 140 31 180 34 50 37 170 40 90 43 150 48 80 50 150 54 30 59 160 65 70 69 160 72 90 75 150 81 0 83 150 87 70Z';
const FLAME='M50 0C55 30 72 52 80 82C91 122 92 152 80 176C72 192 61 200 50 200C38 200 24 193 17 178C6 155 10 127 23 103C29 92 35 85 37 68C43 82 45 92 47 97C49 70 44 38 50 0Z';

const CSS=`
#loader{position:fixed;inset:0;z-index:90;overflow:hidden;background:#07070b;--sw:max(100vw,177.78vh);--u:calc(var(--sw)/1600);transition:opacity .9s ease;-webkit-user-select:none;user-select:none}
#loader.ld-out{opacity:0;pointer-events:none}
#loader .ld-stage{position:absolute;left:50%;bottom:0;width:var(--sw);height:calc(var(--sw)*.5625);transform:translateX(-50%)}
#loader .ld-far{position:absolute;inset:0;filter:blur(1.3px)}
#loader .ld-p,#loader .ld-d{position:absolute;overflow:visible;opacity:0;transition:transform .9s cubic-bezier(.2,1.3,.4,1),opacity .5s ease}
#loader .ld-on{opacity:1!important;transform:none!important}
#loader .ld-grow{transform-origin:50% 100%;transform:scaleY(0)}
#loader .ld-rise{transform:translateY(calc(var(--u)*150));transition:transform 1.5s cubic-bezier(.2,.8,.3,1),opacity 1s ease}
#loader .ld-pop{transform-origin:50% 85%;transform:scale(0);transition:transform .75s cubic-bezier(.3,1.6,.5,1),opacity .3s ease}
#loader .ld-fade{transition:opacity 1.1s ease}
#loader .ld-drop{transform:translateY(calc(var(--u)*-110));transition:transform .85s cubic-bezier(.3,1.45,.5,1),opacity .4s ease}
#loader .ld-slide{transform:translateX(calc(var(--u)*-70));transition:transform 2.6s cubic-bezier(.2,.7,.3,1),opacity 1.8s ease}
#loader .ld-bloom{transform-origin:50% 100%;transform:scale(0);transition:transform 1s cubic-bezier(.3,1.5,.5,1),opacity .4s ease}
#loader .ld-ignite{transform-origin:50% 100%;transform:scale(.04);transition:transform 1.7s cubic-bezier(.3,1.25,.5,1),opacity .6s ease}
#loader .ld-clouds,#loader .ld-skyfill{position:absolute;inset:0;opacity:0;transition:opacity 1.6s ease}
#loader .ld-sk{position:absolute;overflow:visible;fill:none;stroke:#f3efe6;stroke-linecap:round;stroke-linejoin:round;transition:opacity 1s ease}
#loader .ld-sk.ld-gone{opacity:0}
#loader .ld-gsk{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:#f3efe6;stroke-linecap:round;transition:opacity 1.2s ease}
#loader .ld-cloud{position:absolute;overflow:visible;animation:ldDrift var(--t) linear var(--d) infinite both}
#loader .ld-grows{position:absolute;inset:0;opacity:0;transition:transform 1.5s cubic-bezier(.3,1.2,.5,1),opacity .9s ease}
#loader .ld-fire{position:absolute;inset:0;transform-origin:50% 78%;animation:ldSurge 4.7s ease-in-out infinite}
#loader .ld-glow{position:absolute;inset:0;animation:ldGlow 4.7s ease-in-out infinite}
#loader .ld-glow>*{animation:ldFlick .19s steps(2,jump-none) infinite alternate}
#loader .ld-fl{position:absolute;transform-origin:50% 100%;animation:ldFlame var(--t) ease-in-out var(--d) infinite alternate}
#loader .ld-fl svg{display:block;width:100%;height:100%}
#loader .ld-fl.m,#loader .ld-fl.c{mix-blend-mode:screen}
#loader .ld-sp{position:absolute;width:calc(var(--s)*var(--u));height:calc(var(--s)*var(--u));border-radius:50%;background:#ffe6a6;box-shadow:0 0 calc(var(--u)*6) calc(var(--u)*2) #ff9a3c;opacity:0;animation:ldSpark var(--t) ease-out var(--d) infinite}
#loader .ld-smoke{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(214,200,222,.2),rgba(214,200,222,0));opacity:0;animation:ldSmoke var(--t) linear var(--d) infinite}
#loader .ld-grass{position:absolute;left:0;right:0;bottom:0;height:calc(var(--u)*118);pointer-events:none}
#loader .ld-gc{position:absolute;bottom:0;height:100%;transform-origin:50% 100%;transform:scaleY(.04);transition:transform 1s cubic-bezier(.22,1.45,.45,1)}
#loader .ld-gc.ld-on{transform:scaleY(var(--s))!important}
#loader .ld-gc svg{display:block;width:100%;height:100%;transform-origin:50% 100%;animation:ldSway var(--t) ease-in-out var(--d) infinite alternate}
#loader .ld-fore{position:absolute;left:50%;bottom:0;width:var(--sw);height:calc(var(--sw)*.5625);transform:translateX(-50%);pointer-events:none}
#loader .ld-text{position:absolute;left:0;right:0;top:max(16px,5vh);text-align:center;font:600 clamp(18px,2.5vw,30px)/1.2 Georgia,'Times New Roman',serif;color:#fff3e4;letter-spacing:.05em;text-shadow:0 2px 14px rgba(60,20,70,.75)}
#loader .ld-text small{display:block;margin-top:7px;font:500 clamp(12px,1.3vw,15px)/1.3 system-ui,sans-serif;letter-spacing:.04em;color:#ffe2cf;opacity:.9}
#loader .ld-text .ld-err{color:#ffd0c8}
@keyframes ldFlame{0%{transform:scale(1,1) skewX(0)}30%{transform:scale(.9,1.09) skewX(3.5deg)}55%{transform:scale(1.06,.9) skewX(-2deg)}80%{transform:scale(.95,1.14) skewX(2.5deg)}100%{transform:scale(1.02,.96) skewX(-3deg)}}
@keyframes ldSurge{0%,100%{transform:scale(1)}14%{transform:scale(1.07)}27%{transform:scale(.94)}46%{transform:scale(1.15)}60%{transform:scale(1.01)}74%{transform:scale(1.09)}88%{transform:scale(.96)}}
@keyframes ldGlow{0%,100%{opacity:.62}14%{opacity:.8}27%{opacity:.5}46%{opacity:1}60%{opacity:.66}74%{opacity:.85}88%{opacity:.55}}
@keyframes ldFlick{from{opacity:.84}to{opacity:1}}
@keyframes ldSpark{0%{transform:translate(0,0) scale(1);opacity:0}7%{opacity:1}45%{transform:translate(calc(var(--dx)*var(--u)*-.35),calc(var(--dy)*var(--u)*.45)) scale(.8)}70%{opacity:.9}100%{transform:translate(calc(var(--dx)*var(--u)),calc(var(--dy)*var(--u))) scale(.25);opacity:0}}
@keyframes ldSmoke{0%{transform:translate(0,0) scale(.5);opacity:0}25%{opacity:1}100%{transform:translate(calc(var(--dx)*var(--u)),calc(var(--u)*-300)) scale(1.7);opacity:0}}
@keyframes ldDrift{from{transform:translateX(calc(var(--a)*var(--u)))}to{transform:translateX(calc(var(--b)*var(--u)))}}
@keyframes ldSway{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}
@media (prefers-reduced-motion:reduce){#loader *{transition-duration:.01s!important}#loader .ld-fl,#loader .ld-fire,#loader .ld-glow,#loader .ld-glow>*,#loader .ld-gc svg{animation:none}#loader .ld-sp,#loader .ld-smoke{display:none}#loader .ld-cloud{animation:none}}
`;

// ---- drawing helpers (stage coordinates) ----
const pieces=[];   // {at, html} in drawing order, per layer
const layers={sun:'',sky:'',far:'',near:'',fore:'',sunSk:'',skySk:'',farSk:'',nearSk:'',foreSk:''};let pk=0;
// One growing piece: an outer svg sized to its own box, so it can be moved and scaled on its own.
// sk: the same thing as a child's chalk drawing, shown on the black screen until the coloured piece takes over.
function piece(layer,kind,at,[x,y,w,h],inner,sk){const k=pk++;layers[layer]+=`<svg class="ld-p ld-${kind}" data-at="${at.toFixed(3)}" data-k="${k}" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" style="left:${U(x)};top:${U(y)};width:${U(w)};height:${U(h)}" aria-hidden="true">${inner}</svg>`;
  if(sk)sketch(layer,null,[x,y,w,h],sk,k);}
function sketch(layer,at,[x,y,w,h],inner,k=''){const m=24;layers[layer+'Sk']+=`<svg class="ld-sk" ${at==null?'':`data-at="${at.toFixed(3)}"`} data-sk="${k}" viewBox="${f(x-m)} ${f(y-m)} ${f(w+2*m)} ${f(h+2*m)}" style="left:${U(x-m)};top:${U(y-m)};width:${U(w+2*m)};height:${U(h+2*m)}" aria-hidden="true">${inner}</svg>`;}
// a child's chalk line through the points: long runs broken up and wobbled, smoothed, and gone over twice
function chalk(P,closed=false,w=2.8){const dense=[];const n=P.length;
  for(let i=0;i<(closed?n:n-1);i++){const a=P[i],b=P[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=Math.max(1,Math.round(L/26));for(let j=0;j<m;j++)dense.push([a[0]+(b[0]-a[0])*j/m,a[1]+(b[1]-a[1])*j/m]);}
  if(!closed)dense.push(P[n-1]);
  const pass=(j,wd,op)=>{const Q=dense.map(([x,y],i)=>i===0&&!closed?[x+rr(-1,1),y+rr(-1,1)]:[x+rr(-j,j),y+rr(-j,j)]);return `<path d="${closed?blob(Q):open(Q)}" stroke-width="${f(wd)}"${op<1?` opacity="${op}"`:''}/>`;};
  return pass(1.8,w,1)+pass(2.6,w*.5,.5);}
function open(P){if(P.length<3)return 'M'+P.map(p=>f(p[0])+' '+f(p[1])).join('L');let d=`M${f(P[0][0])} ${f(P[0][1])}`;
  for(let i=0;i<P.length-1;i++){const a=P[Math.max(0,i-1)],b=P[i],c=P[i+1],e=P[Math.min(P.length-1,i+2)];d+=`C${f(b[0]+(c[0]-a[0])/6)} ${f(b[1]+(c[1]-a[1])/6)} ${f(c[0]-(e[0]-b[0])/6)} ${f(c[1]-(e[1]-b[1])/6)} ${f(c[0])} ${f(c[1])}`;}return d;}
const circleP=(cx,cy,rx,ry=rx,n=12)=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*6.283)*rx*rr(.92,1.06),cy+Math.sin(i/n*6.283)*ry*rr(.92,1.06)]);
// a child's pine: a zigzag of three tiers on a stubby trunk
function kidPine(cx,by,h){const w=h/2;return chalk([[cx-w*.46,by-h*.12],[cx-w*.16,by-h*.38],[cx-w*.36,by-h*.4],[cx-w*.1,by-h*.66],[cx-w*.24,by-h*.68],[cx,by-h],[cx+w*.24,by-h*.68],[cx+w*.1,by-h*.66],[cx+w*.36,by-h*.4],[cx+w*.16,by-h*.38],[cx+w*.46,by-h*.12]],true)+chalk([[cx-w*.07,by-h*.12],[cx-w*.07,by],[cx+w*.07,by],[cx+w*.07,by-h*.12]]);}
// closed smooth curve through points (Catmull-Rom as cubic Beziers)
function blob(P){let d=`M${f(P[0][0])} ${f(P[0][1])}`;const n=P.length;for(let i=0;i<n;i++){const a=P[(i-1+n)%n],b=P[i],c=P[(i+1)%n],e=P[(i+2)%n];
  d+=`C${f(b[0]+(c[0]-a[0])/6)} ${f(b[1]+(c[1]-a[1])/6)} ${f(c[0]-(e[0]-b[0])/6)} ${f(c[1]-(e[1]-b[1])/6)} ${f(c[0])} ${f(c[1])}`;}return d+'Z';}
const poly=P=>'M'+P.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z';
// a conifer: a warm rim of sunset light on its west edge, the dark tree, its branch layers lit, and their sunniest tops
function tree(cx,by,h,lit,dark){const s=h/200,x=cx-50*s,y=by-h;return `<g transform="translate(${f(x)} ${f(y)}) scale(${(s).toFixed(4)})"><use href="#ldTree" fill="#f0a04a" transform="translate(-2.2 -1)"/><use href="#ldTree" fill="${dark}"/><use href="#ldTreeLayers" fill="${lit}"/><use href="#ldTreeLayers" fill="#c9b048" opacity=".55" transform="translate(-1.2 -1.2) scale(.985)"/></g>`;}

// ---- shared paints ----
const DEFS=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<path id="ldTree" d="${TREE}"/><g id="ldTreeLayers">${TREE_LAYERS}</g><path id="ldLine" d="${LINE}"/><symbol id="ldFlameS" viewBox="0 0 100 200" preserveAspectRatio="none"><path d="${FLAME}"/></symbol>
<linearGradient id="ldSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a9c"/><stop offset=".2" stop-color="#7d47a6"/><stop offset=".38" stop-color="#c44f86"/><stop offset=".5" stop-color="#ec6360"/><stop offset=".6" stop-color="#f88a45"/><stop offset=".7" stop-color="#ffb44e"/></linearGradient>
<radialGradient id="ldSunGlow"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc062" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a50" stop-opacity="0"/></radialGradient>
<linearGradient id="ldLitFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".55" stop-color="#e2704f"/><stop offset="1" stop-color="#a5506a"/></linearGradient>
<linearGradient id="ldShadeFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c4f8e"/><stop offset="1" stop-color="#4e3a6e"/></linearGradient>
<linearGradient id="ldHills" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a86"/><stop offset="1" stop-color="#3d3f5c"/></linearGradient>
<linearGradient id="ldMeadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7a338"/><stop offset=".18" stop-color="#7f9330"/><stop offset=".55" stop-color="#557a27"/><stop offset="1" stop-color="#34521d"/></linearGradient>
<radialGradient id="ldDirt"><stop offset="0" stop-color="#7a5232"/><stop offset=".7" stop-color="#5e4128" stop-opacity=".85"/><stop offset="1" stop-color="#5e4128" stop-opacity="0"/></radialGradient>
<linearGradient id="ldStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7bf9b"/><stop offset=".55" stop-color="#a68a6c"/><stop offset="1" stop-color="#6e5a48"/></linearGradient>
<linearGradient id="ldLitLow" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#ff9a3c" stop-opacity="0"/><stop offset="1" stop-color="#ffab48" stop-opacity=".95"/></linearGradient>
<linearGradient id="ldLitTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb24c" stop-opacity=".9"/><stop offset=".5" stop-color="#ff9a3c" stop-opacity="0"/></linearGradient>
<radialGradient id="ldEmber"><stop offset="0" stop-color="#fff0a0"/><stop offset=".35" stop-color="#ffab3a"/><stop offset=".75" stop-color="#d4421a"/><stop offset="1" stop-color="#7a1e0a" stop-opacity="0"/></radialGradient>
<radialGradient id="ldGround"><stop offset="0" stop-color="#ffa04a" stop-opacity=".7"/><stop offset=".55" stop-color="#ff8a3a" stop-opacity=".25"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>
<radialGradient id="ldWarm"><stop offset="0" stop-color="#ffd27f" stop-opacity=".85"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient>
<linearGradient id="ldWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset="1" stop-color="#ffaa3a"/></linearGradient>
<linearGradient id="ldFlO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4a1a" stop-opacity="0"/><stop offset=".22" stop-color="#ff5a1f" stop-opacity=".75"/><stop offset=".6" stop-color="#ff7d1a"/><stop offset="1" stop-color="#ffa63a"/></linearGradient>
<linearGradient id="ldFlM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a1f" stop-opacity="0"/><stop offset=".3" stop-color="#ffab2b" stop-opacity=".9"/><stop offset="1" stop-color="#ffd650"/></linearGradient>
<linearGradient id="ldFlC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0" stop-opacity="0"/><stop offset=".35" stop-color="#ffec8f" stop-opacity=".95"/><stop offset="1" stop-color="#fffbe8"/></linearGradient>
</defs></svg>`;

// ---- sky, sun, clouds (far) ----
const SKY=`<svg class="ld-sky" viewBox="0 0 1600 900" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><rect width="1600" height="900" fill="url(#ldSky)"/></svg>`;
piece('sun','pop',.07,[245,40,360,360],`<circle cx="425" cy="220" r="175" fill="url(#ldSunGlow)"/><circle cx="425" cy="220" r="46" fill="#ffe27a"/><circle cx="420" cy="214" r="34" fill="#fff2b4" opacity=".7"/>`,
  chalk(circleP(425,220,46),true)+Array.from({length:12},(_,i)=>{const a=i/12*6.283+.1;return chalk([[425+Math.cos(a)*62,220+Math.sin(a)*62],[425+Math.cos(a)*rr(84,96),220+Math.sin(a)*rr(84,96)]],false,2.4);}).join(''));
// two child's clouds, gone once the sky has filled in
for(const [cx,cy,s] of [[250,120,1],[1180,150,.85]])sketch('sky',.24,[cx-110*s,cy-50*s,220*s,90*s],chalk([[-100,30],[-92,0],[-60,-14],[-40,-40],[0,-48],[30,-30],[62,-38],[94,-10],[104,30]].map(([x,y])=>[cx+x*s,cy+y*s]).concat([[cx-100*s,cy+30*s]]),false));
// streaks of sunset cloud: a dark underside, the body, a bright lower lip toward the sun
function cloud(cx,cy,len,th,body,lip,under){const n=Math.max(3,Math.round(len/55)),top=[],bot=[];
  for(let i=0;i<=n;i++){const x=cx-len/2+len*i/n,e=Math.sin(Math.PI*i/n);top.push([x,cy-th*(.35+.65*e)*rr(.7,1.15)]);bot.push([x,cy+th*.35*e*rr(.6,1)]);}
  const P=top.concat(bot.reverse()),shift=(dx,dy,k)=>P.map(([x,y])=>[cx+(x-cx)*k+dx,cy+(y-cy)*k+dy]);
  return `<path d="${blob(shift(4,-th*.25,1))}" fill="${under}" opacity=".85"/><path d="${blob(P)}" fill="${body}"/><path d="${blob(shift(-len*.04,th*.3,.78))}" fill="${lip}" opacity=".9"/>`;}
const CLOUDS=[[300,95,330,26,0],[620,60,420,22,1],[980,110,380,28,0],[1340,70,420,24,1],[180,190,280,20,2],[760,170,360,22,2],[1180,200,300,18,2],[1500,165,260,18,0],[520,250,240,15,2]];
const CPAL=[['#ff5d84','#ff9a7a','#8b4a9e'],['#f0507e','#ff8a6a','#7a3f96'],['#ff7a4c','#ffb862','#b0507e']];
CLOUDS.forEach(([cx,cy,len,th,k],i)=>{const [b,l,u]=CPAL[k],x=cx-len/2-20,y=cy-th*1.8-10,w=len+60,h=th*3.2+20,speed=rr(48,78)*(cy<150?.8:1),a=-(x+w)-30,bb=1630-x,t=(bb-a)/speed;
  // where it starts along its crossing: two are partway across already, the rest blow in one after another
  const d=i<2?-t*rr(.35,.6):i*2.2-3;
  layers.sky+=`<svg class="ld-cloud" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" style="left:${U(x)};top:${U(y)};width:${U(w)};height:${U(h)};--a:${f(a)};--b:${f(bb)};--t:${t.toFixed(1)}s;--d:${d.toFixed(1)}s" aria-hidden="true">${cloud(cx,cy,len,th,b,l,u)}</svg>`;});

// ---- mountains: the west faces in alpenglow, the east faces in purple shade, patches of old snow high up ----
function mountain(at,box,lit,shade,snowLit,snowShade,kid){const [a,pk2,b]=kid,zz=[];for(let i=0;i<=8;i++){const t=i/8,y=pk2[1]+(Math.min(a[1],b[1])-pk2[1])*(i%2?.3:.2);zz.push([pk2[0]+(a[0]-pk2[0])*(.24-.04*(i%2))*(1-t)*1.2+(b[0]-pk2[0])*(.24-.04*(i%2))*t*1.2,y]);}
  piece('far','rise',at,box,`<path d="${poly(shade)}" fill="url(#ldShadeFace)"/><path d="${poly(lit)}" fill="url(#ldLitFace)"/>${snowShade.map(s=>`<path d="${poly(s)}" fill="#c8b6de" opacity=".85"/>`).join('')}${snowLit.map(s=>`<path d="${poly(s)}" fill="#ffe1d4" opacity=".92"/>`).join('')}`,chalk(kid)+chalk(zz,false,2.4));}
mountain(.03,[60,190,560,260],
  [[60,430],[150,380],[230,330],[290,292],[324,215],[332,262],[312,300],[330,340],[300,400],[318,440]],
  [[324,215],[360,250],[420,290],[480,330],[560,370],[600,420],[600,440],[318,440],[300,400],[330,340],[312,300],[332,262]],
  [[[324,215],[310,240],[300,262],[314,252],[318,272],[332,262]]],[[[324,215],[332,262],[346,268],[350,246],[360,250]]],[[70,430],[324,215],[600,430]]);
mountain(.05,[420,110,700,330],
  [[430,430],[540,330],[620,270],[700,200],[760,150],[813,120],[822,170],[800,230],[822,290],[790,360],[808,430]],
  [[813,120],[870,160],[930,190],[990,220],[1052,239],[1100,300],[1100,430],[808,430],[790,360],[822,290],[800,230],[822,170]],
  [[[813,120],[790,150],[768,180],[790,168],[782,200],[806,180],[810,210],[822,170]],[[748,190],[728,212],[756,204]]],
  [[[813,120],[822,170],[842,190],[852,165],[875,175],[870,160]],[[900,182],[915,205],[930,190]]],[[430,430],[813,120],[1100,430]]);
mountain(.07,[1000,70,600,370],
  [[1010,430],[1052,239],[1120,200],[1190,160],[1260,130],[1330,100],[1387,84],[1396,140],[1370,200],[1392,260],[1356,330],[1376,430]],
  [[1387,84],[1440,120],[1500,150],[1560,175],[1600,190],[1600,430],[1376,430],[1356,330],[1392,260],[1370,200],[1396,140]],
  [[[1387,84],[1360,112],[1335,136],[1362,130],[1350,162],[1378,146],[1384,176],[1396,140]],[[1300,138],[1278,160],[1310,152]],[[1240,168],[1224,186],[1252,178]]],
  [[[1387,84],[1396,140],[1418,160],[1428,134],[1452,146],[1440,120]],[[1480,160],[1496,184],[1508,165]]],[[1010,430],[1387,84],[1640,330]]);
piece('far','rise',.09,[0,300,1600,140],`<path d="M0 360C120 330 230 345 340 335C470 322 560 350 690 340C820 330 930 352 1060 344C1200 336 1320 350 1450 338C1520 332 1570 338 1600 335L1600 440 0 440Z" fill="url(#ldHills)"/>`);

// ---- meadow, then the forest growing on it in waves ----
piece('far','fade',.11,[0,500,1600,400],`<path d="M0 548C260 536 520 552 800 544C1080 536 1340 550 1600 540L1600 900 0 900Z" fill="url(#ldMeadow)"/><path d="M0 560C300 552 560 566 800 560C1060 554 1320 566 1600 558L1600 590C1300 600 1000 588 800 594C540 600 260 588 0 596Z" fill="#c7b048" opacity=".35"/>`,chalk([[0,548],[260,538],[520,550],[800,544],[1080,537],[1340,549],[1600,540]]));
// back rows: jagged treelines, hazier the further away
for(const [row,base,hMin,hMax,col,at0] of [[0,470,120,190,'#3e4a5e',.12],[1,515,150,230,'#2a4636',.16]]){
  for(let g=0;g<4;g++){let inner='';const x0=g*400-40,x1=x0+480;for(let x=x0;x<x1;x+=rr(40,70)){const h=rr(hMin,hMax),w=h*rr(.5,.7);inner+=`<use href="#ldLine" fill="${col}" transform="translate(${f(x)} ${f(base-h)}) scale(${(w/100).toFixed(3)} ${(h/200).toFixed(3)})"/>`;}
    piece('far','grow',at0+g*.012,[x0,base-hMax-10,x1-x0+80,hMax+14],inner);}
}
// the forest behind the cabin: single trees, lit gold on the sunset side
const TPAL=[['#6f8a33','#1f3b27'],['#7a8f38','#22402a'],['#66832f','#1c3524'],['#80913a','#253f2b']];
const forest=[];for(let x=-20;x<1640;x+=rr(42,66))forest.push([x+rr(-8,8),rr(528,548),rr(190,300)]);
forest.sort((a,b)=>a[1]-b[1]).forEach(([x,by,h],i)=>{const [l,d]=TPAL[i%4],w=h/2;piece('far','grow',.19+.17*(x+20)/1660,[x-w/2-4,by-h-4,w+8,h+8],tree(x,by,h,l,d),i%3===0&&(x<660||x>1390)?kidPine(x,by,h*.9):'');});

// ---- the cabin, after the reference painting: on stilts, the main roof's gable out over the porch on two braced posts (hollow
// underneath, its boards running back), a little porch roof on the left slanting up to the cabin, window between the posts, door and lantern beside,
// the long side to the right (no window), stairs down the right. Every horizontal edge is level.
{const wood='#c98a42',woodLit='#e3aa5c',woodDk='#8a5a2e',post='#9a6a38',roof='#857fa3',roofLit='#a9a3c4',roofDk='#5f5a80',board='rgba(120,74,34,.35)',trim='#7d4f2a';
 const A=[966,196],L=[842,300],Rr=[1090,300],B=[1236,196],E=[1360,300];   // gable apex and eaves, the ridge's back end, the back eave
 // stilts and the shade under the deck
 const SX=[717,837,956,1081,1167];
 piece('far','grow',.3,[690,455,670,105],`<path d="M700 470H1350V548H700Z" fill="#2a2018" opacity=".55"/>${SX.map(x=>`<rect x="${x-6}" y="466" width="12" height="86" fill="${post}"/><rect x="${x-6}" y="466" width="4" height="86" fill="${woodLit}" opacity=".45"/>`).join('')}<path d="M760 548C800 538 840 548 860 552H700Z" fill="#6e6458"/>`,SX.map(x=>chalk([[x,468],[x,552]],false,2.4)).join(''));
 // the deck
 piece('far','grow',.33,[696,446,490,26],`<rect x="700" y="456" width="480" height="12" fill="${woodDk}"/><rect x="700" y="452" width="480" height="5" fill="${woodLit}"/>${[740,820,900,980,1060,1140].map(x=>`<circle cx="${x}" cy="462" r="2.2" fill="#5a3a20"/>`).join('')}`,chalk([[700,454],[1180,454],[1180,468],[700,468]],true,2.4));
 // walls: the front under the porch, the long side to the right; window, door, lantern
 let boards='';for(let x=895;x<1177;x+=9)boards+=`M${x} 300V456`;for(let x=1183;x<1350;x+=10)boards+=`M${x} 300V464`;
 piece('far','grow',.36,[880,290,480,180],`<path d="M889 300H1177V456H889Z" fill="#b97f3e"/><path d="M1177 300H1350V464H1177Z" fill="${wood}"/><path d="${boards}" stroke="${board}" stroke-width="2"/>
  <path d="M889 300H1177V318H889Z" fill="#000" opacity=".16"/>
  <rect x="948" y="330" width="84" height="76" fill="#5a3a24"/><rect x="954" y="336" width="72" height="64" fill="url(#ldWin)"/><path d="M990 336V400M954 368H1026" stroke="#6a4428" stroke-width="4"/><path d="M956 338Q968 368 960 398M1024 338Q1012 368 1020 398" stroke="#ffeec2" stroke-width="5" fill="none" opacity=".55"/>
  <rect x="928" y="328" width="18" height="80" fill="#7a4a2a"/><rect x="1034" y="328" width="18" height="80" fill="#7a4a2a"/><path d="M932 340H942M932 352H942M932 364H942M932 376H942M932 388H942M1038 340H1048M1038 352H1048M1038 364H1048M1038 376H1048M1038 388H1048" stroke="#5a341c" stroke-width="2"/>
  <rect x="1078" y="326" width="48" height="130" fill="#4e3a2e"/><rect x="1082" y="330" width="40" height="126" fill="#5e4a3c"/><rect x="1090" y="338" width="24" height="30" fill="#8a7a6a"/><circle cx="1116" cy="398" r="3" fill="#e8c070"/>
  <circle cx="1146" cy="344" r="38" fill="url(#ldWarm)"/><rect x="1139" y="334" width="14" height="21" rx="3" fill="#ffd77a" stroke="#3a2a1a" stroke-width="2.5"/>
  <circle cx="990" cy="368" r="74" fill="url(#ldWarm)" opacity=".55"/>`,
  chalk([[889,300],[1177,300],[1177,456],[889,456]],true)+chalk([[1177,300],[1350,300],[1350,464],[1177,464]],true)+chalk([[954,336],[1026,336],[1026,400],[954,400]],true)+chalk([[990,336],[990,400]],false,2.2)+chalk([[954,368],[1026,368]],false,2.2)+chalk([[1082,456],[1082,330],[1122,330],[1122,456]]));
 // roof: the metal slope back to the right, the little porch roof on the left, then the gable out over the porch: rake trim,
 // the hollow beneath (its boards running back at 45 degrees), the header beam
 const IA=[A[0],A[1]+10],IL=[L[0]+8,L[1]-2],IR=[Rr[0]-8,Rr[1]-2];
 // Inside the gable the front wall runs on up under the roof; only the band along the left rake, between the gable's front
 // edge and the wall set back behind it, shows the roof's underside.
 const SH=889-L[0],soffit=[L,A,[A[0]+SH,A[1]],[889,300]];
 let gb='';for(let x=IL[0]-140;x<IR[0];x+=13)gb+=`M${f(x)} ${f(IL[1]+2)}l160 -160`;
 let wb='';for(let x=895;x<IR[0];x+=9)wb+=`M${x} ${A[1]}V300`;
 piece('far','drop',.39,[670,180,705,170],`<path d="${poly([A,B,E,Rr])}" fill="${roof}"/><path d="${poly([A,B,[B[0]+9,B[1]+8],[A[0]+8,A[1]+8]])}" fill="${roofLit}"/>
  <path d="M${Array.from({length:12},(_,i)=>{const t=(i+.6)/12.2;return `${f(A[0]+(B[0]-A[0])*t)} ${f(A[1]+(B[1]-A[1])*t)}L${f(Rr[0]+(E[0]-Rr[0])*t)} ${f(Rr[1]+(E[1]-Rr[1])*t)}`;}).join('M')}" stroke="${roofDk}" stroke-width="2" opacity=".55"/>
  <path d="M${f(E[0])} ${E[1]}H${f(Rr[0])}V${E[1]+7}H${f(E[0])}Z" fill="${trim}"/>
  <path d="M684 330L846 304V316L690 342Z" fill="${roof}"/><path d="M684 330L846 304V308L685 334Z" fill="${roofLit}"/><path d="M690 342L846 316V324L690 350Z" fill="${trim}"/>
  <clipPath id="ldGable"><path d="${poly([IA,IL,IR])}"/></clipPath><clipPath id="ldSoffit"><path d="${poly(soffit)}"/></clipPath>
  <g clip-path="url(#ldGable)"><path d="${poly([IA,IL,IR])}" fill="#b97f3e"/><path d="${wb}" stroke="${board}" stroke-width="2"/>
   <path d="${poly([[889,300],[A[0]+SH,A[1]],[A[0]+SH+22,A[1]],[911,300]])}" fill="#000" opacity=".14"/>
   <g clip-path="url(#ldSoffit)"><path d="${poly(soffit)}" fill="#6a4428"/><path d="${gb}" stroke="#3e2614" stroke-width="2.2" opacity=".75"/></g></g>
  <path d="M${L[0]+2} ${L[1]-4}H${Rr[0]-2}V${L[1]+8}H${L[0]+2}Z" fill="${trim}"/><path d="M${L[0]+2} ${L[1]-4}H${Rr[0]-2}V${L[1]-1}H${L[0]+2}Z" fill="${woodLit}" opacity=".6"/>
  <path d="${poly([[A[0],A[1]-10],[L[0]-14,L[1]+2],[L[0]+6,L[1]+4],[A[0],A[1]+12],[Rr[0]-6,Rr[1]+4],[Rr[0]+14,Rr[1]+2]])}" fill="${trim}"/><path d="${poly([[A[0],A[1]-10],[L[0]-14,L[1]+2],[L[0]-8,L[1]+4],[A[0],A[1]-4]])}" fill="${woodLit}" opacity=".7"/>`,
  chalk([[L[0]-12,L[1]+2],A,[Rr[0]+12,Rr[1]+2]])+chalk([A,B,E,Rr])+chalk([[889,300],[A[0]+SH,A[1]+4]],false,2.2)+chalk([[684,332],[846,306]])+chalk([[L[0],L[1]+3],[Rr[0],Rr[1]+3]]));
 // posts (the two under the gable braced at the top) and the rail
 const P2=[[707,345],[803,330],[846,308],[1066,308]];
 let rail=`<path d="${P2.map(([x,y])=>`M${x} ${y}V456`).join('')}" stroke="${post}" stroke-width="12"/><path d="${P2.map(([x,y])=>`M${x-3} ${y}V456`).join('')}" stroke="${woodLit}" stroke-width="4" opacity=".5"/>
  <path d="M846 336L872 310M1066 336L1040 310" stroke="${post}" stroke-width="7" stroke-linecap="round"/>`;
 for(let x=712;x<1176;x+=11)rail+=`<rect x="${x}" y="412" width="4.5" height="42" fill="${woodDk}"/>`;
 rail+=`<rect x="704" y="404" width="474" height="9" fill="${woodLit}"/><rect x="704" y="448" width="474" height="5" fill="${woodDk}"/><path d="M1177 398V456" stroke="${post}" stroke-width="10"/>`;
 {let k=chalk([[704,408],[1178,408]])+P2.map(([x,y])=>chalk([[x,y],[x,456]])).join('');for(let x=730;x<1176;x+=26)k+=chalk([[x,410],[x,452]],false,2);piece('far','grow',.42,[695,300,495,160],rail,k);}
 // stairs to a pad on the ground
 let st=`<path d="M1177 464L1368 575 1352 580 1166 470Z" fill="${woodDk}"/>`;for(let i=0;i<9;i++){const x=1184+i*20.5,y=470+i*11.5;st+=`<rect x="${f(x)}" y="${f(y)}" width="34" height="6" fill="${woodLit}"/>`;}
 st+=`<path d="M1177 404L1366 520" stroke="${woodLit}" stroke-width="7"/><path d="M1366 520V575" stroke="${post}" stroke-width="9"/>`;for(let i=1;i<9;i++){const x=1177+i*21,y=404+i*12.8;st+=`<rect x="${f(x)}" y="${f(y)}" width="4" height="${f(60-i*.4)}" fill="${woodDk}"/>`;}
 st+=`<path d="M1300 576H1440L1452 592H1290Z" fill="#b9b0a2"/>`;
 {const z=[[1177,464]];for(let i=0;i<9;i++){const x=1177+i*21.2,y=464+i*12.3;z.push([x+21.2,y],[x+21.2,y+12.3]);}piece('far','grow',.44,[1160,396,300,202],st,chalk(z,false,2.4)+chalk([[1177,404],[1366,520]]));}
 // a small tree in front of the cabin
 piece('near','grow',.45,[916,380,110,186],tree(972,562,176,'#86a03c','#21412a'),kidPine(972,562,166));
}
// tall framing trees at the sides, nearer than the forest
[[40,640,600],[150,600,470],[1480,630,540],[1585,650,640]].forEach(([x,by,h],i)=>{const w=h/2;piece('near','grow',.4+i*.018,[x-w/2-6,by-h-6,w+12,h+40],`<rect x="${x-h*.018}" y="${by-h*.1}" width="${h*.036}" height="${h*.12}" fill="#4a3020"/>`+tree(x,by,h,i%2?'#738c35':'#6a8632','#1d3624'),kidPine(x,by,h*.95));});

// ---- the fire pit: dirt ring, stones, logs, embers; chairs round it ----
const FX=800,FY=716,lit=[];   // fire centre (ring centre); lit: shapes the firelight falls on
piece('near','fade',.48,[520,620,560,200],`<ellipse cx="${FX}" cy="${FY+14}" rx="260" ry="92" fill="url(#ldDirt)"/>`);
const stones=[];for(let i=0;i<13;i++){const a=i/13*Math.PI*2+.12,sx=FX+Math.cos(a)*192,sy=FY+Math.sin(a)*62,front=Math.sin(a)>-.05,k=.72+.28*(Math.sin(a)+1)/2,w=rr(84,98)*k,h=rr(56,66)*k;
  const P=[];for(let j=0;j<8;j++){const b=j/8*Math.PI*2,q=rr(.86,1.08);P.push([sx+Math.cos(b)*w/2*q*(Math.abs(Math.cos(b))>.6?1:.96),sy-h*.42+Math.sin(b)*h/2*q]);}
  stones.push({a,sx,sy,front,d:blob(P),w,h});}
stones.sort((p,q)=>p.sy-q.sy);
const stone=s=>`<path d="${s.d}" fill="url(#ldStone)" stroke="#5a4636" stroke-width="2.5"/><path d="M${f(s.sx-s.w*.25)} ${f(s.sy-s.h*.62)}q${f(s.w*.2)} ${f(-s.h*.12)} ${f(s.w*.42)} 0" stroke="#efdcbf" stroke-width="3" fill="none" opacity=".55"/>`;
// Adirondack chair, three-quarter view facing +x: parts as 3D points (x forward, y up, z away) drawn oblique.
function chair(cx,by,s,flip,[main,light,dark,deep]){
  const P=(x,y,z)=>[f(cx+(flip?-1:1)*(x+.42*z-30)*s),f(by-(y+.3*z)*s)],Q=pts=>'M'+pts.map(p=>P(...p).join(' ')).join('L')+'Z';
  let g='',l='';
  const ol=`stroke="${deep}" stroke-width="${f(.9*s)}" stroke-linejoin="round"`;
  const box=(x0,x1,y0,y1,z0,z1,top,front,side)=>{g+=`<path d="${Q([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]])}" fill="${top}" ${ol}/><path d="${Q([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]])}" fill="${front}" ${ol}/><path d="${Q([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]])}" fill="${side}" ${ol}/>`;};
  box(46,54,0,62,56,62,dark,dark,deep);box(-6,64,60,64,48,68,light,dark,dark);                  // far front leg, far arm
  for(let k=0;k<5;k++){const z0=5+k*10.4,z1=z0+9.6,t=112+9*Math.sin(Math.PI*(k+.5)/5);         // back slats, leaning back, rounded tops
    g+=`<path d="${Q([[2,30,z0],[2,30,z1],[-34,t-4,z1],[-37,t,(z0+z1)/2],[-34,t-4,z0]])}" fill="${k%2?main:light}" ${ol}/>`;}
  g+=`<path d="${Q([[0,30,0],[52,38,0],[52,38,60],[0,30,60]])}" fill="${dark}"/>`;
  for(let k=0;k<5;k++){const x=4+k*10;g+=`<path d="${Q([[x,30+.15*x,1],[x+9,31+.15*x,1],[x+9,31+.15*x,59],[x,30+.15*x,59]])}" fill="${main}" ${ol}/>`;}
  box(-22,58,0,10,0,6,main,dark,dark);g+=`<path d="${Q([[-24,0,0],[-16,0,0],[56,36,0],[50,40,0]])}" fill="${dark}"/>`;  // near rail + stringer
  box(46,54,0,62,0,6,main,light,main);box(-8,66,60,65,-8,12,light,main,dark);                  // near front leg, near arm (wide, overhanging)
  l+=`<path d="${Q([[54,0,0],[54,62,0],[54,62,6],[54,0,6]])}" fill="#ffab48" opacity=".75"/><path d="${Q([[66,60,-8],[66,65,-8],[66,65,12],[66,60,12]])}" fill="#ffb24c" opacity=".85"/><path d="${Q([[20,65,-8],[66,65,-8],[66,65,12],[20,65,12]])}" fill="#ffb24c" opacity=".35"/>`;
  return g+l;}
function kidChair(cx,by,s,flip){const P=(x,y,z)=>[cx+(flip?-1:1)*(x+.42*z-30)*s,by-(y+.3*z)*s];
  return chalk([P(2,30,6),P(-34,112,6),P(-37,120,30),P(-34,112,56),P(2,30,56)],true)+chalk([P(0,30,30),P(52,38,30)])+chalk([P(-8,62,0),P(66,62,0)])+chalk([P(50,0,0),P(50,62,0)])+chalk([P(-20,0,0),P(2,30,0)])+chalk([P(50,0,58),P(50,40,58)],false,2.2);}
const PINK=['#ef5f74','#ff8b98','#b8405a','#8e2c44'],TEAL=['#3cb6c6','#78d8e2','#23889a','#18667a'];
// (behind the ring first, then the ring's back stones, the fire, the logs, the front stones, the near chairs)
piece('near','pop',.6,[560,500,200,210],chair(620,700,1.5,false,TEAL),kidChair(620,700,1.5,false));
piece('near','pop',.63,[930,505,210,210],chair(1050,705,1.5,true,PINK),kidChair(1050,705,1.5,true));
const kidStone=s=>chalk(circleP(s.sx,s.sy-s.h*.42,s.w*.46,s.h*.46,9),true,2.4);
stones.filter(s=>!s.front).forEach((s,i)=>{piece('near','pop',.5+i*.006,[s.sx-s.w/2-6,s.sy-s.h-6,s.w+12,s.h+12],stone(s),kidStone(s));lit.push(`<path d="${s.d}" fill="url(#ldLitLow)"/>`);});
layers.near+='%FIRE%';
{let logs='';for(const [x0,y0,x1,y1] of [[730,712,868,676],[872,714,734,674],[790,722,818,664],[756,700,846,704]]){const L=Math.hypot(x1-x0,y1-y0),a=Math.atan2(y1-y0,x1-x0)*180/Math.PI,cx=(x0+x1)/2,cy=(y0+y1)/2;
  logs+=`<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})"><rect x="${f(-L/2)}" y="-11" width="${f(L)}" height="22" rx="10" fill="#5e3a22"/><path d="M${f(-L/2+12)} -4H${f(L/2-16)}M${f(-L/2+20)} 5H${f(L/2-24)}" stroke="#3e2414" stroke-width="2.5"/><ellipse cx="${f(L/2-3)}" cy="0" rx="6" ry="11" fill="#d9a066"/><ellipse cx="${f(L/2-3)}" cy="0" rx="3" ry="6" fill="#b07a42"/></g>`;
  lit.push(`<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})"><rect x="${f(-L/2)}" y="-11" width="${f(L)}" height="9" rx="4" fill="#ff8a3a" opacity=".6"/><ellipse cx="${f(L/2-3)}" cy="0" rx="6" ry="11" fill="#ffb24c" opacity=".8"/></g>`);}
 piece('near','drop',.54,[700,640,200,100],`<ellipse cx="${FX}" cy="${FY-6}" rx="86" ry="18" fill="url(#ldEmber)"/>`+logs,chalk([[734,704],[868,676]],false,3)+chalk([[866,706],[736,676]],false,3));}
sketch('near',.5,[720,540,160,170],chalk([[748,700],[742,640],[766,664],[770,600],[792,640],[800,560],[812,630],[832,596],[836,650],[858,636],[852,700]],true,3));
stones.filter(s=>s.front).forEach((s,i)=>{piece('near','pop',.51+i*.006,[s.sx-s.w/2-6,s.sy-s.h-6,s.w+12,s.h+12],stone(s),kidStone(s));lit.push(`<path d="${s.d}" fill="url(#ldLitTop)"/>`);});
piece('near','pop',.66,[290,520,240,240],chair(440,748,1.85,false,PINK),kidChair(440,748,1.85,false));
piece('near','pop',.69,[1070,525,240,240],chair(1160,752,1.85,true,TEAL),kidChair(1160,752,1.85,true));

// ---- the fire itself: flames, glow, sparks, smoke (lit at the halfway point) ----
let fire='';{const fl=(cls,x,w,h,t,d)=>`<div class="ld-fl ${cls}" style="left:${U(FX+x-w/2)};top:${U(FY-4-h)};width:${U(w)};height:${U(h)};--t:${t}s;--d:${d}s"><svg aria-hidden="true"><use href="#ldFlameS" fill="url(#ldFl${cls.toUpperCase()})"/></svg></div>`;
 for(const [x,w,h] of [[-52,74,130],[-26,88,175],[2,104,215],[30,86,168],[56,70,120]])fire+=fl('o',x,w,h,rr(.8,1.5).toFixed(2),(-rr(0,1.5)).toFixed(2));
 for(const [x,w,h] of [[-32,58,108],[-8,68,150],[16,66,158],[38,54,100]])fire+=fl('m',x,w,h,rr(.65,1.2).toFixed(2),(-rr(0,1.2)).toFixed(2));
 for(const [x,w,h] of [[-14,42,72],[4,48,98],[22,40,70]])fire+=fl('c',x,w,h,rr(.55,1).toFixed(2),(-rr(0,1)).toFixed(2));
 let sparks='';for(let i=0;i<16;i++)sparks+=`<i class="ld-sp" style="left:${U(FX+rr(-40,40))};top:${U(FY-60-rr(0,50))};--s:${rr(3,6.5).toFixed(1)};--dx:${rr(-80,80).toFixed(0)};--dy:${-rr(200,330).toFixed(0)};--t:${rr(1.6,3.2).toFixed(2)}s;--d:${(-rr(0,3)).toFixed(2)}s"></i>`;
 let smoke='';for(let i=0;i<3;i++)smoke+=`<i class="ld-smoke" style="left:${U(FX-70+rr(-20,20))};top:${U(FY-250)};width:${U(140)};height:${U(140)};--dx:${rr(-60,60).toFixed(0)};--t:${rr(6,8).toFixed(1)}s;--d:${(-i*2.4).toFixed(1)}s"></i>`;
 layers.near=layers.near.replace('%FIRE%',`<div class="ld-grows" data-fire="glow"><div class="ld-glow"><svg viewBox="0 0 1600 900" style="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:screen" aria-hidden="true"><ellipse cx="${FX}" cy="${FY-90}" rx="520" ry="330" fill="url(#ldGround)"/></svg></div></div><div class="ld-grows" data-fire="flames" style="transform:scale(.05);transform-origin:${U(FX)} ${U(FY)}"><div class="ld-fire">${fire}</div>${smoke}</div>`);
 layers.fore+=`<div class="ld-grows" data-fire="sparks">${sparks}</div>`;}
// the firelight on everything round the fire, flickering with it
layers.near+=`<div class="ld-grows" data-fire="light"><div class="ld-glow"><svg viewBox="0 0 1600 900" style="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:screen" aria-hidden="true"><ellipse cx="${FX}" cy="${FY+20}" rx="330" ry="110" fill="url(#ldGround)"/>${lit.join('')}</svg></div></div>`;

// ---- foreground: a boulder and summer wildflowers, last of all ----
piece('fore','rise',.72,[0,760,300,150],`<path d="${blob([[10,900],[20,830],[70,790],[150,778],[220,800],[270,850],[280,900]])}" fill="#8e8898"/><path d="${blob([[40,840],[80,800],[150,790],[200,806],[160,820],[90,836]])}" fill="#c9a49e" opacity=".8"/>`,chalk([[14,898],[24,830],[72,792],[150,780],[218,802],[268,852],[278,898]]));
const flower={lupine(x,by,h,c1,c2){let g=`<path d="M${x} ${by}V${by-h}" stroke="#4a6a28" stroke-width="3"/>`;for(let i=0;i<14;i++){const t=i/13,y=by-h*.35-h*.65*t,r=7*(1-t*.6);g+=`<ellipse cx="${f(x-r*.6)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r*.7)}" fill="${i%2?c1:c2}"/><ellipse cx="${f(x+r*.6)}" cy="${f(y-2)}" rx="${f(r)}" ry="${f(r*.7)}" fill="${i%2?c2:c1}"/>`;}
   for(let i=0;i<5;i++){const a=-2.4+i*.45;g+=`<ellipse cx="${f(x+Math.cos(a)*14)}" cy="${f(by-10+Math.sin(a)*8)}" rx="11" ry="3.5" fill="#557a2a" transform="rotate(${f(a*57)} ${f(x+Math.cos(a)*14)} ${f(by-10+Math.sin(a)*8)})"/>`;}return g;},
  brush(x,by,h){let g=`<path d="M${x} ${by}Q${x+4} ${by-h/2} ${x} ${by-h}" stroke="#4a6a28" stroke-width="3" fill="none"/>`;for(let i=0;i<8;i++){const y=by-h+i*7;g+=`<ellipse cx="${f(x+(i%2?5:-5))}" cy="${f(y)}" rx="7" ry="5" fill="${i<3?'#ff6a3a':'#e2402a'}"/>`;}return g;},
  daisy(x,by,h){let g=`<path d="M${x} ${by}V${by-h}" stroke="#4f7a2a" stroke-width="2.5"/>`;for(let i=0;i<9;i++){const a=i/9*Math.PI*2;g+=`<ellipse cx="${f(x+Math.cos(a)*8)}" cy="${f(by-h+Math.sin(a)*5)}" rx="7" ry="3" fill="#fff6e8" transform="rotate(${f(a*57)} ${f(x+Math.cos(a)*8)} ${f(by-h+Math.sin(a)*5)})"/>`;}return g+`<circle cx="${x}" cy="${by-h}" r="4.5" fill="#f2b632"/>`;}};
[['lupine',70,900,150],['lupine',110,905,120],['daisy',230,896,70],['brush',300,900,96],['daisy',560,902,60],['lupine',640,906,110],['daisy',700,898,52],['daisy',930,900,58],['brush',985,904,90],['lupine',1040,906,120],
 ['daisy',1250,898,64],['lupine',1380,904,140],['brush',1440,900,100],['lupine',1500,906,128],['daisy',1560,898,66]].forEach(([k,x,by,h],i)=>{
  const g=k==='lupine'?flower.lupine(x,by,h,i%3?'#8a5ad6':'#6a46c0','#b48cf0'):flower[k](x,by,h);const kid=chalk([[x,by],[x+rr(-3,3),by-h*.55],[x,by-h+8]],false,2.2)+(k==='daisy'?chalk(circleP(x,by-h,10,10,8),true,2.2):k==='lupine'?[0,1,2,3].map(j=>chalk(circleP(x,by-h*.45-j*h*.16,7-j,6-j,7),true,2)).join(''):chalk(circleP(x,by-h+16,9,18,8),true,2.2));
  piece('fore','bloom',.76+i*.014,[x-40,by-h-20,80,h+24],g,kid);});

// ---- assemble ----
const host=document.createElement('div');host.id='loader';host.setAttribute('role','progressbar');host.setAttribute('aria-label','Loading the property');host.setAttribute('aria-valuemin','0');host.setAttribute('aria-valuemax','100');
const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
// grass along the bottom: the progress bar
const N=Math.round(Math.min(64,Math.max(30,innerWidth/26)));let grass='';
for(let i=0;i<N;i++){let b='';for(let j=0;j<9;j++){const x=rr(6,54),lean=rr(-14,14),top=rr(4,40),w=rr(2.6,5),c=['#3f5d1f','#56772a','#6f8f30','#93a43c','#b4ae46'][Math.floor(rr(0,5))];
  b+=`<path d="M${f(x-w)} 100Q${f(x+lean*.35)} ${f((100+top)/2)} ${f(x+lean)} ${f(top)}Q${f(x+lean*.35+w*.4)} ${f((100+top)/2)} ${f(x+w)} 100Z" fill="${c}"/>`;}
  grass+=`<div class="ld-gc" style="left:${(i/N*100-.8).toFixed(2)}%;width:${(100/N*1.9).toFixed(2)}%;--s:${rr(.72,1).toFixed(2)}"><svg viewBox="0 0 60 100" preserveAspectRatio="none" style="--t:${rr(2.4,4).toFixed(2)}s;--d:${(-rr(0,3)).toFixed(2)}s" aria-hidden="true">${b}</svg></div>`;}
let tufts='';for(let x=8;x<1000;x+=rr(16,30)){const h=rr(14,30);tufts+=`<path d="M${f(x-6)} 112L${f(x-3)} ${f(112-h*.7)}M${f(x)} 112L${f(x+rr(-2,2))} ${f(112-h)}M${f(x+6)} 112L${f(x+4)} ${f(112-h*.6)}" stroke-width="1.6"/>`;}
const gsk=`<svg class="ld-gsk" viewBox="0 0 1000 118" preserveAspectRatio="none" aria-hidden="true"><path d="M0 112C160 108 330 114 500 111C670 108 840 114 1000 110" stroke-width="2"/>${tufts}</svg>`;
host.innerHTML=DEFS+`<div class="ld-stage"><div class="ld-skyfill">${SKY}</div>${layers.sun}<div class="ld-clouds">${layers.sky}</div>${layers.sunSk}${layers.skySk}<div class="ld-far">${layers.far}</div>${layers.farSk}${layers.near}${layers.nearSk}</div><div class="ld-grass">${gsk}${grass}</div><div class="ld-fore">${layers.fore}${layers.foreSk}</div><div class="ld-text">Paradise Valley<small>Loading…</small></div>`;
document.body.prepend(host);

// ---- progress ----
const sketches=Object.fromEntries([...host.querySelectorAll('.ld-sk:not([data-at])')].map(el=>[el.dataset.sk,el])),skyFill=host.querySelectorAll('.ld-skyfill,.ld-clouds'),groundSk=host.querySelector('.ld-gsk');
const items=[...host.querySelectorAll('[data-at]')].map(el=>({el,at:+el.dataset.at})).sort((a,b)=>a.at-b.at),clumps=[...host.querySelectorAll('.ld-gc')],small=host.querySelector('.ld-text small'),fireParts=Object.fromEntries([...host.querySelectorAll('[data-fire]')].map(el=>[el.dataset.fire,el]));
let p=0,label='Loading',slot=0,next=0,gone=false;
// (one after another, 60 ms apart, closer together when a jump in progress leaves many waiting)
function show(el){const now=performance.now();slot=Math.max(slot,now);const delay=((slot-now)/1000).toFixed(2)+'s';slot+=slot-now>700?14:60;el.style.transitionDelay=delay;
  if(el.classList.contains('ld-sk')){el.classList.add('ld-gone');return;}el.classList.add('ld-on');const sk=sketches[el.dataset.k];if(sk){sk.style.transitionDelay=delay;sk.classList.add('ld-gone');}}
function render(){while(next<items.length&&items[next].at<=p)show(items[next++].el);clumps.forEach((c,i)=>{if((i+.5)/clumps.length<=p&&!c.classList.contains('ld-on'))c.classList.add('ld-on');});
  if(p>=.5){const t=Math.min(1,(p-.5)/.5),k=.3+.7*Math.pow(t,.85);fireParts.flames.style.opacity='1';fireParts.flames.style.transform=`scale(${k.toFixed(3)})`;
   fireParts.glow.style.opacity=(.3+.7*t).toFixed(2);fireParts.light.style.opacity=p<.58?'0':(.35+.65*t).toFixed(2);fireParts.sparks.style.opacity=(.2+.8*t).toFixed(2);}
  const sky=Math.min(1,p/.4).toFixed(2);skyFill.forEach(el=>el.style.opacity=sky);groundSk.style.opacity=Math.max(0,1-p*1.15).toFixed(2);
  small.textContent=label+' · '+Math.round(p*100)+'%';host.setAttribute('aria-valuenow',String(Math.round(p*100)));}
window.montanaLoading={
  at(v,l){if(gone)return;if(l)label=l;if(v>p)p=Math.min(1,v);render();},
  // finish the picture, then fade into the scene
  // (resolves as the fade begins)
  done(){if(gone)return Promise.resolve();label='Ready';p=1;render();gone=true;const wait=Math.min(1600,Math.max(0,slot-performance.now())+500);
    return new Promise(r=>setTimeout(()=>{host.classList.add('ld-out');window.__loaderGone=true;r();setTimeout(()=>host.remove(),1000);},wait));},
  fail(msg){small.innerHTML='';const e=document.createElement('span');e.className='ld-err';e.textContent=msg;small.append(e);},
  // (for the preview page: start the picture again)
  reset(){p=0;next=0;slot=0;gone=false;host.classList.remove('ld-out');for(const {el} of items){el.classList.remove('ld-on');el.style.transitionDelay='';}clumps.forEach(c=>c.classList.remove('ld-on'));host.querySelectorAll('.ld-sk').forEach(el=>{el.classList.remove('ld-gone');el.style.transitionDelay='';});for(const el of Object.values(fireParts)){el.style.opacity='';el.style.transform=el.dataset.fire==='flames'?'scale(.05)':'';}render();},
};
render();
})();
