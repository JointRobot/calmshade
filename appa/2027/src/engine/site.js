// isokit · builds the whole world from the project's SITE data: painted ground (paths, fields, plazas, shores),
// water, hills, scattered trees, areas (venues) made of KIT parts, site-wide parts, and the day-to-night light.
// Returns { root, areas, update(t, opts), bounds }. Everything animated reads story channels (see story.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from './world.js';
import { KIT } from './kit.js';
import { addPoly, addCircle, hit } from './obstacles.js';
import { floorTex } from './painter.js';
import { mergeStatic } from './merge.js';
import { S } from './story.js';
import { lerp, clamp, smooth, hash, rng, easeOutBack } from './util.js';

const smoothPoly = (pts, n = 8) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal'); return c.getPoints(pts.length * n).slice(0, -1).map(v => [v.x, v.z]); };
const distSeg = (x, y, a, b) => { const ex = b[0] - a[0], ey = b[1] - a[1], L = ex * ex + ey * ey || 1e-9; const t = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / L, 0, 1); return Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t); };
export const distPath = (x, y, pts) => { let d = Infinity; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(x, y, pts[i], pts[i + 1])); return d; };
const inPoly = (x, y, P0) => { let ins = false; for (let i = 0, j = P0.length - 1; i < P0.length; j = i++) { const [xa, ya] = P0[j], [xb, yb] = P0[i]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) ins = !ins; } return ins; };
const col = h => new THREE.Color(h);

