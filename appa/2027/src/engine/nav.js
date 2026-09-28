// PULSE iso3d · walkable floor grid and A* paths around every registered footprint (deterministic)
import { hit } from './obstacles.js';

export function buildNav({ x0 = -4.3, y0 = -3.5, x1 = 15.4, y1 = 17.8, res = 0.1, R = 0.23 } = {}) {
  const W = Math.ceil((x1 - x0) / res), H = Math.ceil((y1 - y0) / res);
  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) blocked[j * W + i] = hit(x0 + (i + 0.5) * res, y0 + (j + 0.5) * res, R) ? 1 : 0;
  const ci = x => Math.max(0, Math.min(W - 1, Math.floor((x - x0) / res))), cj = y => Math.max(0, Math.min(H - 1, Math.floor((y - y0) / res)));
  const cx = i => x0 + (i + 0.5) * res, cy = j => y0 + (j + 0.5) * res;
  const free = (x, y) => !blocked[cj(y) * W + ci(x)];
  // nearest free cell centre (breadth-first)
  function snap(x, y) {
    const si = ci(x), sj = cj(y); if (!blocked[sj * W + si] && !hit(x, y, R)) return [x, y];
    const seen = new Uint8Array(W * H); const q = [[si, sj]]; seen[sj * W + si] = 1;
    for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; if (!blocked[j * W + i]) return [cx(i), cy(j)];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H || seen[b * W + a]) continue; seen[b * W + a] = 1; q.push([a, b]); } }
    return [x, y];
  }
  function los(ax, ay, bx, by) { const L = Math.hypot(bx - ax, by - ay); const n = Math.ceil(L / (res * 0.5)); for (let k = 0; k <= n; k++) { const t = k / n; if (!free(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; } return true; }
  // A* over 8 neighbours; returns plan points from a to b (a and b snapped to free floor), string-pulled
  function path(ax, ay, bx, by) {
    [ax, ay] = snap(ax, ay); [bx, by] = snap(bx, by);
    if (los(ax, ay, bx, by)) return [[ax, ay], [bx, by]];
    const s = cj(ay) * W + ci(ax), g = cj(by) * W + ci(bx);
    const G = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
    const heap = []; const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const gi = g % W, gj = (g / W) | 0; const hfn = n => { const dx = Math.abs(n % W - gi), dy = Math.abs(((n / W) | 0) - gj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    G[s] = 0; push(s, hfn(s));
    const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    while (heap.length) { const n = pop(); if (closed[n]) continue; closed[n] = 1; if (n === g) { found = true; break; }
      const i = n % W, j = (n / W) | 0;
      for (const [di, dj, c] of N8) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const m = b * W + a; if (blocked[m] || closed[m]) continue;
        if (di && dj && (blocked[j * W + a] || blocked[b * W + i])) continue;
        const ng = G[n] + c; if (ng < G[m]) { G[m] = ng; from[m] = n; push(m, ng + hfn(m)); } } }
    if (!found) { // the goal sits in a pocket: walk to the reachable free cell nearest to it instead
      const seen = new Uint8Array(W * H); const q = [s]; seen[s] = 1; let best = s, bd = Infinity;
      for (let h = 0; h < q.length; h++) { const n = q[h]; const d = Math.hypot(cx(n % W) - bx, cy((n / W) | 0) - by); if (d < bd) { bd = d; best = n; }
        const i = n % W, j = (n / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const m = b * W + a; if (seen[m] || blocked[m]) continue; seen[m] = 1; q.push(m); } }
      if (best === s) return [[ax, ay]];
      return path(ax, ay, cx(best % W), cy((best / W) | 0));
    }
    const cells = []; for (let n = g; n !== -1; n = from[n]) cells.push([cx(n % W), cy((n / W) | 0)]); cells.reverse();
    cells[0] = [ax, ay]; cells[cells.length - 1] = [bx, by];
    const out = [cells[0]]; let k = 0;
    while (k < cells.length - 1) { let far = k + 1; for (let m = cells.length - 1; m > k + 1; m--) if (los(cells[k][0], cells[k][1], cells[m][0], cells[m][1])) { far = m; break; } out.push(cells[far]); k = far; }
    return out;
  }
  // push a set of standing spots apart (and off obstacles); radii per spot
  function spread(spots, radii, iters = 40) {
    const p = spots.map(s => snap(s[0], s[1]));
    for (let it = 0; it < iters; it++) { let moved = false;
      for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) { const dx = p[b][0] - p[a][0], dy = p[b][1] - p[a][1], d = Math.hypot(dx, dy) || 1e-3; const need = radii[a] + radii[b] + 0.06;
        if (d < need) { const push = (need - d) / 2, ux = dx / d, uy = dy / d; p[a][0] -= ux * push; p[a][1] -= uy * push; p[b][0] += ux * push; p[b][1] += uy * push; moved = true; } }
      for (let a = 0; a < p.length; a++) p[a] = snap(p[a][0], p[a][1]);
      if (!moved) break; }
    return p;
  }
  return { free, snap, path, spread, los };
}
