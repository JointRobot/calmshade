// isokit · the video and deck-frame renderer. renderAt(t, { cam, clean, type, q }) draws the tour at time t.
// ?style=<key> overrides the project's look; ?pr= sets the pixel ratio (1.5 for the video, 2 for deck frames).
import { createWorld, C30 } from './engine/world.js';
import { STYLES, makeMaterials } from './engine/style.js';
import { G } from './engine/geom.js';
import { buildSite } from './engine/site.js';
import { buildCrowd } from './engine/crowd.js';
import { CAST } from '../project/cast.js';
import { S } from './engine/story.js';
import { SITE } from '../project/site.js';
import { CHANNELS } from '../project/story.js';
import { LOOK } from '../project/look.js';

const q = new URLSearchParams(location.search);
const style = q.get('style') ? { ...STYLES[q.get('style')] } : { ...STYLES[LOOK.style], ...LOOK.overrides };
const pr = +(q.get('pr') || 1.5);
S.install(CHANNELS); S.mode = 'film';
const gl = document.createElement('canvas');
const world = createWorld({ canvas: gl, width: 1920, height: 1080, pixelRatio: pr, style });
world.key.shadow.mapSize.set(4096, 4096);
const mat = makeMaterials(style), g = G(style);
const site = buildSite(world, mat, g, style, SITE);
world.fitShadow(...LOOK.shadowBox);
const crowd = buildCrowd(world, mat, SITE, CAST); window.__crowd = crowd;
window.validateCrowd = (step) => crowd.validate(step); window.crowdRoutes = () => crowd.exportRoutes();
const out = document.getElementById('out'); out.width = Math.round(1920 * pr); out.height = Math.round(1080 * pr); const O = out.getContext('2d');
const [X0, Y0, X1, Y1] = SITE.bounds; const OVER = [(X0 + X1) / 2, (Y0 + Y1) / 2, 0, 1920 / ((X1 - X0 + Y1 - Y0) * C30 * 1.05)];

let tourMod = null; try { tourMod = await import('../project/tour.js'); } catch (e) {}
window.renderAt = (t, o = {}) => {
  if (o.cam) world.setCam(...o.cam); else if (tourMod) { const c = tourMod.camAt(t); world.setCamIso(c[0], c[1], c[2] * 1920 / 1920); } else world.setCam(...OVER);
  site.update(t); crowd.update(t, null);
  world.render();
  O.setTransform(1, 0, 0, 1, 0, 0); O.drawImage(gl, 0, 0, out.width, out.height);
  if (!o.clean && tourMod && tourMod.overlay) tourMod.overlay(O, t, out.width, out.height);
  return out.toDataURL(o.type || 'image/jpeg', o.q ?? 0.92);
};
window.OVERVIEW = OVER;
window.gpuInfo = () => { const c = world.renderer.getContext(); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; };
window.__world = world; window.__site = site;
if (!q.has('capture')) { const t0 = performance.now(); const loop = () => { window.renderAt(((performance.now() - t0) / 1000) % 90); requestAnimationFrame(loop); }; loop(); }
