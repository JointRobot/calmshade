// APPA Art Fest 2027 · the people. Walkers follow a plan (times in seconds of the 90 s loop); wanderers roam an
// area on a seamless loop; cyclists ride a path loop; performers play or dance while their stage is on.
// Kinds: man, woman (saree unless outfit 'casual'), girl, boy (casual unless outfit 'uniform'), teacher.
export const CAST = {
  loop: 90, navRes: 0.25,
  walkers: [
    // a family: arrive at check-in, stop at the lake to see the lotus light, end at the opening night
    ...[['mother', 'woman', { h: 1.6, saree: '#B8432F', border: '#E0B040', blouse: '#6A2A3A' }, [0, 0]], ['father', 'man', { h: 1.74, shirt: '#8FB3CF', hat: 'cap', hatColor: '#2F7F7A' }, [0.9, 0.3]],
        ['mira', 'girl', { h: 1.3, dress: '#E2A33A', bag: true, bagColor: '#D9502F' }, [0.3, 0.9]], ['kabir', 'boy', { h: 1.2, shirt: '#3E6AA0', pants: '#6A5A48' }, [1.1, 1.1]]]
      .map(([id, kind, look, [ox, oy]]) => ({ id, kind, ...look, plan: [
        { xy: [52 + ox, 118 + oy], until: 16, acts: id === 'mira' ? [[10, 12, 'point', [56, 119, 4]]] : [] },
        { xy: [77 + ox, 96 + oy], until: 70, look: [66, 64], acts: id === 'kabir' || id === 'mira' ? [[65.5, 68.5, 'point', [66, 64, 0.6]], [69, 70, 'joy']] : [[66, 68.5, 'photo', [66, 64, 0.8]]] },
        { xy: [98 + ox, 109 + oy], until: 90, look: [88, 104], acts: [[76, 78, 'joy'], [80, 84, id === 'father' ? 'clap' : 'raise']] } ] }))
  ],
  wanderers: [
    { area: 'raiker', count: 4 }, { area: 'lefarm', count: 5 }, { area: 'shambhala', count: 3 }, { area: 'purrom', count: 5 },
    { area: 'company', count: 4 }, { area: 'calmshet', count: 5 }, { area: 'theeya', count: 5 }, { area: 'checkin', count: 3 }, { area: 'camp', count: 3 }, { area: 'hidden', count: 2 }
  ],
  cyclists: [{ path: 'loop', count: 8, speed: 3.0, lane: 0.55 }],
  performers: [
    { area: 'calmshet', count: 4, colors: ['#F2E6CF', '#D9502F', '#E2A33A', '#2F7F7A'] },
    { area: 'raiker', count: 3, colors: ['#E2A33A', '#F2E6CF', '#7A4A8C'] },
    { area: 'shambhala', count: 2, style: 'play', colors: ['#F2E6CF', '#FFC9E0'] },
    { area: 'hidden', count: 1, style: 'play' },
    { area: 'theeya', count: 2, colors: ['#F2E6CF', '#A94F32'] },
    { area: 'lefarm', count: 3, colors: ['#F2E6CF', '#3E6AA0', '#E2A33A'] },
    { area: 'company', count: 2, colors: ['#E8C8FF', '#F2E6CF'] }
  ]
};
