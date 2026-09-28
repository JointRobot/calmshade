// isokit · the interactive app. Everything project-specific comes from /project: SITE (layout), CHANNELS (story),
// CAST (people), COPY (words and controls), LOOK (look and colours), tour.js (guided tour). This file rarely changes.
// Modes: explore (drag, zoom, tap areas and spots; controls drive story channels) and tour (the video's walk, live).
import * as THREE from 'three';
import { createWorld, C30 } from '../engine/world.js';
import { STYLES, makeMaterials } from '../engine/style.js';
import { G } from '../engine/geom.js';
import { buildSite } from '../engine/site.js';
import { buildCrowd } from '../engine/crowd.js';
import { S } from '../engine/story.js';
import { clamp } from '../engine/util.js';
import { SITE } from '../../project/site.js';
import { CHANNELS, TOUR_LENGTH } from '../../project/story.js';
import { CAST } from '../../project/cast.js';
import { LOOK } from '../../project/look.js';
import { COPY } from '../../project/copy.js';
import * as TOURM from '../../project/tour.js';

const BOOT = { start: performance.now() }; window.__boot = BOOT;
const q = new URLSearchParams(location.search); const $ = s => document.querySelector(s);
// ---- theme and words
const U = LOOK.ui; for (const k of ['paper', 'card', 'ink', 'muted', 'rule', 'accent', 'accent2', 'gold', 'bg']) if (U[k]) document.documentElement.style.setProperty('--' + k, U[k]);
document.documentElement.style.setProperty('--font', `'${U.font}'`); document.documentElement.style.setProperty('--display', `'${U.display}'`);
document.title = COPY.title; $('#brand').textContent = COPY.brand; $('#tourbtn').textContent = COPY.tourLabel;
$('#i-eyebrow').textContent = COPY.intro.eyebrow; $('#i-h1').textContent = COPY.intro.h1; $('#i-tag').textContent = COPY.intro.tag; $('#i-text').textContent = COPY.intro.text; $('#i-credit').textContent = COPY.intro.credit; $('#enter').textContent = COPY.intro.loading;

// ---- renderer: real-time settings (direct render, no screen-space AO or bloom, soft PCF shadows)
const touch = matchMedia('(pointer: coarse)').matches; const low = q.get('q') === 'low' || (touch && q.get('q') !== 'high');
const style = { ...STYLES[q.get('style') || LOOK.style], ...(q.get('style') ? {} : LOOK.overrides) };
style.ao = false; style.bloom = 0; style.shadow = { ...style.shadow, type: q.get('shadow') || 'pcf', intensity: style.shadow?.intensity ?? 0.7 }; style.direct = q.get('direct') !== '0';
const canvas = $('#gl'), ov2 = $('#ov'), O = ov2.getContext('2d');
const PR = q.has('pr') ? +q.get('pr') : Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
let VW = innerWidth, VH = innerHeight;
const world = createWorld({ canvas, width: VW, height: VH, pixelRatio: Math.min(PR, 1.5), style, preserve: false });
world.key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); world.timeGPU = true;
const mat = makeMaterials(style), g = G(style);
S.install(CHANNELS); S.mode = 'app';
BOOT.world = performance.now(); const site = buildSite(world, mat, g, style, SITE); BOOT.site = performance.now();
world.fitShadow(...(LOOK.shadowBox || SITE.bounds));
let ROUTES = null; try { const r = await fetch('./assets/routes.json', { cache: 'no-cache' }); if (r.ok) ROUTES = await r.json(); } catch (e) {}
const crowd = buildCrowd(world, mat, SITE, CAST, { routes: ROUTES }); BOOT.crowd = performance.now();
for (const p of crowd.walkers) if (!p.loop) p.loop = crowd.LOOP;

