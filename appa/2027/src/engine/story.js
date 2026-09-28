// isokit · story channels: every animated value in the scene is a named channel.
// A channel has a film/tour timeline (a pure function of time) and an app value that controls can set.
// Archetypes and the crowd only ever read channels through S.get(name, t, arg), so the same scene
// runs the video, the guided tour and the interactive app.
import { clamp, smooth } from './util.js';

export const S = {
  mode: 'film',           // 'film' (timeline) or 'app' (controls)
  channels: {},           // name -> { film(t, arg), app: value | (arg) => value, ease }
  target: new Map(),      // app mode: 'name|arg' -> target value
  cur: new Map(),         // app mode: 'name|arg' -> eased value
  pulses: new Map(),      // app mode: 'name|arg' -> { t0, dur, peak }
  clock: 0,
  install(channels) { this.channels = channels; },
  key: (name, arg) => (arg === undefined ? name : name + '|' + arg),
  get(name, t, arg) {
    const ch = this.channels[name]; if (!ch) return 0;
    if (this.mode === 'film') return ch.film ? ch.film(t, arg) : 0;
    const k = this.key(name, arg);
    const p = this.pulses.get(k);
    if (p) { const d = this.clock - p.t0; if (d > p.dur) this.pulses.delete(k); else { const ramp = Math.min(1, d / 0.6, (p.dur - d) / 1.2); return p.peak * smooth(clamp(ramp, 0, 1)); } }
    if (!this.cur.has(k)) this.cur.set(k, this.appDefault(ch, arg));
    return this.cur.get(k);
  },
  appDefault(ch, arg) { return typeof ch.app === 'function' ? ch.app(arg) : (ch.app ?? 0); },
  // controls
  set(name, arg, value) { this.target.set(this.key(name, arg), value); if (!this.cur.has(this.key(name, arg))) this.cur.set(this.key(name, arg), this.appDefault(this.channels[name] || {}, arg)); },
  pulse(name, arg, dur = 8, peak = 1) { this.pulses.set(this.key(name, arg), { t0: this.clock, dur, peak }); },
  value(name, arg) { const k = this.key(name, arg); return this.target.has(k) ? this.target.get(k) : this.cur.has(k) ? this.cur.get(k) : this.appDefault(this.channels[name] || {}, arg); },
  // called every app frame: eased values follow their targets (per-channel ease, seconds to ~63%)
  step(dt) {
    this.clock += dt;
    for (const [k, v] of this.target) { const name = k.split('|')[0]; const ease = this.channels[name]?.ease ?? 0.6; const c = this.cur.get(k) ?? v; const a = 1 - Math.exp(-dt / Math.max(0.01, ease)); this.cur.set(k, c + (v - c) * a); }
  },
  reset() { this.target.clear(); this.cur.clear(); this.pulses.clear(); }
};
