import { TS } from './story.js';
// APPA Art Fest 2027 · the people. Walkers follow a plan (times in seconds of the 90 s loop); wanderers roam an
// area on a seamless loop; cyclists ride a path loop; performers play or dance while their stage is on.
// Kinds: man, woman (saree unless outfit 'casual'), girl, boy (casual unless outfit 'uniform'), teacher.
export const CAST = {
  loop: 90, navRes: 0.25,
  walkers: [
    // a family: walk in under the arch, stop on the shore to watch the lotus light and the island, end at the square stage
    ...[['mother', 'woman', { h: 1.6, saree: '#B8432F', border: '#E0B040', blouse: '#6A2A3A' }, [0, 0]], ['father', 'man', { h: 1.74, shirt: '#8FB3CF', hat: 'cap', hatColor: '#2F7F7A' }, [0.9, 0.3]],
        ['mira', 'girl', { h: 1.3, dress: '#E2A33A', bag: true, bagColor: '#D9502F' }, [0.3, 0.9]], ['kabir', 'boy', { h: 1.2, shirt: '#3E6AA0', pants: '#6A5A48' }, [1.1, 1.1]]]
      .map(([id, kind, look, [ox, oy]]) => ({ id, kind, ...look, plan: [
        { xy: [92 + ox, 104 + oy], until: 16 * TS, acts: id === 'mira' ? [[10 * TS, 12 * TS, 'point', [90, 100, 4]]] : [] },
        { xy: [72 + ox, 84 + oy], until: 70 * TS, look: [75, 58], acts: (id === 'kabir' || id === 'mira' ? [[65.5, 68.5, 'point', [68, 38.5, 0.6]], [69, 70, 'joy']] : [[66, 68.5, 'photo', [75, 57, 1.5]]]).map(a => [a[0] * TS, a[1] * TS, ...a.slice(2)]) },
        { xy: [94 + ox, 90 + oy], until: 90 * TS, look: [96, 84], acts: [[76 * TS, 78 * TS, 'joy'], [80 * TS, 84 * TS, id === 'father' ? 'clap' : 'raise']] } ] }))
  ],
  wanderers: [
    { area: 'raiker', count: 4 }, { area: 'lefarm', count: 5 }, { area: 'shambhala', count: 3 }, { area: 'purrom', count: 5 },
    { area: 'company', count: 4 }, { area: 'calmshet', count: 5 }, { area: 'theeya', count: 5 }, { area: 'checkin', count: 6 }, { area: 'camp', count: 3 }, { area: 'hidden', count: 2 }
  ],
  cyclists: [{ path: 'loop', count: 8, speed: 3.0, lane: 0.55 }],
  performers: [
    { area: 'calmshet', count: 4, colors: ['#F2E6CF', '#D9502F', '#E2A33A', '#2F7F7A'] },
    { area: 'raiker', count: 3, colors: ['#E2A33A', '#F2E6CF', '#7A4A8C'] },
    { area: 'shambhala', count: 2, style: 'play', colors: ['#F2E6CF', '#FFC9E0'] },
    { area: 'hidden', count: 1, style: 'play' },
    { area: 'theeya', count: 2, colors: ['#F2E6CF', '#A94F32'] },
    { area: 'lefarm', count: 3, colors: ['#F2E6CF', '#3E6AA0', '#E2A33A'] },
    { area: 'company', count: 2, colors: ['#E8C8FF', '#F2E6CF'] },
    { area: 'checkin', count: 2, style: 'play', colors: ['#F2E6CF', '#E2A33A'] }
  ]
};