// ---- contact shadows: people do not cast into the shadow map; one instanced soft blob each, along the sun
for (const p of crowd.all) p.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
const blobs = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); const id = x.createImageData(128, 32);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 128; i++) { const u = i / 127, v = (j - 15.5) / 16; const along = u < 0.12 ? 0.6 + 0.4 * u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 1.3); const a = Math.pow(Math.max(0, 1 - v * v), 1.4) * along; const k = (j * 128 + i) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = 255; id.data[k + 3] = Math.round(255 * a); }
  x.putImageData(id, 0, 0); const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: '#2E1F14', transparent: true, opacity: 0.6, depthWrite: false }), crowd.all.length);
  m.frustumCulled = false; m.renderOrder = 1; world.scene.add(m); return m; })();
const BQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(0.884, 0.468)), BM = new THREE.Matrix4(), BV = new THREE.Vector3(), BS = new THREE.Vector3();
function placeBlobs() { crowd.all.forEach((p, i) => { const h = p.spec.h || 1.6; const L = 0.85 * h; if (p.root.visible) BS.set(L, 1, p.kid ? 0.3 : 0.4); else BS.set(0, 0, 0); BV.copy(p.root.position); BV.x += 0.468 * 0.38 * L; BV.z -= 0.884 * 0.38 * L; BV.y += 0.012; BM.compose(BV, BQ, BS); blobs.setMatrixAt(i, BM); }); blobs.instanceMatrix.needsUpdate = true; }
// the shadow map re-renders only when a caster moves, appears or disappears
const CASTERS = []; world.scene.traverse(o => { if (o.isMesh && o.castShadow) CASTERS.push(o); });
world.renderer.shadowMap.autoUpdate = false; world.renderer.shadowMap.needsUpdate = true; let shSig = NaN;
function shadowCheck() { let sg = 0; for (let i = 0; i < CASTERS.length; i++) { const o = CASTERS[i]; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; } if (!vis) { sg += (i + 1) * 0.001; continue; } const e = o.matrixWorld.elements; sg += (e[12] * 1.31 + e[13] * 2.17 + e[14] * 3.71 + e[0] + e[5] * 1.73 + e[10] * 2.39 + e[4] * 0.71 + e[8] * 0.37) * ((i % 13) + 1); }
  if (!(Math.abs(sg - shSig) < 1e-7)) { world.renderer.shadowMap.needsUpdate = true; shSig = sg; } }

// ---- camera (screen-space target px, py and zoom S in CSS pixels per metre)
const cam = { px: 0, py: 0, S: 8 }, camT = { px: 0, py: 0, S: 8 };
const scr = (x, y, z = 0) => [(x - y) * C30, (x + y) / 2 - z];
const side = () => (VW < 900 ? { w: VW, h: VH * 0.5, dx: 0, dy: VH * 0.22 } : { w: VW - 420, h: VH - 70, dx: 200, dy: 0 });
const [BX0, BY0, BX1, BY1] = SITE.bounds;
function fitOverview() { const f = side(); const [px, py] = scr((BX0 + BX1) / 2, (BY0 + BY1) / 2, 2); const dw = (BX1 - BX0 + BY1 - BY0) * C30, dh = (BX1 - BX0 + BY1 - BY0) / 2 + 14; const S2 = Math.min(f.w / dw, f.h / dh) * 0.98; return { px: px + f.dx / S2, py: py + f.dy / S2, S: S2 }; }
function areaView(id) { const a = SITE.areas.find(x => x.id === id); const f = side(); const [x0, y0, x1, y1] = a.rect; const [px, py] = scr((x0 + x1) / 2, (y0 + y1) / 2, 2); const size = Math.max(x1 - x0, y1 - y0); const S2 = Math.min(f.w / (size * 1.75), f.h / (size * 1.05)); return { px: px + f.dx / S2, py: py + f.dy / S2, S: S2 }; }
function spotView(key) { const sp = COPY.spots[key]; const f = side(); const c = sp.cam || sp.pos; const [px, py] = scr(c[0], c[1], c[2] || 0); const S2 = Math.min(f.w / 30, f.h / 19) * (sp.zoom || 1); return { px: px + f.dx / S2, py: py + f.dy / S2, S: S2 }; }
const setCamT = v => Object.assign(camT, v);
Object.assign(cam, fitOverview()); setCamT(fitOverview());

