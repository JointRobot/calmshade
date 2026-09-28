// isokit · the people: walkers with itineraries, wanderers looping inside areas, cyclists on path loops,
// performers on stages. Positions and poses are pure functions of time, so the video and the app agree.
// Walkers never pass through anything: routes are planned on a nav grid around every registered footprint,
// and validate() proves it (collisions, standing overlaps, cyclist lanes) before any render.
import * as THREE from 'three';
import { P } from './world.js';
import { lerp, clamp, smooth, env, rng } from './util.js';
import { makePerson, faceTo, POSES, blendPose, addPose, walkPose } from './rig.js';
import { hit, pushOut } from './obstacles.js';
import { buildNav } from './nav.js';
import { S } from './story.js';

export const bodyR = p => (p.kid ? 0.14 : 0.18);
const SK = ['#C98D63', '#B0764F', '#D6A27A', '#94603F', '#BF845A', '#E0B08A'];
const SHIRTS = ['#D9502F', '#3E6AA0', '#F2E6CF', '#6E9A4B', '#E2A33A', '#7A4A8C', '#2F7F7A', '#C8412F', '#F4F1EA', '#3A3A48'];
const PANTS = ['#34384A', '#6A5A48', '#2E3A52', '#8A7A60', '#3A3030'];

// a bicycle in local coordinates (facing +Z): returns the group and its two wheels
function bicycle(mat, color, k = 1) {
  const g = new THREE.Group(); const fm = mat(color), tm = mat('#26262C');
  const wheel = () => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33 * k, 0.03 * k, 6, 18), tm); w.rotation.y = Math.PI / 2; const hub = new THREE.Group(); hub.add(w); for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.62 * k, 0.012), tm); sp.rotation.x = i * Math.PI / 3; hub.add(sp); } return hub; };
  const wf = wheel(), wb = wheel(); wf.position.set(0, 0.34 * k, 0.52 * k); wb.position.set(0, 0.34 * k, -0.52 * k); g.add(wf, wb);
  const tube = (a, b, r = 0.025) => { const A = new THREE.Vector3(...a).multiplyScalar(k), B = new THREE.Vector3(...b).multiplyScalar(k); const d = B.clone().sub(A); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * k, r * k, d.length(), 6), fm); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); };
  tube([0, 0.34, -0.52], [0, 0.42, -0.05]); tube([0, 0.42, -0.05], [0, 0.82, -0.12]); tube([0, 0.42, -0.05], [0, 0.78, 0.42]); tube([0, 0.82, -0.12], [0, 0.78, 0.42]); tube([0, 0.34, 0.52], [0, 0.95, 0.44]); tube([0, 0.34, -0.52], [0, 0.82, -0.12]);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * k, 0.02 * k, 0.5 * k, 6), tm); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.97 * k, 0.43 * k); g.add(bar);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12 * k, 0.04 * k, 0.24 * k), tm); seat.position.set(0, 0.86 * k, -0.14 * k); g.add(seat);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { group: g, wheels: [wf, wb], k };
}

