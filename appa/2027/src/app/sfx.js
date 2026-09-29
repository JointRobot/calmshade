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
function tone(f, t0, dur, vol, type = 'sine', f2) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
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
  else if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); setTimeout(() => { if (!on) stopBed(); }, 400); }
  return on;
}
export function tick() { if (!on) return; const t = ctx.currentTime; tone(740, t, 0.07, 0.035); tone(1110, t + 0.02, 0.06, 0.015); }
const PENT = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
export function bell(i = 0) { if (!on) return; const t = ctx.currentTime, f = PENT[i % PENT.length]; tone(f, t, 1.8, 0.05); tone(f * 2.01, t, 1.1, 0.018); tone(f * 3.02, t, 0.5, 0.006); }
export function whoosh() { if (!on) return; const t = ctx.currentTime, s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.7); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 1); }
