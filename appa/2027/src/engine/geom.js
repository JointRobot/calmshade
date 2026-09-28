// PULSE iso3d · geometry helpers in plan coordinates (x east, y south, z up)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P } from './world.js';

export function G(style) {
  const bevel = style.bevel;
  const shade = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
  const api = {
    shade,
    box(x0, y0, x1, y1, z0, z1, mat, o = {}) {
      const w = x1 - x0, d = y1 - y0, h = z1 - z0; const r = o.round ?? bevel;
      const g = r > 0 && Math.min(w, d, h) > r * 2.2 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(g, mat); m.position.copy(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); return shade(m, o.cast ?? true, o.recv ?? true);
    },
    rbox(cx, cy, w, d, rot, z0, z1, mat, o = {}) { const m = api.box(-w / 2, -d / 2, w / 2, d / 2, z0, z1, mat, o); m.position.x += cx; m.position.z += cy; const g = new THREE.Group(); g.add(m); m.position.set(0, (z0 + z1) / 2, 0); g.position.set(cx, 0, cy); g.rotation.y = -rot; return g; },
    cyl(cx, cy, r, z0, z1, mat, o = {}) { const g = new THREE.CylinderGeometry(o.r2 ?? r, r, z1 - z0, o.seg ?? 28, 1, !!o.open); const m = new THREE.Mesh(g, mat); m.position.copy(P(cx, cy, (z0 + z1) / 2)); return shade(m, o.cast ?? true, o.recv ?? true); },
    sphere(cx, cy, cz, r, mat, o = {}) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 24, o.seg2 ?? 16), mat); m.position.copy(P(cx, cy, cz)); return shade(m, o.cast ?? true, o.recv ?? false); },
    // annulus sector extruded upward: centre (cx, cy), radii r0..r1, angles a0..a1 (degrees, plan, 0 = +x, 90 = +y south)
    arcSlab(cx, cy, r0, r1, a0, a1, z0, z1, mats, o = {}) {
      const s = new THREE.Shape(); const n = 48; const A = a => a * Math.PI / 180;
      for (let i = 0; i <= n; i++) { const a = A(a0 + (a1 - a0) * i / n); const x = cx + r1 * Math.cos(a), y = cy + r1 * Math.sin(a); i ? s.lineTo(x, -y) : s.moveTo(x, -y); }
      for (let i = n; i >= 0; i--) { const a = A(a0 + (a1 - a0) * i / n); s.lineTo(cx + r0 * Math.cos(a), -(cy + r0 * Math.sin(a))); }
      const bv = o.bevel ?? Math.min(0.02, bevel);
      const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 48 });
      g.rotateX(-Math.PI / 2); g.translate(0, z0, 0);
      return shade(new THREE.Mesh(g, mats));
    },
    // extruded plan polygon (points in plan x, y)
    prism(pts, z0, z1, mats, o = {}) {
      const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))); const bv = o.bevel ?? Math.min(0.015, bevel);
      const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); return shade(new THREE.Mesh(g, mats));
    },
    // a flat plane on a wall or floor. side: 'N' faces +y (south), 'W' faces +x (east), 'F' faces up.
    plane(side, u0, v0, w, h, at, mat, o = {}) {
      const g = new THREE.PlaneGeometry(w, h); const m = new THREE.Mesh(g, mat); const eps = o.eps ?? 0.004;
      if (side === 'N') { m.position.copy(P(u0 + w / 2, at + eps, v0 + h / 2)); }
      if (side === 'W') { m.position.copy(P(at + eps, u0 + w / 2, v0 + h / 2)); m.rotation.y = Math.PI / 2; m.scale.x = -1; m.material.side = THREE.DoubleSide; }
      if (side === 'F') { m.position.copy(P(u0 + w / 2, v0 + h / 2, at + eps)); m.rotation.x = -Math.PI / 2; }
      m.receiveShadow = o.recv ?? true; m.castShadow = false; return m;
    },
    line(points, color, width = 0.01) { // thin tube along plan points [x,y,z]
      const curve = new THREE.CatmullRomCurve3(points.map(p => P(p[0], p[1], p[2]))); const g = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), width, 6, false);
      return new THREE.Mesh(g, color);
    }
  };
  return api;
}
