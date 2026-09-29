// APPA Art Fest 2027 · story channels. Each channel has a tour timeline (film: pure function of time, seconds)
// and an app value (what the interactive app starts with; controls in copy.js change it).
// Channels used by the engine: timeOfDay (0 morning, 0.5 golden hour, 1 night), buildIn, stageOn, crowd, lotusGlow, dronesOn.
import { env, smooth, ramp, lerp } from '../src/engine/util.js';

// The tour is authored on a 114 s timeline; TS squeezes it to a tight ~91 s (under two minutes). Everything time-based
// in the tour (camera, captions, channels, the family walkers) is authored in the original seconds and scaled by TS.
export const TS = 0.8;
export const TOUR_LENGTH = Math.round(114 * TS);
// the order venues rise in during the opening, and when the tour's camera visits each one (seconds)
const ORDER = ['checkin', 'island', 'calmshet', 'camp', 'purrom', 'company', 'theeya', 'lefarm', 'shambhala', 'raiker', 'hidden'];
// the tour goes round the lake clockwise on screen from Calmshet (Venue 1): Purrom, The Company Theatre, Theeya, Hidden APPA,
// Le Farm, Shambhala and Secret Farm last (Venue 7), then dusk over the island cinema.
// t=82 to 96: a wide, unhurried hold over the whole lake while the tour recaps all four festival weeks
// (see project/tour.js captions); a final overview hold to 114 carries the Encore caption and the end card.
export const VISIT = { checkin: [9, 16], calmshet: [17, 25], purrom: [25.5, 31], company: [32, 37.5], theeya: [39, 45], hidden: [46, 51], lefarm: [52.5, 59], shambhala: [60, 65.5], raiker: [66.5, 72], island: [76, 82] };

export const CHANNELS = {
  timeOfDay: { film: t => lerp(0.2, 0.5, smooth(ramp(t, 8, 68))) + 0.42 * smooth(ramp(t, 72, 82)), app: 0.4, ease: 1.2 },
  // 4 = the Encore (26–28 Feb, VVIP/VIP only), which the tour's final stretch (past t=104) represents.
  week: { film: t => (t < 32 ? 0 : t < 52 ? 1 : t < 76 ? 2 : t < 104 ? 3 : 4), app: 0, ease: 0.05 },
  buildIn: { film: (t, id) => { const i = Math.max(0, ORDER.indexOf(id)); return smooth(ramp(t, 1.0 + i * 0.42, 2.0 + i * 0.42)); }, app: 1 },
  stageOn: {
    film: (t, id) => { const v = VISIT[id]; const visit = v ? env(t, v[0] - 1.5, v[0] + 0.5, v[1] + 1, v[1] + 3) : 0; const finale = smooth(ramp(t, 90, 93)) * (id === 'calmshet' ? 1 : 0.7); return Math.max(visit, finale); },
    app: () => 0, ease: 0.5 },
  crowd: {
    film: (t, id) => { const v = VISIT[id]; const base = 0.35; const visit = v ? env(t, v[0] - 3, v[0], v[1] + 2, v[1] + 5) * 0.55 : 0; const finale = id === 'calmshet' ? 0.35 + 0.65 * smooth(ramp(t, 86, 94)) : 0;
      // the Encore is small and exclusive by design: once the finale crowd settles, calmshet hushes back down.
      const encoreHush = (id === 'calmshet' && t > 102.5) ? 0.4 : 1;
      return Math.max(base + visit, finale) * encoreHush; },
    app: id => (id === 'calmshet' ? 0.6 : 0.45), ease: 1.0 },
  lotusGlow: { film: t => smooth(ramp(t, 74, 79)), app: 0, ease: 0.8 },
  dronesOn: { film: t => env(t, 88.5, 92, 101, 102.5), app: 0, ease: 0.8 }
};
// channels are authored in original seconds: feed them t / TS
for (const c of Object.values(CHANNELS)) { const f = c.film; if (f) c.film = (t, id) => f(t / TS, id); }
