// PULSE iso3d · walls that can be cut down to any height (so the iso camera sees into a room) with painted inner faces
import * as THREE from 'three';
import { P } from './world.js';
import { addRect } from './obstacles.js';

// side 'N': wall along x at plan y = f (face towards +y); side 'W': wall along y at plan x = f (face towards +x)
// a..b: span along the wall; openings: [[o0, o1, openingHeight]]; tex: optional painter texture covering u in [a, b], v in [0, H]
export function buildWall({ side, a, b, f, H = 3.0, th = 0.12, material, tex = null, openings = [], parent, texMat = null, eps = 0.004 }) {
  const pieces = [];
  const cuts = [a]; for (const o of openings) cuts.push(o[0], o[1]); cuts.push(b);
  const spans = []; for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 1e-3) spans.push([cuts[i], cuts[i + 1], 0, H]);
  for (const o of openings) if (H > o[2]) spans.push([o[0], o[1], o[2], H]);
  for (const [u0, u1, z0, z1] of spans) {
    const len = u1 - u0, hh = z1 - z0;
    if (z0 === 0) { if (side === 'N') addRect(u0, f - th, u1, f, 'wall'); else addRect(f - th, u0, f, u1, 'wall'); }
    const bg = new THREE.BoxGeometry(side === 'N' ? len : th, hh, side === 'N' ? th : len); bg.translate(0, hh / 2, 0);
    const box = new THREE.Mesh(bg, material); box.castShadow = true; box.receiveShadow = true; box.userData.wall = true;
    if (side === 'N') box.position.copy(P((u0 + u1) / 2, f - th / 2, z0)); else box.position.copy(P(f - th / 2, (u0 + u1) / 2, z0));
    parent.add(box);
    let plane = null;
    if (tex) {
      const pg = new THREE.PlaneGeometry(len, hh); pg.translate(0, hh / 2, 0);
      const uv = pg.attributes.uv; const U0 = (u0 - a) / (b - a), U1 = (u1 - a) / (b - a);
      for (let i = 0; i < uv.count; i++) { const x = uv.getX(i), y = uv.getY(i); uv.setXY(i, U0 + x * (U1 - U0), (z0 + y * hh) / H); }
      plane = new THREE.Mesh(pg, texMat); plane.receiveShadow = true; plane.userData.wall = true;
      if (side === 'N') plane.position.copy(P((u0 + u1) / 2, f + eps, z0));
      else { plane.position.copy(P(f + eps, (u0 + u1) / 2, z0)); plane.rotation.y = Math.PI / 2; plane.scale.x = -1; }
      parent.add(plane);
    }
    pieces.push({ box, plane, z0, z1, hh, U0: (u0 - a) / (b - a), U1: (u1 - a) / (b - a) });
  }
  let cur = H;
  return {
    pieces,
    setHeight(h) {
      if (Math.abs(h - cur) < 1e-3) return; cur = h;
      for (const p of pieces) {
        const vis = Math.max(0, Math.min(h, p.z1) - p.z0); const k = vis / p.hh;
        p.box.visible = vis > 0.005; if (p.box.visible) p.box.scale.y = k;
        if (p.plane) { p.plane.visible = p.box.visible; if (p.plane.visible) { p.plane.scale.y = k; const uv = p.plane.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) { const top = i < 2; if (top) uv.setY(i, (p.z0 + vis) / H); } uv.needsUpdate = true; } }
      }
    }
  };
}
