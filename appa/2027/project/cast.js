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
        { xy: [92 + ox, 104 + oy], until: 16, acts: id === 'mira' ? [[10, 12, 'point', [90, 100, 4]]] : [] },
        { xy: [72 + ox, 84 + oy], until: 70, look: [75, 58], acts: id === 'kabir' || id === 'mira' ? [[65.5, 68.5, 'point', [68, 38.5, 0.6]], [69, 70, 'joy']] : [[66, 68.5, 'photo', [75, 57, 1.5]]] },
        { xy: [94 + ox, 90 + oy], until: 90, look: [96, 84], acts: [[76, 78, 'joy'], [80, 84, id === 'father' ? 'clap' : 'raise']] } ] }))
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