export function buildSite(world, mat, g, style, SITE) {
  const root = new THREE.Group(); world.scene.add(root);
  const [X0, Y0, X1, Y1] = SITE.bounds; const W = X1 - X0, H = Y1 - Y0;
  const glows = [], anims = [], pools = [];
  const glowCache = new Map();
  const ctx = {
    mat, g, S, world, style, hit, mergeGeometries,
    // a material that glows with a channel: off colour by day, on colour lit up by the channel (and the night)
    glow(key, o) { if (glowCache.has(key)) return glowCache.get(key); const m = mat(o.map ? '#ffffff' : o.off, { emissive: o.on, emissiveIntensity: 0, noCache: true, map: o.map }); if (o.map) { m.emissiveMap = o.map; m.needsUpdate = true; } glows.push({ m, ...o }); glowCache.set(key, m); return m; },
    // a soft additive light pool on the ground (fake light), strength from a channel
    pool(parent, x, y, r, color, channel, arg) {
      const m = new THREE.MeshBasicMaterial({ map: poolTex(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m); mesh.rotation.x = -Math.PI / 2; mesh.position.copy(P(x, y, 0.06)); mesh.renderOrder = 2; parent.add(mesh);
      return t => { const k = channel === 'night' ? night : S.get(channel, t, arg) * lerp(0.35, 1, night); m.opacity = 0.55 * k; mesh.visible = k > 0.01; };
    },
    // light beams from a truss: list of [u, v, z, du, dv] in the parent's local plan coordinates
    beams(parent, list, color, channel, arg) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, alphaMap: beamTex() });
      const ms = list.map(([u, v, z, du, dv]) => { const len = z; const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, len, 16, 1, true), m); c.position.copy(P(u + du / 2, v + (dv - v) / 2, z / 2)); c.rotation.x = Math.atan2(dv - v, len) * 0.9; c.renderOrder = 3; parent.add(c); return c; });
      return t => { const k = S.get(channel, t, arg); m.opacity = 0.16 * k * lerp(0.25, 1, night); for (const c of ms) c.visible = k > 0.02; };
    },
  };
  let beamT = null; function beamTex() { if (beamT) return beamT; const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#555555'); gr.addColorStop(1, '#000000'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); beamT = new THREE.CanvasTexture(c); return beamT; }
  let poolT = null; function poolTex() { if (poolT) return poolT; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); poolT = new THREE.CanvasTexture(c); return poolT; }

  // ---------- ground: one slab with a painted top (grass, fields, plazas, shores, paths) ----------
  const G0 = SITE.ground || {}; const ppm = G0.ppm || 12;
  const water = (SITE.water || []).map(w => ({ ...w, poly: smoothPoly(w.pts, 6) }));
  const areas = SITE.areas || [];
  const ft = floorTex(X0, Y0, W, H, ppm, c => {
    c.fillStyle = G0.color || '#9DB36A'; c.fillRect(X0, Y0, W, H);
    const r = rng(7); for (let i = 0; i < W * H * 0.25; i++) { c.fillStyle = `rgba(${40 + r() * 60 | 0},${70 + r() * 60 | 0},${20 + r() * 40 | 0},${0.08 + r() * 0.1})`; c.beginPath(); c.arc(X0 + r() * W, Y0 + r() * H, 0.2 + r() * 0.9, 0, 7); c.fill(); }
    for (const f of G0.fields || []) { c.save(); c.translate(f.x, f.y); c.rotate(f.rot || 0); c.fillStyle = f.color || '#C9B46A'; c.fillRect(-f.w / 2, -f.d / 2, f.w, f.d); c.strokeStyle = f.rows || 'rgba(90,110,40,0.55)'; c.lineWidth = 0.18; for (let u = -f.w / 2 + 0.4; u < f.w / 2; u += 0.7) { c.beginPath(); c.moveTo(u, -f.d / 2 + 0.2); c.lineTo(u, f.d / 2 - 0.2); c.stroke(); } c.restore(); }
    for (const w of water) { c.fillStyle = w.shore || '#D9C79A'; c.beginPath(); w.poly.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.lineWidth = w.shoreWidth || 2.4; c.strokeStyle = w.shore || '#D9C79A'; c.stroke(); c.fill(); }
    for (const a of areas) { if (!a.floor) continue; c.fillStyle = a.floor; const [cx, cy] = a.center; c.beginPath(); if (a.rect) { const [x0, y0, x1, y1] = a.rect; const rr = 1.5; c.roundRect(x0, y0, x1 - x0, y1 - y0, rr); } else c.ellipse(cx, cy, a.r || 8, (a.r || 8) * 0.8, 0, 0, 7); c.fill(); }
    for (const p of SITE.paths || []) { c.strokeStyle = p.edge || 'rgba(120,90,50,0.35)'; c.lineWidth = (p.width || 2) + 0.5; c.beginPath(); p.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (p.loop) c.closePath(); c.stroke(); c.strokeStyle = p.color || '#D8C096'; c.lineWidth = p.width || 2; c.stroke(); if (p.dash) { c.setLineDash([0.6, 0.8]); c.strokeStyle = p.dash; c.lineWidth = 0.12; c.stroke(); c.setLineDash([]); } }
  });
  const slab = g.box(X0, Y0, X1, Y1, -(G0.depth || 1.2), 0, mat(G0.edge || '#7A5A3A'), { round: 0 }); root.add(slab);
  const top = g.plane('F', X0, Y0, W, H, 0.0, mat('#ffffff', { map: ft.tex, noCache: true })); root.add(top);
  addPoly([[X0 - 3, Y0 - 3], [X1 + 3, Y0 - 3], [X1 + 3, Y0 + 0.3], [X0 - 3, Y0 + 0.3]], 'edge'); addPoly([[X0 - 3, Y1 - 0.3], [X1 + 3, Y1 - 0.3], [X1 + 3, Y1 + 3], [X0 - 3, Y1 + 3]], 'edge');
  addPoly([[X0 - 3, Y0], [X0 + 0.3, Y0], [X0 + 0.3, Y1], [X0 - 3, Y1]], 'edge'); addPoly([[X1 - 0.3, Y0], [X1 + 3, Y0], [X1 + 3, Y1], [X1 - 0.3, Y1]], 'edge');

  // ---------- water: a lit surface with a slow ripple texture; the crowd keeps to the shore ----------
  const waterMats = [];
  let ripple = null;
  for (const w of water) {
    const shape = new THREE.Shape(w.poly.map(([x, y]) => new THREE.Vector2(x, -y)));
    if (!ripple) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256); const r = rng(3); x.strokeStyle = 'rgba(40,70,110,0.16)'; x.lineWidth = 2; for (let i = 0; i < 90; i++) { const y = r() * 256, x0 = r() * 256, L = 12 + r() * 30; x.beginPath(); x.moveTo(x0, y); x.quadraticCurveTo(x0 + L / 2, y - 3, x0 + L, y); x.stroke(); } ripple = new THREE.CanvasTexture(c); ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(W / 18, W / 18); ripple.colorSpace = THREE.SRGBColorSpace; }
    const m = mat(w.color || '#6FA8C8', { map: ripple, noCache: true, rough: 0.35 }); waterMats.push({ m, w });
    const geo = new THREE.ShapeGeometry(shape, 8); geo.rotateX(-Math.PI / 2); const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 20, pos.getZ(i) / 20);
    const mesh = new THREE.Mesh(geo, m); mesh.position.y = 0.035; mesh.receiveShadow = true; root.add(mesh);
    if (w.shallow) { let cx = 0, cy = 0; for (const [x, y] of w.poly) { cx += x; cy += y; } cx /= w.poly.length; cy /= w.poly.length; const rim = w.poly.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / d * 1.3, y + (y - cy) / d * 1.3]; });
      const sg = new THREE.ShapeGeometry(new THREE.Shape(rim.map(([x, y]) => new THREE.Vector2(x, -y))), 8); sg.rotateX(-Math.PI / 2); const sm = new THREE.Mesh(sg, mat(w.shallow)); sm.position.y = 0.02; sm.receiveShadow = true; root.add(sm); waterMats.push({ m: sm.material, w: { color: w.shallow, dusk: w.shallowDusk || '#C9B8C8', night: w.shallowNight || '#2A3868' } }); }
    addPoly(w.poly, w.id || 'water');
  }

  // ---------- hills (decorative mounds near the edges) ----------
  for (const h of SITE.hills || []) {
    const prof = []; for (let i = 0; i <= 10; i++) { const f = i / 10; prof.push(new THREE.Vector2(Math.max(0.01, (1 - f) * h.r), h.h * Math.sin(f * Math.PI / 2) ** 1.6)); }
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat(h.color || '#7F9A55')); m.scale.set(1, 1, (h.ry || h.r) / h.r); m.position.copy(P(h.x, h.y, 0)); m.castShadow = m.receiveShadow = true; root.add(m);
    addCircle(h.x, h.y, h.r * 0.85, 'hill');
  }

  // ---------- areas (venues): a group each, built from KIT parts; can rise in with channel 'buildIn' ----------
  const AREAS = {};
  for (const a of areas) {
    const grp = new THREE.Group(); grp.name = a.id; root.add(grp); const parts = [];
    (a.structures || []).forEach((s, i) => { const f = KIT[s.type]; if (!f) { console.warn('unknown part', s.type); return; } const r = f(ctx, { ...s, id: s.id || `${a.id}-${s.type}-${i}`, area: a.id }); if (r.dyn) r.group.userData.dyn = true; grp.add(r.group); parts.push(r); if (r.update) anims.push(r.update); });
    mergeStatic(grp);
    AREAS[a.id] = { ...a, group: grp, parts };
  }
  // site-wide parts (boats, lanterns along paths, towers, drones)
  const siteGrp = new THREE.Group(); root.add(siteGrp);
  (SITE.structures || []).forEach((s, i) => { const f = KIT[s.type]; if (!f) return; const r = f(ctx, { ...s, id: s.id || `site-${s.type}-${i}` }); if (r.dyn) r.group.userData.dyn = true; siteGrp.add(r.group); if (r.update) anims.push(r.update); });
  mergeStatic(siteGrp);

  // ---------- trees: scattered by seed, avoiding water, areas, paths and obstacles; instanced per kind ----------
  const TS = SITE.trees || {}; const treeSpots = [...(TS.list || [])];
  if (TS.count) { const r = rng(TS.seed || 11); let tries = 0;
    while (treeSpots.length < TS.count + (TS.list || []).length && tries++ < TS.count * 30) { const x = X0 + 1.5 + r() * (W - 3), y = Y0 + 1.5 + r() * (H - 3);
      if (water.some(w => inPoly(x, y, w.poly)) || water.some(w => distPath(x, y, [...w.poly, w.poly[0]]) < (w.shoreWidth || 2.4) / 2 + 1.2)) continue;
      if (areas.some(a => a.rect ? x > a.rect[0] - 1 && x < a.rect[2] + 1 && y > a.rect[1] - 1 && y < a.rect[3] + 1 : Math.hypot(x - a.center[0], y - a.center[1]) < (a.r || 8) + 1)) continue;
      if ((SITE.paths || []).some(p => distPath(x, y, p.loop ? [...p.pts, p.pts[0]] : p.pts) < (p.width || 2) / 2 + 1)) continue;
      if ((G0.fields || []).some(f => Math.abs(x - f.x) < f.w / 2 + 0.5 && Math.abs(y - f.y) < f.d / 2 + 0.5)) continue;
      if (hit(x, y, 0.8)) continue; treeSpots.push([x, y, 0.8 + r() * 0.6, r() < (TS.pineShare ?? 0.3) ? 1 : 0]); } }
  for (const [hi, h] of (SITE.hills || []).entries()) { const r = rng(900 + hi); const n = Math.round(h.r * (TS.hillDensity ?? 1.4)); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, f = Math.sqrt(r()) * 0.8; const x = h.x + Math.cos(a) * h.r * f, y = h.y + Math.sin(a) * (h.ry || h.r) * f; if (x < X0 + 1 || y < Y0 + 1 || x > X1 - 1 || y > Y1 - 1) continue; const z = h.h * Math.pow(Math.sin((1 - f) * Math.PI / 2), 1.6); treeSpots.push([x, y, 0.9 + r() * 0.5, r() < 0.5 ? 1 : 0, z]); } }
  const kinds = [{ crown: new THREE.IcosahedronGeometry(1.1, 0), cz: 2.3, trunkH: 1.6 }, { crown: new THREE.ConeGeometry(0.9, 2.6, 7), cz: 2.6, trunkH: 1.3 }];
  const greens = TS.colors || ['#5E8A45', '#6E9A4B', '#4F7A3E', '#7FA35A', '#8AA84E'];
  kinds.forEach((k, ki) => { const spots = treeSpots.filter(s => (s[3] || 0) === ki); if (!spots.length) return;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, k.trunkH, 6).translate(0, k.trunkH / 2, 0), mat('#6B4A2E'), spots.length);
    const crown = new THREE.InstancedMesh(k.crown.clone().translate(0, k.cz, 0), mat('#ffffff', { noCache: true }), spots.length); const M = new THREE.Matrix4(), c = new THREE.Color();
    spots.forEach((s, i) => { const sc = s[2]; M.makeRotationY(hash(i + ki) * 6); M.scale(new THREE.Vector3(sc, sc * (0.9 + hash(i * 3) * 0.3), sc)); M.setPosition(s[0], (s[4] || 0) - 0.1, s[1]); trunk.setMatrixAt(i, M); crown.setMatrixAt(i, M); crown.setColorAt(i, c.set(greens[(i + ki) % greens.length])); if (!s[4]) addCircle(s[0], s[1], 0.35 * sc, 'tree'); });
    trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true; root.add(trunk, crown); });

  // ---------- light: time of day drives sun, sky, water and every glow ----------
  const amb = world.scene.children.find(o => o.isAmbientLight), hemi = world.scene.children.find(o => o.isHemisphereLight);
  const base = { key: world.key.intensity, amb: amb ? amb.intensity : 0, hemi: hemi ? hemi.intensity : 0, keyCol: col(style.keyColor || '#FFFFFF'), shadow: world.key.shadow.intensity };
  const SKY = SITE.sky || { day: ['#F4E9DA', '#E8D8C2'], dusk: ['#F6C98A', '#E58F6A'], night: ['#141A33', '#2A2F55'] };
  const bgCan = world.scene.background && world.scene.background.image; let lastBg = '';
  let night = 0;
  function light(t) {
    const tod = S.get('timeOfDay', t); night = smooth((tod - 0.55) / 0.33); const dusk = Math.max(0, 1 - Math.abs(tod - 0.5) / 0.22) * (1 - night);
    world.key.intensity = base.key * lerp(1, 0.2, night) * lerp(1, 0.85, dusk);
    world.key.color.copy(base.keyCol).lerp(col('#FFB070'), dusk * 0.7).lerp(col('#8FA4E0'), night);
    world.key.shadow.intensity = base.shadow * lerp(1, 0.4, night);
    if (amb) { amb.intensity = base.amb * lerp(1, 0.75, night); amb.color.set('#FFF4E6').lerp(col('#5A6AA0'), night); }
    if (hemi) { hemi.intensity = base.hemi * lerp(1, 0.45, night) * lerp(1, 0.9, dusk); hemi.color.set('#FFF6EA').lerp(col('#FFC89A'), dusk).lerp(col('#7080C0'), night); }
    const mixC = (a, b, c2) => col(a).lerp(col(b), dusk).lerp(col(c2), night);
    const top = mixC(SKY.day[0], SKY.dusk[0], SKY.night[0]), bot = mixC(SKY.day[1], SKY.dusk[1], SKY.night[1]);
    const key = top.getHexString() + bot.getHexString();
    if (bgCan && key !== lastBg) { lastBg = key; const x = bgCan.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, bgCan.height); gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(1, '#' + bot.getHexString()); x.fillStyle = gr; x.fillRect(0, 0, bgCan.width, bgCan.height); world.scene.background.needsUpdate = true; }
    for (const { m, w } of waterMats) { m.color.set(w.color || '#6FA8C8').lerp(col(w.dusk || '#86A9D8'), dusk * 0.55).lerp(col(w.night || '#1E2A50'), night); }
    if (ripple) ripple.offset.set((t * 0.004) % 1, (t * 0.0025) % 1);
    for (const gl of glows) { const k = gl.channel === 'night' ? night : S.get(gl.channel, t, gl.arg) * lerp(gl.day ?? 0.3, 1, night); gl.m.emissiveIntensity = 1.7 * k; }
  }
  // venues rising in (channel 'buildIn', arg area id), used by the tour's opening
  function build(t) { for (const id in AREAS) { if (!S.channels.buildIn) return; const k = clamp(S.get('buildIn', t, id), 0, 1); const grp = AREAS[id].group; grp.visible = k > 0.001; const e = easeOutBack(k); grp.scale.set(1, Math.max(0.001, e), 1); } }

  return {
    root, areas: AREAS, bounds: SITE.bounds, ctx,
    get night() { return night; },
    update(t) { light(t); build(t); for (const f of anims) f(t); }
  };
}