// ---- navigation state
const A = { visited: new Set(), revealed: new Set(), area: null, spot: null };
const areaList = SITE.areas.filter(a => COPY.areas[a.id]);
const shownArea = a => !a.hidden || A.revealed.has(a.id);
function goOverview() { A.area = null; A.spot = null; setCamT(fitOverview()); renderPanel(); }
function goArea(id) { A.area = id; A.spot = null; A.visited.add(id); setCamT(areaView(id)); renderPanel(); }
function goSpot(key) { const sp = COPY.spots[key]; A.area = sp.area; A.spot = key; if (sp.area) A.visited.add(sp.area); setCamT(spotView(key)); renderPanel(); }
function run(actions = [], out) { for (const a of actions) { if (a.set) S.set(a.set, a.arg, a.value); if (a.pulse) S.pulse(a.pulse, a.arg, a.dur || 8, a.peak || 1); if (a.reveal) { A.revealed.add(a.reveal); buildChips(); } if (a.say && out) out.textContent = a.say;
  if (a.go) { const [k, v] = a.go.split(':'); if (k === 'area') goArea(v); else if (k === 'spot') goSpot(v); else goOverview(); } } }

// ---- pins
const pinLayer = $('#pins'); const pins = [];
for (const a of areaList) { const c = COPY.areas[a.id]; const b = document.createElement('button'); b.className = 'pin areapin'; b.innerHTML = `${c.n ? `<span class="n">${c.n}</span>` : '<span class="dot"></span>'}<span class="l">${c.name}</span>`; b.onclick = e => { e.stopPropagation(); goArea(a.id); }; pinLayer.appendChild(b); pins.push({ el: b, pos: [a.center[0], a.center[1], 4], area: a.id, areaPin: true }); }
for (const key in COPY.spots) { const sp = COPY.spots[key]; const b = document.createElement('button'); b.className = 'pin'; b.innerHTML = `<span class="dot"></span><span class="l">${sp.title}</span>`; b.onclick = e => { e.stopPropagation(); goSpot(key); }; pinLayer.appendChild(b); pins.push({ el: b, pos: sp.pos, key, area: sp.area }); }
function placePins() {
  for (const p of pins) {
    const a = p.area && SITE.areas.find(x => x.id === p.area);
    const show = tour ? false : p.areaPin ? (!A.area && !A.spot && shownArea(a)) : p.area === null ? (!A.area && A.spot !== p.key) : (A.area === p.area && A.spot !== p.key);
    p.el.classList.toggle('hidden', !show); if (!show) continue;
    const [x, y] = world.screen(...p.pos); p.el.style.transform = `translate(${x}px, ${y}px)`;
  }
}

