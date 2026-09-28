// PULSE iso3d · the three candidate looks and the material factory
import * as THREE from 'three';

export const STYLES = {
  A: { key: 'A', name: 'Clean vector', mat: 'toon', steps: [0.74, 1.0], bevel: 0.0, shadow: { type: 'pcf', intensity: 0.32, radius: 1 },
       outline: { color: '#1F2536', strength: 0.95, thickness: 1.25 }, ao: false, bloom: 0, tone: 'none', exposure: 1,
       bg: ['#F2EADB', '#F2EADB'], ambient: 1.55, hemi: 0, key: 1.55, keyColor: '#FFF6EA' },
  B: { key: 'B', name: 'Soft toy diorama', mat: 'standard', steps: null, bevel: 0.025, shadow: { type: 'vsm', intensity: 0.8, radius: 9 },
       outline: null, ao: true, bloom: 0.28, tone: 'neutral', exposure: 1.02,
       bg: ['#F6EFE3', '#EADCC6'], ambient: 0.3, hemi: 1.55, key: 2.7, keyColor: '#FFF1DC' },
  C: { key: 'C', name: 'Warm toon', mat: 'toon', steps: [0.42, 0.7, 1.0], bevel: 0.012, shadow: { type: 'pcf', intensity: 0.55, radius: 1 },
       outline: { color: '#3E2418', strength: 1.0, thickness: 1.8 }, ao: false, bloom: 0.2, tone: 'none', exposure: 1,
       bg: ['#F5E7D0', '#EED9BA'], ambient: 1.05, hemi: 0, key: 2.0, keyColor: '#FFE6C8' },
  D: { key: 'D', name: 'Watercolour storybook', mat: 'toon', steps: [0.6, 0.82, 1.0], bevel: 0.01, shadow: { type: 'vsm', intensity: 0.42, radius: 10 },
       outline: { color: '#6A4632', strength: 0.7, thickness: 1.5, wobble: 2.2 }, stylize: 'watercolor', ao: false, bloom: 0, tone: 'none', exposure: 1,
       colorFx: { sat: 0.9, pastel: 0.12 }, bg: ['#F7F0E2', '#F1E6D2'], ambient: 1.25, hemi: 0, key: 1.6, keyColor: '#FFF3E0' },
  E: { key: 'E', name: 'Paper-cut diorama', mat: 'toon', steps: [0.8, 1.0], bevel: 0.0, shadow: { type: 'vsm', intensity: 0.62, radius: 14 },
       outline: { color: '#FFF8EA', strength: 0.95, thickness: 1.3 }, stylize: 'paper', ao: false, bloom: 0, tone: 'none', exposure: 1,
       colorFx: { sat: 1.08, pastel: 0.04 }, bg: ['#EFE3CE', '#E6D6BC'], ambient: 1.4, hemi: 0, key: 1.35, keyColor: '#FFF6EA' },
  F: { key: 'F', name: 'Night light', mat: 'standard', steps: null, bevel: 0.02, shadow: { type: 'pcf', intensity: 0.85, radius: 1 },
       outline: null, ao: true, bloom: { strength: 0.8, radius: 0.5, threshold: 0.72 }, tone: 'aces', exposure: 1.1, night: true,
       colorFx: { darken: 0.55 }, bg: ['#0B0E1A', '#161A2C'], ambient: 0.18, ambientColor: '#5A6AA0', hemi: 0, key: 0.35, keyColor: '#8FA4E0' },
  G: { key: 'G', name: 'Blueprint with colour accents', mat: 'toon', steps: [0.62, 1.0], bevel: 0.0, shadow: { type: 'pcf', intensity: 0.28, radius: 1 },
       outline: { color: '#EAF2FF', strength: 0.9, thickness: 1.1 }, stylize: 'blueprint', edgeAfter: true, ao: false, bloom: 0.25, tone: 'none', exposure: 1,
       bg: ['#1E4A7A', '#1A3F6A'], ambient: 1.5, hemi: 0, key: 1.4, keyColor: '#FFFFFF' },
  H: { key: 'H', name: 'Clay', mat: 'standard', steps: null, bevel: 0.045, clay: true, shadow: { type: 'vsm', intensity: 0.85, radius: 8 },
       outline: null, ao: true, bloom: 0.15, tone: 'neutral', exposure: 1.05, colorFx: { sat: 1.18, lift: 0.04 },
       bg: ['#F4E9DA', '#E8D8C2'], ambient: 0.35, hemi: 1.35, key: 2.9, keyColor: '#FFE9CF' },
  I: { key: 'I', name: 'Pencil storyboard', mat: 'toon', steps: [0.35, 0.62, 0.86, 1.0], bevel: 0.0, shadow: { type: 'pcf', intensity: 0.6, radius: 1 },
       outline: { color: '#35353A', strength: 0.9, thickness: 1.5, wobble: 1.4 }, stylize: 'pencil', ao: false, bloom: 0, tone: 'none', exposure: 1,
       bg: ['#F7F4EC', '#F2EEE4'], ambient: 1.1, hemi: 0, key: 1.8, keyColor: '#FFFFFF' },
  J: { key: 'J', name: 'Oil painting', mat: 'standard', steps: null, bevel: 0.03, shadow: { type: 'vsm', intensity: 0.9, radius: 10 },
       outline: null, stylize: 'oil', sty: { brush: 5, sat: 1.15 }, ao: true, bloom: 0.2, tone: 'neutral', exposure: 1.0, colorFx: { sat: 1.1 },
       bg: ['#E9D9BC', '#D9C4A0'], ambient: 0.35, hemi: 1.3, key: 2.9, keyColor: '#FFE4C0' }
};

