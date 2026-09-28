// APPA Art Fest 2027 · story channels. Each channel has a tour timeline (film: pure function of time, seconds)
// and an app value (what the interactive app starts with; controls in copy.js change it).
// Channels used by the engine: timeOfDay (0 morning, 0.5 golden hour, 1 night), buildIn, stageOn, crowd, lotusGlow, dronesOn.
import { env, smooth, ramp, lerp } from '../src/engine/util.js';

export const TOUR_LENGTH = 90;
// the order venues rise in during the opening, and when the tour's camera visits each one (seconds)
const ORDER = ['checkin', 'theeya', 'camp', 'raiker', 'lefarm', 'shambhala', 'purrom', 'company', 'calmshet', 'hidden'];
export const VISIT = { checkin: [9, 16], raiker: [17, 25], lefarm: [26, 33], shambhala: [34, 41], purrom: [42, 49], company: [50, 57], theeya: [58, 63], hidden: [64, 68], calmshet: [72, 90] };

export const CHANNELS = {
  timeOfDay: { film: t => lerp(0.2, 0.5, smooth(ramp(t, 8, 56))) + 0.42 * smooth(ramp(t, 60, 71)), app: 0.4, ease: 1.2 },
  week: { film: t => (t < 26 ? 0 : t < 42 ? 1 : t < 64 ? 2 : 3), app: 0, ease: 0.05 },
  buildIn: { film: (t, id) => { const i = Math.max(0, ORDER.indexOf(id)); return smooth(ramp(t, 1.0 + i * 0.42, 2.0 + i * 0.42)); }, app: 1 },
  stageOn: {
    film: (t, id) => { const v = VISIT[id]; const visit = v ? env(t, v[0] - 1.5, v[0] + 0.5, v[1] + 1, v[1] + 3) : 0; const finale = smooth(ramp(t, 72, 75)) * (id === 'calmshet' ? 1 : 0.7); return Math.max(visit, finale); },
    app: () => 0, ease: 0.5 },
  crowd: {
    film: (t, id) => { const v = VISIT[id]; const base = 0.35; const visit = v ? env(t, v[0] - 3, v[0], v[1] + 2, v[1] + 5) * 0.55 : 0; return Math.max(base + visit, id === 'calmshet' ? 0.35 + 0.65 * smooth(ramp(t, 68, 76)) : 0); },
    app: id => (id === 'calmshet' ? 0.6 : 0.45), ease: 1.0 },
  lotusGlow: { film: t => smooth(ramp(t, 64, 69)), app: 0, ease: 0.8 },
  dronesOn: { film: t => env(t, 76, 79.5, 88.5, 90), app: 0, ease: 0.8 }
};