// ---- panel
const panel = $('#panel'), pBody = $('#pbody');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const btn = (label, fn, cls = '') => { const b = el('button', 'cbtn ' + cls, label); b.onclick = fn; return b; };
const row = (...els) => { const d = el('div', 'row'); els.forEach(e => d.appendChild(e)); return d; };
function controls(list = [], box) {
  for (const c of list) {
    if (c.type === 'button') box.appendChild(row(btn(c.label, () => { run(c.actions, out); renderPanelSoon(); }, c.primary ? 'primary' : '')));
    if (c.type === 'toggle') { const on = S.value(c.channel, c.arg) > ((c.on ?? 1) + (c.off ?? 0)) / 2; box.appendChild(row(btn(on ? (c.labelOn || c.label) : c.label, () => { const v = on ? (c.off ?? 0) : (c.on ?? 1); S.set(c.channel, c.arg, v); for (const a of c.also || []) S.set(a.channel, a.arg, on ? a.off : a.on); renderPanel(); }, on ? 'on' : 'primary'))); }
    if (c.type === 'slider') { box.appendChild(el('div', 'label', c.label)); const s = el('input'); s.type = 'range'; s.min = c.min ?? 0; s.max = c.max ?? 1; s.step = c.step ?? 0.01; s.value = S.value(c.channel, c.arg); const ro = el('div', 'readout', c.readout ? c.readout(+s.value) : ''); s.oninput = () => { S.set(c.channel, c.arg, +s.value); if (c.readout) ro.textContent = c.readout(+s.value); }; box.appendChild(s); if (c.readout) box.appendChild(ro); }
    if (c.type === 'choice') { box.appendChild(el('div', 'label', c.label)); const grid = el('div', 'choices'); const cur = Math.round(S.value(c.channel, c.arg)); const ro = el('div', 'readout', (c.options.find(o => o.value === cur) || {}).text || '');
      for (const o of c.options) grid.appendChild(btn(o.label, () => { S.set(c.channel, c.arg, o.value); run(o.actions); renderPanel(); }, o.value === cur ? 'on' : '')); box.appendChild(grid); box.appendChild(ro); }
  }
  let out = null;
}
let soon = 0; const renderPanelSoon = () => { clearTimeout(soon); soon = setTimeout(renderPanel, 60); };
function renderPanel() {
  pBody.innerHTML = ''; if (tour) { panel.classList.add('hidden'); return; } panel.classList.remove('hidden');
  if (!A.area && !A.spot) { const o = COPY.overview;
    pBody.append(el('div', 'eyebrow', o.eyebrow), el('h2', '', o.h2), el('p', 'note', o.text));
    const list = el('div', 'alist'); for (const a of [...areaList].sort((x, y) => (COPY.areas[x.id].n || 99) - (COPY.areas[y.id].n || 99))) { if (!shownArea(a)) continue; const c = COPY.areas[a.id]; const b = el('button', 'abtn' + (A.visited.has(a.id) ? ' done' : '')); b.innerHTML = `<span class="n">${c.n || '•'}</span><span><b>${c.name}</b><br><i>${c.tagline}</i></span>`; b.onclick = () => goArea(a.id); list.appendChild(b); }
    pBody.appendChild(list); controls(o.controls, pBody);
    if (o.journey) { pBody.appendChild(el('div', 'label', 'Your festival journey')); const ol = el('ol', 'journey'); o.journey.forEach(s => ol.appendChild(el('li', '', s))); pBody.appendChild(ol); }
    pBody.appendChild(row(btn(COPY.tourLabel, startTour, 'primary'))); return; }
  if (A.spot) { const sp = COPY.spots[A.spot]; const a = sp.area ? COPY.areas[sp.area] : null;
    pBody.append(el('div', 'eyebrow', a ? a.name : COPY.title), el('h2', '', sp.title), el('p', 'note', sp.text)); controls(sp.controls, pBody);
    pBody.appendChild(row(btn('← ' + (a ? a.name : 'The map'), () => (sp.area ? goArea(sp.area) : goOverview()), 'ghost'))); return; }
  const c = COPY.areas[A.area]; pBody.append(el('div', 'eyebrow', c.n ? `Venue ${c.n}` : 'Around the festival'), el('h2', '', c.name), el('p', 'tag', c.tagline));
  if (c.text) pBody.appendChild(el('p', 'note', c.text));
  if (c.offerings) { pBody.appendChild(el('div', 'label', 'What happens here')); const ul = el('ul', 'offer'); c.offerings.forEach(s => ul.appendChild(el('li', '', s))); pBody.appendChild(ul); }
  if (COPY.weeks) { const w = COPY.weeks[Math.round(S.value('week'))]; if (w) { pBody.appendChild(el('div', 'label', 'This week')); pBody.appendChild(el('div', 'readout', `${w.dates} · ${w.label}`)); } }
  const spots = Object.keys(COPY.spots).filter(k => COPY.spots[k].area === A.area);
  if (spots.length) { pBody.appendChild(el('div', 'label', 'Try it')); const list = el('div', 'alist'); for (const k of spots) list.appendChild(btn(COPY.spots[k].title, () => goSpot(k))); pBody.appendChild(list); }
  pBody.appendChild(row(btn('← The map', goOverview, 'ghost')));
}

