// isokit · render stills, shot lists or the tour video with headless Chrome (raw DevTools protocol, no npm deps).
// usage:
//   node tools/render.mjs stills 0,12,30 OUT_DIR
//   node tools/render.mjs video OUT.mp4 [fps=30] [from=0] [to=90] [audio.wav]
//   node tools/render.mjs shots SHOTS.json OUT_DIR   (clean frames, optional camera per shot)
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // 10_iso3d
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mode = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const dport = 9300 + Math.floor(Math.random() * 500);
const udd = fs.mkdtempSync('/tmp/pulse-chrome-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${dport}`, `--user-data-dir=${udd}`, '--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json(); const pg = l.find(x => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch (e) {} await new Promise(r => setTimeout(r, 250)); }
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map(); const waiters = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') console.error('PAGE EXCEPTION', JSON.stringify(d.params.exceptionDetails).slice(0, 800));
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) console.error('PAGE', d.params.type, d.params.args.map(a => a.value || a.description).join(' ').slice(0, 500));
  for (const w of waiters.splice(0)) w(d); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800)); return r.result.result.value; };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const PAGE = process.env.PAGE || 'styletest.html?style=B';
if (process.env.VW) await send('Emulation.setDeviceMetricsOverride', { width: +process.env.VW, height: +process.env.VH, deviceScaleFactor: +(process.env.DPR || 1), mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${port}/${PAGE}${PAGE.includes('?') ? '&' : '?'}capture=1` });
await new Promise(r => { const f = (d) => { if (d.method === 'Page.loadEventFired') r(); else waiters.push(f); }; waiters.push(f); });
for (let i = 0; i < 100; i++) { const ok = await evaluate('typeof window.renderAt === "function" || typeof window.__app === "object"'); if (ok) break; await new Promise(r => setTimeout(r, 200)); }
console.log('GPU:', await evaluate('window.gpuInfo ? window.gpuInfo() : "n/a"')); await evaluate('window.READY || true');
const t0 = Date.now();
const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');

if (mode === 'stills') {
  const times = process.argv[3].split(',').map(Number); const out = process.argv[4]; fs.mkdirSync(out, { recursive: true });
  for (const t of times) { const d = await evaluate(`renderAt(${t}, { type: 'image/png', clean: ${process.env.CLEAN === '1'} })`); const f = path.join(out, `iso_t${String(t.toFixed(1)).padStart(5, '0')}.png`); fs.writeFileSync(f, b64(d)); console.log('wrote', f); }
} else if (mode === 'eval') {
  console.log(JSON.stringify(await evaluate(process.argv[3]), null, 1));
} else if (mode === 'style') {
  const out = process.argv[3]; const tag = process.argv[4] || 'X'; fs.mkdirSync(out, { recursive: true });
  for (const shot of (process.env.SHOTS || 'wide,close').split(',')) { const t1 = Date.now(); const d = await evaluate(`renderAt(window.SHOTS['${shot}'].t, { shot: '${shot}', type: 'image/png', lineup: '${shot}' === 'lineup' })`); const f = path.join(out, `style_${tag}_${shot}.png`); fs.writeFileSync(f, b64(d)); console.log('wrote', f, Date.now() - t1, 'ms'); }
} else if (mode === 'clip') {
  const out = process.argv[3], fps = +(process.argv[4] || 30), dur = +(process.argv[5] || 8);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < fps * dur; i++) { const d = await evaluate(`renderAt(${(i / fps).toFixed(4)}, { type: 'image/jpeg', q: 0.92 })`); if (!ff.stdin.write(b64(d))) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote', out);
} else if (mode === 'shots') {
  // JSON list: [{name, t, cam?: [x, y, z, S], clean?: true}]
  const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); const out = process.argv[4]; fs.mkdirSync(out, { recursive: true });
  for (const sh of spec) { const d = await evaluate(`renderAt(${sh.t}, ${JSON.stringify({ type: 'image/png', clean: sh.clean !== false, cam: sh.cam })})`); const f = path.join(out, `${sh.name}.png`); fs.writeFileSync(f, b64(d)); console.log('wrote', f); }
} else if (mode === 'video') {
  const out = process.argv[3], fps = +(process.argv[4] || 30), from = +(process.argv[5] || 0), to = +(process.argv[6] || 90), audio = process.argv[7];
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
  if (audio) args.push('-ss', String(from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  args.push('-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((to - from) * fps);
  for (let i = 0; i < n; i++) { const t = from + i / fps; const d = await evaluate(`renderAt(${t.toFixed(4)}, { type: 'image/jpeg', q: 0.93 })`); if (!ff.stdin.write(b64(d))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 90 === 0) console.log(`frame ${i}/${n}  t=${t.toFixed(2)}  ${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote', out);
}
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
ws.close(); chrome.kill(); server.close(); await new Promise(r => setTimeout(r, 400)); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
process.exit(0);
