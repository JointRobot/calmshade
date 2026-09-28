// Smoothness probe: opens the app in a real (headed) Chrome window on this Mac's display, runs the guided tour
// (or explore moves) and records every real frame interval, the camera path and pixel-ratio changes.
// usage: node tools/probe_smooth.mjs [tour|explore] [seconds] [W] [H] [extraQuery]
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', process.env.ROOT || '');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mode = process.argv[2] || 'tour', secs = +(process.argv[3] || 90), W = +(process.argv[4] || 1440), H = +(process.argv[5] || 860), extra = process.argv[6] || '';
fs.mkdirSync(path.join(root, 'out'), { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); const PFX = process.env.PREFIX || '';
  if (PFX) { if (!u.startsWith(PFX)) { res.writeHead(404); res.end(); return; } u = u.slice(PFX.length) || '/index.html'; } // PREFIX: serve the app under a folder, and answer the bare folder with index.html (no slash redirect), like a rewrite rule would
  const p = path.join(root, u.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port, dport = 9300 + Math.floor(Math.random() * 500);
const udd = fs.mkdtempSync('/tmp/pulse-chrome-');
const chrome = spawn(CHROME, [`--remote-debugging-port=${dport}`, `--user-data-dir=${udd}`, `--window-size=${W},${H + 90}`, '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 80; i++) { try { const l = await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json(); const pg = l.find(x => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch (e) {} await new Promise(r => setTimeout(r, 250)); }
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map(); const waiters = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.error('PAGE EXCEPTION', JSON.stringify(d.params.exceptionDetails).slice(0, 600));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.error('PAGE error', d.params.args.map(a => a.value || a.description).join(' ').slice(0, 400));
  for (const w of waiters.splice(0)) w(d); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr, ms = 20000) => { const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((_, j) => setTimeout(() => j(new Error('evaluate timed out (page navigating?)')), ms))]); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Page.enable'); await send('Page.bringToFront');
await send('Page.navigate', { url: process.env.PREFIX ? `http://127.0.0.1:${port}${process.env.PREFIX}` : `http://127.0.0.1:${port}/index.html?${process.env.NOPERF ? '' : 'perf=1'}${extra ? '&' + extra : ''}` });
for (let i = 0; i < 150; i++) { const ok = await evaluate('!!(window.__boot && window.__boot.ready)').catch(() => false); if (ok) break; await sleep(200); }
const info = await evaluate(`({ dpr: devicePixelRatio, w: innerWidth, h: innerHeight, boot: Object.fromEntries(Object.entries(window.__boot).map(([k, v]) => [k, Math.round(v - window.__boot.start)])),
  pr: window.__app.world.renderer.getPixelRatio(), bench: window.__boot.gpuBench, gpu: (() => { const gl = window.__app.world.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() })`);
console.log(JSON.stringify(info)); if (process.env.PREFIX) console.log('page address after load:', await evaluate('location.href'));
if (process.env.GPUQ) { console.log('timer query ext:', await evaluate(`!!window.__app.world.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2')`)); }
await evaluate(`document.querySelector('#enter').click()`); await sleep(1500);
if (process.env.WARM) await sleep(+process.env.WARM * 1000); // let a fresh Chrome profile finish its own first-run jobs before measuring
if (process.env.SHOT) { for (const [i, ex] of process.env.SHOT.split(';').entries()) { await evaluate(ex); await sleep(+(process.env.SHOT_WAIT || 3800)); const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); fs.writeFileSync(path.join(root, 'out', `probe_shot_${i}.jpg`), Buffer.from(r.result.data, 'base64')); } ws.close(); chrome.kill(); server.close(); process.exit(0); }
// frame recorder: every rAF interval, the camera, and the pixel ratio
await evaluate(`(() => { const R = window.__rec = { dt: [], cam: [], pr: [], t0: performance.now() }; let l = performance.now(); const app = window.__app;
  const f = (n) => { R.dt.push(+(n - l).toFixed(2)); l = n; R.cam.push([+(n - R.t0).toFixed(1), +app.cam.px.toFixed(4), +app.cam.py.toFixed(4), +app.cam.S.toFixed(3)]); R.pr.push(app.world.renderer.getPixelRatio()); (R.gpu || (R.gpu = [])).push(app.world.gpuMs == null ? -1 : +app.world.gpuMs.toFixed(2)); if (!R.stop) requestAnimationFrame(f); }; requestAnimationFrame(f); })()`);
if (process.env.TEX) await evaluate(`(() => { const app = window.__app, R = window.__rec; R.tex = {}; const gl = app.world.renderer.getContext();
  for (const k of ['texImage2D', 'texSubImage2D']) { const f = gl[k].bind(gl); gl[k] = (...a) => { const src = a.find(x => x && typeof x === 'object' && 'width' in x && 'height' in x); const px = src ? src.width * src.height : (typeof a[3] === 'number' && typeof a[4] === 'number' ? a[3] * a[4] : 0);
    const sec = Math.floor((performance.now() - R.t0) / 1000); const e = R.tex[sec] || (R.tex[sec] = { n: 0, mpx: 0, big: {} }); e.n++; e.mpx += px / 1e6; if (src && px > 250000) { const key = src.width + 'x' + src.height; e.big[key] = (e.big[key] || 0) + 1; } return f(...a); }; } })()`);
if (process.env.INSTR) await evaluate(`(() => { const app = window.__app, R = window.__rec; R.spk = []; const T0 = R.t0; const now = () => performance.now();
  const wrap = (obj, key, tag) => { const f = obj[key].bind(obj); obj[key] = (...a) => { const s = now(); const r = f(...a); const d = now() - s; if (d > 4) R.spk.push([+(s - T0).toFixed(0), tag, +d.toFixed(1)]); return r; }; };
  for (const z of Object.keys(app.gallery.built)) wrap(app.gallery.built[z], 'update', z); wrap(app.crowd, 'update', 'crowd'); wrap(app.world, 'render', 'render'); wrap(app.world, 'resize', 'resize');
  const gl = app.world.renderer.getContext(); for (const k of ['texImage2D', 'texSubImage2D', 'compileShader', 'linkProgram', 'getProgramParameter', 'generateMipmap']) { const f = gl[k].bind(gl); gl[k] = (...a) => { const s = now(); const r = f(...a); const d = now() - s; if (d > 1.5) R.spk.push([+(s - T0).toFixed(0), 'gl.' + k + (a[6] && a[6].width ? ':' + a[6].width + 'x' + a[6].height : a[5] && a[5].width ? ':' + a[5].width + 'x' + a[5].height : ''), +d.toFixed(1)]); return r; }; } })()`);
const traceChunks = []; if (process.env.TRACE) { ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.method === 'Tracing.dataCollected') traceChunks.push(...d.params.value); }); await send('Tracing.start', { categories: 'devtools.timeline,v8,v8.execute,disabled-by-default-v8.gc,blink.user_timing,toplevel', transferMode: 'ReportEvents' }); }
if (mode === 'tour') { await evaluate(`document.querySelector('#tourbtn').click()`); await sleep(secs * 1000 + 500); }
else { const ids = await evaluate('Object.keys(window.__app.site.areas)'); const moves = ids.flatMap(id => [`goArea('${id}')`]).concat(['goOverview()']);
  for (let i = 0; i < Math.ceil(secs / 3); i++) { await evaluate(`window.__app.${moves[i % moves.length]}`).catch(e => console.error(String(e).slice(0, 200))); await sleep(3000); } }