// ---- header chips
function buildChips() { const zc = $('#chips'); zc.innerHTML = ''; for (const a of [...areaList].sort((x, y) => (COPY.areas[x.id].n || 99) - (COPY.areas[y.id].n || 99))) { const c = COPY.areas[a.id]; if (!c.n || !shownArea(a)) continue; const b = el('button', '', String(c.n)); b.title = c.name; b.onclick = () => goArea(a.id); zc.appendChild(b); } }
buildChips(); $('#brand').onclick = goOverview; $('#tourbtn').onclick = () => (tour ? stopTour() : startTour());

// ---- guided tour: the video's walk, live
let tour = false, tourT0 = 0; const audio = $('#score'); if (LOOK.audio) audio.src = LOOK.audio;
function startTour() { tour = true; S.mode = 'film'; if (prCur > prTourCap) setPR(prTourCap); const from = +(q.get('tour0') || 0); tourT0 = performance.now() - from * 1000; if (LOOK.audio) { try { audio.currentTime = from; audio.play().catch(() => {}); } catch (e) {} } $('#tourbtn').textContent = COPY.tourStop; document.body.classList.add('touring'); renderPanel(); }
function stopTour() { tour = false; S.mode = 'app'; if (LOOK.audio) audio.pause(); $('#tourbtn').textContent = COPY.tourLabel; document.body.classList.remove('touring'); O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, ov2.width, ov2.height); requestAnimationFrame(() => requestAnimationFrame(() => { if (!tour) goOverview(); })); }

// ---- pointer: pan, zoom, pinch (explore only)
let drag = null; const touches = new Map();
canvas.addEventListener('pointerdown', e => { if (tour) return; touches.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); drag = { moved: 0 }; });
canvas.addEventListener('pointermove', e => { if (!touches.has(e.pointerId)) return; const prev = touches.get(e.pointerId); touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (drag.pinch) { camT.S = clamp(camT.S * d / drag.pinch, 3, 160); cam.S = camT.S; } drag.pinch = d; return; }
  const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; drag.moved += Math.abs(dx) + Math.abs(dy); camT.px -= dx / cam.S; camT.py -= dy / cam.S; cam.px = camT.px; cam.py = camT.py; });
canvas.addEventListener('pointerup', e => { touches.delete(e.pointerId); if (touches.size < 2 && drag) drag.pinch = 0; });
canvas.addEventListener('wheel', e => { e.preventDefault(); if (tour) return; camT.S = clamp(camT.S * Math.exp(-e.deltaY * 0.0015), 3, 160); }, { passive: false });

// ---- resize, adaptive sharpness (never while moving or touring)
function resize() { VW = innerWidth; VH = innerHeight; const r = prCur; world.resize(VW, VH, r); ov2.width = VW * r; ov2.height = VH * r; ov2.style.width = VW + 'px'; ov2.style.height = VH + 'px'; if (!A.area) setCamT(fitOverview()); else if (A.spot) setCamT(spotView(A.spot)); else setCamT(areaView(A.area)); }
addEventListener('resize', resize);
let prCur = Math.min(PR, 1.5), prCool = 0, prTourCap = prCur; const PR_MIN = Math.min(1, PR), PR_MAX = PR, GPU_BUDGET = 10.5; const ftBuf = [];
function setPR(v, now = performance.now()) { prCur = v; world.resize(VW, VH, prCur); ov2.width = VW * prCur; ov2.height = VH * prCur; ftBuf.length = 0; prCool = now + 3000; }
function adapt(rawDt, now) { if (tour || now < prCool || q.has('pr')) return; const settled = Math.abs(camT.px - cam.px) * cam.S < 1 && Math.abs(camT.py - cam.py) * cam.S < 1 && Math.abs(Math.log(camT.S / cam.S)) < 0.004; if (!settled) { ftBuf.length = 0; return; }
  ftBuf.push([rawDt * 1000, world.gpuMs]); if (ftBuf.length > 90) ftBuf.shift(); if (ftBuf.length < 90) return; const drops = ftBuf.filter(f => f[0] > 25).length; const gg = ftBuf.map(f => f[1]).filter(v => v != null); const gAvg = gg.length > 30 ? gg.reduce((a, b) => a + b, 0) / gg.length : null;
  let next = prCur; if (drops >= 6 || (gAvg != null && gAvg > GPU_BUDGET * 1.15)) next = Math.max(PR_MIN, prCur - 0.25); else if (drops === 0 && gAvg != null && gAvg * ((prCur + 0.25) / prCur) ** 2 < GPU_BUDGET * 0.8 && prCur < prTourCap) next = Math.min(prTourCap, prCur + 0.25); if (next !== prCur) setPR(next, now); }

