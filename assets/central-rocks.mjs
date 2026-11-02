// The middle of the property, around and between the buildings. Rocks here get
// the detailed look; rocks further out keep the cheap one. Decided by position so
// the same rock never changes shape as the camera moves.
export const CENTRAL_AREA={x:-14,z:12,radius:46};
export function inCentralArea(x,z){return Math.hypot(x-CENTRAL_AREA.x,z-CENTRAL_AREA.z)<CENTRAL_AREA.radius;}
