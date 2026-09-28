// isokit · the tour's camera path and its type layer (titles, venue captions, subtitles, end card).
// Camera keys are plan targets: [t, x, y, z, S] with S = pixels per metre at 1920 px wide. Interpolation is
// monotone cubic in screen space and in log zoom, so pans and zooms ease without overshoot.
// Type is bright on a dark box in the project's colours (never light cards on the scene).
import { monotone, env } from './util.js';
import { C30 } from './world.js';

export function makeCamera(keys) {
  const ts = keys.map(k => k[0]); const sx = keys.map(k => (k[1] - k[2]) * C30), sy = keys.map(k => (k[1] + k[2]) / 2 - (k[3] || 0)), ls = keys.map(k => Math.log(k[4]));
  const fx = monotone(ts, sx), fy = monotone(ts, sy), fs = monotone(ts, ls);
  return t => [fx(t), fy(t), Math.exp(fs(t))];
}

// TOUR: { title: [t0, t1, big, small, line], end: [t0, t1, big, small, line], captions: [[t0, t1, eyebrow, name, tagline]], subs: [[t0, t1, text]] }
export function drawOverlay(O, t, W, H, TOUR, C, logo) {
  const k = W / 1920; O.save(); O.scale(k, k); const w = 1920, h = 1080; O.textBaseline = 'alphabetic';
  const F = C.display || 'Fraunces', G = C.font || 'Mukta';
  const box = (x, y, bw, bh) => { O.fillStyle = C.box; O.fillRect(x, y, bw, bh); O.fillStyle = C.rule; O.fillRect(x, y, 4, bh); };
  for (const c of TOUR.captions || []) { const a = env(t, c[0], c[0] + 0.6, c[1] - 0.6, c[1]); if (a < 0.01) continue; O.globalAlpha = a;
    O.font = `italic 500 30px ${F}, Georgia, serif`; const w1 = O.measureText(c[3]).width; O.font = `400 20px ${G}, sans-serif`; const w2 = c[4] ? O.measureText(c[4]).width : 0;
    const bw = Math.max(w1, w2) + 60; box(40, h - 132, bw, 100);
    O.fillStyle = C.accent; O.font = `600 14px ${G}, sans-serif`; O.fillText(String(c[2]).toUpperCase().split('').join(String.fromCharCode(8202)), 62, h - 104);
    O.fillStyle = C.text; O.font = `italic 500 30px ${F}, Georgia, serif`; O.fillText(c[3], 62, h - 72);
    if (c[4]) { O.fillStyle = C.soft; O.font = `400 20px ${G}, sans-serif`; O.fillText(c[4], 62, h - 44); } O.globalAlpha = 1; }
  for (const s of TOUR.subs || []) { const a = env(t, s[0], s[0] + 0.35, s[1] - 0.35, s[1]); if (a < 0.01) continue; O.globalAlpha = a;
    O.font = `italic 500 40px ${F}, Georgia, serif`; const ww = O.measureText(s[2]).width; const x = (w - ww) / 2, y = h - 150;
    O.fillStyle = C.box; O.fillRect(x - 26, y - 48, ww + 52, 66); O.fillStyle = C.text; O.fillText(s[2], x, y); O.globalAlpha = 1; }
  for (const key of ['title', 'end']) { const T = TOUR[key]; if (!T) continue; const a = env(t, T[0], T[0] + 0.8, T[1] - 0.8, T[1]); if (a < 0.01) continue; O.globalAlpha = a;
    O.textAlign = 'center'; O.font = `700 96px ${G}, sans-serif`; const bw = Math.max(O.measureText(T[2]).width + 120, 760); O.fillStyle = C.box; O.fillRect(w / 2 - bw / 2, 60, bw, T[4] ? 236 : 190); O.fillStyle = C.rule; O.fillRect(w / 2 - bw / 2, 60, bw, 4);
    O.fillStyle = C.text; O.fillText(T[2], w / 2, 160); O.font = `italic 500 34px ${F}, Georgia, serif`; O.fillStyle = C.accent; O.fillText(T[3], w / 2, 212);
    if (T[4]) { O.font = `400 22px ${G}, sans-serif`; O.fillStyle = C.soft; O.fillText(T[4], w / 2, 256); }
    if (key === 'end' && logo) { const lh = 34, lw = logo.naturalWidth / logo.naturalHeight * lh; O.drawImage(logo, w - lw - 48, h - lh - 40, lw, lh); }
    O.textAlign = 'left'; O.globalAlpha = 1; }
  O.restore();
}
