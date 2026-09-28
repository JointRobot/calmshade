// APPA Art Fest 2027 · the site: one lake, seven venues, the check-in, the camp and Hidden APPA.
// Plan metres, x east, y south. The map is a diorama, not to scale: the real lake is kilometres across.
// On screen the top corner is the north-west (hills), the bottom corner the south-east (Calmshet's side).
// Every venue is an area with a plaza and a list of KIT parts (see src/engine/kit.js for the part types).

const V = (cx, cy) => (dx, dy) => [cx + dx, cy + dy];   // helper: positions relative to a venue centre
const at = (c, dx, dy, o) => ({ x: c[0] + dx, y: c[1] + dy, ...o });

// venue centres
const C = {
  raiker: [16, 58], lefarm: [32, 26], shambhala: [72, 25], purrom: [107, 41], company: [110, 78],
  calmshet: [84, 106], theeya: [30, 98], checkin: [56, 122], camp: [12, 84], hidden: [118, 112]
};

export const SITE = {
  name: 'APPA Art Fest 2027',
  bounds: [0, 0, 130, 130],
  ground: { color: '#A3B56C', edge: '#7A5A3A', depth: 2.2, ppm: 12,
    fields: [ { x: 8, y: 36, w: 10, d: 14, rot: 0.1, color: '#C8B56A' }, { x: 22, y: 40, w: 8, d: 10, rot: -0.1, color: '#B9C36E' },
      { x: 118, y: 96, w: 14, d: 9, rot: 0.2, color: '#D2BF72' }, { x: 104, y: 120, w: 12, d: 10, rot: -0.15, color: '#BFCB74' }, { x: 50, y: 8, w: 12, d: 8, rot: 0.05, color: '#C8B56A' } ] },
  sky: { day: ['#F6ECDA', '#EAD9BE'], dusk: ['#F7C88C', '#E48F6C'], night: ['#121834', '#2A2F58'] },
  water: [ { id: 'lake', color: '#4FA6D2', dusk: '#86A9D8', night: '#1D2A55', shallow: '#8FD0DE', shore: '#DCCB9C', shoreWidth: 2.6,
    pts: [[44, 42], [58, 36], [74, 38], [88, 44], [95, 58], [92, 74], [84, 88], [68, 93], [52, 88], [42, 76], [38, 60]] } ],
  hills: [ { x: 6, y: 6, r: 14, h: 8, color: '#7C9656' }, { x: 26, y: 2, r: 12, h: 6, color: '#86A05C' }, { x: 2, y: 26, r: 12, h: 7, color: '#809A58' },
    { x: 50, y: 0, r: 10, h: 5, color: '#8AA35E' }, { x: 0, y: 48, r: 9, h: 4.5, color: '#86A05C' }, { x: 128, y: 4, r: 10, h: 6, color: '#7C9656' } ],
  // the cycle loop around the lake and the spokes to every venue
  paths: [
    { id: 'loop', loop: true, width: 2.4, color: '#E2CB9C', dash: 'rgba(255,255,255,0.55)', pts: [[38, 36], [60, 30], [84, 32], [100, 50], [101, 70], [94, 90], [76, 100], [54, 100], [36, 88], [30, 62]] },
    { id: 'in', width: 2.6, color: '#E2CB9C', pts: [[56, 128], [56, 118], [58, 106], [62, 100]] },
    { id: 's-raiker', width: 1.8, pts: [[30, 62], [22, 60]] }, { id: 's-lefarm', width: 1.8, pts: [[38, 36], [34, 30]] },
    { id: 's-shambhala', width: 1.8, pts: [[66, 31], [70, 28]] }, { id: 's-purrom', width: 1.8, pts: [[100, 50], [105, 45]] },
    { id: 's-company', width: 1.8, pts: [[101, 72], [106, 76]] }, { id: 's-calmshet', width: 2.2, pts: [[82, 97], [84, 100]] },
    { id: 's-theeya', width: 1.8, pts: [[40, 91], [34, 96]] }, { id: 's-camp', width: 1.6, pts: [[31, 76], [18, 82]] },
    { id: 'trail-hidden', width: 1.2, color: '#CDB889', pts: [[94, 90], [106, 100], [114, 106], [120, 112]] }
  ],
  trees: { count: 330, seed: 21, pineShare: 0.28 },
  areas: [
    // RAIKER FARMS (Kamshet): huge, parking inside. Politically inclined gatherings and the biggest events. Farm details from public write-ups:
    // flower polyhouses, buffalo stables, fruit trees, a lotus pond, an open-air restaurant.
    { id: 'raiker', n: 1, name: 'Raiker Farms', center: C.raiker, rect: [5, 48, 27, 68], floor: '#CDBA8A', structures: [
      at(C.raiker, -2, -6, { type: 'stage', w: 10, d: 5, glow: '#FFB45A' }),
      at(C.raiker, -2, -2.8, { type: 'audience', area: 'raiker', face: Math.PI / 2, r0: 2, r1: 8, count: 60 }),
      at(C.raiker, 8, -1, { type: 'house', w: 4, d: 2.6, h: 1.9, color: '#E3F0E6', roof: '#BFE0CF' }),
      at(C.raiker, 8, 2.5, { type: 'house', w: 4, d: 2.6, h: 1.9, color: '#E3F0E6', roof: '#BFE0CF' }),
      at(C.raiker, 8, -6, { type: 'pavilion', w: 4, d: 2.6, roof: '#7A5A3A' }),
      at(C.raiker, 3, 7, { type: 'sculpture', kind: 'head', h: 5 }),
      at(C.raiker, -6, 6, { type: 'pavilion', w: 5, d: 3.2, tables: 3, roof: '#8A6A3A' }),
      at(C.raiker, -1, 8.5, { type: 'fire' }),
      at(C.raiker, -10, -6, { type: 'cars', count: 5, rot: Math.PI / 2 }) ] },
    // LE FARM: 15 acres on the Vadivali backwaters; a two-storey main house with balconies. Political forums and big events with parking.
    { id: 'lefarm', n: 2, name: 'Le Farm', center: C.lefarm, rect: [20, 15, 44, 37], floor: '#D3C193', structures: [
      at(C.lefarm, -7.5, -8, { type: 'house', w: 7, d: 4.5, h: 5, color: '#EFE3CC', roof: '#A94F32' }),
      at(C.lefarm, 5, -4, { type: 'stage', w: 10, d: 5, glow: '#FFB45A' }),
      at(C.lefarm, 5, -1, { type: 'audience', area: 'lefarm', face: Math.PI / 2, r0: 2, r1: 7, count: 60 }),
      at(C.lefarm, -8, 2, { type: 'bigtop', r: 3.5, color: '#C8412F' }), at(C.lefarm, -2, 7, { type: 'bigtop', r: 3.3, h: 4.4, color: '#D9953F', color2: '#F7EAD0' }),
      at(C.lefarm, 10, 9, { type: 'sculpture', kind: 'ring', h: 5, rot: 0.8 }),
      at(C.lefarm, 4, 9, { type: 'stall', rot: 0.1, color: '#6E9A4B' }), at(C.lefarm, 7, 9.5, { type: 'stall', rot: 0.1, color: '#B5523B', seed: 2 }),
      at(C.lefarm, 6, -10.5, { type: 'cars', count: 5, rot: 0 }) ] },
    // SHAMBHALA BY THE LAKE: lake-touch homestay, main house and dormitories, jetty, paragliding base. Intimate music.
    { id: 'shambhala', n: 3, name: 'Shambhala by the Lake', center: C.shambhala, rect: [60, 16, 84, 32], floor: '#D8C8A0', structures: [
      at(C.shambhala, -6, -3, { type: 'house', w: 6, d: 3.6, h: 3, color: '#E8D7B6', roof: '#7A4A2E' }),
      at(C.shambhala, -6, 2, { type: 'house', w: 5, d: 2.6, h: 2.4, color: '#DCC9A3', roof: '#7A4A2E' }),
      at(C.shambhala, 4, -3, { type: 'dome', r: 2.4, glow: '#FFC8E8' }),
      at(C.shambhala, 3, 0, { type: 'stage', w: 5, d: 3, h: 0.6, truss: 3.6, glow: '#FFC9E0', beam: '#FFD0E8' }),
      at(C.shambhala, 3, 2.4, { type: 'audience', area: 'shambhala', face: Math.PI / 2, r0: 1.5, r1: 5.5, count: 18 }),
      at(C.shambhala, -10.5, -6, { type: 'tent', r: 1.4 }), at(C.shambhala, -8.5, -8.5, { type: 'tent', r: 1.4, color: '#E8D7B6' }) ] },
    // PURROM: eco retreat facing the Sahyadri: solo domes (Mango, Labernum), the Glass House (Peepal), Chickoo house, the MotherShip. Horror film festival.
    { id: 'purrom', n: 4, name: 'Purrom', center: C.purrom, rect: [95, 31, 121, 53], floor: '#D6C49A', structures: [
      at(C.purrom, -7, -5, { type: 'dome', r: 2.2, glow: '#FFE08A', color: '#EDE4D0' }), at(C.purrom, -2.5, -6, { type: 'dome', r: 2.2, glow: '#FFE08A', color: '#DCE8D2' }),
      at(C.purrom, 6, -6, { type: 'dome', r: 3.4, glow: '#B8FFD8', color: '#EDE4D0' }),
      at(C.purrom, -9, -1, { type: 'house', w: 3.6, d: 3, h: 2.4, color: '#CFE8EA', roof: '#8FBFC8' }),
      at(C.purrom, -9, 3.5, { type: 'house', w: 4.6, d: 3.4, h: 2.4, color: '#EBDDBE', roof: '#8A4A2E' }),
      at(C.purrom, 1, 2, { type: 'screen', w: 6, h: 3.4, rows: 3, glow: '#B9F5C0', show: 'horror' }),
      at(C.purrom, 9, 1, { type: 'sculpture', kind: 'totem', h: 3.4 }),
      ...[0, 1, 2].map(i => at(C.purrom, 3 + i * 3, 8, { type: 'stall', color: ['#2F7F7A', '#B5523B', '#D9953F'][i], seed: i })) ] },
    // THE COMPANY THEATER: their own theatre festival inside the festival.
    { id: 'company', n: 6, name: 'The Company Theatre', center: C.company, rect: [98, 66, 124, 90], floor: '#D1BE92', structures: [
      at(C.company, 2, -5, { type: 'theatre', w: 9, d: 6 }),
      at(C.company, -8, -3, { type: 'stage', w: 5, d: 3, h: 0.7, truss: 3.6, glow: '#E8C8FF', beam: '#E8D8FF' }),
      at(C.company, -8, -0.5, { type: 'audience', area: 'company', face: Math.PI / 2, r0: 1.5, r1: 5, count: 20 }),
      at(C.company, -4, 6, { type: 'screen', w: 7, h: 3.6, rot: -Math.PI / 2 + 0.1, rows: 3 }),
      at(C.company, 7, 6, { type: 'pavilion', w: 4, d: 3, tables: 2, roof: '#6A3A2E' }) ] },
    // KAMSHET: the festival hub. Archive of the last two years' events and their formats, the fashion runway, art and installations.
    { id: 'calmshet', n: 5, name: 'Calmshet (Main Venue)', center: C.calmshet, rect: [68, 96, 102, 124], floor: '#D9C597', structures: [
      at(C.calmshet, 2, -1.5, { type: 'stage', w: 11, d: 6, h: 1.2, truss: 7, glow: '#FF9A4A' }),
      at(C.calmshet, 2, 2.5, { type: 'audience', area: 'calmshet', face: Math.PI / 2, r0: 2.5, r1: 10, a0: -1.0, a1: 1.0, count: 80 }),
      at(C.calmshet, -12, -3, { type: 'tower', h: 13, glow: '#FF7FD0' }), at(C.calmshet, 14, -2, { type: 'tower', h: 11, glow: '#7FE7FF' }),
      at(C.calmshet, -10.5, 3, { type: 'stage', w: 9, d: 2, h: 0.9, truss: 3.2, glow: '#FF7FD0', beam: '#FFC0E8', show: 'fashion' }),
      at(C.calmshet, -10.5, 5.5, { type: 'audience', area: 'fashion', face: Math.PI / 2, r0: 1.5, r1: 4, count: 14 }),
      at(C.calmshet, -13, 11, { type: 'pavilion', w: 5, d: 3.4, tables: 3, roof: '#B8643A' }),
      at(C.calmshet, -2, 15, { type: 'pavilion', w: 8, d: 3, tables: 4, roof: '#3E6AA0' }),
      ...[0, 1, 2].map(i => at(C.calmshet, 14, 4 + i * 3, { type: 'stall', rot: -Math.PI / 2, color: ['#B5523B', '#D9953F', '#3E6AA0'][i], seed: i + 1 })) ] },
    // THEEYA CREATION VILLAGE: run by a singer, so a vocal stage under the trees.
    { id: 'theeya', n: 7, name: 'Theeya Creation Village', center: C.theeya, rect: [18, 86, 44, 110], floor: '#CFB98C', structures: [
      at(C.theeya, -6, -4, { type: 'house', w: 4, d: 3, color: '#E8D2A8' }), at(C.theeya, 1, -6, { type: 'house', w: 3.4, d: 3, rot: 0.3, color: '#E1C49A', roof: '#8A4A2E' }),
      at(C.theeya, 7, -4, { type: 'stage', w: 6, d: 3.4, h: 0.8, truss: 4, glow: '#FFC08A', beam: '#FFE0B8' }),
      at(C.theeya, 7, -1.5, { type: 'audience', area: 'theeya', face: Math.PI / 2, r0: 1.5, r1: 5, count: 22 }),
      at(C.theeya, 7, 7, { type: 'pavilion', w: 5.5, d: 3.6, tables: 3, roof: '#A94F32' }),
      at(C.theeya, -6, 5, { type: 'stall', color: '#B5523B' }), at(C.theeya, -2.6, 6, { type: 'stall', color: '#D9953F', seed: 3 }),
      at(C.theeya, 1, 1, { type: 'fire' }) ] },
    { id: 'checkin', n: 0, name: 'Check-in', center: C.checkin, rect: [44, 114, 70, 129], floor: '#D8C8A2', structures: [
      at(C.checkin, 0, -3, { type: 'arch', w: 7, h: 4.6, text: 'APPA ART FEST 2027', size: 92, rot: 0 }),
      at(C.checkin, -8, 2, { type: 'cars', count: 4, rot: 0 }), at(C.checkin, 8, 3, { type: 'pavilion', w: 4, d: 3, tables: 2, roof: '#2F7F7A' }) ] },
    { id: 'camp', n: 0, name: 'Stay & Unwind', center: C.camp, rect: [3, 74, 22, 94], floor: '#BFB282', structures: [
      at(C.camp, -5, -4, { type: 'tent' }), at(C.camp, 0, -6, { type: 'tent', color: '#E8D7B6' }), at(C.camp, 5, -3, { type: 'tent' }),
      at(C.camp, -4, 4, { type: 'tent', color: '#E8D7B6' }), at(C.camp, 3, 5, { type: 'tent' }), at(C.camp, 0, 0, { type: 'fire' }) ] },
    { id: 'hidden', n: 0, name: 'Hidden APPA', center: C.hidden, rect: [110, 104, 128, 122], floor: '#C2B485', hidden: true, structures: [
      at(C.hidden, -2, -3, { type: 'stage', w: 4, d: 2.6, h: 0.5, truss: 3, glow: '#B6FF9A', beam: '#D8FFC8' }),
      at(C.hidden, 4, 4, { type: 'sculpture', kind: 'totem', h: 2.8 }), at(C.hidden, -4, 5, { type: 'fire' }) ] }
  ],
  // parts that belong to the whole site
  structures: [
    { type: 'lotus', x: 66, y: 64, r: 3 },
    { type: 'boats', count: 5, speed: 0.006, loop: [[52, 50], [70, 45], [86, 55], [84, 76], [66, 84], [50, 74], [46, 60]] },
    { type: 'jetty', x: 72, y: 34, rot: Math.PI / 2 - 0.2, len: 6 }, { type: 'jetty', x: 80, y: 94, rot: -Math.PI / 2 - 0.4, len: 7 },
    { type: 'tower', x: 58, y: 34, h: 14, glow: '#FFB0E0' },
    { type: 'lanterns', h: 3.2, pts: [[57, 110], [58, 104], [62, 100], [68, 99], [76, 100]] },
    { type: 'lanterns', h: 3.0, color: '#FFB3E0', pts: [[62, 29], [66, 27], [70, 27]] },
    { type: 'drones', x: 84, y: 106, r: 7, h: 9, count: 10 }
  ],
  // named standing spots the cast can walk between (area centres are added automatically)
  spots: {},
  // where each area's pin floats, and the camera framing for areas (size in metres across)
  view: { overview: { x: 65, y: 65, size: 150 }, area: { size: 30 } }
};
export const VENUE_CENTRES = C;