let grad = null;
function gradientMap(steps) {
  const n = steps.length; const d = new Uint8Array(n * 4);
  steps.forEach((v, i) => { const c = Math.round(v * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = c; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, n, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}

export function makeMaterials(style) {
  if (style.steps) grad = gradientMap(style.steps);
  const cache = new Map();
  // o: { rough, metal, emissive, emissiveIntensity, map, basic, transparent, opacity, side, vertexColors, noCache }
  const fx = style.colorFx || {};
  const tint = (col) => { const c = new THREE.Color(col || '#ffffff'); if (!Object.keys(fx).length) return c; const h = {}; c.getHSL(h);
    if (fx.sat) h.s = Math.min(1, h.s * fx.sat); if (fx.darken) h.l *= fx.darken; if (fx.lift) h.l = Math.min(1, h.l + fx.lift); c.setHSL(h.h, h.s, h.l); if (fx.pastel) c.lerp(new THREE.Color('#ffffff'), fx.pastel); return c; };
  let clayN = null;
  if (style.clay) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const img = x.createImageData(256, 256);
    const hgt = new Float32Array(256 * 256); for (let i = 0; i < hgt.length; i++) hgt[i] = Math.random(); for (let k = 0; k < 3; k++) { const b = new Float32Array(hgt.length); for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) { let a = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += hgt[((y + dy + 256) % 256) * 256 + ((xx + dx + 256) % 256)]; b[y * 256 + xx] = a / 9; } hgt.set(b); }
    for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) { const i = y * 256 + xx; const dx = hgt[y * 256 + (xx + 1) % 256] - hgt[y * 256 + (xx + 255) % 256], dy = hgt[((y + 1) % 256) * 256 + xx] - hgt[((y + 255) % 256) * 256 + xx]; img.data[i * 4] = 128 + dx * 900; img.data[i * 4 + 1] = 128 + dy * 900; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); clayN = new THREE.CanvasTexture(cv); clayN.wrapS = clayN.wrapT = THREE.RepeatWrapping; clayN.repeat.set(3, 3); }
  return function mat(color, o = {}) {
    const key = JSON.stringify([color, o.rough, o.metal, o.emissive, o.emissiveIntensity, o.basic, o.transparent, o.opacity, o.side, o.vertexColors]);
    if (!o.map && !o.noCache && cache.has(key)) return cache.get(key);
    let m;
    const base = { color: o.basic ? new THREE.Color(color || '#ffffff') : tint(color) };
    if (o.map) base.map = o.map;
    if (o.transparent) { base.transparent = true; base.opacity = o.opacity ?? 1; base.depthWrite = o.depthWrite ?? false; }
    if (o.side) base.side = o.side;
    if (o.vertexColors) base.vertexColors = true;
    if (o.basic) { m = new THREE.MeshBasicMaterial(base); m.toneMapped = false; }
    else if (style.mat === 'toon') {
      m = new THREE.MeshToonMaterial({ ...base, gradientMap: grad });
      if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    } else {
      m = new THREE.MeshStandardMaterial({ ...base, roughness: o.rough ?? (style.clay ? 0.62 : 0.86), metalness: o.metal ?? 0 });
      if (clayN && !o.map) { m.normalMap = clayN; m.normalScale = new THREE.Vector2(0.55, 0.55); }
      if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    }
    if (!o.map && !o.noCache) cache.set(key, m);
    return m;
  };
}

export function backgroundTexture(style) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, style.bg[0]); g.addColorStop(1, style.bg[1]); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
