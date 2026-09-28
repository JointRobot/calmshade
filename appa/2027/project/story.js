// APPA Art Fest 2027 · story channels. Each channel has a tour timeline (film: pure function of time, seconds)
// and an app value (what the interactive app starts with; controls in copy.js change it).
// Channels used by the engine: timeOfDay (0 morning, 0.5 golden hour, 1 night), buildIn, stageOn, crowd, lotusGlow, dronesOn.
import { env, smooth, ramp, lerp } from '../src/engine/util.js';

export const TOUR_LENGTH = 114;
// the order venues rise in during the opening, and when the tour's camera visits each one (seconds)
const ORDER = ['checkin', 'island', 'lefarm', 'camp', 'shambhala', 'raiker', 'calmshet', 'purrom', 'company', 'theeya', 'hidden'];
// the tour goes round the lake clockwise on screen from the festival square: Le Farm, Shambhala, Raiker, (Calmshet is
// saved for the finale) Purrom, The Company Theatre, Theeya, Hidden APPA, then dusk over the island cinema.
// t=74 to 88.5: a wide, unhurried hold over the whole lake while the tour recaps all four festival weeks
// (see project/tour.js captions). The calmshet finale camera move, and the finale channels below, then run
// 88.5 to 102.5; a final overview hold from 102.5 to 114 carries the Encore caption and the end card.
export const VISIT = { checkin: [9, 16], lefarm: [17, 25], shambhala: [26, 33], raiker: [34, 41], purrom: [42, 49], company: [50, 57], theeya: [58, 63], hidden: [64, 68], island: [69, 74], calmshet: [88.5, 114] };

export const CHANNELS = {
  timeOfDay: { film: t => lerp(0.2, 0.5, smooth(ramp(t, 8, 56))) + 0.42 * smooth(ramp(t, 60, 71)), app: 0.4, ease: 1.2 },
  // 4 = the Encore (26–28 Feb, VVIP/VIP only), which the tour's final stretch (past t=104) represents.
  week: { film: t => (t < 26 ? 0 : t < 42 ? 1 : t < 64 ? 2 : t < 104 ? 3 : 4), app: 0, ease: 0.05 },
  buildIn: { film: (t, id) => { const i = Math.max(0, ORDER.indexOf(id)); return smooth(ramp(t, 1.0 + i * 0.42, 2.0 + i * 0.42)); }, app: 1 },
  stageOn: {
    film: (t, id) => { const v = VISIT[id]; const visit = v ? env(t, v[0] - 1.5, v[0] + 0.5, v[1] + 1, v[1] + 3) : 0; const finale = smooth(ramp(t, 84.5, 87.5)) * (id === 'calmshet' ? 1 : 0.7); return Math.max(visit, finale); },
    app: () => 0, ease: 0.5 },
  crowd: {
    film: (t, id) => { const v = VISIT[id]; const base = 0.35; const visit = v ? env(t, v[0] - 3, v[0], v[1] + 2, v[1] + 5) * 0.55 : 0; const finale = id === 'calmshet' ? 0.35 + 0.65 * smooth(ramp(t, 80.5, 88.5)) : 0;
      // the Encore is small and exclusive by design: once the finale crowd settles, calmshet hushes back down.
      const encoreHush = (id === 'calmshet' && t > 102.5) ? 0.4 : 1;
      return Math.max(base + visit, finale) * encoreHush; },
    app: id => (id === 'calmshet' ? 0.6 : 0.45), ease: 1.0 },
  lotusGlow: { film: t => smooth(ramp(t, 64, 69)), app: 0, ease: 0.8 },
  dronesOn: { film: t => env(t, 88.5, 92, 101, 102.5), app: 0, ease: 0.8 }
};
