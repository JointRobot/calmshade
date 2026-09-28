// PULSE iso3d · renderer, true-isometric orthographic camera, lights and post chain
// Coordinates: the rest of the code uses the plan convention of v01 (x east, y south, z up). Three.js: X = x, Y = z, Z = y.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { EdgePass, StylizePass } from './post.js';
import { backgroundTexture } from './style.js';

export const C30 = Math.cos(Math.PI / 6);
export const P = (x, y, z = 0) => new THREE.Vector3(x, z, y);

export function createWorld({ canvas, width = 1920, height = 1080, pixelRatio = 2, style, preserve = true }) {
  // direct: no post passes, so draw straight to the canvas with its own multisampling (no half-float target, no resolve, no output pass)
  const direct = !!style.direct && !style.ao && !style.bloom && !style.stylize && !style.outline;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: direct, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = style.tone === 'agx' ? THREE.AgXToneMapping : style.tone === 'aces' ? THREE.ACESFilmicToneMapping : style.tone === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = style.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = style.shadow.type === 'vsm' ? THREE.VSMShadowMap : style.shadow.type === 'basic' ? THREE.PCFShadowMap : style.shadow.type === 'hard' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.enabled = style.shadow.type !== 'none';

  const scene = new THREE.Scene(); scene.background = backgroundTexture(style);
  const bgCan = scene.background.image;
  const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 400);

  // lights: warm key from the south-west, above (the v01 faces were lit from the left-front)
  const amb = new THREE.AmbientLight(style.ambientColor || '#FFF4E6', style.ambient); scene.add(amb);
  if (style.hemi) { const h = new THREE.HemisphereLight('#FFF6EA', '#8A6A55', style.hemi); scene.add(h); }
  const key = new THREE.DirectionalLight(style.keyColor, style.key); key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.intensity = style.shadow.intensity;
  if (style.shadow.type === 'vsm') { key.shadow.radius = style.shadow.radius; key.shadow.blurSamples = 16; key.shadow.bias = -0.0008; }
  scene.add(key); scene.add(key.target);

  const W = width * pixelRatio, H = height * pixelRatio;
  renderer.info.autoReset = false;
  const rt = direct ? null : new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: style.msaa ?? 4 });
  const composer = direct ? null : new EffectComposer(renderer, rt); if (composer) { composer.setPixelRatio(1); composer.setSize(W, H); }
  if (composer) composer.addPass(new RenderPass(scene, camera));
  let gtao = null, edge = null, bloom = null;
  if (composer && style.ao) { gtao = new GTAOPass(scene, camera, W, H); gtao.blendIntensity = 0.85; gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16 }); gtao.updatePdMaterial({ radius: 6, rings: 2, samples: 16 }); composer.addPass(gtao); }
  const sty = composer && style.stylize ? new StylizePass(scene, camera, W, H, style.stylize, style) : null;
  if (sty && style.edgeAfter) composer.addPass(sty);
  if (composer && style.outline) { edge = new EdgePass(scene, camera, W, H, style.outline); composer.addPass(edge); }
  if (sty && !style.edgeAfter) composer.addPass(sty);
  if (composer && style.bloom) { const b = typeof style.bloom === 'number' ? { strength: style.bloom, radius: 0.5, threshold: 0.92 } : style.bloom; bloom = new UnrealBloomPass(new THREE.Vector2(W, H), b.strength, b.radius, b.threshold); composer.addPass(bloom); }
  if (composer) composer.addPass(new OutputPass());

  const world = { renderer, scene, camera, key, composer, style, width, height, pixelRatio, S: 60, target: new THREE.Vector3(), bloom, bloomBase: bloom ? bloom.strength : 0 };
  // camera from a plan target (x, y, z) and v01 zoom S (px per metre)
  world.setCam = (x, y, z, S) => {
    world.camArgs = [x, y, z, S]; world.S = S; const t = P(x, y, z); world.target.copy(t);
    const hh = world.height / (S * 1.2247) / 2, ww = world.width / (S * 1.2247) / 2;
    camera.left = -ww; camera.right = ww; camera.top = hh; camera.bottom = -hh;
    const d = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(80);
    camera.position.copy(t).add(d); camera.up.set(0, 1, 0); camera.lookAt(t); camera.near = 1; camera.far = 200; camera.updateProjectionMatrix();
  };
  world.setCamIso = (px, py, S) => { const a = px / C30, b = 2 * py; world.setCam((a + b) / 2, (b - a) / 2, 0, S); };
  // shadow frustum over a plan rectangle
  world.fitShadow = (x0, y0, x1, y1) => {
    const c = P((x0 + x1) / 2, (y0 + y1) / 2, 0); const r = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    key.position.copy(c).add(new THREE.Vector3(-9, 26, 17)); key.target.position.copy(c);
    const sc = key.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
  };
  world.direct = direct;
  const draw = direct ? () => { renderer.setRenderTarget(null); renderer.render(scene, camera); } : () => composer.render();
  // optional GPU timing (EXT_disjoint_timer_query_webgl2, Chrome/Edge): world.gpuMs is the GPU time of a recent frame; results arrive a few frames late
  const gl = renderer.getContext(); const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const pend = []; world.gpuMs = null; world.gpuTiming = !!tq; world.gpuLog = []; world.gpuTag = null;
  const poll = () => { while (pend.length) { const [q, tg] = pend[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; const dj = gl.getParameter(tq.GPU_DISJOINT_EXT); const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q); pend.shift(); if (!dj) { world.gpuMs = ns / 1e6; if (tg) world.gpuLog.push([tg, world.gpuMs]); } } };
  world.render = () => { if (!tq || !world.timeGPU || pend.length > 6) { if (tq && world.timeGPU) poll(); draw(); return; } poll(); const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); draw(); gl.endQuery(tq.TIME_ELAPSED_EXT); pend.push([q, world.gpuTag]); };
  // blend the backdrop towards a warm morning (used by the night film's last shot)
  const mixHex = (a, b, k) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return '#' + ca.lerp(cb, k).getHexString(); };
  world.setBgMix = (k) => { const x = bgCan.getContext('2d'); const g2 = x.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0, mixHex(style.bg[0], '#F3E6CF', k)); g2.addColorStop(1, mixHex(style.bg[1], '#E4CFA8', k)); x.fillStyle = g2; x.fillRect(0, 0, 4, 256); scene.background.needsUpdate = true; };
  world.screen = (x, y, z) => { const v = P(x, y, z).project(camera); return [(v.x + 1) / 2 * world.width, (1 - v.y) / 2 * world.height]; };
  world.resize = (w, h, pr) => { world.width = w; world.height = h; if (pr) renderer.setPixelRatio(pr); renderer.setSize(w, h, false); const r = renderer.getPixelRatio(); if (composer) composer.setSize(w * r, h * r); if (world.camArgs) world.setCam(...world.camArgs); };
  return world;
}
