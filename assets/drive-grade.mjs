// The drive's ground, graded smooth. The survey ground under the two-track carries 10-25 cm humps a metre or two long (sd 4 cm
// along the centre line), and in low sun they read as a lumpy road; the real gravel is smooth. Along the measured line the height
// is refitted as a level-plus-cross-slope section every half metre, smoothed along the drive (about 3 m for the level, 6 m for the
// cross slope), and blended back into the survey over 2.2-4.5 m from the centre line and over the last 6 m at each end.
// Pure: edits a height grid in place (row j at z=-half+j*px, column i at x=-half+i*px), before anything samples it.
export function gradeDrive(data,W,px,line,{full=2.2,edge=4.5,sigma=3,slopeSigma=6,endFade=6}={}){
  const half=(W-1)*px/2,src=Float32Array.from(data);
  const at=(x,z)=>{const i=(x+half)/px,j=(z+half)/px;if(i<0||j<0||i>W-2||j>W-2)return NaN;const i0=Math.floor(i),j0=Math.floor(j),fx=i-i0,fy=j-j0,k=j0*W+i0;
    return (src[k]*(1-fx)+src[k+1]*fx)*(1-fy)+(src[k+W]*(1-fx)+src[k+W+1]*fx)*fy;};
  // resample the line every half metre
  const P=[];
  {let s=0,carry=0;for(let n=1;n<line.length;n++){const a=line[n-1],b=line[n],L=Math.hypot(b.x-a.x,b.z-a.z);if(!L)continue;
    for(let t=carry;t<=L;t+=.5)P.push({x:a.x+(b.x-a.x)*t/L,z:a.z+(b.z-a.z)*t/L,s:s+t,tx:(b.x-a.x)/L,tz:(b.z-a.z)/L});
    const used=Math.floor((L-carry)/.5)*.5+carry;carry=used+.5-L;s+=L;}}
  const N=P.length;if(N<8)return 0;
  // a level and a cross slope for each section, fitted to the survey across the drive
  const lev=new Float64Array(N),slo=new Float64Array(N),ok=new Uint8Array(N);
  for(let k=0;k<N;k++){const p=P[k],nx=-p.tz,nz=p.tx;let sw=0,so=0,sh=0,soo=0,soh=0;
    for(let o=-2.5;o<=2.5001;o+=.5){const h=at(p.x+nx*o,p.z+nz*o);if(!Number.isFinite(h))continue;sw++;so+=o;sh+=h;soo+=o*o;soh+=o*h;}
    if(sw<5)continue;const d=sw*soo-so*so;slo[k]=d?(sw*soh-so*sh)/d:0;lev[k]=(sh-slo[k]*so)/sw;ok[k]=1;}
  const blur=(v,sg)=>{const r=Math.ceil(sg*2*3),out=new Float64Array(N);for(let k=0;k<N;k++){let w=0,a=0;for(let q=Math.max(0,k-r);q<=Math.min(N-1,k+r);q++){if(!ok[q])continue;const g=Math.exp(-.5*((q-k)*.5/sg)**2);w+=g;a+=g*v[q];}out[k]=w?a/w:v[k];}return out;};
  const L2=blur(lev,sigma),S2=blur(slo,slopeSigma),sEnd=P[N-1].s;
  // each grid vertex near the line takes its nearest section's fitted height
  const best=new Float32Array(W*W).fill(1e9),tgt=new Float32Array(W*W);
  for(let k=1;k<N;k++){const a=P[k-1],b=P[k],dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);if(!L)continue;
    const i0=Math.max(0,Math.floor((Math.min(a.x,b.x)-edge+half)/px)),i1=Math.min(W-1,Math.ceil((Math.max(a.x,b.x)+edge+half)/px));
    const j0=Math.max(0,Math.floor((Math.min(a.z,b.z)-edge+half)/px)),j1=Math.min(W-1,Math.ceil((Math.max(a.z,b.z)+edge+half)/px));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=-half+i*px,z=-half+j*px,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(L*L)));
      const ex=x-a.x-dx*t,ez=z-a.z-dz*t,d=Math.hypot(ex,ez),g=j*W+i;if(d>=edge||d>=best[g])continue;best[g]=d;
      const off=(ex*-dz+ez*dx)/L,s=a.s+t*L,lv=L2[k-1]+(L2[k]-L2[k-1])*t,sl=S2[k-1]+(S2[k]-S2[k-1])*t;
      const across=1-smooth(full,edge,d),ends=smooth(0,endFade,s)*smooth(0,endFade,sEnd-s);tgt[g]=(lv+sl*off-src[g])*across*ends;}}
  let moved=0;for(let g=0;g<W*W;g++)if(best[g]<edge&&tgt[g]){data[g]=src[g]+tgt[g];moved++;}
  return moved;
}
function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
