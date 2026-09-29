// isokit · the kit of parts: parameterised structures built from one line of site data each.
// Every part: KIT.<type>(ctx, spec) → { group, update?(t) }. Show lights (stage, screen, marquee) follow channel 'stageOn' for
// the part's area (or spec.show to link it to another key). Parts build in local plan coordinates
// (x east, y south, z up) around (spec.x, spec.y), rotated by spec.rot (radians), and register their own
// walking footprints so the crowd never walks through them. Animated parts read story channels via ctx.S.
// To add a part: copy the closest one, keep it cheap (shared materials, few meshes), register its footprint.
import * as THREE from 'three';
import { P } from './world.js';
import { addORect, addCircle } from './obstacles.js';
import { hash, smooth, lerp } from './util.js';

// ---------- helpers ----------
export function place(s) {
  const grp = new THREE.Group(); const rot = s.rot || 0; grp.position.set(s.x, 0, s.y); grp.rotation.y = -rot;
  const c = Math.cos(rot), sn = Math.sin(rot);
  return { grp, add: o => { grp.add(o); return o; }, W: (u, v) => [s.x + u * c - v * sn, s.y + u * sn + v * c], rot };
}
const stripeCache = new Map();
export function stripeTex(a, b, n = 16, vertical = true) {
  const k = [a, b, n, vertical].join(); if (stripeCache.has(k)) return stripeCache.get(k);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; if (vertical) x.fillRect(i * 256 / n, 0, 256 / n + 1, 64); else x.fillRect(0, i * 64 / n, 256, 64 / n + 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; stripeCache.set(k, t); return t;
}
// gabled roof: w along local x (ridge direction), d along local y, ridge height h above z0, overhang o
export function gable(w, d, h, z0, o, m) {
  const a = -w / 2 - o, b = w / 2 + o, c = -d / 2 - o, e = d / 2 + o; const T = (x, y, z) => [x, z, y];
  const v = [
    ...T(a, c, z0), ...T(b, c, z0), ...T(b, 0, z0 + h), ...T(a, c, z0), ...T(b, 0, z0 + h), ...T(a, 0, z0 + h),
    ...T(a, e, z0), ...T(a, 0, z0 + h), ...T(b, 0, z0 + h), ...T(a, e, z0), ...T(b, 0, z0 + h), ...T(b, e, z0),
    ...T(a + o, c + o, z0), ...T(a + o, 0, z0 + h - o * 0.6), ...T(a + o, e - o, z0), ...T(b - o, c + o, z0), ...T(b - o, e - o, z0), ...T(b - o, 0, z0 + h - o * 0.6)];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; return mesh;
}
const box = (ctx, x0, y0, x1, y1, z0, z1, m, o) => ctx.g.box(x0, y0, x1, y1, z0, z1, m, o);
// painted stage backdrop: a sun with rings over lotus petals and waves, in the stage's colour (s.art: a custom painter (ctx2d, w, h))
const artCache = new Map();
export function backdrop(color, art) {
  const k = color + (art ? art.name : ''); if (artCache.has(k)) return artCache.get(k);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  if (art) art(x, 512, 256, color); else {
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#3A2A4A'); g.addColorStop(1, '#1C1426'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = color; x.globalAlpha = 0.95; x.beginPath(); x.arc(256, 150, 62, 0, 7); x.fill();
    x.strokeStyle = color; x.lineWidth = 5; for (let i = 1; i < 5; i++) { x.globalAlpha = 0.7 - i * 0.13; x.beginPath(); x.arc(256, 150, 62 + i * 22, Math.PI, 0); x.stroke(); }
    x.globalAlpha = 0.9; x.fillStyle = '#F4E6CC'; for (let i = -3; i <= 3; i++) { x.save(); x.translate(256 + i * 44, 226); x.rotate(i * 0.22); x.beginPath(); x.ellipse(0, -18, 14, 30, 0, 0, 7); x.fill(); x.restore(); }
    x.strokeStyle = '#F4E6CC'; x.lineWidth = 3; x.globalAlpha = 0.6; for (let j = 0; j < 3; j++) { x.beginPath(); for (let u = 0; u <= 512; u += 8) x.lineTo(u, 240 + j * 8 + Math.sin(u / 26 + j) * 4); x.stroke(); }
    x.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; artCache.set(k, t); return t;
}

// ---------- the parts ----------
// a neon glow overlay for a lettered board: lights with the night, and only once the 'lights' channel is up (the tour's lake moment)
function neonPlane(ctx, s, w, bh, lines, fs, font, y, z, cw, ch) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(fs);
  const col = s.neon; x.strokeStyle = col; x.fillStyle = '#FFFFFF'; x.lineWidth = 3; x.shadowColor = col; x.lineJoin = 'round';
  lines.forEach((ln, i) => { const yy = ch / 2 + (i - (lines.length - 1) / 2) * fs * 1.08; for (const b of [26, 14, 6]) { x.shadowBlur = b; x.fillStyle = col; x.fillText(ln, cw / 2, yy, cw - 60); } x.shadowBlur = 0; x.fillStyle = '#FFFFFF'; x.globalAlpha = 0.85; x.fillText(ln, cw / 2, yy, cw - 60); x.globalAlpha = 1; });
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, bh), m); mesh.position.copy(P(0, y, z)); mesh.renderOrder = 3; mesh.castShadow = false;
  return { mesh, update: t => { const on = ctx.night() * (ctx.S.channels.lights ? ctx.S.get('lights', t) : 1); m.opacity = on; mesh.visible = on > 0.01; } };
}
export const KIT = {
  // performance stage: platform, truss, backdrop that lights up, speaker stacks, light beams when on
  stage(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 8, d = s.d || 5, h = s.h || 1, H = s.truss || 5.5;
    const deck = ctx.mat(s.deck || '#3A3440'), steel = ctx.mat('#2A2A30', { metal: 0.4, rough: 0.5 }), black = ctx.mat('#1B1B20');
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, h, deck));
    add(box(ctx, -1.2, d / 2, 1.2, d / 2 + 0.9, 0, h * 0.5, deck));
    for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) add(ctx.g.cyl(u, v, 0.12, 0, H, steel, { seg: 8 }));
    add(box(ctx, -w / 2 - 0.1, -d / 2 - 0.12, w / 2 + 0.1, -d / 2 + 0.12, H - 0.25, H, steel)); add(box(ctx, -w / 2 - 0.1, d / 2 - 0.12, w / 2 + 0.1, d / 2 + 0.12, H - 0.25, H, steel));
    add(box(ctx, -w / 2 - 0.12, -d / 2, -w / 2 + 0.12, d / 2, H - 0.25, H, steel)); add(box(ctx, w / 2 - 0.12, -d / 2, w / 2 + 0.12, d / 2, H - 0.25, H, steel));
    const screenM = ctx.glow(`stage:${s.id}`, { on: s.glow || '#FFB45A', off: '#2B2733', channel: 'stageOn', arg: s.show ?? s.area ?? s.id, day: 0.35, map: backdrop(s.glow || '#FFB45A', s.art) });
    add(box(ctx, -w / 2 + 0.3, -d / 2 + 0.05, w / 2 - 0.3, -d / 2 + 0.2, h, H - 0.4, screenM, { round: 0 }));
    for (const u of [-w / 2 - 0.6, w / 2 + 0.6]) add(box(ctx, u - 0.45, d / 2 - 1.4, u + 0.45, d / 2 - 0.5, 0, 2.2, black));
    const lampM = ctx.glow(`lamp:${s.id}`, { on: '#FFF3C8', off: '#44404A', channel: 'stageOn', arg: s.show ?? s.area ?? s.id, day: 0.2 });
    for (let i = 0; i < 5; i++) add(ctx.g.cyl(-w / 2 + 1 + i * (w - 2) / 4, d / 2 - 0.1, 0.16, H - 0.6, H - 0.25, lampM, { seg: 10 }));
    const beams = ctx.beams(grp, [[-w / 3, d / 2 - 0.1], [0, d / 2 - 0.1], [w / 3, d / 2 - 0.1]].map(([u, v]) => [u, v, H - 0.6, u * 0.6, v + 1.5]), s.beam || '#FFE3A6', 'stageOn', s.show ?? s.area ?? s.id);
    const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.3, d + 0.3, rot, `${s.id} stage`);
    for (const u of [-w / 2 - 0.6, w / 2 + 0.6]) { const [px, py] = W(u, d / 2 - 0.95); addORect(px, py, 1.0, 1.0, rot, `${s.id} speakers`); }
    return { group: grp, update: beams };
  },
  // striped big top with a centre pole and a flag
  bigtop(ctx, s) {
    const { grp, add } = place(s); const r = s.r || 4, wall = s.wall || 1.8, H = s.h || 5.2; const tex = stripeTex(s.color || '#C8412F', s.color2 || '#F4E6CC', 20);
    const cloth = ctx.mat('#ffffff', { map: tex, noCache: true, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.08, H - wall, 20, 1, true), cloth); roof.position.copy(P(0, 0, wall + (H - wall) / 2)); roof.castShadow = roof.receiveShadow = true; add(roof);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wall, 20, 1, true, 0.5, Math.PI * 2 - 1.0), cloth); w.position.copy(P(0, 0, wall / 2)); w.castShadow = w.receiveShadow = true; add(w);
    add(ctx.g.cyl(0, 0, 0.08, 0, H + 0.9, ctx.mat('#6B4A2E'), { seg: 8 }));
    const flag = add(box(ctx, 0.05, -0.02, 0.8, 0.02, H + 0.45, H + 0.85, ctx.mat(s.flag || '#F2B33D'), { round: 0 }));
    const inner = ctx.glow('tentlamp', { on: '#FFD08A', off: '#3A2E2A', channel: 'night', day: 0 });
    const lamp = add(ctx.g.sphere(0, 0, H * 0.55, 0.35, inner, { seg: 10 })); lamp.castShadow = false;
    addCircle(s.x, s.y, r + 0.15, `${s.id} big top`);
    return { group: grp, update: t => { flag.rotation.y = 0.25 * Math.sin(t * 2 + s.x); }, dyn: true };
  },
  // bell tent for stays (glows at night)
  tent(ctx, s) {
    const { grp, add } = place(s); const r = s.r || 1.7, H = s.h || 2.6;
    const cloth = ctx.mat(s.color || '#EFE3CA', { side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, H - 0.7, 14, 1, true), cloth); cone.position.copy(P(0, 0, 0.7 + (H - 0.7) / 2)); cone.castShadow = cone.receiveShadow = true; add(cone);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.7, 14, 1, true, 0.4, Math.PI * 2 - 0.8), cloth); wall.position.copy(P(0, 0, 0.35)); wall.castShadow = true; add(wall);
    const glowM = ctx.glow('tentlight', { on: '#FFC878', off: '#6A5A48', channel: 'night', day: 0 });
    const l = add(ctx.g.sphere(0, 0, 0.9, 0.22, glowM, { seg: 8 })); l.castShadow = false;
    addCircle(s.x, s.y, r + 0.1, `${s.id} tent`);
    return { group: grp };
  },
  // faceted dome, lit from inside at night
  dome(ctx, s) {
    const { grp, add } = place(s); const r = s.r || 3;
    const skin = ctx.glow(`dome:${s.id}`, { on: s.glow || '#9FD8FF', off: s.color || '#E8E4DA', channel: 'night', day: 0, keepLit: true });
    const g = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); const m = new THREE.Mesh(g, skin); m.castShadow = m.receiveShadow = true; add(m);
    add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), new THREE.LineBasicMaterial({ color: '#4A4A52' })));
    addCircle(s.x, s.y, r + 0.1, `${s.id} dome`);
    return { group: grp };
  },
  // open pavilion: posts and a gabled roof (workshops, food courts); s.tables adds tables inside.
  // s.raised lifts the floor on a stone plinth, s.steps adds a stone staircase up to it on the south side.
  pavilion(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 6, d = s.d || 4, H = s.h || 2.6, base = s.raised || 0;
    const wood = ctx.mat(s.post || '#7A5433'), roofM = ctx.mat(s.roof || '#B8643A', { side: THREE.DoubleSide });
    if (base > 0) {
      const stone = ctx.mat(s.stone || '#C9B48A');
      add(box(ctx, -w / 2 - 0.2, -d / 2 - 0.2, w / 2 + 0.2, d / 2 + 0.2, 0, base, stone));
      if (s.steps) { const sw = Math.min(2.2, w * 0.5), sn = s.steps; for (let i = 0; i < sn; i++) { const z1 = base * (i + 1) / sn; add(box(ctx, -sw / 2, d / 2 + 0.2 + i * 0.32, sw / 2, d / 2 + 0.2 + (i + 1) * 0.32, 0, z1, stone)); } }
    }
    for (const u of [-w / 2, 0, w / 2]) for (const v of [-d / 2, d / 2]) add(ctx.g.cyl(u, v, 0.09, base, base + H, wood, { seg: 8 }));
    add(gable(w, d, 1.3, base + H, 0.35, roofM));
    add(box(ctx, -w / 2 + 0.2, -d / 2 + 0.2, w / 2 - 0.2, d / 2 - 0.2, base, base + 0.12, ctx.mat(s.floor || '#C9A77A')));
    if (s.tables) for (let i = 0; i < s.tables; i++) { const u = -w / 2 + (i + 0.5) * w / s.tables; add(box(ctx, u - 0.5, -0.4, u + 0.5, 0.4, base + 0.45, base + 0.55, wood)); const [tx, ty] = W(u, 0); addORect(tx, ty, 1.2, 1.0, rot, `${s.id} table`); }
    for (const u of [-w / 2, 0, w / 2]) for (const v of [-d / 2, d / 2]) { const [px, py] = W(u, v); addCircle(px, py, 0.12, `${s.id} post`); }
    if (base > 0 && s.steps) { const [sx, sy] = W(0, d / 2 + 0.2 + s.steps * 0.16); addORect(sx, sy, Math.min(2.2, w * 0.5) + 0.1, s.steps * 0.32, rot, `${s.id} steps`); }
    return { group: grp };
  },
  // village house with a gabled roof and windows that light at night; s.roofType: 'barrel' for a curved standing-seam roof
  house(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 4, d = s.d || 3, H = s.h || 2.4;
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, H, ctx.mat(s.color || '#E7D6B8')));
    const roofM = ctx.mat(s.roof || '#A94F32', { side: THREE.DoubleSide });
    if (s.pitch !== undefined) add(gable(w, d, s.pitch, H, 0.45, roofM));
    else if (s.roofType === 'barrel') {
      const rr = d / 2 + 0.4; const half = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w + 0.7, 20, 1, true, 0, Math.PI), roofM);
      half.rotation.z = Math.PI / 2; half.rotation.y = Math.PI / 2; half.position.copy(P(0, 0, H)); half.castShadow = half.receiveShadow = true; add(half);
      for (const side of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(rr, 20, 0, Math.PI), roofM); cap.position.copy(P(side * (w / 2 + 0.35), 0, H)); cap.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; add(cap); }
    } else add(gable(w, d, 1.2, H, 0.3, roofM));
    add(box(ctx, -0.4, d / 2 - 0.02, 0.4, d / 2 + 0.04, 0, 1.8, ctx.mat('#3A2E28'), { round: 0 }));
    const win = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    for (const u of [-w / 3, w / 3]) add(box(ctx, u - 0.3, d / 2 - 0.02, u + 0.3, d / 2 + 0.04, 1.0, 1.6, win, { round: 0 }));
    const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.2, d + 0.2, rot, `${s.id} house`);
    return { group: grp };
  },
  // multi-floor villa with balconies at each level. Options: s.plinth (stone base height), s.frontStairs ('straight' up to the
  // plinth | 'double': two curved masonry staircases meeting the first-floor balcony), s.twin (two gables facing the front),
  // s.stair (exterior spiral staircase: true | 'both').
  villa(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 7, d = s.d || 5, floors = s.floors || 2, fh = s.floorH || 2.6, taper = s.taper || 0, pl = s.plinth || 0;
    const wallM = ctx.mat(s.color || '#EFE3CC'), railM = ctx.mat(s.rail || '#F4EADD'), roofM = ctx.mat(s.roof || '#A94F32', { side: THREE.DoubleSide }), stone = ctx.mat(s.stone || '#B9A583');
    const winM = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    const ov = s.overhang ?? 0.75;
    if (pl > 0) add(box(ctx, -w / 2 - 0.7, -d / 2 - 0.6, w / 2 + 0.7, d / 2 + ov + 0.5, 0, pl, stone));
    let z = pl, fw = w, fd = d;
    for (let f = 0; f < floors; f++) {
      fw = w - f * taper; fd = d - f * taper;
      add(box(ctx, -fw / 2, -fd / 2, fw / 2, fd / 2, z, z + fh, wallM));
      const nw = Math.max(2, Math.round(fw / 2.2));
      for (let i = 0; i < nw; i++) { const u = -fw / 2 + (i + 0.5) * fw / nw; add(box(ctx, u - 0.32, fd / 2 - 0.02, u + 0.32, fd / 2 + 0.04, z + fh * 0.3, z + fh * 0.8, winM, { round: 0 })); }
      for (let i = 0; i < Math.max(1, Math.round(fd / 2.4)); i++) { const v = -fd / 2 + (i + 0.5) * fd / Math.max(1, Math.round(fd / 2.4)); for (const u of [-fw / 2 - 0.03, fw / 2 + 0.03]) add(box(ctx, u - 0.03, v - 0.3, u + 0.03, v + 0.3, z + fh * 0.3, z + fh * 0.8, winM, { round: 0 })); }
      add(box(ctx, -fw / 2 - ov * 0.15, fd / 2, fw / 2 + ov * 0.15, fd / 2 + ov, z + fh - 0.08, z + fh + 0.05, wallM));
      const np = Math.max(4, Math.round(fw * 1.3));
      for (let i = 0; i <= np; i++) { const u = -fw / 2 + i * fw / np; add(box(ctx, u - 0.04, fd / 2 + ov - 0.06, u + 0.04, fd / 2 + ov, z + fh + 0.05, z + fh + 0.55, railM)); }
      add(box(ctx, -fw / 2 - ov * 0.15, fd / 2 + ov - 0.06, fw / 2 + ov * 0.15, fd / 2 + ov, z + fh + 0.42, z + fh + 0.55, railM, { round: 0 }));
      for (const u of [-fw / 2 + 0.3, 0, fw / 2 - 0.3]) add(ctx.g.cyl(u, fd / 2 + ov - 0.15, 0.09, z, z + fh, railM, { seg: 8 }));
      z += fh;
    }
    if (s.twin) { for (const side of [-1, 1]) { const m = gable(fd + 0.3, fw / 2, s.roofH || 1.6, z, 0.35, roofM); m.rotation.y = Math.PI / 2; m.position.x = side * fw / 4; add(m); } }
    else add(gable(fw, fd, s.roofH || 1.5, z, 0.45, roofM));
    const front = d / 2 + ov + (pl > 0 ? 0.5 : 0);
    if (s.frontStairs === 'straight' && pl > 0) { const n = Math.max(3, Math.round(pl / 0.2)), sw = Math.min(3, w * 0.35); for (let i = 0; i < n; i++) add(box(ctx, -sw / 2, front + i * 0.3, sw / 2, front + (i + 1) * 0.3, 0, pl * (n - i) / n, stone, { round: 0 })); }
    if (s.frontStairs === 'double') {
      const top = pl + fh, N = 11, v0 = d / 2 + ov, reach = 2.8;
      add(box(ctx, -1.1, v0 + reach - 0.2, 1.1, v0 + reach + 0.7, 0, 0.18, stone));
      for (const side of [-1, 1]) for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI / 2; const u = side * (0.7 + 1.9 * (1 - Math.cos(a))), v = v0 + reach * (1 - Math.sin(a)), zz = 0.18 + (top - 0.18) * (i + 1) / N;
        const b = box(ctx, u - 0.5, v - 0.2, u + 0.5, v + 0.2, 0, zz, railM, { round: 0 }); b.rotation.y = side * a; add(b);
        if (i % 2 === 0) add(ctx.g.cyl(u + side * 0.45, v, 0.05, zz, zz + 0.6, wallM, { seg: 6 })); }
    }
    if (s.stair) {
      const sides = s.stair === 'both' ? [1, -1] : [1];
      for (const side of sides) { const cx0 = side * (w / 2 + 1.0), N = 14, turns = 1.15, topZ = pl + fh;
        for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 * turns, r = 0.78, zz = topZ * i / N; const px = cx0 + Math.cos(a) * r * side, py = Math.sin(a) * r * 0.6;
          const b = box(ctx, px - 0.28, py - 0.16, px + 0.28, py + 0.16, zz, zz + 0.08, railM, { round: 0 }); b.rotation.y = -a; add(b); }
        add(ctx.g.cyl(cx0, 0, 0.06, 0, topZ + 0.35, railM, { seg: 8 })); }
    }
    const extra = s.frontStairs === 'double' ? 3.6 : s.frontStairs === 'straight' ? 1.4 : 0;
    const [cx, cy] = W(0, extra / 2); addORect(cx, cy, w + (s.stair ? 3.6 : 1.6), d + ov + 1.2 + extra, rot, `${s.id} villa`);
    return { group: grp };
  },
  // hill lodge (Calmshet): a cream three-storey timber-and-stone house on a stone terrace, a wooden veranda with white
  // railings wrapping every floor on all four sides, a steep gabled roof with a dormer, stone steps up the front.
  lodge(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 9, d = s.d || 6, floors = s.floors || 3, fh = s.floorH || 2.5, pl = s.plinth || 0.8, b = 1.0;
    const wallM = ctx.mat(s.color || '#F2D58E'), railM = ctx.mat(s.rail || '#FFFFFF'), wood = ctx.mat(s.wood || '#8A5A34'), stone = ctx.mat(s.stone || '#B9A583');
    const roofM = ctx.mat(s.roof || '#7A4A2C', { side: THREE.DoubleSide });
    const winM = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    add(box(ctx, -w / 2 - 2.2, -d / 2 - 1.8, w / 2 + 2.2, d / 2 + 1.8, 0, pl, stone));
    // stone steps down the south side
    const n = 4, sw = 3; for (let i = 0; i < n; i++) add(box(ctx, -sw / 2, d / 2 + 1.8 + i * 0.32, sw / 2, d / 2 + 1.8 + (i + 1) * 0.32, 0, pl * (n - 1 - i) / n + 0.02, stone, { round: 0 }));
    let z = pl;
    for (let f = 0; f < floors; f++) {
      add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, z, z + fh, wallM));
      add(box(ctx, -w / 2 - b, -d / 2 - b, w / 2 + b, d / 2 + b, z - 0.02, z + 0.12, wood));
      // windows on all four faces, and a door on the ground floor
      const nw = Math.max(2, Math.round(w / 2.4)), nd = Math.max(1, Math.round(d / 2.6));
      for (let i = 0; i < nw; i++) { const u = -w / 2 + (i + 0.5) * w / nw; if (f === 0 && Math.abs(u) < 0.9) continue; for (const v of [-d / 2 - 0.03, d / 2 + 0.03]) add(box(ctx, u - 0.33, v - 0.03, u + 0.33, v + 0.03, z + fh * 0.3, z + fh * 0.82, winM, { round: 0 })); }
      for (let i = 0; i < nd; i++) { const v = -d / 2 + (i + 0.5) * d / nd; for (const u of [-w / 2 - 0.03, w / 2 + 0.03]) add(box(ctx, u - 0.03, v - 0.33, u + 0.03, v + 0.33, z + fh * 0.3, z + fh * 0.82, winM, { round: 0 })); }
      if (f === 0) add(box(ctx, -0.5, d / 2 - 0.02, 0.5, d / 2 + 0.05, z, z + 1.9, ctx.mat('#4A2E1E'), { round: 0 }));
      // white railing all round the veranda
      const x0 = -w / 2 - b + 0.06, x1 = w / 2 + b - 0.06, y0 = -d / 2 - b + 0.06, y1 = d / 2 + b - 0.06, rz = z + 0.12;
      for (const v of [y0, y1]) { add(box(ctx, x0, v - 0.04, x1, v + 0.04, rz + 0.86, rz + 0.96, railM, { round: 0 })); for (let i = 0; i <= Math.round((x1 - x0) / 0.55); i++) { const u = x0 + i * (x1 - x0) / Math.round((x1 - x0) / 0.55); add(box(ctx, u - 0.03, v - 0.03, u + 0.03, v + 0.03, rz, rz + 0.86, railM, { round: 0 })); } }
      for (const u of [x0, x1]) { add(box(ctx, u - 0.04, y0, u + 0.04, y1, rz + 0.86, rz + 0.96, railM, { round: 0 })); for (let i = 1; i < Math.round((y1 - y0) / 0.55); i++) { const v = y0 + i * (y1 - y0) / Math.round((y1 - y0) / 0.55); add(box(ctx, u - 0.03, v - 0.03, u + 0.03, v + 0.03, rz, rz + 0.86, railM, { round: 0 })); } }
      z += fh;
    }
    // timber veranda columns rising to the roof eaves
    for (const u of [w / 2 + b - 0.15, -w / 2 - b + 0.15, 0]) for (const v of [-d / 2 - b + 0.15, d / 2 + b - 0.15]) add(ctx.g.cyl(u, v, 0.1, pl, z, wood, { seg: 8 }));
    for (const v of [0]) for (const u of [-w / 2 - b + 0.15, w / 2 + b - 0.15]) add(ctx.g.cyl(u, v, 0.1, pl, z, wood, { seg: 8 }));
    add(gable(w + 2 * b, d + 2 * b, s.roofH || 2.8, z, 0.35, roofM));
    // dormer window in the front roof
    add(box(ctx, -0.8, 0.4, 0.8, d / 2 + b - 0.4, z, z + 1.7, wallM)); add(box(ctx, -0.45, d / 2 + b - 0.44, 0.45, d / 2 + b - 0.36, z + 0.5, z + 1.4, winM, { round: 0 }));
    const dg = gable(1.9, d / 2 + b - 0.2, 0.8, z + 1.7, 0.15, roofM); dg.rotation.y = Math.PI / 2; dg.position.z = (0.4 + d / 2 + b - 0.4) / 2; add(dg);
    const [cx, cy] = W(0, 0.6); addORect(cx, cy, w + 4.6, d + 3.6 + 1.8, rot, `${s.id} lodge`);
    return { group: grp };
  },
  // a row of painters' easels with finished canvases facing local +y (south): s.count, s.gap; s.z lifts them onto a raised floor
  easels(ctx, s) {
    const { grp, add, W, rot } = place(s); const n = s.count || 3, gap = s.gap || 1.3, z = s.z || 0; const wood = ctx.mat('#7A5433'), cream = ctx.mat('#F4ECDA');
    const palettes = [['#C8412F', '#E2A33A', '#3E6AA0'], ['#2F7F7A', '#F2E6CF', '#B5523B'], ['#7A4A8C', '#E2A33A', '#6E9A4B'], ['#3E6AA0', '#D9502F', '#F2E6CF']];
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * gap; const pal = palettes[(i + (s.seed || 0)) % palettes.length];
      for (const dx of [-0.32, 0.32]) add(box(ctx, u + dx - 0.025, -0.08, u + dx + 0.025, 0.02, z, z + 1.55, wood, { round: 0 }));
      add(box(ctx, u - 0.02, -0.4, u + 0.02, -0.34, z, z + 1.2, wood, { round: 0 }));
      add(box(ctx, u - 0.42, 0.02, u + 0.42, 0.07, z + 0.55, z + 1.6, cream, { round: 0 }));
      add(box(ctx, u - 0.36, 0.07, u + 0.02, 0.09, z + 1.0, z + 1.52, ctx.mat(pal[0]), { round: 0 }));
      add(box(ctx, u - 0.1, 0.07, u + 0.36, 0.09, z + 0.62, z + 1.1, ctx.mat(pal[1]), { round: 0 }));
      add(box(ctx, u - 0.3, 0.07, u + 0.2, 0.09, z + 0.62, z + 0.85, ctx.mat(pal[2]), { round: 0 }));
      if (!z) { const [cx, cy] = W(u, -0.15); addCircle(cx, cy, 0.4, `${s.id || 'easel'} ${i}`); }
    }
    return { group: grp };
  },
  // a lettered sign board on two posts, readable from the south: s.text ('\n' for two lines), s.w, s.h (board bottom), s.board, s.ink
  sign(ctx, s) {
    const { grp, add, W } = place(s); const w = s.w || 3.2, H = s.h || 1.5, bh = w / 3.2; const wood = ctx.mat('#5A3A24');
    for (const u of [-w / 2 + 0.15, w / 2 - 0.15]) { add(ctx.g.cyl(u, 0, 0.07, 0, H + bh, wood, { seg: 6 })); const [px, py] = W(u, 0); addCircle(px, py, 0.12, `${s.id || 'sign'} post`); }
    const c = document.createElement('canvas'); c.width = 768; c.height = 240; const x = c.getContext('2d'); x.fillStyle = s.board || '#2A2226'; x.fillRect(0, 0, 768, 240); x.strokeStyle = s.ink || '#F4E6CC'; x.lineWidth = 6; x.strokeRect(12, 12, 744, 216);
    const lines = String(s.text || 'PROGRAMME').split('\n'); x.fillStyle = s.ink || '#F4E6CC'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = s.size || (lines.length > 1 ? 74 : 92); x.font = `700 ${fs}px Georgia, serif`; lines.forEach((ln, i) => x.fillText(ln, 384, 120 + (i - (lines.length - 1) / 2) * fs * 1.08, 700));
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, bh), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide, toneMapped: false })); board.position.copy(P(0, 0.09, H + bh / 2)); add(board);
    add(box(ctx, -w / 2, 0.02, w / 2, 0.08, H - 0.04, H + bh + 0.04, wood, { round: 0 }));
    if (s.neon) { const nn = neonPlane(ctx, s, w, bh, lines, fs, f => `700 ${f}px Georgia, serif`, 0.11, H + bh / 2, 768, 240); grp.add(nn.mesh); return { group: grp, dyn: true, update: nn.update }; }
    return { group: grp };
  },
  // yoga and meditation mats laid in a ring (s.layout 'ring') or in rows: s.count, s.r; flat, so people sit on them
  mats(ctx, s) {
    const { grp, add } = place(s); const n = s.count || 6; const cols = ['#C8412F', '#2F7F7A', '#E2A33A', '#7A4A8C', '#3E6AA0', '#6E9A4B'];
    for (let i = 0; i < n; i++) {
      let u, v, a; if (s.layout === 'rows') { const per = s.per || 3; u = ((i % per) - (per - 1) / 2) * 1.0; v = (Math.floor(i / per)) * 1.9; a = 0; } else { a = i / n * Math.PI * 2; const r = s.r || 1.6; u = Math.cos(a) * r; v = Math.sin(a) * r; }
      const m = box(ctx, -0.32, -0.8, 0.32, 0.8, 0, 0.04, ctx.mat(cols[(i + (s.seed || 0)) % cols.length]), { round: 0 }); m.position.x += u; m.position.z += v; m.rotation.y = -a; add(m);
    }
    return { group: grp };
  },
  // a small stone shrine with a tiered spire, a gold finial and a red flag (a temple stop on the trail)
  shrine(ctx, s) {
    const { grp, add, W, rot } = place(s); const stone = ctx.mat('#D8CDB8'), ochre = ctx.mat('#E2A33A'), red = ctx.mat('#C8412F'), dark = ctx.mat('#4A3A2E');
    add(box(ctx, -1.3, -1.3, 1.3, 1.3, 0, 0.35, stone)); add(box(ctx, -0.8, -0.8, 0.8, 0.8, 0.35, 1.7, ochre)); add(box(ctx, -0.25, 0.78, 0.25, 0.84, 0.35, 1.2, dark, { round: 0 }));
    add(box(ctx, -0.95, -0.95, 0.95, 0.95, 1.7, 1.85, stone)); add(box(ctx, -0.65, -0.65, 0.65, 0.65, 1.85, 2.5, red)); add(box(ctx, -0.4, -0.4, 0.4, 0.4, 2.5, 3.0, ochre)); add(box(ctx, -0.18, -0.18, 0.18, 0.18, 3.0, 3.35, red));
    add(ctx.g.sphere(0, 0, 3.5, 0.13, ctx.mat('#E8B848'), { seg: 8, seg2: 6 })); add(ctx.g.cyl(1.05, -1.0, 0.03, 0.35, 3.0, dark, { seg: 6 })); add(box(ctx, 1.05, -1.0, 1.6, -0.98, 2.4, 2.9, red, { round: 0 }));
    const [cx, cy] = W(0, 0); addORect(cx, cy, 2.8, 2.8, rot, `${s.id || 'shrine'}`);
    return { group: grp };
  },
  // modern two-storey house with flat roof slabs, big glass fronts, a rounded front veranda and a carport (Le Farm)
  modern(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 8, d = s.d || 6, h1 = s.h || 2.8, h2 = s.h2 || 2.5;
    const wall = ctx.mat(s.color || '#F2D58E'), trim = ctx.mat(s.trim || '#F8EFDC'), dark = ctx.mat('#3A2E28');
    const glass = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, h1, wall));
    add(box(ctx, -w / 2 - 0.45, -d / 2 - 0.45, w / 2 + 0.45, d / 2 + 0.45, h1, h1 + 0.25, trim));
    for (let i = 0; i < 3; i++) { const u = -w / 2 + 0.6 + i * (w - 1.2) / 3; add(box(ctx, u + 0.15, d / 2 - 0.02, u + (w - 1.2) / 3 - 0.15, d / 2 + 0.05, 0.35, h1 - 0.35, glass, { round: 0 })); }
    const uw = w * 0.62, ud = d * 0.72, u0 = w * 0.14, v0 = -d / 2 + 0.3;
    add(box(ctx, u0 - uw / 2, v0, u0 + uw / 2, v0 + ud, h1 + 0.25, h1 + 0.25 + h2, wall));
    add(box(ctx, u0 - uw / 2 - 0.4, v0 - 0.4, u0 + uw / 2 + 0.4, v0 + ud + 0.4, h1 + 0.25 + h2, h1 + 0.5 + h2, trim));
    for (const f of [-0.25, 0.25]) add(box(ctx, u0 + f * uw - 0.7, v0 + ud - 0.02, u0 + f * uw + 0.7, v0 + ud + 0.05, h1 + 0.6, h1 + h2 - 0.2, glass, { round: 0 }));
    add(box(ctx, u0 - uw / 2, v0 + ud, u0 + uw / 2, d / 2 + 0.45, h1 + 0.25, h1 + 0.8, trim, { round: 0 }));
    const r = Math.min(2.2, w * 0.28), cu = -w / 2 + r + 0.2;
    add(ctx.g.arcSlab(cu, d / 2, 0, r, 0, 180, h1 - 0.02, h1 + 0.22, trim));
    for (const a of [20, 70, 110, 160]) { const A = a * Math.PI / 180; add(ctx.g.cyl(cu + Math.cos(A) * (r - 0.25), d / 2 + Math.sin(A) * (r - 0.25), 0.1, 0, h1, trim, { seg: 8 })); }
    add(box(ctx, -0.5, d / 2 - 0.02, 0.5, d / 2 + 0.05, 0, 2.1, dark, { round: 0 }));
    // carport on the west side
    const cw = s.carport ?? 3.4; if (cw) { const x0 = -w / 2 - cw, x1 = -w / 2 - 0.1, y0 = -d / 2 + 0.6, y1 = d / 2 + 0.6;
      for (const u of [x0 + 0.2, x1 - 0.1]) for (const v of [y0 + 0.2, y1 - 0.2]) add(ctx.g.cyl(u, v, 0.08, 0, 2.3, trim, { seg: 8 }));
      add(box(ctx, x0 - 0.2, y0 - 0.2, x1, y1 + 0.2, 2.3, 2.45, trim));
      const cu2 = (x0 + x1) / 2; add(box(ctx, cu2 - 0.85, y0 + 0.4, cu2 + 0.85, y1 - 0.4, 0.2, 1.0, ctx.mat(s.car || '#3A3A42'))); add(box(ctx, cu2 - 0.75, y0 + 1.2, cu2 + 0.75, y1 - 1.4, 1.0, 1.55, ctx.mat('#BFD3E0')));
      const [px, py] = W(cu2, (y0 + y1) / 2); addORect(px, py, cw, y1 - y0 + 0.4, rot, `${s.id} carport`); }
    const [cx, cy] = W(0, r / 2); addORect(cx, cy, w + 0.9, d + r + 0.9, rot, `${s.id} house`);
    return { group: grp };
  },
  // clay hut: round with a conical roof, or s.square for a square hut with a pyramid tiled roof (Purrom)
  hut(ctx, s) {
    const { grp, add, W, rot } = place(s); const r = s.r || 2, H = s.h || 1.9, roofH = s.roofH || 1.55;
    const wallM = ctx.mat(s.color || '#E3C9A0'), roofM = ctx.mat(s.roof || '#A9432B', { side: THREE.DoubleSide });
    if (s.square) {
      add(box(ctx, -r, -r, r, r, 0, H, wallM));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.62, roofH, 4), roofM); roof.rotation.y = Math.PI / 4; roof.position.copy(P(0, 0, H + roofH / 2)); roof.castShadow = roof.receiveShadow = true; add(roof);
      add(box(ctx, -0.45, r - 0.02, 0.45, r + 0.08, 0, 1.6, ctx.mat(s.door || '#C9A060'), { round: 0 }));
      add(box(ctx, -0.8, r, 0.8, r + 0.9, 0, 0.12, ctx.mat('#B9A583'), { round: 0 }));
      const [cx, cy] = W(0, 0); addORect(cx, cy, 2 * r + 0.3, 2 * r + 0.3, rot, `${s.id} hut`);
      return { group: grp };
    }
    add(ctx.g.cyl(0, 0, r, 0, H, wallM, { seg: 16 }));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.22, roofH, 16), roofM); roof.position.copy(P(0, 0, H + roofH / 2)); roof.castShadow = roof.receiveShadow = true; add(roof);
    add(box(ctx, -0.35, r - 0.04, 0.35, r + 0.06, 0, 1.4, ctx.mat('#3A2E28'), { round: 0 }));
    addCircle(s.x, s.y, r + 0.15, `${s.id} hut`);
    return { group: grp };
  },
  // timber pergola deck: posts, a slatted roof, a raised deck with tables and a few steps (Theeya)
  pergola(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 7, d = s.d || 4, H = s.h || 2.5, base = s.raised ?? 0.35;
    const wood = ctx.mat(s.post || '#6B4A2E'), deck = ctx.mat(s.deck || '#A87A4E'), roofM = ctx.mat(s.roof || '#5A4636');
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, base, deck));
    for (let i = 0; i <= 3; i++) { const u = -w / 2 + 0.15 + i * (w - 0.3) / 3; for (const v of [-d / 2 + 0.15, d / 2 - 0.15]) add(ctx.g.cyl(u, v, 0.08, base, base + H, wood, { seg: 8 })); }
    add(box(ctx, -w / 2 - 0.3, -d / 2 - 0.3, w / 2 + 0.3, d / 2 + 0.3, base + H, base + H + 0.12, roofM));
    for (let i = 0; i < 9; i++) { const u = -w / 2 + (i + 0.5) * w / 9; add(box(ctx, u - 0.06, -d / 2 - 0.5, u + 0.06, d / 2 + 0.5, base + H + 0.12, base + H + 0.28, wood, { round: 0 })); }
    for (let i = 0; i < (s.tables ?? 3); i++) { const u = -w / 2 + (i + 0.5) * w / (s.tables ?? 3); add(box(ctx, u - 0.55, -0.45, u + 0.55, 0.45, base + 0.7, base + 0.8, wood)); for (const dv of [-0.75, 0.75]) add(box(ctx, u - 0.5, dv - 0.12, u + 0.5, dv + 0.12, base, base + 0.45, wood)); }
    for (let i = 0; i < 2; i++) add(box(ctx, w / 2 - 1.6, d / 2 + i * 0.3, w / 2 - 0.4, d / 2 + (i + 1) * 0.3, 0, base * (2 - i) / 2, deck, { round: 0 }));
    const [cx, cy] = W(0, 0.3); addORect(cx, cy, w + 0.2, d + 0.8, rot, `${s.id} pergola`);
    return { group: grp };
  },
  // white event canopy / gazebo tent
  canopy(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 3, H = s.h || 2.3; const cloth = ctx.mat(s.color || '#F4F0E6', { side: THREE.DoubleSide }), post = ctx.mat('#D8D2C6');
    for (const u of [-w / 2, w / 2]) for (const v of [-w / 2, w / 2]) { add(ctx.g.cyl(u, v, 0.05, 0, H, post, { seg: 6 })); const [px, py] = W(u, v); addCircle(px, py, 0.1, `${s.id} canopy post`); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 1.0, 4, 1, true), cloth); roof.rotation.y = Math.PI / 4; roof.position.copy(P(0, 0, H + 0.5)); roof.castShadow = true; add(roof);
    add(box(ctx, -w / 2, -w / 2, w / 2, -w / 2 + 0.04, H - 0.3, H, cloth, { round: 0 })); add(box(ctx, -w / 2, w / 2 - 0.04, w / 2, w / 2, H - 0.3, H, cloth, { round: 0 }));
    if (s.tables !== 0) add(box(ctx, -w * 0.3, -0.35, w * 0.3, 0.35, 0.7, 0.8, ctx.mat('#7A5433')));
    return { group: grp };
  },
  // a cluster of clay pots
  pots(ctx, s) {
    const { grp, add } = place(s); const n = s.count || 6, cols = ['#A9542F', '#B8643A', '#8E4A2A'];
    for (let i = 0; i < n; i++) { const a = hash(i + s.x) * 6.28, r = 0.3 + hash(i * 3 + s.y) * (s.r || 1.4), sc = 0.25 + hash(i * 7) * 0.25; const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const m = add(ctx.g.sphere(x, y, sc * 0.9, sc, ctx.mat(cols[i % 3]), { seg: 10, seg2: 8 })); m.scale.y = 1.25; addCircle(s.x + x, s.y + y, sc, 'pot'); }
    return { group: grp };
  },
  // a flowering bush (bougainvillea): a mound of green with blossom
  bush(ctx, s) {
    const { grp, add } = place(s); const r = s.r || 1.2; const leaf = ctx.mat('#4F7A3E'), bloom = ctx.mat(s.color || '#D8367A');
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, rr = r * 0.5; add(ctx.g.sphere(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.55, r * 0.55, i % 2 ? bloom : leaf, { seg: 8, seg2: 6 })); }
    add(ctx.g.sphere(0, 0, r * 0.9, r * 0.6, bloom, { seg: 8, seg2: 6 })); addCircle(s.x, s.y, r, 'bush');
    return { group: grp };
  },
  // flea or food stall: table, posts and a striped canopy
  stall(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 2.2, d = s.d || 1.4; const wood = ctx.mat('#7A5433');
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2 - 0.5, 0, 0.85, wood));
    for (const u of [-w / 2, w / 2]) for (const v of [-d / 2, d / 2]) add(ctx.g.cyl(u, v, 0.05, 0, 2.2, wood, { seg: 6 }));
    const can = ctx.mat('#ffffff', { map: stripeTex(s.color || '#2F7F7A', '#F4E6CC', 8), noCache: true, side: THREE.DoubleSide });
    const c = add(box(ctx, -w / 2 - 0.15, -d / 2 - 0.15, w / 2 + 0.15, d / 2 + 0.15, 2.2, 2.32, can, { round: 0 })); c.rotation.x = 0.12;
    for (let i = 0; i < 5; i++) add(ctx.g.sphere(-w / 2 + 0.3 + i * (w - 0.6) / 4, -d / 2 + 0.3, 0.95, 0.12, ctx.mat(['#E07B39', '#D9A441', '#6E9A4B', '#B5523B', '#3E6AA0'][(i + (s.seed || 0)) % 5]), { seg: 8 }));
    const [cx, cy] = W(0, -0.25); addORect(cx, cy, w + 0.2, d - 0.3, rot, `${s.id} stall`);
    return { group: grp };
  },
  // tall festival tower with platforms and a pulsing beacon
  tower(ctx, s) {
    const { grp, add } = place(s); const H = s.h || 12; const steel = ctx.mat(s.color || '#8A5A36');
    add(ctx.g.cyl(0, 0, 0.55, 0, H, steel, { r2: 0.25, seg: 8 }));
    for (const z of [H * 0.35, H * 0.65, H * 0.9]) add(ctx.g.cyl(0, 0, 1.3 - z / H * 0.6, z, z + 0.15, ctx.mat('#5A3E2A'), { seg: 12 }));
    const beacon = ctx.glow(`beacon:${s.id}`, { on: s.glow || '#FF8FD0', off: '#C9B8A0', channel: 'night', day: 0.3, keepLit: true });
    const b = add(ctx.g.sphere(0, 0, H + 0.4, 0.5, beacon, { seg: 12 })); b.castShadow = false;
    addCircle(s.x, s.y, 0.7, `${s.id} tower`);
    return { group: grp, update: t => { b.scale.setScalar(1 + 0.12 * Math.sin(t * 3 + s.x)); }, dyn: true };
  },
  // wooden jetty from (x, y) out along its rotation into the water (decorative: the crowd does not walk on it)
  jetty(ctx, s) {
    const { grp, add } = place(s); const L = s.len || 6, w = s.w || 1.2; const wood = ctx.mat('#8A6440');
    add(box(ctx, 0, -w / 2, L, w / 2, 0.15, 0.3, wood, { round: 0 }));
    for (let u = 0.5; u <= L; u += 1.5) for (const v of [-w / 2, w / 2]) add(ctx.g.cyl(u, v, 0.06, -0.3, 0.45, wood, { seg: 6 }));
    return { group: grp };
  },
  // boats looping on the water: s.loop = plan points of a closed route, s.count boats, s.speed laps per second
  boats(ctx, s) {
    const grp = new THREE.Group(); const curve = new THREE.CatmullRomCurve3(s.loop.map(p => new THREE.Vector3(p[0], 0.05, p[1])), true);
    const hullM = ctx.mat('#7A4A2E'), sail = ctx.mat('#F4E6CC', { side: THREE.DoubleSide }), lamp = ctx.glow('boatlamp', { on: '#FFD08A', off: '#6A5A48', channel: 'night', day: 0 });
    const boats = [];
    for (let i = 0; i < (s.count || 4); i++) {
      const b = new THREE.Group(); const hull = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hullM); hull.scale.set(0.55, 0.45, 1.3); hull.castShadow = true; b.add(hull);
      if (i % 2 === 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), sail); m.position.set(0, 0.8, 0); m.rotation.y = Math.PI / 2; b.add(m); }
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lamp); l.position.set(0, 0.35, 0.9); b.add(l);
      grp.add(b); boats.push(b);
    }
    return { group: grp, dyn: true, update: t => { boats.forEach((b, i) => { const u = ((t * (s.speed || 0.004) + i / boats.length) % 1 + 1) % 1; const p = curve.getPointAt(u), q = curve.getPointAt((u + 0.002) % 1); b.position.set(p.x, 0.05 + 0.04 * Math.sin(t * 2 + i), p.z); b.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); b.rotation.z = 0.05 * Math.sin(t * 1.3 + i); }); } };
  },
  // floating lotus installation; lights up with channel 'lotusGlow'
  lotus(ctx, s) {
    const { grp, add } = place(s); const r = s.r || 2.2;
    const petal = ctx.glow('lotus', { on: '#FFB0D8', off: '#F2C9D8', channel: 'lotusGlow', day: 0.2, keepLit: true });
    const core = ctx.glow('lotuscore', { on: '#FFE9A0', off: '#E8D39A', channel: 'lotusGlow', day: 0.2, keepLit: true });
    const flower = new THREE.Group(); add(flower);
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) { const a = (i + ring * 0.5) / 8 * Math.PI * 2; const m = new THREE.Mesh(new THREE.SphereGeometry(r * (0.5 - ring * 0.14), 10, 8), petal); m.scale.set(0.35, 0.18, 1); m.position.set(Math.cos(a) * r * (0.45 - ring * 0.16), 0.25 + ring * 0.35, Math.sin(a) * r * (0.45 - ring * 0.16)); m.rotation.y = -a + Math.PI / 2; m.rotation.x = -0.5 - ring * 0.35; flower.add(m); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 12, 10), core); c.position.y = 0.55; flower.add(c);
    const pool = ctx.pool(grp, 0, 0, r * 2.2, '#FF9ACB', 'lotusGlow');
    return { group: grp, dyn: true, update: t => { const k = ctx.S.get('lotusGlow', t); flower.rotation.y = t * 0.05; flower.position.y = 0.05 * Math.sin(t * 1.1); flower.scale.setScalar(1 + 0.06 * k); pool(t); } };
  },
  // sculptures: 'head' (a serene giant head with a turning ring), 'ring' (a big frame to walk through), 'totem'
  sculpture(ctx, s) {
    const { grp, add, W } = place(s); const k = s.kind || 'head', H = s.h || 4; const brass = ctx.mat(s.color || '#C79A4B', { metal: 0.35, rough: 0.45 });
    if (k === 'head') {
      add(box(ctx, -0.8, -0.8, 0.8, 0.8, 0, 0.6, ctx.mat('#6E6258')));
      const head = new THREE.Mesh(new THREE.SphereGeometry(H * 0.32, 24, 18), brass); head.scale.set(0.82, 1, 0.9); head.position.copy(P(0, 0, 0.6 + H * 0.45)); head.castShadow = true; add(head);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.42, 0.08, 8, 40), ctx.mat('#8A5A36', { metal: 0.3 })); ring.position.copy(P(0, 0, 0.6 + H * 0.5)); add(ring);
      const eyeM = ctx.glow(`eyes:${s.id}`, { on: '#9FE8FF', off: '#3A3A40', channel: 'night', day: 0.1, keepLit: true });
      for (const sx of [-1, 1]) add(ctx.g.sphere(sx * H * 0.1, H * 0.27, 0.6 + H * 0.5, H * 0.035, eyeM, { seg: 8 }));
      addCircle(s.x, s.y, 1.0, `${s.id} sculpture`);
      return { group: grp, dyn: true, update: t => { ring.rotation.x = Math.PI / 2 + 0.15 * Math.sin(t * 0.4); ring.rotation.z = t * 0.2; } };
    }
    if (k === 'crystal') { const gm = ctx.glow(`crystal:${s.id}`, { on: s.glow || '#C9A0FF', off: s.color || '#9A7AC8', channel: 'night', day: 0.25, keepLit: true }); add(box(ctx, -0.7, -0.7, 0.7, 0.7, 0, 0.5, ctx.mat('#5A5048'))); for (const [dx, dy, sc] of [[0, 0, 1], [0.45, 0.25, 0.6], [-0.4, 0.3, 0.55]]) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 * sc, 0), gm); m.scale.set(1, H * 0.55 / sc * sc, 1); m.position.copy(P(dx, dy, 0.5 + H * 0.33 * sc)); m.rotation.y = dx * 2; m.castShadow = true; add(m); } addCircle(s.x, s.y, 0.8, `${s.id} crystal`); return { group: grp }; }
    if (k === 'ring') { const ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.5, 0.12, 8, 48), brass); ring.position.copy(P(0, 0, H * 0.5 + 0.1)); ring.castShadow = true; add(ring); const [cx, cy] = W(0, 0); addCircle(cx, cy, 0.25, `${s.id} ring`); return { group: grp }; }
    const cols = ['#B5523B', '#D9953F', '#2F7F7A', '#6E9A4B', '#3E6AA0'];
    for (let i = 0; i < 5; i++) add(box(ctx, -0.35 + hash(i + s.x) * 0.1, -0.35, 0.35, 0.35, i * H / 5, (i + 1) * H / 5 - 0.05, ctx.mat(cols[i % 5])));
    addCircle(s.x, s.y, 0.5, `${s.id} totem`); return { group: grp };
  },
  // string lights along plan points [[x, y], ...] on poles; the bulbs glow at night
  lanterns(ctx, s) {
    const grp = new THREE.Group(); const H = s.h || 3; const pole = ctx.mat('#5A4030'); const pts = s.pts;
    const bulbM = ctx.glow(`bulbs:${s.color || 'warm'}`, { on: s.color || '#FFD48A', off: '#8A7A60', channel: 'night', day: 0.05 });
    const pos = [];
    for (let i = 0; i < pts.length; i++) { grp.add(ctx.g.cyl(pts[i][0], pts[i][1], 0.05, 0, H, pole, { seg: 6 })); addCircle(pts[i][0], pts[i][1], 0.1, 'lantern pole');
      if (i < pts.length - 1) { const [a, b] = [pts[i], pts[i + 1]]; const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.7)); for (let k = 1; k < n; k++) { const f = k / n; pos.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f), H - 0.1 - 0.5 * Math.sin(f * Math.PI)]); } } }
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), bulbM, pos.length); const m4 = new THREE.Matrix4();
    pos.forEach((p, i) => { m4.makeTranslation(p[0], p[2], p[1]); inst.setMatrixAt(i, m4); }); inst.castShadow = false; grp.add(inst);
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pos.map(p => new THREE.Vector3(p[0], p[2] + 0.03, p[1]))), new THREE.LineBasicMaterial({ color: '#3A3030' })));
    return { group: grp };
  },
  // outdoor cinema screen with rows of benches
  screen(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 7, H = s.h || 4; const frame = ctx.mat('#2A2A30');
    for (const u of [-w / 2, w / 2]) add(ctx.g.cyl(u, 0, 0.12, 0, H + 1, frame, { seg: 8 }));
    const scr = ctx.glow(`screen:${s.id}`, { on: s.glow || '#BFD6FF', off: '#EDEAE2', channel: 'stageOn', arg: s.show ?? s.area ?? s.id, day: 0.3, keepLit: true });
    add(box(ctx, -w / 2, -0.08, w / 2, 0.08, 1, H + 1, scr, { round: 0 }));
    const bench = ctx.mat('#7A5433');
    for (let r = 0; r < (s.rows || 3); r++) { const v = 2.2 + r * 1.4; add(box(ctx, -w / 2 + 0.6, v - 0.2, w / 2 - 0.6, v + 0.2, 0, 0.45, bench)); const [bx, by] = W(0, v); addORect(bx, by, w - 1.0, 0.5, rot, `${s.id} bench`); }
    const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.3, 0.4, rot, `${s.id} screen`);
    return { group: grp };
  },
  // theatre building with a marquee that lights with the show; s.veranda adds a colonial-style covered porch across the front
  theatre(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 8, d = s.d || 6, H = s.h || 4.5, b = s.plinth || 0, ov = 1.15;
    if (b > 0) { const stone = ctx.mat(s.stone || '#B9A583'); add(box(ctx, -w / 2 - 0.5, -d / 2 - 0.5, w / 2 + 0.5, d / 2 + (s.veranda ? ov : 0) + 0.3, 0, b, stone));
      const n = Math.max(3, Math.round(b / 0.2)); for (let i = 0; i < n; i++) add(box(ctx, -1.3, d / 2 + (s.veranda ? ov : 0) + 0.3 + i * 0.3, 1.3, d / 2 + (s.veranda ? ov : 0) + 0.3 + (i + 1) * 0.3, 0, b * (n - i) / n, stone, { round: 0 })); }
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, b, b + H, ctx.mat(s.color || '#D9C2A0')));
    add(gable(w, d, s.roofH || 1.6, b + H, 0.45, ctx.mat(s.roof || '#6A3A2E', { side: THREE.DoubleSide })));
    const win = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    for (const u of [-w * 0.33, w * 0.33]) add(box(ctx, u - 0.4, d / 2 - 0.02, u + 0.4, d / 2 + 0.05, b + H * 0.3, b + H * 0.72, win, { round: 0 }));
    if (s.veranda) {
      const postM = ctx.mat(s.rail || '#F4EADD');
      add(box(ctx, -w / 2 - ov * 0.1, d / 2, w / 2 + ov * 0.1, d / 2 + ov, b + H * 0.72, b + H * 0.8, postM));
      const np = Math.max(2, Math.round(w / 1.7));
      for (let i = 0; i <= np; i++) { const u = -w / 2 + 0.5 + i * (w - 1.0) / np; add(ctx.g.cyl(u, d / 2 + ov - 0.18, 0.1, b, b + H * 0.72, postM, { seg: 10 })); }
      for (let i = 0; i <= np * 3; i++) { const u = -w / 2 + 0.5 + i * (w - 1.0) / (np * 3); if (Math.abs(u) < 1.2) continue; add(box(ctx, u - 0.03, d / 2 + ov - 0.2, u + 0.03, d / 2 + ov - 0.16, b, b + 0.7, postM, { round: 0 })); }
      add(box(ctx, -w / 2 + 0.5, d / 2 + ov - 0.22, -1.2, d / 2 + ov - 0.14, b + 0.62, b + 0.72, postM, { round: 0 })); add(box(ctx, 1.2, d / 2 + ov - 0.22, w / 2 - 0.5, d / 2 + ov - 0.14, b + 0.62, b + 0.72, postM, { round: 0 }));
    }
    const marq = ctx.glow(`marquee:${s.id}`, { on: '#FFE08A', off: s.marquee || '#B5523B', channel: 'stageOn', arg: s.show ?? s.area ?? s.id, day: 0.5, keepLit: true });
    add(box(ctx, -w * 0.2, d / 2, w * 0.2, d / 2 + 0.12, b + H * 0.8, b + H * 0.95, marq, { round: 0 }));
    add(box(ctx, -0.8, d / 2 - 0.02, 0.8, d / 2 + 0.05, b, b + 2.3, ctx.mat('#5A3A2A'), { round: 0 }));
    const extra = b > 0 ? 1.5 : 0; const [cx, cy] = W(0, ((s.veranda ? ov : 0) + extra) / 2); addORect(cx, cy, w + 1.2, d + (s.veranda ? ov : 0) + extra + 1.0, rot, `${s.id} theatre`);
    return { group: grp };
  },
  // entrance arch with a painted sign board (s.text)
  arch(ctx, s) {
    const { grp, add, W } = place(s); const w = s.w || 6, H = s.h || 4; const wood = ctx.mat('#7A5433');
    for (const u of [-w / 2, w / 2]) { add(ctx.g.cyl(u, 0, 0.18, 0, H, wood, { seg: 8 })); const [px, py] = W(u, 0); addCircle(px, py, 0.25, 'arch post'); }
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d'); x.fillStyle = s.board || '#2A2226'; x.fillRect(0, 0, 1024, 256);
    x.fillStyle = s.ink || '#F4E6CC'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${s.size || 110}px ${s.font || 'Georgia, serif'}`; x.fillText(s.text || 'WELCOME', 512, 136);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const bh = (w + 0.6) / 4; const board = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, bh), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false }));
    board.position.copy(P(0, 0.2, H - 0.3)); add(board); add(box(ctx, -w / 2 - 0.3, 0.05, w / 2 + 0.3, 0.18, H - 0.3 - bh / 2 - 0.05, H - 0.3 + bh / 2 + 0.05, wood, { round: 0 }));
    if (s.neon) { const nn = neonPlane(ctx, s, w + 0.6, bh, [s.text || 'WELCOME'], s.size || 110, f => `700 ${f}px ${s.font || 'Georgia, serif'}`, 0.22, H - 0.3, 1024, 256); grp.add(nn.mesh); return { group: grp, canvas: c, tex: t, dyn: true, update: nn.update }; }
    return { group: grp, canvas: c, tex: t };
  },
  // parked cars in a row (the check-in car park)
  cars(ctx, s) {
    const { grp, add, W, rot } = place(s); const n = s.count || 6; const cols = ['#C8412F', '#3E6AA0', '#E8E2D2', '#6E9A4B', '#2A2A30', '#D9A441'];
    for (let i = 0; i < n; i++) { const u = (i - (n - 1) / 2) * 2.4; const m = ctx.mat(cols[(i + (s.seed || 0)) % cols.length]);
      add(box(ctx, u - 0.85, -2, u + 0.85, 2, 0.2, 1.0, m)); add(box(ctx, u - 0.75, -1.1, u + 0.75, 0.9, 1.0, 1.6, ctx.mat('#BFD3E0')));
      const [cx, cy] = W(u, 0); addORect(cx, cy, 1.9, 4.2, rot, 'car'); }
    return { group: grp };
  },
  // a fire pit with a flickering glow
  fire(ctx, s) {
    const { grp, add } = place(s); const logs = ctx.mat('#5A3A22');
    for (let i = 0; i < 3; i++) { const l = add(box(ctx, -0.5, -0.07, 0.5, 0.07, 0, 0.14, logs, { round: 0 })); l.rotation.y = i * Math.PI / 3; }
    const flameM = ctx.glow('flame', { on: '#FFB347', off: '#FF9A3C', channel: 'night', day: 0.6, keepLit: true });
    const f = add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), flameM)); f.position.set(0, 0.5, 0); f.castShadow = false;
    const pool = ctx.pool(grp, 0, 0, 3.2, '#FF9A3C', 'night');
    addCircle(s.x, s.y, 0.6, 'fire');
    return { group: grp, dyn: true, update: t => { f.scale.set(1, 0.8 + 0.25 * Math.sin(t * 11 + s.x) * Math.sin(t * 7), 1); pool(t); } };
  },
  // hovering drones with lights (channel 'dronesOn')
  drones(ctx, s) {
    const grp = new THREE.Group(); const n = s.count || 8; const body = ctx.mat('#3A3A42'); const lt = ctx.glow('drone', { on: s.glow || '#7FE7FF', off: '#A0A8B0', channel: 'dronesOn', day: 0.4, keepLit: true });
    const ds = [];
    for (let i = 0; i < n; i++) { const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.45), body)); for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), body); r.position.set(a * 0.3, 0.07, b * 0.3); d.add(r); } const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lt); l.position.y = -0.1; d.add(l); grp.add(d); ds.push(d); }
    return { group: grp, dyn: true, update: t => { const on = ctx.S.get('dronesOn', t); ds.forEach((d, i) => { const a = i / n * Math.PI * 2 + t * 0.25; const R = (s.r || 5) * (0.8 + 0.2 * Math.sin(t * 0.5 + i)); d.position.set(s.x + Math.cos(a) * R, lerp(0.3, (s.h || 7) + Math.sin(t * 1.3 + i) * 0.5, smooth(on)), s.y + Math.sin(a) * R); d.visible = on > 0.02; }); } };
  },
  // audience extras: cheap instanced figures in a fan in front of a stage; channel 'crowd' (arg: area) sets how many are out,
  // 'stageOn' (arg: area) makes them bounce. s.face is the direction (radians) from the focus point towards the crowd.
  audience(ctx, s) {
    const grp = new THREE.Group(); const n = s.count || 40;
    const body = new THREE.CapsuleGeometry(0.16, 0.7, 3, 8); body.translate(0, 0.55, 0); const head = new THREE.SphereGeometry(0.13, 8, 6); head.translate(0, 1.2, 0);
    const geo = ctx.mergeGeometries([body, head]);
    const m = new THREE.InstancedMesh(geo, ctx.mat('#ffffff', { noCache: true }), n); m.castShadow = false;
    const cols = ['#C8412F', '#3E6AA0', '#E8E2D2', '#6E9A4B', '#D9A441', '#7A4A8C', '#2F7F7A', '#E07B39']; const c = new THREE.Color();
    const spots = []; let tries = 0; const a0 = s.a0 ?? -0.9, a1 = s.a1 ?? 0.9;
    while (spots.length < n && tries++ < n * 40) { const a = (s.face || 0) + a0 + hash(tries * 3.1 + s.x) * (a1 - a0); const r = (s.r0 || 2) + hash(tries * 7.7 + s.y) * ((s.r1 || 7) - (s.r0 || 2)); const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r;
      if (ctx.hit(x, y, 0.22) || spots.some(p => Math.hypot(p[0] - x, p[1] - y) < 0.5)) continue; spots.push([x, y, hash(tries)]); }
    spots.forEach((p, i) => m.setColorAt(i, c.set(cols[i % cols.length]))); m.count = spots.length; grp.add(m);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Vp = new THREE.Vector3(), Sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    return { group: grp, spots, dyn: true, update: t => { const k = ctx.S.get('crowd', t, s.area); const ex = ctx.S.get('stageOn', t, s.area);
      spots.forEach((p, i) => { const on = p[2] < k; Q.setFromAxisAngle(up, Math.atan2(s.x - p[0], s.y - p[1])); const bob = on ? Math.max(0, Math.sin(t * 6 + i * 1.7)) * 0.12 * ex : 0; Vp.set(p[0], bob, p[1]); const sc = on ? 0.95 + p[2] * 0.12 : 0; Sc.set(sc, sc, sc); M.compose(Vp, Q, Sc); m.setMatrixAt(i, M); });
      m.instanceMatrix.needsUpdate = true; } };
  },
  bench(ctx, s) { const { grp, add, W, rot } = place(s); const w = s.w || 1.8; const wood = ctx.mat('#7A5433'); add(box(ctx, -w / 2, -0.2, w / 2, 0.2, 0.35, 0.45, wood)); for (const u of [-w / 2 + 0.15, w / 2 - 0.15]) add(box(ctx, u - 0.05, -0.18, u + 0.05, 0.18, 0, 0.35, wood)); const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.1, 0.5, rot, 'bench'); return { group: grp }; },
};
