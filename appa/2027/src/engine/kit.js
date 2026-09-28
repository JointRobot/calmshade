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
  // open pavilion: posts and a gabled roof (workshops, food courts); s.tables adds tables inside
  pavilion(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 6, d = s.d || 4, H = s.h || 2.6; const wood = ctx.mat(s.post || '#7A5433'), roofM = ctx.mat(s.roof || '#B8643A', { side: THREE.DoubleSide });
    for (const u of [-w / 2, 0, w / 2]) for (const v of [-d / 2, d / 2]) add(ctx.g.cyl(u, v, 0.09, 0, H, wood, { seg: 8 }));
    add(gable(w, d, 1.3, H, 0.35, roofM));
    add(box(ctx, -w / 2 + 0.2, -d / 2 + 0.2, w / 2 - 0.2, d / 2 - 0.2, 0, 0.12, ctx.mat(s.floor || '#C9A77A')));
    if (s.tables) for (let i = 0; i < s.tables; i++) { const u = -w / 2 + (i + 0.5) * w / s.tables; add(box(ctx, u - 0.5, -0.4, u + 0.5, 0.4, 0.45, 0.55, wood)); const [tx, ty] = W(u, 0); addORect(tx, ty, 1.2, 1.0, rot, `${s.id} table`); }
    for (const u of [-w / 2, 0, w / 2]) for (const v of [-d / 2, d / 2]) { const [px, py] = W(u, v); addCircle(px, py, 0.12, `${s.id} post`); }
    return { group: grp };
  },
  // village house with a gabled roof and windows that light at night
  house(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 4, d = s.d || 3, H = s.h || 2.4;
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, H, ctx.mat(s.color || '#E7D6B8')));
    add(gable(w, d, 1.2, H, 0.3, ctx.mat(s.roof || '#A94F32', { side: THREE.DoubleSide })));
    add(box(ctx, -0.4, d / 2 - 0.02, 0.4, d / 2 + 0.04, 0, 1.8, ctx.mat('#3A2E28'), { round: 0 }));
    const win = ctx.glow('window', { on: '#FFCB70', off: '#4A5560', channel: 'night', day: 0 });
    for (const u of [-w / 3, w / 3]) add(box(ctx, u - 0.3, d / 2 - 0.02, u + 0.3, d / 2 + 0.04, 1.0, 1.6, win, { round: 0 }));
    const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.2, d + 0.2, rot, `${s.id} house`);
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
  // theatre building with a marquee that lights with the show
  theatre(ctx, s) {
    const { grp, add, W, rot } = place(s); const w = s.w || 8, d = s.d || 6, H = s.h || 4.5;
    add(box(ctx, -w / 2, -d / 2, w / 2, d / 2, 0, H, ctx.mat(s.color || '#D9C2A0')));
    add(gable(w, d, 1.6, H, 0.3, ctx.mat(s.roof || '#6A3A2E', { side: THREE.DoubleSide })));
    const marq = ctx.glow(`marquee:${s.id}`, { on: '#FFE08A', off: '#B5523B', channel: 'stageOn', arg: s.show ?? s.area ?? s.id, day: 0.5, keepLit: true });
    add(box(ctx, -w * 0.35, d / 2, w * 0.35, d / 2 + 0.6, H * 0.62, H * 0.78, marq, { round: 0 }));
    add(box(ctx, -0.9, d / 2 - 0.02, 0.9, d / 2 + 0.05, 0, 2.3, ctx.mat('#2A2226'), { round: 0 }));
    const [cx, cy] = W(0, 0); addORect(cx, cy, w + 0.2, d + 0.2, rot, `${s.id} theatre`);
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
