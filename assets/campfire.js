// The fire in the fire pit: one of yomotsu's volumetric flames (assets/fire, as in jconra.com's Fire Lab) over the logs,
// with a soft warm glow on the ground round the ring. The flame is re-sliced for the camera every frame, so it only runs
// while the camera is near enough to see it; from further away it is hidden and costs nothing.
import * as THREE from 'three';
import VolumetricFire from './fire/VolumetricFire.js';

const NEAR = 110;                              // metres: beyond this the flame is a few pixels and not worth slicing

export function createCampfire({ scene, camera, heightAt, at }) {
  VolumetricFire.texturePath = new URL('./fire/', import.meta.url).href;
  const y = heightAt(at.x, at.z);
  // built at the lab's own size (its buffers are sized from it) and scaled down to a fire-pit flame about 1.8 m tall
  const fire = new VolumetricFire(3, 6, 3, 0.5, camera);
  fire.mesh.scale.setScalar(0.3);
  fire.mesh.position.set(at.x, y + 0.1 + 3 * 0.3, at.z);
  fire.mesh.frustumCulled = false;             // its geometry is rebuilt every frame; the bounds would go stale
  fire.mesh.renderOrder = 3;
  fire.mesh.name = 'campfire-flame';
  scene.add(fire.mesh);

  // the glow: an additive disc on the ground, brightest in the ring, flickering with the flame
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,170,70,.75)'); r.addColorStop(.35, 'rgba(255,120,40,.32)'); r.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6).rotateX(-Math.PI / 2), glowMat);
  glow.position.set(at.x, y + 0.06, at.z); glow.renderOrder = 2; glow.name = 'campfire-glow';
  scene.add(glow);

  const t0 = performance.now() / 1000, _d = new THREE.Vector3();
  return {
    fire, glow,
    update(cam) {
      const near = _d.copy(fire.mesh.position).sub(cam.position).length() < NEAR;
      fire.mesh.visible = glow.visible = near;
      if (!near) return;
      const t = performance.now() / 1000 - t0;
      fire.update(t);
      glowMat.opacity = 0.75 + 0.18 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1) + 0.07 * Math.sin(t * 17);
    },
  };
}
