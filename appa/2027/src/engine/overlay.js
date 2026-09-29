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
// wCss/hCss (optional): the canvas's CSS (logical) size, i.e. independent of devicePixelRatio. Font sizes here
// are tuned for a ~1920px-wide desktop frame; below MOBILE_BP that reads as illegibly small text (the smallest
// lines, like a venue's tagline, land around 6px), so a flat MOBILE_BOOST multiplies k on any narrower screen.
// Box sizes scale with the same k, so nothing clips inside its own box — but the lowest caption line sits
// CAPTION_BOTTOM_V px from the top of the fixed 1080-tall virtual frame, so on a short phone a big boost can
// push it below the visible viewport; hCss clamps k so that line always stays on screen. Video rendering
// (no wCss/hCss) is unaffected.
const MOBILE_BP = 700, MOBILE_BOOST = 4.0, CAPTION_BOTTOM_V = 1048;
export function drawOverlay(O, t, W, H, TOUR, C, logo, wCss, hCss) {
  const kBase = W / 1920;
  let k = (wCss && wCss < MOBILE_BP) ? kBase * MOBILE_BOOST : kBase;
  if (wCss && wCss < MOBILE_BP && hCss) k = Math.min(k, hCss / CAPTION_BOTTOM_V);
  O.save(); O.scale(k, k); const w = 1920, h = 1080; O.textBaseline = 'alphabetic';
  const F = C.display || 'Fraunces', G = C.font || 'Mukta';
  const vis = W / k, maxW = vis - 80; // visible width in virtual units; on a phone this is ~480, so long lines must shrink to fit
  const fit = (wt, size, text, avail, fam) => { O.font = `${wt} ${size}px ${fam}`; const m = O.measureText(text).width; return m > avail ? Math.max(8, size * avail / m) : size; };
  const box = (x, y, bw, bh) => { O.fillStyle = C.box; O.fillRect(x, y, bw, bh); O.fillStyle = C.rule; O.fillRect(x, y, 4, bh); };
  for (const c of TOUR.captions || []) { const a = env(t, c[0], c[0] + 0.6, c[1] - 0.6, c[1]); if (a < 0.01) continue; O.globalAlpha = a;
    const inW = maxW - 22 - 40; const f1 = fit('italic 500', 30, c[3], inW, `${F}, Georgia, serif`), f2 = c[4] ? fit('400', 20, c[4], inW, `${G}, sans-serif`) : 20;
    O.font = `italic 500 ${f1}px ${F}, Georgia, serif`; const w1 = O.measureText(c[3]).width; O.font = `400 ${f2}px ${G}, sans-serif`; const w2 = c[4] ? O.measureText(c[4]).width : 0;
    const bw = Math.max(w1, w2) + 60; box(40, h - 132, bw, 100);
    O.fillStyle = C.accent; O.font = `600 14px ${G}, sans-serif`; O.fillText(String(c[2]).toUpperCase().split('').join(String.fromCharCode(8202)), 62, h - 104);
    O.fillStyle = C.text; O.font = `italic 500 ${f1}px ${F}, Georgia, serif`; O.fillText(c[3], 62, h - 72);
    if (c[4]) { O.fillStyle = C.soft; O.font = `400 ${f2}px ${G}, sans-serif`; O.fillText(c[4], 62, h - 44); } O.globalAlpha = 1; }
  for (const s of TOUR.subs || []) { const a = env(t, s[0], s[0] + 0.35, s[1] - 0.35, s[1]); if (a < 0.01) continue; O.globalAlpha = a;
    const fs = fit('italic 500', 40, s[2], maxW - 52, `${F}, Georgia, serif`); O.font = `italic 500 ${fs}px ${F}, Georgia, serif`; const ww = O.measureText(s[2]).width; const x = (Math.min(w, vis) - ww) / 2, y = h - 150;
    O.fillStyle = C.box; O.fillRect(x - 26, y - 48, ww + 52, 66); O.fillStyle = C.text; O.fillText(s[2], x, y); O.globalAlpha = 1; }
  for (const key of ['title', 'end']) { const T = TOUR[key]; if (!T) continue; const a = env(t, T[0], T[0] + 0.8, T[1] - 0.8, T[1]); if (a < 0.01) continue; O.globalAlpha = a;
    O.textAlign = 'center'; // the frame is left-anchored, so everything centres on the visible width
    const pad = Math.min(60, maxW * 0.06), inW = maxW - 2 * pad;
    const f0 = fit('700', 96, T[2], inW, `${G}, sans-serif`), f1 = fit('italic 500', 34, T[3], inW, `${F}, Georgia, serif`), f2 = T[4] ? fit('400', 22, T[4], inW, `${G}, sans-serif`) : 22;
    O.font = `700 ${f0}px ${G}, sans-serif`; const wA = O.measureText(T[2]).width; O.font = `italic 500 ${f1}px ${F}, Georgia, serif`; const wB = O.measureText(T[3]).width; O.font = `400 ${f2}px ${G}, sans-serif`; const wC = T[4] ? O.measureText(T[4]).width : 0;
    const bw = Math.min(maxW, Math.max(wA + 2 * pad, wB + 2 * pad, wC + 2 * pad, Math.min(760, maxW))); const cxx = Math.min(w / 2, vis / 2);
    O.fillStyle = C.box; O.fillRect(cxx - bw / 2, 60, bw, T[4] ? 236 : 190); O.fillStyle = C.rule; O.fillRect(cxx - bw / 2, 60, bw, 4);
    O.fillStyle = C.text; O.font = `700 ${f0}px ${G}, sans-serif`; O.fillText(T[2], cxx, 160); O.font = `italic 500 ${f1}px ${F}, Georgia, serif`; O.fillStyle = C.accent; O.fillText(T[3], cxx, 212);
    if (T[4]) { O.font = `400 ${f2}px ${G}, sans-serif`; O.fillStyle = C.soft; O.fillText(T[4], cxx, 256); }
    if (key === 'end' && logo) { const lh = 34, lw = logo.naturalWidth / logo.naturalHeight * lh; O.drawImage(logo, Math.min(w, vis) - lw - 48, h - lh - 40, lw, lh); }
    O.textAlign = 'left'; O.globalAlpha = 1; }
  O.restore();
}