// people who stay put and keep doing something: a guitarist by a fire, a visitor touching an installation, someone
// studying a painting. Each: { id, at, face, faceZ, kind, look, prop, acts } (acts repeat every 90 s).
const every = (kind, tgt, starts, len = 5) => starts.map(s => [s, s + len, kind, tgt]);
const strum = [[0.5, 89.5, 'play']];
const touch = (tgt, off = 0) => [...every('tap', tgt, [3, 40, 66].map(s => s + off)), ...every('point', tgt, [14, 52].map(s => s + off)), ...every('photo', tgt, [26, 78].map(s => s + off))];
const study = (tgt, off = 0) => [...every('point', tgt, [4, 38].map(s => s + off), 4), ...every('photo', tgt, [20, 60].map(s => s + off), 4)];
const brush = (a, b) => [0.5, 12, 24, 36, 48, 60, 72, 84].map((s, i) => [s, s + (i === 7 ? 5 : 11), 'tap', i % 2 ? b : a]);
const G = { hat: undefined };
CAST.stations = [
  // fires: a guitarist with listeners
  { id: 'st-raiker-gtr', at: [16.8, 74.8], face: [18, 76], faceZ: 0.5, kind: 'woman', look: { h: 1.56, shirt: '#E2A33A', hat: 'sun' }, prop: 'guitar', acts: strum },
  { id: 'st-raiker-l1', at: [16.6, 77.4], face: [17.9, 76.3], kind: 'man', acts: every('clap', null, [8, 34, 60], 6) },
  { id: 'st-theeya-gtr', at: [112.2, 65.3], face: [113.5, 66.5], faceZ: 0.5, kind: 'man', look: { h: 1.7, shirt: '#3E6AA0' }, prop: 'guitar', acts: strum },
  { id: 'st-theeya-l1', at: [115.4, 67.9], face: [112.4, 67.5], kind: 'woman', look: { h: 1.58, shirt: '#7A4A8C' }, acts: every('clap', null, [10, 44, 70], 6) },
  { id: 'st-square-gtr', at: [86.8, 87.8], face: [88, 89], faceZ: 0.5, kind: 'woman', look: { h: 1.6, shirt: '#2F7F7A' }, prop: 'guitar', acts: strum },
  { id: 'st-square-l1', at: [89.8, 90.6], face: [87, 90.2], kind: 'boy', acts: every('joy', null, [12, 46, 72], 3) },
  { id: 'st-purrom-gtr', at: [56.5, 20.6], face: [56.5, 22.4], faceZ: 1.0, kind: 'man', look: { h: 1.7, shirt: '#B5523B' }, prop: 'guitar', acts: strum },
  // interactive installations
  { id: 'st-raiker-i1', at: [6.5, 63.7], face: [5, 62], kind: 'girl', look: { h: 1.3 }, acts: touch([5, 62, 1.5]) },
  { id: 'st-raiker-i2', at: [3.6, 63.8], face: [5, 62], faceZ: 1.8, kind: 'man', acts: touch([5, 62, 2.0], 9) },
  { id: 'st-lefarm-i1', at: [69.4, 109], face: [71, 107.5], kind: 'woman', acts: touch([71, 107.5, 1.5]) },
  { id: 'st-lefarm-i2', at: [72.4, 109.4], face: [71, 107.5], faceZ: 1.8, kind: 'boy', acts: touch([71, 107.5, 1.8], 12) },
  { id: 'st-calmshet-ai1', at: [26, 50.9], face: [28, 49], kind: 'woman', acts: touch([28, 49, 1.3]) },
  { id: 'st-calmshet-ai2', at: [30.3, 50.9], face: [28, 49], kind: 'man', acts: touch([28, 49, 1.5], 14) },
  { id: 'st-theeya-i1', at: [122.8, 64.4], face: [124, 66], kind: 'girl', look: { h: 1.32 }, acts: touch([124, 66, 1.3]) },
  { id: 'st-company-i1', at: [85, 19.8], face: [86.5, 18], kind: 'man', acts: touch([86.5, 18, 1.3]) },
  { id: 'st-company-i2', at: [87.6, 20.1], face: [86.5, 18], faceZ: 1.8, kind: 'woman', acts: touch([86.5, 18, 1.8], 16) },
  // exhibitions: people looking at paintings
  { id: 'st-raiker-v1', at: [25.9, 70.9], face: [26.4, 68.7], faceZ: 1.1, kind: 'woman', acts: study([26.4, 68.7, 1.15]) },
  { id: 'st-raiker-v2', at: [28.3, 70.9], face: [27.6, 68.7], faceZ: 1.1, kind: 'man', acts: study([27.6, 68.7, 1.2], 9) },
  { id: 'st-calmshet-v1', at: [12.6, 35.3], face: [12.6, 33.4], faceZ: 1.1, kind: 'woman', acts: study([12.6, 33.4, 1.15]) },
  { id: 'st-calmshet-v2', at: [15.6, 35.3], face: [15.4, 33.4], faceZ: 1.1, kind: 'man', acts: study([15.4, 33.4, 1.2], 11) },
  { id: 'st-purrom-v1', at: [44.9, 20.4], face: [45.3, 18.7], faceZ: 1.1, kind: 'man', acts: study([45.3, 18.7, 1.15]) },
  { id: 'st-purrom-v2', at: [47.4, 20.4], face: [46.7, 18.7], faceZ: 1.1, kind: 'woman', acts: study([46.7, 18.7, 1.2], 13) },
  { id: 'st-company-v1', at: [64, 12.6], face: [65.6, 11.7], faceZ: 1.1, kind: 'woman', acts: study([65.6, 11.7, 1.15], 6) },
  // artists at work
  { id: 'st-company-painter', at: [65.8, 13.3], face: [65.8, 11.7], faceZ: 1.1, kind: 'man', look: { h: 1.72, shirt: '#F2E6CF' }, acts: brush([65.8, 11.7, 1.25], [65.9, 11.7, 0.9]) },
  { id: 'st-calmshet-sculptor', at: [13.1, 47.3], face: [11.5, 46], faceZ: 1.2, kind: 'man', look: { h: 1.72, shirt: '#8A7A60' }, acts: brush([11.5, 46, 1.4], [11.5, 46, 0.9]) },
  { id: 'st-calmshet-potter1', at: [32.3, 52.2], face: [32.3, 50], faceZ: 0.8, kind: 'woman', acts: brush([32.3, 50.4, 0.8], [32.3, 50.2, 0.75]) },
  { id: 'st-calmshet-potter2', at: [35.7, 52.2], face: [35.7, 50], faceZ: 0.8, kind: 'man', acts: brush([35.7, 50.4, 0.8], [35.7, 50.2, 0.75]) },
  { id: 'st-lefarm-wood1', at: [56.3, 108.5], face: [57.5, 108.5], faceZ: 0.9, kind: 'man', acts: brush([57.2, 108.5, 0.9], [57.0, 108.5, 0.8]) },
  { id: 'st-lefarm-wood2', at: [58.7, 108.5], face: [57.5, 108.5], faceZ: 0.9, kind: 'woman', acts: brush([57.8, 108.5, 0.9], [58.0, 108.5, 0.8]) },
  { id: 'st-purrom-work', at: [40, 23.4], face: [40, 21.6], faceZ: 0.9, kind: 'woman', acts: brush([40, 21.9, 0.85], [40.2, 21.9, 0.75]) },
  { id: 'st-shambhala-rocks', at: [37.7, 96.4], face: [36, 95], faceZ: 1.0, kind: 'man', acts: study([36, 95, 1.0]) },
  { id: 'st-shambhala-wood', at: [48.7, 96.8], face: [47.4, 95.4], faceZ: 0.9, kind: 'man', acts: brush([47.4, 95.5, 0.9], [47.6, 95.5, 0.8]) }
];

