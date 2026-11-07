// APPA · minimal synthesised sound (no audio files): a soft lake-and-wind bed with the odd bird, a gentle tap for
// controls, a bell for each venue in the guided tour, and a whoosh at the start and end. Off until the visitor
// switches it on (browsers only allow sound after a tap), and every level is kept very low.
let ctx = null, master = null, noiseBuf = null, on = false, bed = null, birds = null;
const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
function ensure() {
  if (!AC) return false;
  if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const n = ctx.sampleRate * 4; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.05) * 3.2; } }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}
const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
function tone(f, t0, dur, vol, type = 'sine', f2, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function startBed() {
  if (bed) return; const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 520; g.gain.value = 0.05; lfo.frequency.value = 0.11; lg.gain.value = 0.022; lfo.connect(lg); lg.connect(g.gain);
  s.connect(lp); lp.connect(g); g.connect(master); s.start(); lfo.start(); bed = { s, lfo };
  const chirp = () => { if (!on) return; const t = ctx.currentTime + 0.05, f = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) tone(f * (1 + i * 0.06), t + i * 0.11, 0.09, 0.012, 'sine', f * (1.25 + i * 0.05)); birds = setTimeout(chirp, 7000 + Math.random() * 9000); };
  birds = setTimeout(chirp, 2500);
}
function stopBed() { if (bed) { try { bed.s.stop(); bed.lfo.stop(); } catch (e) {} bed = null; } clearTimeout(birds); }
export const isOn = () => on;
export function setOn(v) {
  if (v && !ensure()) return false; on = v;
  if (v) { startBed(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.6); tick(); }
  else if (ctx) { zoneStop(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); setTimeout(() => { if (!on) stopBed(); }, 400); }
  return on;
}
export function tick() { if (!on) return; const t = ctx.currentTime; tone(740, t, 0.07, 0.035); tone(1110, t + 0.02, 0.06, 0.015); }
const PENT = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
export function bell(i = 0) { if (!on) return; const t = ctx.currentTime, f = PENT[i % PENT.length]; tone(f, t, 1.8, 0.05); tone(f * 2.01, t, 1.1, 0.018); tone(f * 3.02, t, 0.5, 0.006); }
export function whoosh() { if (!on) return; const t = ctx.currentTime, s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.7); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 1); }

