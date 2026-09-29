// APPA Art Fest 2027 · the site: one lake with an island cinema, seven venues around it, the festival square
// (check-in) on the south shore, the camp and Hidden APPA. Laid out from Karthik's own concept drawing.
// Plan metres, x east, y south. The map is a diorama, not to scale: the real lake is kilometres across.
// On screen the top corner is the north-west, the bottom corner the south-east. Going round the lake clockwise
// on screen: Le Farm (bottom-left), Shambhala (left), Raiker (top-left), Calmshet (top), Purrom (top-right),
// The Company Theatre (right), Theeya (bottom-right), and the festival square (bottom, by the water).
// Every venue is an area with a plaza and a list of KIT parts (see src/engine/kit.js for the part types).

const at = (c, dx, dy, o) => ({ x: c[0] + dx, y: c[1] + dy, ...o });
const A = (x, y, o) => ({ x, y, ...o });   // absolute plan position

// venue centres
const C = {
  raiker: [15, 66], shambhala: [34, 86], lefarm: [60, 108], calmshet: [24, 40], purrom: [48, 18], company: [73, 17],
  theeya: [111, 68], checkin: [89, 91], island: [75, 59], camp: [18, 114], hidden: [118, 114]
};

export const SITE = {
  name: 'APPA Art Fest 2027',
  bounds: [0, 0, 130, 130],
  ground: { color: '#A3B56C', edge: '#7A5A3A', depth: 2.2, ppm: 12,
    fields: [ { x: 124, y: 40, w: 10, d: 12, rot: 0.1, color: '#C8B56A' }, { x: 84, y: 118, w: 10, d: 8, rot: -0.1, color: '#B9C36E' },
      { x: 39, y: 112, w: 8, d: 12, rot: 0.05, color: '#D2BF72' }, { x: 8, y: 90, w: 9, d: 10, rot: 0.1, color: '#BFCB74' }, { x: 96, y: 14, w: 10, d: 8, rot: 0.15, color: '#C8B56A' } ] },
  sky: { day: ['#F6ECDA', '#EAD9BE'], dusk: ['#F7C88C', '#E48F6C'], night: ['#121834', '#2A2F58'] },
  water: [ { id: 'lake', color: '#4FA6D2', dusk: '#86A9D8', night: '#1D2A55', shallow: '#8FD0DE', shore: '#DCCB9C', shoreWidth: 2.6,
    pts: [[44.8, 73.4], [40.8, 64.3], [41.3, 57.2], [45.3, 49.9], [51, 45.1], [56.3, 43.8], [58.3, 40.2], [62.7, 35], [71.2, 32.2], [81.3, 31.9], [92, 36], [98.3, 41.3],
      [100.8, 48.5], [96.8, 55.9], [90.6, 62.9], [84, 71], [76, 77], [65, 78.5], [55.2, 77.7]],
    // the island cinema in the middle of the lake
    islands: [ [[66.7, 62.5], [67, 58.3], [70.5, 52.8], [75.2, 51.4], [80.4, 52.8], [83.2, 57.9], [82.8, 62.8], [79.4, 66.2], [74.1, 66.9], [69.2, 65.9]] ] } ],
  hills: [ { x: 6, y: 8, r: 11, h: 7, color: '#7C9656' }, { x: 26, y: 3, r: 8, h: 5, color: '#86A05C' }, { x: 2, y: 40, r: 6, h: 4, color: '#809A58' },
    { x: 124, y: 8, r: 9, h: 6, color: '#7C9656' }, { x: 108, y: 3, r: 6, h: 4, color: '#86A05C' } ],
  // the cycle loop around the lake and the spokes to every venue
  paths: [
    { id: 'loop', loop: true, width: 2.4, color: '#E2CB9C', dash: 'rgba(255,255,255,0.55)',
      pts: [[36, 62], [39, 48], [46, 40], [55, 34], [64, 30], [76, 28], [92, 30], [104, 40], [106, 52], [98, 66], [92, 74], [82, 80], [68, 82], [52, 81], [40, 75]] },
    { id: 'in', width: 2.6, color: '#E2CB9C', pts: [[102, 130], [99, 113], [94, 104], [90, 101]] },
    { id: 's-raiker', width: 1.8, pts: [[62, 81.5], [61, 96]] }, { id: 's-shambhala', width: 1.8, pts: [[40, 75], [36, 78]] },
    { id: 's-lefarm', width: 1.8, pts: [[36, 62], [28, 64]] }, { id: 's-calmshet', width: 2.2, pts: [[39, 46], [34, 44]] },
    { id: 's-purrom', width: 1.8, pts: [[55, 34], [50, 31]] }, { id: 's-company', width: 1.8, pts: [[74, 28.5], [73, 26]] },
    { id: 's-theeya', width: 1.8, pts: [[102, 59], [108, 57.5]] },
    { id: 's-camp', width: 1.6, pts: [[52, 81], [44, 100], [32, 108], [26, 110]] },
    { id: 'trail-hidden', width: 1.2, color: '#CDB889', pts: [[104, 100], [110, 106], [115, 110]] }
  ],
  trees: { count: 330, seed: 21, pineShare: 0.28,
    // a few trees on the island (the scatter keeps off the water, so these are placed by hand)
    list: [[68.5, 60, 0.7, 0], [80.8, 59.6, 0.7, 0], [71, 64.3, 0.65, 0], [78, 64.6, 0.7, 1], [69.5, 56.5, 0.6, 1]] },
  areas: [
    // 1 · RAIKER FARMS (Kamshet): a cream farmhouse with twin red gables and a double curved staircase up to the balcony.
    // Huge, parking inside: forums, town halls and the biggest gatherings. Flower polyhouses, buffalo stables, a lotus pond.
    { id: 'raiker', n: 7, name: 'Secret Farm', center: C.raiker, rect: [1, 54, 29, 80], floor: '#CDBA8A', structures: [
      A(15, 60, { type: 'villa', w: 9, d: 5.5, floors: 2, floorH: 2.7, color: '#F4ECDA', roof: '#B8432F', rail: '#FFFFFF', twin: true, frontStairs: 'double' }),
      A(7, 71, { type: 'stage', w: 10, d: 5, glow: '#FFB45A' }),
      A(7, 74, { type: 'audience', area: 'raiker', face: Math.PI / 2, r0: 2, r1: 6, count: 45 }),
      A(24, 57, { type: 'pavilion', w: 5, d: 3.2, tables: 3, roof: '#8A6A3A' }),
      A(25, 64, { type: 'pavilion', w: 4, d: 2.6, roof: '#7A5A3A' }),
      A(24, 73, { type: 'sculpture', kind: 'head', h: 5 }),
      A(18, 76, { type: 'fire' }),
      A(23, 78, { type: 'cars', count: 3, rot: 0 }),
      A(27, 68.6, { type: 'easels', count: 3, gap: 1.2, seed: 1 }),
      A(27, 68.3, { type: 'pavilion', w: 4, d: 2.8, roof: '#6A4A3A' }), A(5, 62, { type: 'sculpture', kind: 'crystal', h: 3, glow: '#FFB45A' }),
      A(9.5, 58, { type: 'bush', r: 0.9, color: '#E0457B' }), A(21, 61, { type: 'bush', r: 0.9, color: '#D8367A' }),
      A(5.5, 57.4, { type: 'pavilion', w: 7, d: 3.2, roof: '#6A4A3A' }), A(5.5, 57.7, { type: 'easels', count: 5, gap: 1.25, seed: 2 }), A(5.5, 60.4, { type: 'sign', w: 3.4, text: 'MEGA EXHIBITION\nK. N. RAMACHANDRAN', size: 52 }), A(3.2, 65.8, { type: 'pavilion', w: 3, d: 2.6, roof: '#8A6A3A' }), A(3.2, 66.0, { type: 'easels', count: 2, gap: 1.2, seed: 1 }), A(21.2, 69.2, { type: 'pavilion', w: 3.6, d: 2.6, roof: '#6A4A3A' }), A(21.2, 69.5, { type: 'easels', count: 3, gap: 1.05, seed: 3 }), A(8.4, 66.6, { type: 'sign', w: 3.4, text: 'CONCERTS · DEBATES\nTHEATRE · AWARDS', size: 52 }), A(28.0, 62.4, { type: 'sign', w: 2.6, text: 'FARM VISITS\nTREKS · PERMACULTURE', size: 48 }), A(14.8, 77.4, { type: 'sign', w: 2.4, text: 'ACOUSTIC\nFIRE' }), A(28, 60.6, { type: 'sculpture', kind: 'crystal', h: 2.6, glow: '#FFB45A' }), A(22.5, 54.8, { type: 'sculpture', kind: 'ring', h: 2.8 }), A(28, 74.6, { type: 'sculpture', kind: 'totem', h: 3 }) ] },
    // 2 · SHAMBHALA BY THE LAKE: a big open pavilion with a red tiled roof on stone terraces, steps down to the lawn.
    // Lake-touch homestay, dormitories, jetty, paragliding base. Intimate music.
    { id: 'shambhala', n: 6, name: 'Shambhala by the Lake', center: C.shambhala, rect: [21, 76, 50, 98], floor: '#D8C8A0', structures: [
      A(31, 84, { type: 'pavilion', w: 10, d: 6, h: 3, raised: 0.8, steps: 4, tables: 4, roof: '#B8432F', post: '#3A3A40', stone: '#B9A583' }),
      A(44, 83, { type: 'stage', w: 5, d: 3, h: 0.6, truss: 3.6, glow: '#FFC9E0', beam: '#FFD0E8' }),
      A(44, 85, { type: 'audience', area: 'shambhala', face: Math.PI / 2, r0: 1.5, r1: 5, count: 18 }),
      A(23.5, 90.5, { type: 'dome', r: 2, glow: '#FFC8E8' }),
      A(26, 94, { type: 'house', w: 5, d: 2.6, h: 2.4, color: '#DCC9A3', roof: '#B8432F' }),
      A(47, 95, { type: 'tent', r: 1.4 }), A(43.5, 96, { type: 'tent', r: 1.4, color: '#E8D7B6' }),
      A(37, 91, { type: 'bush', r: 0.9, color: '#E0457B' }), A(36, 95, { type: 'sculpture', kind: 'totem', h: 1.8 }),
      A(38.6, 80.8, { type: 'pavilion', w: 4, d: 2.6, roof: '#6A4A3A' }), A(38.6, 81.1, { type: 'easels', count: 3, gap: 1.1, seed: 1 }), A(38.6, 83.6, { type: 'sign', w: 2.8, text: 'ART EXHIBITION', size: 60 }), A(39.8, 93.6, { type: 'sign', w: 2.2, text: 'ROCK\nBALANCING' }), A(47.4, 92.8, { type: 'sign', w: 2.6, text: 'CARPENTRY\nWORKSHOP' }), A(30.8, 95.4, { type: 'easels', count: 2, gap: 1.3, seed: 2 }) ] },
    // 3 · LE FARM: On the backwaters. A two-storey modern house with flat roofs, big glass and a carport.
    // Political forums and big events under the big tops, with parking.
    { id: 'lefarm', n: 5, name: 'Le Farm', center: C.lefarm, rect: [48, 97, 73, 120], floor: '#D3C193', structures: [
      A(57, 102, { type: 'modern', w: 8, d: 5.5, h: 2.8, h2: 2.4, color: '#F2D58E', trim: '#F8EFDC', car: '#3A3A42' }),
      A(64.5, 112, { type: 'stage', w: 9, d: 4.5, glow: '#FFB45A' }),
      A(64.5, 114.8, { type: 'audience', area: 'lefarm', face: Math.PI / 2, r0: 2, r1: 6, count: 40 }),
      A(52, 114, { type: 'bigtop', r: 3.3, color: '#C8412F' }), A(68.5, 101.5, { type: 'bigtop', r: 3.2, h: 4.4, color: '#D9953F', color2: '#F7EAD0' }),
      A(71, 107.5, { type: 'sculpture', kind: 'crystal', h: 3.2, color: '#C8412F', glow: '#FF6A4A' }),
      A(57, 119, { type: 'stall', rot: 0.1, color: '#6E9A4B' }), A(53.8, 119.2, { type: 'stall', rot: 0.1, color: '#B5523B', seed: 2 }),
      A(50.5, 107, { type: 'pavilion', w: 4, d: 2.8, roof: '#3E6AA0', floor: '#D9C597' }), A(57.5, 108.5, { type: 'pavilion', w: 4.4, d: 2.4, roof: '#8A6A3A' }),
      A(65, 106.6, { type: 'pavilion', w: 4.4, d: 2.6, roof: '#6A4A3A' }), A(65, 106.9, { type: 'easels', count: 3, gap: 1.3, seed: 0 }), A(65.2, 108.9, { type: 'sign', w: 3.4, text: 'EXHIBITS\nANTIQUE · AI · KNR SKETCHES', size: 50 }), A(71.3, 116.6, { type: 'pavilion', w: 3.6, d: 2.6, tables: 2, roof: '#B8643A' }), A(71, 119.5, { type: 'sign', w: 2.4, text: 'BEER FEST', size: 80 }), A(63.2, 99.6, { type: 'pavilion', w: 3.6, d: 2.6, tables: 2, roof: '#7A2A3A' }), A(63.2, 102.6, { type: 'sign', w: 2.8, text: 'WINE & CHEESE\nFINE DINE', size: 58 }), A(50.1, 99.6, { type: 'shrine' }), A(52.4, 97.9, { type: 'sign', w: 3.0, text: 'TEMPLE TRAIL\nFARM · PERMACULTURE', size: 50 }), A(57.5, 110.7, { type: 'sign', w: 2.4, text: 'WOODCUT\nWORKSHOP' }), A(50.5, 104.4, { type: 'sign', w: 2.6, text: 'SUNRISE YOGA\nMEDITATION', size: 60 }), A(71.2, 110.5, { type: 'sign', w: 2.6, text: 'AI FUTURES\nINTERACTIVE' }), A(55.2, 98.0, { type: 'sculpture', kind: 'totem', h: 2.6 }) ] },
    // 4 · CALMSHET: a cream two-storey timber-and-stone hill lodge with wraparound verandas on a stone terrace, the main
    // stage on the lawn, the archive of the last two years' events and formats, the fashion runway, art and installations.
    { id: 'calmshet', n: 1, name: 'Calmshet', center: C.calmshet, rect: [10, 24, 38, 53], floor: '#D9C597', structures: [
      A(24, 31, { type: 'lodge', w: 5, d: 6, floors: 2, color: '#F2D58E', roof: '#7A4A2C', rail: '#FFFFFF', wood: '#8A5A34', plinth: 0.8, stone: '#B9A583' }),
      A(17, 28, { type: 'bush', r: 2.2, color: '#3F7A3A' }), A(31.5, 27.5, { type: 'bush', r: 2.4, color: '#356F35' }), A(8.5, 33.5, { type: 'bush', r: 1.8, color: '#4B8440' }), A(34.5, 34, { type: 'bush', r: 2, color: '#3F7A3A' }), A(24, 26.2, { type: 'bush', r: 2.6, color: '#2F6A34' }),
      A(14, 31, { type: 'pavilion', w: 7, d: 3, tables: 3, roof: '#3E6AA0' }), A(14, 33.3, { type: 'easels', count: 4, gap: 1.6, seed: 0 }),
      A(20, 41, { type: 'stage', w: 11, d: 6, h: 1.2, truss: 7, glow: '#FF9A4A' }),
      A(20, 44.5, { type: 'audience', area: 'calmshet', face: Math.PI / 2, r0: 2.5, r1: 8, a0: -1.0, a1: 1.0, count: 70 }),
      A(12, 38, { type: 'tower', h: 13, glow: '#FF7FD0' }), A(28.5, 42, { type: 'tower', h: 11, glow: '#7FE7FF' }),
      A(33, 31, { type: 'stage', w: 7, d: 2, h: 0.9, truss: 3.2, glow: '#FF7FD0', beam: '#FFC0E8', show: 'fashion' }),
      A(33, 33, { type: 'audience', area: 'fashion', face: Math.PI / 2, r0: 1.5, r1: 3.5, count: 12 }),
      A(34, 50, { type: 'pavilion', w: 5, d: 3.4, tables: 3, roof: '#B8643A' }),
      A(28, 49, { type: 'dome', r: 2.2, glow: '#9ADFFF', color: '#EDE4D0' }),
      A(18.7, 33.9, { type: 'sign', w: 3.4, text: 'K. N. RAMACHANDRAN\nPAINTINGS · THE ARCHIVE', size: 52 }), A(11.8, 27.2, { type: 'pavilion', w: 4.4, d: 2.8, roof: '#8A6A3A' }), A(11.8, 27.5, { type: 'easels', count: 3, gap: 1.2, seed: 3 }), A(28, 46.5, { type: 'sign', w: 2.8, text: 'COMICS × AI\nIMMERSIVE' }), A(34, 47.3, { type: 'sign', w: 2.8, text: 'POTTERY\nWORKSHOP' }), A(12.4, 50.8, { type: 'screen', w: 3.6, h: 2.1, rows: 2, glow: '#FFD2A0', show: 'calmshet' }), A(36.4, 26.6, { type: 'mats', count: 5, r: 1.5, seed: 1 }), A(36.3, 29.0, { type: 'sign', w: 2.6, text: 'SUNSET\nMEDITATION' }), A(37.2, 36, { type: 'sculpture', kind: 'crystal', h: 2.6, glow: '#9ADFFF' }), A(11.5, 46, { type: 'sculpture', kind: 'ring', h: 3.2 }),
      ...[0, 1, 2].map(i => A(35.5, 39 + i * 2.8, { type: 'stall', rot: -Math.PI / 2, color: ['#B5523B', '#D9953F', '#3E6AA0'][i], seed: i + 1 })) ] },
    // 5 · PURROM: an eco retreat facing the Sahyadri. Square clay huts with red pyramid roofs, clay pots, white canopies,
    // and the Glass House. The horror film festival.
    { id: 'purrom', n: 2, name: 'Purrom', center: C.purrom, rect: [36, 6, 61, 31], floor: '#D6C49A', structures: [
      A(44, 15, { type: 'hut', square: true, r: 1.8, h: 2.2, roofH: 1.7, color: '#B5533A', roof: '#C4452C' }),
      A(49, 10.5, { type: 'hut', square: true, r: 1.8, h: 2.2, roofH: 1.7, color: '#B04E36', roof: '#C4452C' }),
      A(56, 15, { type: 'dome', r: 2.6, glow: '#B8FFD8', color: '#EDE4D0' }),
      A(47, 23, { type: 'screen', w: 6, h: 3.4, rows: 3, glow: '#B9F5C0', show: 'horror' }),
      A(40, 21.5, { type: 'canopy', w: 3 }), A(56.5, 23, { type: 'canopy', w: 3 }),
      A(51, 15.5, { type: 'pots', count: 7, r: 1.2 }), A(41, 18.5, { type: 'pots', count: 5, r: 1 }),
      A(58, 28, { type: 'sculpture', kind: 'totem', h: 3.4 }),
      A(50.5, 28.6, { type: 'sign', w: 3.0, text: 'HORROR FILM\nFESTIVAL', size: 58 }), A(57.6, 10.4, { type: 'mats', count: 5, r: 1.5, seed: 0 }), A(60, 15.6, { type: 'sign', w: 2.4, text: 'SUNRISE YOGA\nSOUND HEALING', size: 52 }), A(50.6, 19.8, { type: 'sign', w: 2.6, text: 'EXHIBITION\nIN THE HUTS' }), A(55.0, 26.0, { type: 'sign', w: 2.4, text: 'ACOUSTIC\nSETS' }), A(38.4, 24.8, { type: 'sign', w: 2.4, text: 'WORKSHOP', size: 64 }), A(46, 18.6, { type: 'easels', count: 3, gap: 1.4, seed: 3 }),
      A(38.5, 28, { type: 'stall', color: '#2F7F7A', seed: 0 }), A(41.2, 28.5, { type: 'stall', color: '#B5523B', seed: 1 }) ] },
    // 6 · THE COMPANY THEATRE: a white colonial house with a red roof and a railed veranda, up a few stone steps on its
    // lawn. Their own theatre festival inside the festival.
    { id: 'company', n: 3, name: 'The Company Theatre', center: C.company, rect: [62, 5, 88, 27], floor: '#D1BE92', structures: [
      A(73, 13, { type: 'theatre', w: 9, d: 5.5, h: 3.4, roofH: 1.5, color: '#F6F2EA', roof: '#C0452E', rail: '#FFFFFF', veranda: true, plinth: 0.6 }),
      A(83.5, 11, { type: 'stage', w: 5, d: 3, h: 0.7, truss: 3.6, glow: '#E8C8FF', beam: '#E8D8FF' }),
      A(83.5, 13, { type: 'audience', area: 'company', face: Math.PI / 2, r0: 1.5, r1: 4.5, count: 16 }),
      A(69, 21.5, { type: 'screen', w: 6, h: 3.4, rows: 2 }),
      A(83, 22.5, { type: 'pavilion', w: 4, d: 3, tables: 2, roof: '#6A3A2E' }),
      A(77.5, 23, { type: 'sculpture', kind: 'ring', h: 3.5 }),
      A(64.5, 14, { type: 'bush', r: 0.9, color: '#E0457B' }),
      A(66.5, 11.6, { type: 'easels', count: 2, gap: 1.4, seed: 2 }), A(66.5, 8.5, { type: 'house', w: 4.4, d: 3, h: 2.4, color: '#F2E6D0', roof: '#C0452E' }), A(86.5, 18, { type: 'sculpture', kind: 'crystal', h: 2.6, glow: '#E8C8FF' }),
      A(73, 18.6, { type: 'sign', w: 3.4, text: 'THE COMPANY THEATRE\nFESTIVAL', size: 56 }), A(79.6, 19.7, { type: 'mats', count: 5, r: 1.5, seed: 3 }), A(64, 19.8, { type: 'sculpture', kind: 'totem', h: 2.4 }), A(83, 25.9, { type: 'sign', w: 2.4, text: 'THEATRE\nWORKSHOPS' }) ] },
    // 7 · THEEYA CREATION VILLAGE: a red-walled house under a low dark roof, a timber pergola deck for long meals,
    // bougainvillea. Run by a singer, so a vocal stage under the trees.
    { id: 'theeya', n: 4, name: 'Theeya Creation Village', center: C.theeya, rect: [100, 56, 126, 80], floor: '#CFB98C', structures: [
      A(113, 61, { type: 'house', w: 8, d: 4.2, h: 2.8, pitch: 0.5, color: '#B8563A', roof: '#4A4A52' }),
      A(107, 70, { type: 'pergola', w: 7, d: 4, h: 2.4, tables: 3 }),
      A(119.5, 69, { type: 'stage', w: 6, d: 3.4, h: 0.8, truss: 4, glow: '#FFC08A', beam: '#FFE0B8' }),
      A(119.5, 71.3, { type: 'audience', area: 'theeya', face: Math.PI / 2, r0: 1.5, r1: 5, count: 20 }),
      A(121, 60, { type: 'pavilion', w: 5, d: 3.6, tables: 3, roof: '#A94F32' }),
      A(113.5, 66.5, { type: 'fire' }),
      A(104, 62.5, { type: 'stall', color: '#B5523B' }), A(104, 65.2, { type: 'stall', color: '#D9953F', seed: 3 }),
      A(124, 66, { type: 'sculpture', kind: 'crystal', h: 2.8, glow: '#FFC08A' }), A(110, 75, { type: 'bush', r: 1.1, color: '#D8367A' }),
      A(109.4, 57.5, { type: 'stage', w: 4, d: 2.4, h: 0.5, truss: 3, glow: '#E8C8FF', beam: '#E8D8FF' }), A(107.4, 61.2, { type: 'sign', w: 2.6, text: 'THEATRE IN\nTHE VILLAGE' }), A(109.6, 65.4, { type: 'easels', count: 2, gap: 1.2, seed: 0 }), A(102.3, 74.4, { type: 'sculpture', kind: 'ring', h: 2.6 }), A(114.5, 77.2, { type: 'sculpture', kind: 'totem', h: 2.6 }), A(107.5, 76.9, { type: 'mats', count: 5, r: 1.5, seed: 2 }), A(107.5, 79.6, { type: 'sign', w: 2.8, text: 'SUNRISE YOGA\nSOUND HEALING', size: 54 }), A(108, 72.9, { type: 'sign', w: 2.2, text: 'FINE DINE', size: 80 }), A(118.5, 64.8, { type: 'bush', r: 0.9, color: '#E0457B' }) ] },
    // CHECK-IN & THE FESTIVAL SQUARE: the entry arch, a fire pit to gather round, a stage, flea and food on the shore.
    { id: 'checkin', n: 0, name: 'Check-in & Festival Square', center: C.checkin, rect: [72, 80, 106, 104], floor: '#D8C8A2', structures: [
      A(90, 100, { type: 'arch', w: 7, h: 4.6, text: 'APPA ART FEST 2027', size: 92, rot: 0 }),
      A(88, 89, { type: 'fire' }),
      A(96, 84, { type: 'stage', w: 7, d: 4, h: 0.9, truss: 4, glow: '#FFB45A' }),
      A(96, 86.5, { type: 'audience', area: 'checkin', face: Math.PI / 2, r0: 1.5, r1: 6, count: 30 }),
      A(86, 82.5, { type: 'house', w: 3.4, d: 2.6, h: 2.2, color: '#E8D2A8', roof: '#B8432F' }),
      ...[0, 1, 2].map(i => A(75 + i * 2.6, 86, { type: 'stall', color: ['#C8412F', '#D9953F', '#2F7F7A'][i], seed: i })),
      A(96, 97.5, { type: 'canopy', w: 3 }), A(100, 95.5, { type: 'canopy', w: 3, color: '#C8412F' }),
      A(80, 97, { type: 'sculpture', kind: 'crystal', h: 3 }) ] },
    // THE ISLAND CINEMA: films on an island in the middle of the lake, reached by boat.
    { id: 'island', n: 0, name: 'Island Cinema', center: C.island, rect: [66, 51, 84, 67], structures: [
      A(74.5, 55.5, { type: 'screen', w: 8, h: 3.8, rows: 3, glow: '#FFD2A0', show: 'island' }),
      A(75, 60, { type: 'lanterns', h: 2.8, pts: [[68, 61.5], [70.5, 64], [75, 65.6], [79.5, 64], [81.8, 60]] }) ] },
    { id: 'camp', n: 0, name: 'Stay & Unwind', center: C.camp, rect: [6, 104, 32, 124], floor: '#BFB282', structures: [
      at(C.camp, -5, -4, { type: 'tent' }), at(C.camp, 0, -6, { type: 'tent', color: '#E8D7B6' }), at(C.camp, 5, -3, { type: 'tent' }),
      at(C.camp, -4, 4, { type: 'tent', color: '#E8D7B6' }), at(C.camp, 3, 5, { type: 'tent' }), at(C.camp, 0, 0, { type: 'fire' }) ] },
    { id: 'hidden', n: 0, name: 'Hidden APPA', center: C.hidden, rect: [110, 106, 128, 124], floor: '#C2B485', hidden: true, structures: [
      at(C.hidden, -2, -3, { type: 'stage', w: 4, d: 2.6, h: 0.5, truss: 3, glow: '#B6FF9A', beam: '#D8FFC8' }),
      at(C.hidden, 4, 4, { type: 'sculpture', kind: 'totem', h: 2.8 }), at(C.hidden, -4, 5, { type: 'fire' }) ] }
  ],
  // parts that belong to the whole site
  structures: [
    { type: 'lotus', x: 68, y: 38.5, r: 3 },
    { type: 'boats', count: 5, speed: 0.006, loop: [[50, 50], [60, 45], [72, 44.5], [86, 40], [95, 46], [92, 56], [86, 65], [77, 73], [62, 74], [53, 70], [56, 62], [53, 52]] },
    // the lit deck on the west shore, and the jetty on the east shore
    { type: 'jetty', x: 41.5, y: 59, rot: 0.05, len: 6 }, { type: 'jetty', x: 47, y: 57.5, rot: 0, len: 5, w: 4 },
    { type: 'jetty', x: 100, y: 50, rot: Math.PI + 0.3, len: 4 },
    { type: 'lanterns', h: 3.0, color: '#FFB3E0', pts: [[42, 59], [47, 55.5], [52, 55.5], [52, 59.5], [47, 59.5]] },
    // the open-air lawn screen between Shambhala and the square
    { type: 'screen', x: 55, y: 90, rot: -Math.PI / 2, w: 6, h: 3.4, rows: 3, show: 'shambhala' },
    { type: 'tower', x: 58, y: 37.5, h: 14, glow: '#FFB0E0' },
    { type: 'lanterns', h: 3.2, pts: [[99, 113], [96, 108], [93, 103]] },
    { type: 'lanterns', h: 3.2, pts: [[74, 83], [82, 84], [91, 82]] },
    { type: 'lanterns', h: 3.0, pts: [[102.5, 67], [107, 66], [111.5, 67]] },
    { type: 'drones', x: 20, y: 41, r: 7, h: 9, count: 10 }
  ],
  // named standing spots the cast can walk between (area centres are added automatically)
  spots: {},
  // where each area's pin floats, and the camera framing for areas (size in metres across)
  view: { overview: { x: 65, y: 65, size: 150, fit: ['raiker', 'shambhala', 'lefarm', 'calmshet', 'purrom', 'company', 'theeya', 'checkin'] }, area: { size: 30 } }
};
export const VENUE_CENTRES = C;
