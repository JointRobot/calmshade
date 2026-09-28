// isokit · plan footprints of everything a body must not enter (furniture, structures, walls, water)
// Shapes in plan metres: rect (axis), orect (rotated), circle, arc (annulus sector), poly (any simple polygon). Each has a name for reports.
export const OBST = [];
export const addRect = (x0, y0, x1, y1, name) => { const a = Math.min(x0, x1), b = Math.min(y0, y1), c = Math.max(x0, x1), d = Math.max(y0, y1); OBST.push({ k: 'rect', x0: a, y0: b, x1: c, y1: d, bb: [a, b, c, d], name }); };
export const addORect = (cx, cy, w, d, rot, name) => { const R = Math.hypot(w, d) / 2; OBST.push({ k: 'orect', cx, cy, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot), bb: [cx - R, cy - R, cx + R, cy + R], name }); };
export const addCircle = (cx, cy, r, name) => OBST.push({ k: 'circle', cx, cy, r, bb: [cx - r, cy - r, cx + r, cy + r], name });
export const addPoly = (pts, name) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } OBST.push({ k: 'poly', pts, bb: [x0, y0, x1, y1], name }); };
export const clearObstacles = () => { OBST.length = 0; };
export const addArc = (cx, cy, r0, r1, a0, a1, name) => OBST.push({ k: 'arc', cx, cy, r0, r1, a0: a0 * Math.PI / 180, a1: a1 * Math.PI / 180, bb: [cx - r1, cy - r1, cx + r1, cy + r1], name });

// signed distance from (x, y) to the shape (negative inside) and the outward normal
function sd(o, x, y) {
  if (o.k === 'rect' || o.k === 'orect') {
    let lx, ly, hw, hd;
    if (o.k === 'rect') { const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2; lx = x - cx; ly = y - cy; hw = (o.x1 - o.x0) / 2; hd = (o.y1 - o.y0) / 2; }
    else { const dx = x - o.cx, dy = y - o.cy; lx = dx * o.c + dy * o.s; ly = -dx * o.s + dy * o.c; hw = o.hw; hd = o.hd; }
    const qx = Math.abs(lx) - hw, qy = Math.abs(ly) - hd; const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const dist = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0);
    let nx, ny; if (qx > qy) { nx = Math.sign(lx) || 1; ny = 0; } else { nx = 0; ny = Math.sign(ly) || 1; }
    if (ox > 0 && oy > 0) { const L = Math.hypot(ox, oy); nx = Math.sign(lx) * ox / L; ny = Math.sign(ly) * oy / L; }
    if (o.k === 'orect') { const wx = nx * o.c - ny * o.s, wy = nx * o.s + ny * o.c; nx = wx; ny = wy; }
    return [dist, nx, ny];
  }
  if (o.k === 'poly') { // signed distance to a simple polygon, negative inside; normal points outward from the nearest edge
    const P = o.pts; let best = Infinity, nx = 0, ny = 0, inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xa, ya] = P[j], [xb, yb] = P[i];
      if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
      const ex = xb - xa, ey = yb - ya, L2 = ex * ex + ey * ey || 1e-9; const t = Math.max(0, Math.min(1, ((x - xa) * ex + (y - ya) * ey) / L2)); const px = xa + ex * t, py = ya + ey * t; const d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; nx = (x - px) / (d || 1); ny = (y - py) / (d || 1); } }
    return inside ? [-best, -nx, -ny] : [best, nx, ny];
  }
  if (o.k === 'circle') { const dx = x - o.cx, dy = y - o.cy, L = Math.hypot(dx, dy) || 1e-6; return [L - o.r, dx / L, dy / L]; }
  // arc: annulus sector
  const dx = x - o.cx, dy = y - o.cy, r = Math.hypot(dx, dy) || 1e-6, a = Math.atan2(dy, dx);
  const inA = a >= o.a0 && a <= o.a1;
  if (inA) { const dIn = r - o.r0, dOut = o.r1 - r; if (dIn < dOut) return [-dIn, -dx / r, -dy / r]; return [-dOut, dx / r, dy / r]; }
  // outside the angular range: distance to the nearer end cap segment
  const cap = Math.abs(a - o.a0) < Math.abs(a - o.a1) ? o.a0 : o.a1; const ux = Math.cos(cap), uy = Math.sin(cap);
  const t = Math.max(o.r0, Math.min(o.r1, dx * ux + dy * uy)); const px = o.cx + ux * t, py = o.cy + uy * t; const ex = x - px, ey = y - py, L = Math.hypot(ex, ey) || 1e-6;
  return [L, ex / L, ey / L];
}
// the first shape a body of radius r at (x, y) overlaps, or null
export function hit(x, y, r = 0.18) { for (const o of OBST) { if (o.bb && (x < o.bb[0] - r || x > o.bb[2] + r || y < o.bb[1] - r || y > o.bb[3] + r)) continue; const [d] = sd(o, x, y); if (d < r) return o; } return null; }
// push a body out of every shape it overlaps (deterministic: depends only on x, y)
export function pushOut(x, y, r = 0.18) {
  for (let it = 0; it < 4; it++) { let moved = false;
    for (const o of OBST) { if (o.bb && (x < o.bb[0] - r || x > o.bb[2] + r || y < o.bb[1] - r || y > o.bb[3] + r)) continue; const [d, nx, ny] = sd(o, x, y); if (d < r) { x += nx * (r - d + 0.005); y += ny * (r - d + 0.005); moved = true; } }
    if (!moved) break; }
  return [x, y];
}