// ---- second pass: every exhibit, workshop, installation and circle in the programme gets people
const KINDS = ['woman', 'man', 'girl', 'woman', 'man', 'boy'];
const ring = (id, cx, cy, r, n, sitters = n) => Array.from({ length: sitters }, (_, i) => { const a = i / n * Math.PI * 2; return { id: `${id}-${i}`, at: [cx + Math.cos(a) * r, cy + Math.sin(a) * r], face: [cx, cy], faceZ: 0.6, kind: KINDS[i % 6], look: KINDS[i % 6] === 'girl' ? { h: 1.3 } : undefined, acts: [[0.5, 89.5, 'sit']] }; });
const at2 = (id, x, y, fx, fy, kind, acts, fz = 1.2, look) => ({ id, at: [x, y], face: [fx, fy], faceZ: fz, kind, acts, look });
CAST.stations.push(
  // circles: sunset, sunrise, sound healing (everyone sits on mats)
  ...ring('sit-calmshet', 36.4, 26.6, 1.5, 5, 4), ...ring('sit-company', 79.6, 19.7, 1.5, 5, 4), ...ring('sit-purrom', 57.6, 10.4, 1.5, 5, 4), ...ring('sit-theeya', 107.5, 76.9, 1.5, 5, 4),
  at2('st-lefarm-yoga1', 49.6, 107, 53, 107, 'woman', [[0.5, 89.5, 'sit']], 1.0), at2('st-lefarm-yoga2', 51.6, 107.1, 53, 107, 'man', [[0.5, 89.5, 'sit']], 1.0),
  // Calmshet
  at2('st-calmshet-v3', 12.6, 28.9, 12.4, 27.6, 'woman', study([12.4, 27.6, 1.15], 5)), at2('st-calmshet-p1', 10.9, 28.9, 10.7, 27.6, 'man', brush([10.7, 27.6, 1.2], [10.8, 27.6, 0.9]), 1.1, { h: 1.7, shirt: '#3E6AA0' }),
  at2('st-calmshet-p2', 14.0, 35.3, 13.4, 33.4, 'woman', brush([13.4, 33.4, 1.25], [13.3, 33.4, 0.9]), 1.1, { h: 1.6, shirt: '#B5523B' }), at2('st-calmshet-v4', 17.6, 35.1, 16.6, 33.4, 'man', study([16.4, 33.4, 1.2], 8)),
  at2('st-calmshet-i3', 36.4, 37.7, 37.2, 36, 'girl', touch([37.2, 36, 1.3], 6), 1.3, { h: 1.32 }),
  // Le Farm
  at2('st-lefarm-v1', 64.5, 108.2, 64.6, 107, 'woman', study([64.6, 107, 1.15], 3)), at2('st-lefarm-v2', 66.0, 108.2, 66.1, 107, 'man', study([66.1, 107, 1.2], 12)),
  at2('st-lefarm-beer1', 69.2, 118.4, 71, 116.6, 'man', every('raise', null, [6, 30, 54, 76], 4), 1.1), at2('st-lefarm-beer2', 72.7, 118.6, 71, 116.6, 'woman', every('raise', null, [14, 38, 62, 82], 4), 1.1),
  at2('st-lefarm-wine1', 61.9, 101.4, 63.2, 99.6, 'woman', every('raise', null, [8, 34, 58], 4), 1.1), at2('st-lefarm-wine2', 64.6, 101.4, 63.2, 99.6, 'man', every('raise', null, [18, 44, 70], 4), 1.1),
  at2('st-lefarm-shrine1', 49.9, 97.6, 50.1, 99.6, 'woman', every('point', [50.1, 99.6, 2.6], [5, 47], 5), 1.5), at2('st-lefarm-shrine2', 48.6, 101.2, 50.1, 99.6, 'man', every('photo', [50.1, 99.6, 2.0], [22, 64], 5), 1.5, { bag: true, hat: 'cap' }),
  at2('st-lefarm-sculptor', 56.6, 98.0, 55.2, 98.0, 'man', brush([55.2, 98.0, 1.4], [55.2, 98.0, 0.9]), 1.2, { h: 1.72, shirt: '#8A7A60' }),
  // Raiker
  at2('st-raiker-m1', 2.9, 59.8, 3.6, 57.9, 'woman', study([3.6, 57.8, 1.15], 2)), at2('st-raiker-m2', 8.1, 59.8, 7.4, 57.9, 'man', study([7.4, 57.8, 1.2], 10)),
  at2('st-raiker-h2', 3.2, 67.5, 3.2, 66.2, 'woman', study([3.2, 66.1, 1.15], 4)), at2('st-raiker-h3', 21.2, 71.0, 21.2, 69.6, 'man', study([21.2, 69.6, 1.15], 7)), at2('st-raiker-h3b', 22.6, 71.0, 22.2, 69.6, 'woman', study([22.2, 69.6, 1.15], 15)),
  at2('st-raiker-i3', 26.6, 60.4, 28, 60.6, 'boy', touch([28, 60.6, 1.3], 4), 1.3, { h: 1.25 }), at2('st-raiker-i4', 20.6, 55.3, 22.5, 54.8, 'woman', touch([22.5, 54.8, 1.5], 18)),
  at2('st-raiker-t1', 26.8, 75.4, 28, 74.6, 'man', every('point', [28, 74.6, 2.0], [9, 50], 5), 1.5), at2('st-raiker-trek', 28.3, 64.5, 25, 64, 'woman', every('point', [25, 64, 1.2], [12, 58], 5), 1.3, { bag: true, hat: 'sun' }),
  at2('st-raiker-painter', 9.1, 62.6, 8.4, 60.8, 'woman', brush([8.4, 57.8, 1.2], [8.4, 57.8, 0.9]), 1.2, { h: 1.6, shirt: '#7A4A8C' }),
  // Shambhala
  at2('st-shambhala-v1', 38.0, 82.5, 37.5, 81.2, 'woman', study([37.5, 81.2, 1.15], 2)), at2('st-shambhala-v2', 39.4, 82.5, 39.7, 81.2, 'man', study([39.7, 81.2, 1.2], 11)),
  at2('st-shambhala-p1', 30.1, 96.9, 30.1, 95.5, 'man', brush([30.1, 95.5, 1.2], [30.2, 95.5, 0.9]), 1.1, { h: 1.7, shirt: '#2F7F7A' }), at2('st-shambhala-p2', 31.6, 96.9, 31.5, 95.5, 'woman', brush([31.5, 95.5, 1.25], [31.4, 95.5, 0.9]), 1.1, { h: 1.6, shirt: '#E2A33A' }),
  // Theeya
  at2('st-theeya-p1', 109.0, 66.9, 109.0, 65.5, 'woman', brush([109, 65.5, 1.2], [109, 65.5, 0.9]), 1.1, { h: 1.58, shirt: '#B8432F' }), at2('st-theeya-p2', 110.4, 66.9, 110.4, 65.5, 'man', brush([110.4, 65.5, 1.2], [110.4, 65.5, 0.9]), 1.1, { h: 1.72, shirt: '#F2E6CF' }),
  at2('st-theeya-i2', 103.8, 75.6, 102.3, 74.4, 'girl', touch([102.3, 74.4, 1.4], 2), 1.3, { h: 1.3 }), at2('st-theeya-i3', 113.2, 78.4, 114.5, 77.2, 'man', touch([114.5, 77.2, 1.4], 20)),
  at2('st-theeya-d1', 111.6, 70.2, 110.2, 70.4, 'woman', every('raise', null, [10, 40, 70], 4), 1.1), at2('st-theeya-d2', 111.6, 71.7, 110.2, 71.0, 'man', every('raise', null, [22, 52, 80], 4), 1.1),
  // Company
  at2('st-company-sculptor', 63.3, 21.0, 64, 19.8, 'man', brush([64, 19.8, 1.4], [64, 19.8, 0.9]), 1.2, { h: 1.72, shirt: '#8A7A60' }), at2('st-company-v2', 65.4, 22.6, 64, 19.8, 'woman', study([64, 19.8, 1.4], 10)),
  // Purrom
  at2('st-purrom-p1', 46.2, 20.5, 46.0, 18.8, 'woman', brush([46, 18.8, 1.2], [46, 18.8, 0.9]), 1.1, { h: 1.6, shirt: '#3E6AA0' })
);
CAST.performers.push({ area: 'theeya', stage: 1, count: 2, colors: ['#E8C8FF', '#F2E6CF'] });