const R = await evaluate(`(() => { window.__rec.stop = true; return window.__rec; })()`);
if (process.env.TRACE) { const done = new Promise(r => ws.addEventListener('message', m => { if (JSON.parse(m.data).method === 'Tracing.tracingComplete') r(); })); await send('Tracing.end'); await done; await sleep(300);
  const long = traceChunks.filter(e => e.ph === 'X' && e.dur > 40000).map(e => ({ name: e.name, ms: +(e.dur / 1000).toFixed(1), ts: e.ts, cat: e.cat, args: JSON.stringify(e.args || {}).slice(0, 160) })).sort((a, b) => b.ms - a.ms).slice(0, 25);
  console.log('long trace events (>40 ms):'); for (const e of long) console.log(' ', JSON.stringify(e)); }
const plog = await evaluate('window.__perf.log || []'); if (plog.length) { console.log('tour frames >24ms or work >10ms  [t, gap, pre, update, crowd, render, overlay]:'); for (const r of plog.filter(r => r[1] > 24)) console.log(' ', JSON.stringify(r)); fs.writeFileSync(path.join(root, 'out', 'probe_log.json'), JSON.stringify(plog)); }
const dt = R.dt.slice(2), n = dt.length, sorted = [...dt].sort((a, b) => a - b), vs = sorted[Math.floor(n / 2)];
const long = dt.map((d, i) => [d, R.cam[i + 2][0]]).filter(([d]) => d > vs * 1.5);
const prChanges = R.pr.reduce((a, p, i) => (i && p !== R.pr[i - 1] ? a.concat([[R.cam[i][0], p]]) : a), []);
// camera smoothness: screen-space speed per frame (px) and its frame-to-frame jump
let maxJerk = 0, jerkAt = 0; for (let i = 3; i < R.cam.length; i++) { const sp = (a, b) => Math.hypot(b[1] - a[1], b[2] - a[2]) * b[3] / Math.max(1e-3, b[0] - a[0]) * 16.67; const s1 = sp(R.cam[i - 2], R.cam[i - 1]), s2 = sp(R.cam[i - 1], R.cam[i]); const j = Math.abs(s2 - s1); if (j > maxJerk) { maxJerk = j; jerkAt = R.cam[i][0]; } }
const gpuBySec = {}; (R.gpu || []).forEach((g, i) => { if (g < 0) return; const sec = Math.floor(R.cam[i][0] / 1000); gpuBySec[sec] = Math.max(gpuBySec[sec] || 0, g); });
const gs = (R.gpu || []).filter(g => g >= 0).sort((a, b) => a - b);
const out = { mode, gpu_med: gs[Math.floor(gs.length / 2)], gpu_p95: gs[Math.floor(gs.length * 0.95)], gpu_max: gs[gs.length - 1], gpuMaxBySec: Object.values(gpuBySec).map(v => +v.toFixed(1)).join(' '), frames: n, vsync_ms: vs, fps: +(1000 / (dt.reduce((a, b) => a + b, 0) / n)).toFixed(1), p95: sorted[Math.floor(n * 0.95)], p99: sorted[Math.floor(n * 0.99)], max: sorted[n - 1],
  dropped: long.length, dropped_pct: +(100 * long.length / n).toFixed(2), worst: long.sort((a, b) => b[0] - a[0]).slice(0, 12), prChanges, cam_px_per_frame_max_change: +maxJerk.toFixed(2), at_ms: jerkAt };
console.log(JSON.stringify(out));
if (R.spk) { const bad = long.map(([d, t]) => t); console.log('spikes near dropped frames:'); for (const s of R.spk) if (bad.some(t => Math.abs(t - s[0]) < 400)) console.log(' ', JSON.stringify(s)); console.log('all spikes >4ms count', R.spk.length); }
if (R.tex) { console.log('texture uploads per second [sec: count, Mpx, big canvases]:'); for (const [k, v] of Object.entries(R.tex)) console.log(' ', k, v.n, v.mpx.toFixed(1), JSON.stringify(v.big)); }
fs.writeFileSync(path.join(root, 'out', `probe_${mode}.json`), JSON.stringify({ info, out, dt, cam: R.cam, spk: R.spk }, null, 0));
ws.close(); chrome.kill(); server.close(); await sleep(400); fs.rmSync(udd, { recursive: true, force: true }); process.exit(0);