// ---- frame loop
const PERF = { dt: [], log: [] }; window.__perf = PERF; const perfOn = q.has('perf'); let hud = null; if (perfOn) { hud = el('div'); hud.style.cssText = 'position:fixed;left:8px;bottom:8px;background:#000c;color:#0f0;font:12px monospace;padding:6px 8px;z-index:9;white-space:pre'; document.body.appendChild(hud); }
const inView = (x, y) => { const px = (x - y) * C30, py = (x + y) / 2 - 0.9; return Math.abs(px - cam.px) < VW / (2 * cam.S) + 2 && Math.abs(py - cam.py) < VH / (2 * cam.S) + 3; };
let last = performance.now(), frames = 0;
function tick(now) {
  const rawDt = (now - last) / 1000, dt = Math.min(0.1, rawDt); last = now; frames++; adapt(rawDt, now);
  let t;
  if (tour) { t = (now - tourT0) / 1000; if (t > TOUR_LENGTH) { stopTour(); requestAnimationFrame(tick); return; } const c = TOURM.camAt(t); cam.px = c[0]; cam.py = c[1]; cam.S = c[2] * VW / 1920; }
  else { S.step(dt); t = S.clock; const k = 1 - Math.exp(-dt * 3.2); cam.px += (camT.px - cam.px) * k; cam.py += (camT.py - cam.py) * k; cam.S = Math.exp(Math.log(cam.S) + (Math.log(camT.S) - Math.log(cam.S)) * k); }
  world.setCamIso(cam.px, cam.py, cam.S);
  const t0 = performance.now(); site.update(t); const t1 = performance.now(); crowd.update(t, inView); placeBlobs(); shadowCheck(); const t2 = performance.now(); world.render(); const t3 = performance.now();
  if (tour) { O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, ov2.width, ov2.height); TOURM.overlay(O, t, ov2.width, ov2.height); } else placePins();
  if (perfOn) { PERF.dt.push(rawDt * 1000); if (PERF.dt.length > 600) PERF.dt.shift(); if (rawDt * 1000 > 24) PERF.log.push([+t.toFixed(2), +(rawDt * 1000).toFixed(1), +(t1 - t0).toFixed(1), +(t2 - t1).toFixed(1), +(t3 - t2).toFixed(1)]);
    if (frames % 15 === 0) { const d = PERF.dt.slice(-120).sort((a, b) => a - b); hud.textContent = `fps ${(1000 / (d.reduce((a, b) => a + b, 0) / d.length)).toFixed(0)}  p95 ${d[Math.floor(d.length * 0.95)].toFixed(1)}  max ${d[d.length - 1].toFixed(1)} ms\nupdate ${(t1 - t0).toFixed(1)}  crowd ${(t2 - t1).toFixed(1)}  render ${(t3 - t2).toFixed(1)} ms  gpu ${world.gpuMs ? world.gpuMs.toFixed(1) : '-'}\npr ${prCur}  calls ${world.renderer.info.render.calls}`; } }
  world.renderer.info.reset();
  requestAnimationFrame(tick);
}

