# Builds seamless foliage tiles from real crown crops: shading removed by dividing out a blur, colour and fine grain kept, mirrored so the edges meet.
# Run with OpenCV: python tools/make_crown_tiles.py <crops dir> <output dir>
import cv2,sys,numpy as np
src,out=sys.argv[1:3]
def tile(name,x0,y0,x1,y1,dst):
    a=cv2.imread(f'{src}/{name}').astype(np.float32)[y0:y1,x0:x1];print(name,a.mean((0,1)).round())
    flat=a/np.maximum(cv2.GaussianBlur(a,(0,0),min(a.shape[:2])/6),1)*a.mean((0,1))
    t=np.vstack([np.hstack([flat,flat[:,::-1]]),np.hstack([flat[::-1],flat[::-1,::-1]])])
    cv2.imwrite(f'{out}/{dst}',np.clip(cv2.resize(t,(512,512),interpolation=cv2.INTER_CUBIC),0,255),[cv2.IMWRITE_JPEG_QUALITY,88])
tile('juniper_L0011.jpg',200,210,420,400,'juniper-crown.jpg')
tile('fir_L0074.jpg',200,130,370,350,'fir-crown.jpg')
