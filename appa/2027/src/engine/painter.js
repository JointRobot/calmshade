// PULSE iso3d · canvas textures for walls and floors, drawn in metres with v up (same convention as v01 wall painters)
import * as THREE from 'three';

export function paintTex(wM, hM, ppm, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(wM * ppm)); c.height = Math.max(4, Math.round(hM * ppm));
  const ctx = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const u0 = o.u0 || 0;
  const api = { canvas: c, ctx, tex, ppm, wM, hM, u0,
    paint(fn = draw, ...args) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(ppm, 0, 0, -ppm, -u0 * ppm, hM * ppm); ctx.lineJoin = ctx.lineCap = 'round'; fn(ctx, ...args); tex.needsUpdate = true; } };
  if (draw) api.paint(draw);
  return api;
}
// floor texture in plan coordinates: x right, y down (no flip)
export function floorTex(x0, y0, wM, hM, ppm, draw) {
  const c = document.createElement('canvas'); c.width = Math.round(wM * ppm); c.height = Math.round(hM * ppm);
  const ctx = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const api = { canvas: c, ctx, tex, paint(fn = draw, ...a) { ctx.setTransform(ppm, 0, 0, ppm, -x0 * ppm, -y0 * ppm); fn(ctx, ...a); tex.needsUpdate = true; } };
  if (draw) api.paint(draw); return api;
}