export function buildCrowd(world, mat, SITE, CAST, opts = {}) {
  const LOOP = CAST.loop || 90; const pre = opts.routes || null;
  const areas = Object.fromEntries(SITE.areas.map(a => [a.id, a]));
  const all = [], walkers = [], cyclists = [], performers = [];
  let seedN = 1; const spec = (s, i) => ({ skin: SK[(i + seedN) % SK.length], shirt: SHIRTS[(i * 3 + seedN) % SHIRTS.length], pants: PANTS[(i + seedN) % PANTS.length], seed: seedN++, outfit: 'casual', sleeve: 'short', ...s });
  let NAV = null; const nav = () => (NAV || (NAV = buildNav({ x0: SITE.bounds[0], y0: SITE.bounds[1], x1: SITE.bounds[2], y1: SITE.bounds[3], res: CAST.navRes || 0.25, R: 0.23 })));
  const areaNav = new Map(); const navFor = id => { if (!areaNav.has(id)) { const [x0, y0, x1, y1] = areas[id].rect; areaNav.set(id, buildNav({ x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1, res: 0.12, R: 0.23 })); } return areaNav.get(id); };
  const where = w => (w.xy ? w.xy : [areas[w.at].center[0] + (w.dx || 0), areas[w.at].center[1] + (w.dy || 0)]);

  // ---- route builder: keys [t, x, y]; hold(until), go(points) along nav paths
  function routeOf(start, N) {
    const k = [[0, start[0], start[1]]]; let t = 0, x = start[0], y = start[1]; const look = [];
    return { k, look, get t() { return t; }, get x() { return x; }, get y() { return y; },
      hold(until) { if (until > t) { k.push([until, x, y]); t = until; } },
      go(pts, v = 1.3) { for (const q of pts) { if (Math.hypot(q[0] - x, q[1] - y) < 0.01) continue; const path = N.path(x, y, q[0], q[1]); for (let n = 1; n < path.length; n++) { const d = Math.hypot(path[n][0] - x, path[n][1] - y); if (d < 0.005) continue; t += d / v; x = path[n][0]; y = path[n][1]; k.push([t, x, y]); } } },
      lookAt(tt, tx, ty) { look.push([tt, tx, ty]); } };
  }
  const finish = (p, r) => { p.path = r.k; p.looks = r.look; p.cum = [0]; for (let j = 1; j < p.path.length; j++) p.cum.push(p.cum[j - 1] + Math.hypot(p.path[j][1] - p.path[j - 1][1], p.path[j][2] - p.path[j - 1][2])); };

  // ---- named walkers with a plan: [{ at | xy, dx, dy, until, look, acts }]
  (CAST.walkers || []).forEach((w, i) => {
    const p = makePerson(spec(w, i), mat); p.id = w.id || `walker${i}`; p.kind = 'walker'; p.acts = [];
    if (pre && pre[p.id]) { p.path = pre[p.id].path; p.looks = pre[p.id].looks; p.cum = [0]; for (let j = 1; j < p.path.length; j++) p.cum.push(p.cum[j - 1] + Math.hypot(p.path[j][1] - p.path[j - 1][1], p.path[j][2] - p.path[j - 1][2])); }
    else { const first = where(w.plan[0]); const s0 = nav().snap(first[0], first[1]); const r = routeOf(s0, nav());
      for (const st of w.plan) { const q = where(st); const qs = nav().snap(q[0], q[1]); r.go([qs], st.speed || 1.3); if (st.look) r.lookAt(r.t, ...st.look); r.hold(st.until); }
      finish(p, r); }
    for (const st of w.plan) for (const a of st.acts || []) p.acts.push(a);
    walkers.push(p); all.push(p);
  });

  // ---- wanderers: loop inside an area between free points, pausing to look
  (CAST.wanderers || []).forEach((wd, wi) => {
    const a = areas[wd.area]; const [x0, y0, x1, y1] = a.rect; const R = rng(wd.seed || 100 + wi);
    for (let i = 0; i < (wd.count || 3); i++) {
      const s = spec({ ...(wd.people ? wd.people[i % wd.people.length] : {}), kind: wd.people ? wd.people[i % wd.people.length].kind || 'man' : ['man', 'woman', 'girl', 'boy', 'man', 'woman'][i % 6] }, wi * 7 + i);
      if (s.kind === 'woman' && !wd.people) Object.assign(s, { outfit: R() < 0.5 ? 'casual' : undefined, saree: SHIRTS[(i + 4) % SHIRTS.length], border: '#E2A33A', blouse: SHIRTS[(i + 7) % SHIRTS.length] });
      if ((s.kind === 'girl' || s.kind === 'boy')) { s.h = s.h || 1.2 + R() * 0.25; s.dress = SHIRTS[(i * 5 + 1) % SHIRTS.length]; } else s.h = s.h || (s.kind === 'woman' ? 1.55 + R() * 0.1 : 1.66 + R() * 0.12);
      if (R() < 0.3) s.hat = R() < 0.5 ? 'sun' : 'cap'; if (R() < 0.35 && s.kind !== 'girl' && s.kind !== 'boy') s.bag = true;
      const p = makePerson(s, mat); p.id = `${wd.area}-w${i}`; p.kind = 'wanderer'; p.area = wd.area; p.acts = [];
      if (pre && pre[p.id]) { p.path = pre[p.id].path; p.looks = pre[p.id].looks; p.cum = [0]; for (let j = 1; j < p.path.length; j++) p.cum.push(p.cum[j - 1] + Math.hypot(p.path[j][1] - p.path[j - 1][1], p.path[j][2] - p.path[j - 1][2])); }
      else {
        const N = navFor(wd.area); const pick = () => { for (let tries = 0; tries < 60; tries++) { const x = x0 + 1 + R() * (x1 - x0 - 2), y = y0 + 1 + R() * (y1 - y0 - 2); if (N.free(x, y)) return [x, y]; } return N.snap(a.center[0], a.center[1]); };
        const start = pick(); const r = routeOf(start, N); r.hold(R() * 4);
        while (r.t < LOOP - 14) { const q = pick(); r.go([q], 0.8 + R() * 0.5); const lk = wd.lookAt ? wd.lookAt : [a.center[0] + (R() - 0.5) * 6, a.center[1] + (R() - 0.5) * 6]; r.lookAt(r.t, lk[0], lk[1]); r.hold(r.t + 3 + R() * 6); if (R() < 0.35) p.acts.push([r.t - 2.5, r.t - 0.5, ['photo', 'point', 'clap', 'wave'][Math.floor(R() * 4)], [lk[0], lk[1], 1.6]]); }
        r.go([start], 1.2); r.hold(LOOP); finish(p, r);
        const last = p.path[p.path.length - 1]; if (last[0] > LOOP) { const k = LOOP / last[0]; p.path.forEach(q => (q[0] *= k)); p.looks.forEach(q => (q[0] *= k)); p.acts.forEach(q => { q[0] *= k; q[1] *= k; }); }
      }
      p.loop = LOOP; walkers.push(p); all.push(p);
    }
  });

  // ---- cyclists on a path loop (one lane each way)
  const pathById = Object.fromEntries((SITE.paths || []).map(p => [p.id, p]));
  (CAST.cyclists || []).forEach((cy, ci) => {
    const P0 = pathById[cy.path]; const pts = P0.loop ? [...P0.pts, P0.pts[0]] : P0.pts; const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(q[0], 0, q[1])), !!P0.loop, 'centripetal'); const L = curve.getLength();
    for (let i = 0; i < (cy.count || 4); i++) {
      const R = rng(500 + ci * 31 + i); const kind = (cy.kinds || ['man', 'woman', 'girl', 'boy'])[i % (cy.kinds || [1, 2, 3, 4]).length];
      const s = spec({ kind, h: kind === 'girl' || kind === 'boy' ? 1.25 + R() * 0.15 : 1.6 + R() * 0.15, dress: SHIRTS[(i + 2) % SHIRTS.length], hat: R() < 0.4 ? 'cap' : undefined, bag: R() < 0.4 }, 60 + i + ci * 9);
      const p = makePerson(s, mat); p.id = `${cy.path}-c${i}`; p.kind = 'cyclist';
      const bk = bicycle(mat, SHIRTS[(i * 3 + 5) % SHIRTS.length], p.kid ? 0.82 : 1); world.scene.add(bk.group); p.bike = bk;
      p.ride = { curve, L, v: (cy.speed || 3.2) * (0.85 + R() * 0.3) * (i % 2 ? -1 : 1), off: R() * L, lane: (i % 2 ? -1 : 1) * (cy.lane ?? 0.5) };
      cyclists.push(p); all.push(p);
    }
  });

  // ---- performers on a stage in an area (dance or play while the stage is on)
  (CAST.performers || []).forEach((pf, fi) => {
    const a = areas[pf.area]; const st = a.structures.filter(s => s.type === 'stage')[pf.stage || 0]; const rot = st.rot || 0, c = Math.cos(rot), sn = Math.sin(rot);
    const n = pf.count || 3; const w = st.w || 8;
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * Math.min(1.6, (w - 2) / Math.max(1, n - 1)), v = 0.2; const x = st.x + u * c - v * sn, y = st.y + u * sn + v * c;
      const s = spec({ kind: (pf.kinds || ['man', 'woman'])[i % (pf.kinds || [1, 2]).length], outfit: 'casual', shirt: (pf.colors || ['#F2E6CF', '#D9502F', '#E2A33A', '#2F7F7A'])[i % 4], hat: pf.hat }, 90 + fi * 11 + i);
      const p = makePerson(s, mat); p.id = `${pf.area}-perf${i}`; p.kind = 'performer'; p.area = pf.area; p.stand = { x, y, z: st.h || 1, yaw: faceTo(0, 0, -sn, c) , style: pf.style || (i % 2 ? 'dance' : 'play') };
      performers.push(p); all.push(p);
    }
  });
  for (const p of all) world.scene.add(p.root);

  // ---- motion
  const ease = f => 0.7 * f + 0.3 * smooth(f);
  function pos(p, t) {
    const k = p.path; if (t <= k[0][0]) return { x: k[0][1], y: k[0][2], dist: 0, vx: 0, vy: 0 };
    if (t >= k[k.length - 1][0]) { const e = k[k.length - 1]; return { x: e[1], y: e[2], dist: p.cum[k.length - 1], vx: 0, vy: 0 }; }
    let i = 0; while (t > k[i + 1][0]) i++; const a = k[i], b = k[i + 1]; const f = (t - a[0]) / (b[0] - a[0]); const e = ease(f); const L = Math.hypot(b[1] - a[1], b[2] - a[2]);
    return { x: lerp(a[1], b[1], e), y: lerp(a[2], b[2], e), dist: p.cum[i] + L * e, vx: L > 0.02 ? (b[1] - a[1]) / L : 0, vy: L > 0.02 ? (b[2] - a[2]) / L : 0 };
  }
  const tOf = (p, t) => (p.loop ? ((t % p.loop) + p.loop) % p.loop : t);
  function yawAt(p, t) { const s = pos(p, t); if (Math.hypot(s.vx, s.vy) > 0.5) return faceTo(0, 0, s.vx, s.vy); let lk = null; for (const l of p.looks) if (t >= l[0]) lk = l; return lk ? faceTo(s.x, s.y, lk[1], lk[2]) : 180; }
  function smoothYaw(p, t) { let sx = 0, sy = 0; for (let k = 0; k < 5; k++) { const a = yawAt(p, Math.max(0, t - k * 0.09)) * Math.PI / 180; sx += Math.sin(a); sy += Math.cos(a); } return Math.atan2(sx, sy) * 180 / Math.PI; }
  function rideAt(p, t) { const r = p.ride; let s = ((r.off + r.v * t) % r.L + r.L) % r.L; const u = s / r.L; const q = r.curve.getPointAt(u), q2 = r.curve.getPointAt(((s + Math.sign(r.v) * 0.3) % r.L + r.L) % r.L / r.L); const dx = q2.x - q.x, dz = q2.z - q.z, dl = Math.hypot(dx, dz) || 1; const nx = -dz / dl, nz = dx / dl; return { x: q.x + nx * r.lane, y: q.z + nz * r.lane, yaw: Math.atan2(dx, dz) * 180 / Math.PI, s }; }

  const V3 = () => new THREE.Vector3();
  function actPose(p, act, af, w, t, pose, fwd, yaw, s) {
    const reachTo = (side, tgt, k) => { const rest = (side === 'L' ? p.j.handL : p.j.handR).getWorldPosition(V3()); p.reach(side, rest.lerp(tgt, k)); };
    const kind = act[2]; let lookT = null;
    if (kind === 'joy') { const j = Math.sin(clamp(af * 1.4, 0, 1) * Math.PI); pose = addPose(blendPose(pose, POSES.joy, w), { pelvisY: j * (p.kid ? 0.18 : 0.08) }); }
    if (kind === 'surprise') pose = blendPose(pose, POSES.surprise, w);
    if (kind === 'crouch' || kind === 'draw') pose = addPose(pose, { spine: [0.45 * w, 0, 0], hipL: [-0.35 * w, 0, 0], hipR: [-0.35 * w, 0, 0], knL: [0.5 * w, 0, 0], knR: [0.5 * w, 0, 0], pelvisY: -0.08 * w });
    if (kind === 'wave') pose = addPose(pose, { shR: [-0.4 * w, 0, -2.4 * w], elR: [-0.4 * w + 0.35 * w * Math.sin(t * 9), 0, 0] });
    p.pose(pose); p.root.updateMatrixWorld(true);
    if (kind === 'tap' || kind === 'point' || kind === 'photo' || kind === 'clap' || kind === 'raise' || kind === 'draw') {
      const tg = act[3] ? P(...act[3]) : p.root.position.clone().add(fwd.clone().multiplyScalar(0.45)).setY(1.0);
      if (kind === 'tap') { reachTo('L', tg, w); lookT = tg; }
      if (kind === 'point') { const sh = p.j.shR.getWorldPosition(V3()); const d = tg.clone().sub(sh).normalize(); reachTo('R', sh.add(d.multiplyScalar(p.D.upper + p.D.fore)), w); lookT = tg; }
      if (kind === 'raise') { const q = p.root.position.clone().add(fwd.clone().multiplyScalar(0.3)).setY(p.spec.h * 1.12); reachTo('R', q, w); }
      if (kind === 'photo' || kind === 'clap') { const c = p.root.position.clone().add(fwd.clone().multiplyScalar(kind === 'photo' ? 0.32 : 0.28)).setY(p.spec.h * (kind === 'photo' ? 0.9 : 0.72)); const side = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar(kind === 'clap' ? 0.06 + 0.05 * Math.abs(Math.sin(t * 8)) : 0.07); reachTo('L', c.clone().add(side), w); reachTo('R', c.clone().sub(side), w); if (kind === 'photo') lookT = tg; }
      if (kind === 'draw') { const q = p.root.position.clone().add(fwd.clone().multiplyScalar(0.36)).setY(0.5); reachTo('R', q, w); lookT = q; }
    }
    return lookT;
  }
  const exprOf = (p, t, act) => { if (act && (act[2] === 'joy' || act[2] === 'dance')) return 'joy'; if (act && act[2] === 'surprise') return 'o'; return 'smile'; };

  function update(t, inView) {
    for (const p of all) {
      let x, y, yaw, moving = 0, dist = 0, tl = t;
      if (p.kind === 'cyclist') { const r = rideAt(p, t); x = r.x; y = r.y; yaw = r.yaw; dist = r.s; }
      else if (p.kind === 'performer') { x = p.stand.x; y = p.stand.y; yaw = p.stand.yaw; }
      else { tl = tOf(p, t); const s = pos(p, tl); x = s.x; y = s.y; dist = s.dist; const s1 = pos(p, tl + 0.05), s0 = pos(p, Math.max(0, tl - 0.05)); moving = clamp(Math.hypot(s1.x - s0.x, s1.y - s0.y) / 0.1 / 0.9, 0, 1); yaw = smoothYaw(p, tl); }
      const vis = !inView || inView(x, y); p.root.visible = vis; if (p.bike) p.bike.group.visible = vis; if (!vis) continue;
      if (p.kind === 'cyclist') {
        const ph = dist / (0.33 * p.bike.k * 2 * Math.PI) * 2 * Math.PI; const k = p.bike.k;
        p.root.position.set(x, 0, y); p.root.rotation.set(0, yaw * Math.PI / 180, 0);
        p.bike.group.position.set(x, 0, y); p.bike.group.rotation.y = yaw * Math.PI / 180; for (const wl of p.bike.wheels) wl.rotation.x = ph;
        const sh = Math.sin(ph * 0.5), ch = Math.cos(ph * 0.5); const seatY = 0.86 * k + 0.05, pel = seatY - p.D.legLen;
        p.pose({ pelvisY: pel, pelvisZ: -0.16 * k, spine: [0.38, 0, 0], neck: [-0.25, 0, 0], hipL: [-1.25 + 0.38 * sh, 0, 0.05], hipR: [-1.25 - 0.38 * sh, 0, -0.05], knL: [1.35 + 0.35 * ch, 0, 0], knR: [1.35 - 0.35 * ch, 0, 0], shL: [-1.05, 0, 0.12], shR: [-1.05, 0, -0.12], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0] });
        p.expr('smile', 0); continue;
      }
      if (p.kind !== 'performer') { const [gx, gy] = pushOut(x, y, bodyR(p)); x = gx; y = gy; }
      p.root.position.set(x, p.kind === 'performer' ? p.stand.z : 0, y); p.root.rotation.set(0, yaw * Math.PI / 180, 0);
      let pose = blendPose(POSES.idle, walkPose(dist / (0.62 * p.spec.h / 1.7) * Math.PI, 1, p.kid), moving);
      const fwd = new THREE.Vector3(Math.sin(yaw * Math.PI / 180), 0, Math.cos(yaw * Math.PI / 180));
      let act = null, af = 0, w = 0;
      if (p.kind === 'performer') { const on = S.get('stageOn', t, p.area); if (on > 0.25) { const st = p.stand.style; act = [0, 1, st === 'dance' ? 'dance' : 'play']; w = smooth((on - 0.25) / 0.4); } }
      else { act = (p.acts || []).find(a => tl >= a[0] && tl <= a[1]) || null; if (act) { af = (tl - act[0]) / (act[1] - act[0]); w = env(af, 0, 0.25, 0.75, 1); } }
      let lookT = null;
      if (act && act[2] === 'dance') { const b = Math.sin(t * 5 + p.spec.seed); pose = addPose(pose, { shL: [-0.3 * w, 0, (1.9 + 0.5 * b) * w], shR: [-0.3 * w, 0, -(1.9 - 0.5 * b) * w], elL: [-0.6 * w, 0, 0], elR: [-0.6 * w, 0, 0], spine: [0, 0.35 * b * w, 0.12 * b * w], pelvisY: 0.05 * Math.abs(b) * w, knL: [0.25 * Math.max(0, b) * w, 0, 0], knR: [0.25 * Math.max(0, -b) * w, 0, 0] }); p.pose(pose); }
      else if (act && act[2] === 'play') { const b = Math.sin(t * 7 + p.spec.seed); pose = addPose(pose, { shL: [-0.9 * w, 0.3 * w, 0.3 * w], elL: [-1.3 * w, 0, 0], shR: [-0.5 * w, -0.2 * w, -0.2 * w], elR: [(-1.1 - 0.25 * b) * w, 0, 0], spine: [0.08 * w, 0.1 * b * w, 0] }); p.pose(pose); }
      else if (act) lookT = actPose(p, act, af, w, tl, pose, fwd, yaw, null);
      else p.pose(pose);
      p.root.updateMatrixWorld(true);
      if (!lookT && p.looks) { let lk = null; for (const l of p.looks) if (tl >= l[0]) lk = l; if (lk && moving < 0.5) lookT = P(lk[1], lk[2], 1.3); }
      if (lookT) p.look(lookT, 0.8);
      const bl = ((t * 0.31 + p.spec.seed * 0.17) % 1); p.expr(exprOf(p, t, act), bl < 0.035 ? Math.sin(bl / 0.035 * Math.PI) : 0);
      if (p.j.plaits) for (const pl of p.j.plaits) pl.rotation.x = 0.15 * Math.sin(t * 5 + p.spec.seed) * moving + 0.1;
      if (p.j.drape) p.j.drape.rotation.x = 0.08 * Math.sin(t * 3 + p.spec.seed) * (0.3 + moving);
    }
  }

  // ---- proof: nobody inside anything, nobody standing in anybody, cyclist lanes clear
  function validate(step = 0.1, T = LOOP) {
    const hits = [], runs = {};
    for (const p of walkers) { const r = bodyR(p) - 0.01; for (let t = 0; t <= T; t += step) { const s = pos(p, tOf(p, t)); const o = hit(s.x, s.y, r); if (o) { const key = p.id + '|' + o.name; const run = runs[key]; if (run && t - run.t1 < step * 1.5) run.t1 = +t.toFixed(2); else { runs[key] = { id: p.id, what: o.name, t0: +t.toFixed(2), t1: +t.toFixed(2), x: +s.x.toFixed(2), y: +s.y.toFixed(2) }; hits.push(runs[key]); } } } }
    const lanes = [], seenLane = new Set(); for (const p of cyclists) { const r = p.ride; for (let s = 0; s < r.L; s += 0.5) { const q = rideAt({ ride: { ...r, off: s, v: Math.sign(r.v) * 1e-9 } }, 0); const o = hit(q.x, q.y, 0.3); if (o && o.name !== 'edge' && !seenLane.has(o.name + Math.sign(r.lane))) { seenLane.add(o.name + Math.sign(r.lane)); lanes.push({ id: p.id, what: o.name, x: +q.x.toFixed(1), y: +q.y.toFixed(1) }); } } }
    const pairs = [], pr = {};
    for (let t = 0; t <= T; t += 0.2) { const st = walkers.map(p => { const a = pos(p, tOf(p, t)), b = pos(p, tOf(p, t + 0.2)); return { p, x: a.x, y: a.y, still: Math.hypot(b.x - a.x, b.y - a.y) < 0.01 }; });
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) { const A = st[i], B = st[j]; if (!A.still || !B.still) continue; const d = Math.hypot(A.x - B.x, A.y - B.y); if (d < bodyR(A.p) + bodyR(B.p) - 0.03) { const key = A.p.id + '|' + B.p.id; const run = pr[key]; if (run && t - run.t1 < 0.3) run.t1 = +t.toFixed(1); else { pr[key] = { a: A.p.id, b: B.p.id, t0: +t.toFixed(1), t1: +t.toFixed(1), x: +A.x.toFixed(1), y: +A.y.toFixed(1) }; pairs.push(pr[key]); } } } }
    return { hits, pairs: pairs.filter(q => q.t1 - q.t0 >= 0.4), lanes, people: all.length };
  }
  const exportRoutes = () => Object.fromEntries(walkers.map(p => [p.id, { path: p.path.map(k => k.map(v => +v.toFixed(3))), looks: (p.looks || []).map(k => k.map(v => +v.toFixed(3))) }]));
  return { all, walkers, cyclists, performers, update, validate, exportRoutes, pos, LOOP };
}
