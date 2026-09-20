import laspy, numpy as np, struct, glob, time, sys
t0=time.time()
# scene center (property pin) in UTM 12N, from the DEM tiepoint
CX,CY = 505268.232, 5005946.540
HALF = 750.6
C = 1.5                                   # grid cell (m)
Xmin, Ymin = CX-HALF, CY-HALF
W = int(2*HALF/C)+2; H = W
OFF = 15000
gmin = np.full(H*W, 32767, np.int16)      # ground min (dm, offset)
cmax = np.full(H*W, -32768, np.int16)     # canopy max
tiles = sorted(glob.glob('/tmp/laz/*.laz'))
print("tiles:", len(tiles), "grid", W, "x", H, flush=True)
for ti,p in enumerate(tiles):
    n=0
    with laspy.open(p) as f:
        for pts in f.chunk_iterator(150000):
            x=np.asarray(pts.x); y=np.asarray(pts.y); z=np.asarray(pts.z)
            cl=np.asarray(pts.classification)
            ix=((x-Xmin)/C).astype(np.int32); iy=((y-Ymin)/C).astype(np.int32)
            m=(ix>=0)&(ix<W)&(iy>=0)&(iy<H)&(cl!=7)
            if not m.any(): continue
            idx=iy[m]*W+ix[m]
            zd=np.clip((z[m]*10).astype(np.int32)-OFF,-32768,32767).astype(np.int16)
            np.maximum.at(cmax, idx, zd)          # canopy = max return
            cg=cl[m]==2
            if cg.any(): np.minimum.at(gmin, idx[cg], zd[cg])
            n+=int(m.sum())
            del x,y,z,cl,ix,iy,m,idx,zd,cg
    print(f"  tile {ti+1}/{len(tiles)} {p.split('/')[-1][-12:]}  pts~{n:,}  {time.time()-t0:.0f}s", flush=True)
# to 2D
gmin=gmin.reshape(H,W); cmax=cmax.reshape(H,W)
# coarse ground baseline (min over 10-cell blocks), hole-filled, upsampled
B=10; Hc=H//B; Wc=W//B
gb=gmin[:Hc*B,:Wc*B].reshape(Hc,B,Wc,B).min(axis=(1,3)).astype(np.float32)
gb[gb>=32000]=np.nan
# fill nan blocks by column/row propagation (simple)
from numpy import isnan
med=np.nanmedian(gb)
gb[isnan(gb)]=med
gU=np.repeat(np.repeat(gb,B,0),B,1)
gU=np.pad(gU,((0,H-gU.shape[0]),(0,W-gU.shape[1])),mode='edge')
groundm=(gU+OFF)/10.0                        # meters
canopym=np.where(cmax>-32000,(cmax.astype(np.float32)+OFF)/10.0,-999.0)
HAG=canopym-groundm
HAG[canopym<-900]=-999
print("HAG>2.5 cells:", int((HAG>2.5).sum()), f"{time.time()-t0:.0f}s", flush=True)
# local maxima (canopy max) in 3x3
cm=cmax.astype(np.int32)
ismax=(HAG>2.5)
for dy in(-1,0,1):
    for dx in(-1,0,1):
        if dx==0 and dy==0: continue
        sh=np.full_like(cm,-2**30)
        ys=slice(max(0,dy),H+min(0,dy)); yd=slice(max(0,-dy),H+min(0,-dy))
        xs=slice(max(0,dx),W+min(0,dx)); xd=slice(max(0,-dx),W+min(0,-dx))
        sh[yd,xd]=cm[ys,xs]
        ismax &= cm>=sh
        del sh
ys,xs=np.where(ismax)
hh=HAG[ys,xs]
order=np.argsort(-hh)
print("peak candidates:", len(order), f"{time.time()-t0:.0f}s", flush=True)
# NMS at min spacing (m)
SP=2.5; cell=SP
grid={}
keep=[]
for oi in order:
    gx,gy=xs[oi],ys[oi]
    wx=Xmin+gx*C; wy=Ymin+gy*C
    cx=int(wx//cell); cy=int(wy//cell); ok=True
    for ddx in(-1,0,1):
        for ddy in(-1,0,1):
            for (px,py) in grid.get((cx+ddx,cy+ddy),()):
                if (px-wx)**2+(py-wy)**2 < SP*SP: ok=False;break
            if not ok:break
        if not ok:break
    if ok:
        grid.setdefault((cx,cy),[]).append((wx,wy))
        E=wx-CX; N=wy-CY; keep.append((E,-N,float(hh[oi])))   # x,z(=-N),height
print("trees kept:", len(keep), f"{time.time()-t0:.0f}s", flush=True)
with open('/var/www/html/terrain/trees.bin','wb') as f:
    for x,z,h in keep: f.write(struct.pack('<fff',x,z,h))
print("wrote trees.bin (x,z,h triples):", len(keep)*12, "bytes", flush=True)
