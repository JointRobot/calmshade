// PULSE iso3d · small math and colour helpers (ported from 09_iso_animation/js/engine.js)
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const env = (t, a, b, c, d) => smooth(ramp(t, a, b)) * (1 - smooth(ramp(t, c, d)));
export const easeOutBack = t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
export const rgb = c => typeof c === 'string' ? hex(c) : c;
export const css = (c, a) => { c = rgb(c); return a === undefined || a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`; };
export const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
export const shade = (c, f) => { c = rgb(c); return [c[0] * f, c[1] * f, c[2] * f]; };
export const toHex = c => { c = rgb(c); return '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); };
export const monotone = (xs, ys) => {
  const n = xs.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  return x => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
};
export const PAL = {
  ink: '#1F2536', paper: '#F2EADB', geru: '#9C4A2E', geruD: '#7E3A24', warli: '#F3EBDD', terracotta: '#C27A4F', teak: '#8A5A36', teakD: '#6C4428',
  laterite: '#A45E3C', brass: '#D9A441', bamboo: '#C9A15E', navy: '#1C2440', night: '#141A30', black: '#1B1C21', teal: '#2F7F7A', ochre: '#D9953F',
  orange: '#E07B39', brick: '#B5523B', sand: '#E8C89A', lime: '#F4EFE4', green: '#6E9A4B', earth: '#B98B5E', concrete: '#86817A', stone: '#D6CAB5', grass: '#93AE6B'
};