// ---- the Green Corner: bamboo being lashed and knocked into place, the flea and café murmur with the odd cup clink, and three
// musicians (violin, flute, hang drum) playing slow phrases in the same D-minor colour. They fade in as the camera nears the corner:
// zone(a) is called every frame with a = 0 (far) .. 1 (right there). Nothing runs while the sound is off or the corner is far away.
const D_MIN = [293.66, 329.63, 349.23, 392, 440, 466.16, 523.25, 587.33], HANG = [293.66, 440, 466.16, 523.25, 587.33, 659.25, 698.46, 880];
let zg = null, zTimer = null, zA = 0, murmur = null; const nxt = {}, idx = { violin: 3, flute: 4 };
const rnd = (a, b) => a + Math.random() * (b - a);
function voice(f, t, dur, vol, type, filt, vib, breath) { // a bowed or blown note: slow attack, vibrato, soft release
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), lf = ctx.createOscillator(), lg = ctx.createGain();
  o.type = type; o.frequency.value = f; lf.frequency.value = vib; lg.gain.value = f * 0.006; lf.connect(lg); lg.connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = filt;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.22, dur * 0.3)); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(zg); o.start(t); lf.start(t); o.stop(t + dur + 0.05); lf.stop(t + dur + 0.05);
  if (breath) { const n = noise(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 1.2; ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(breath, t + 0.08); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(ng); ng.connect(zg); n.start(t); n.stop(t + dur + 0.05); }
}
function click(t, f, vol) { // a short woody knock: a quick falling tone plus a puff of filtered noise
  tone(f, t, 0.11, vol, 'triangle', f * 0.55, zg); const n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 2.4; bp.Q.value = 1.5;
  g.gain.setValueAtTime(vol * 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); n.connect(bp); bp.connect(g); g.connect(zg); n.start(t); n.stop(t + 0.07);
}
function zoneStep() {
  if (!on || !ctx || zA < 0.02) return; const now = ctx.currentTime, ahead = now + 0.4;
  if (nxt.violin < ahead) { idx.violin = Math.max(0, Math.min(7, idx.violin + Math.round(rnd(-2, 2)))); const d = rnd(1.0, 2.1); voice(D_MIN[idx.violin] / 2, Math.max(now, nxt.violin), d, 0.05, 'sawtooth', 1500, 5.4, 0); nxt.violin = Math.max(now, nxt.violin) + d * 0.92 + (Math.random() < 0.18 ? rnd(1.2, 2.6) : 0); }
  if (nxt.flute < ahead) { idx.flute = Math.max(0, Math.min(7, idx.flute + Math.round(rnd(-3, 3)))); const d = rnd(0.5, 1.5); voice(D_MIN[idx.flute], Math.max(now, nxt.flute), d, 0.04, 'sine', 3200, 4.8, 0.006); nxt.flute = Math.max(now, nxt.flute) + d + (Math.random() < 0.35 ? rnd(1.0, 3.2) : rnd(0.05, 0.3)); }
  if (nxt.hang < ahead) { let t = Math.max(now, nxt.hang); const n = 2 + Math.floor(Math.random() * 4), step = rnd(0.24, 0.36); for (let i = 0; i < n; i++) { const f = HANG[Math.floor(Math.random() * HANG.length)], tt = t + i * step; tone(f, tt, 1.7, 0.055, 'sine', undefined, zg); tone(f * 2.0, tt, 0.9, 0.018, 'sine', undefined, zg); tone(f * 3.01, tt, 0.35, 0.006, 'sine', undefined, zg); } nxt.hang = t + n * step + rnd(1.0, 2.6); }
  if (nxt.knock < ahead) { let t = Math.max(now, nxt.knock); const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) click(t + i * rnd(0.2, 0.3), rnd(480, 640), 0.07); nxt.knock = t + n * 0.3 + rnd(0.6, 2.4);
    if (Math.random() < 0.3) { const tt = t + 0.5, r = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(900, tt); bp.frequency.exponentialRampToValueAtTime(2600, tt + 0.35); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.03, tt + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.38); r.connect(bp); bp.connect(g); g.connect(zg); r.start(tt); r.stop(tt + 0.4); } }
  if (nxt.clink < ahead) { const t = Math.max(now, nxt.clink), f = rnd(2300, 2800); tone(f, t, 0.18, 0.02, 'sine', undefined, zg); tone(f * 1.51, t + 0.01, 0.12, 0.01, 'sine', undefined, zg); nxt.clink = t + rnd(3, 7); }
}
function zoneStart() {
  if (zTimer) return; zg = ctx.createGain(); zg.gain.value = 0; zg.connect(master); const now = ctx.currentTime;
  for (const k of ['violin', 'flute', 'hang', 'knock', 'clink']) nxt[k] = now + rnd(0.1, 2.2);
  const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); // the flea and café: a low murmur of voices
  bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.7; g.gain.value = 0.035; lfo.frequency.value = 0.27; lg.gain.value = 0.014; lfo.connect(lg); lg.connect(g.gain); s.connect(bp); bp.connect(g); g.connect(zg); s.start(); lfo.start(); murmur = { s, lfo };
  zTimer = setInterval(zoneStep, 160);
}
function zoneStop() {
  if (zTimer) { clearInterval(zTimer); zTimer = null; } if (murmur) { try { murmur.s.stop(); murmur.lfo.stop(); } catch (e) {} murmur = null; } if (zg) { try { zg.disconnect(); } catch (e) {} zg = null; }
}
export function zone(a) {
  zA = on && ctx ? a : 0; if (!on || !ctx) return;
  if (a > 0.02) { zoneStart(); zg.gain.setTargetAtTime(a * a, ctx.currentTime, 0.35); }
  else if (zTimer && a <= 0.005) zoneStop();
}