// ---- warm-up behind the intro card: shaders (hidden objects too), textures, fonts and overlay glyphs, then a GPU benchmark along the tour
resize(); renderPanel();
world.setCamIso(cam.px, cam.py, cam.S); site.update(0); crowd.update(0, () => true);
{ const hidden = []; world.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } }); world.renderer.compile(world.scene, world.camera); world.render(); for (const o of hidden) o.visible = false;
  world.scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) for (const k in m) { const v = m[k]; if (v && v.isTexture) world.renderer.initTexture(v); } }); }
world.render(); BOOT.compiled = performance.now();
try { await Promise.race([Promise.all([`italic 500 30px ${U.display}`, `italic 500 40px ${U.display}`, `italic 500 34px ${U.display}`, `italic 500 28px ${U.display}`, `italic 400 17px ${U.display}`, `700 96px ${U.font}`, `700 22px ${U.font}`, `600 14px ${U.font}`, `600 12px ${U.font}`, `500 15px ${U.font}`, `400 15px ${U.font}`, `400 16px ${U.font}`, `400 20px ${U.font}`, `400 22px ${U.font}`].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
// lay out a venue panel and a spot panel once, behind the intro card, so the first real one does not cost a frame
{ const firstArea = areaList.find(a => COPY.areas[a.id].n) || areaList[0]; const firstSpot = Object.keys(COPY.spots).find(k => COPY.spots[k].area);
  if (firstArea) { A.area = firstArea.id; A.spot = null; renderPanel(); void pBody.offsetHeight; }
  if (firstSpot) { A.area = COPY.spots[firstSpot].area; A.spot = firstSpot; renderPanel(); void pBody.offsetHeight; }
  A.area = null; A.spot = null; A.visited.clear(); renderPanel(); void pBody.offsetHeight; placePins(); }
{ S.mode = 'film'; for (let tt = 0; tt < TOUR_LENGTH; tt += 3) { O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, ov2.width, ov2.height); TOURM.overlay(O, tt + 1, ov2.width, ov2.height); } O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, ov2.width, ov2.height); S.mode = 'app'; }
BOOT.fonts = performance.now();
if (world.gpuTiming && !q.has('pr')) {
  const frameP = () => new Promise(r => requestAnimationFrame(r)); S.mode = 'film';
  for (let tt = 8; tt < TOUR_LENGTH; tt += 7) { const c = TOURM.camAt(tt); world.setCamIso(c[0], c[1], c[2] * VW / 1920); site.update(tt); crowd.update(tt, () => true); world.gpuTag = null; world.render(); await frameP(); world.gpuTag = 'b'; world.render(); world.gpuTag = null; await frameP(); }
  for (let k = 0; k < 8; k++) { world.render(); await frameP(); }
  const samples = world.gpuLog.filter(x => x[0] === 'b').map(x => x[1]).sort((a, b) => a - b); world.gpuLog.length = 0; S.mode = 'app';
  const gm = samples.length ? samples[Math.floor(samples.length / 2)] : null; BOOT.gpuBench = gm;
  if (gm) { prTourCap = Math.max(PR_MIN, Math.min(PR_MAX, Math.floor(prCur * Math.sqrt(GPU_BUDGET / gm) * 4) / 4)); if (prTourCap !== prCur) setPR(prTourCap); }
  world.setCamIso(cam.px, cam.py, cam.S); site.update(0); crowd.update(0, () => true); world.render();
} else if (!q.has('pr') && (devicePixelRatio || 1) >= 2) { prTourCap = 1.25; setPR(1.25); }
BOOT.ready = performance.now(); BOOT.pr = prCur;
{ const en = $('#enter'); en.textContent = COPY.intro.enter; en.disabled = false; en.onclick = () => $('#intro').classList.add('hidden'); }
requestAnimationFrame(tick);
window.__app = { A, S, goArea, goSpot, goOverview, world, cam, site, crowd, startTour, stopTour };
