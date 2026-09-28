// APPA Art Fest 2027 · the guided tour (114 s): the camera path, captions and subtitles.
// Camera keys: [t, x, y, z, S] = at time t look at plan point (x, y, z) with S pixels per metre (at 1920 px wide).
// Keep each venue on screen for 5 to 8 seconds; pull back (smaller S) between far-apart venues.
import { makeCamera, drawOverlay } from '../src/engine/overlay.js';
import { LOOK } from './look.js';

export const KEYS = [
  [0, 65, 66, 0, 6.9], [7, 65, 68, 0, 7.6],
  [10.5, 90, 94, 0, 28], [15, 90, 93, 0, 31],
  [17.5, 76, 100, 0, 14], [19.5, 60, 107, 0, 28], [24.5, 60, 108, 0, 31],
  [28, 34, 87, 0, 28], [32.5, 34, 86, 0, 31],
  [36, 15, 67, 0, 28], [40.5, 15, 66, 0, 31],
  [42, 30, 42, 0, 14], [44, 48, 19, 0, 28], [48.5, 48, 18, 0, 31],
  [52, 74, 17, 0, 28], [56.5, 75, 17, 0, 31],
  [58.5, 95, 42, 0, 12], [60.5, 112, 68, 0, 27], [63, 113, 68, 0, 29],
  [65, 116, 92, 0, 12], [67, 118, 113, 0, 26], [68.5, 117, 112, 0, 27],
  [71, 80, 64, 0, 19], [73, 76, 60, 0, 21],
  [88.5, 22, 38, 0, 22], [94.5, 22, 39, 1, 32], [97, 22, 38, 1, 29], [101, 65, 67, 0, 7.2], [102.5, 65, 67, 0, 7.1],
  [114, 65, 67, 0, 7.1]
];
export const TOUR = {
  title: [0.6, 8.2, 'APPA ART FEST 2027', 'When minds co-create', '25 Jan to 25 Feb 2027  ·  One lake. Seven venues. A living ecosystem.'],
  end: [110.2, 114, 'APPA ART FEST 2027', 'People · Planet · Art · Community', '25 Jan to 25 Feb 2027  ·  A brighter tomorrow'],
  captions: [
    [9, 16, 'Your festival journey', 'Check-in & the square', 'Walk in under the arch, pick your ride, gather at the fire'],
    [18, 25.5, 'Venue 1', 'Le Farm', 'Big events, open debate and long tables'],
    [27, 33.5, 'Venue 2', 'Shambhala by the Lake', 'Intimate music, long meals, artist residencies'],
    [35, 41.5, 'Venue 3', 'Raiker Farms', 'The biggest gatherings, forums and large-scale art'],
    [43, 49.5, 'Venue 5', 'Purrom', 'A horror film festival in a healing retreat'],
    [51, 57.5, 'Venue 6', 'The Company Theatre', 'Their own theatre festival'],
    [59.5, 64, 'Venue 7', 'Theeya Creation Village', 'Voice, craft and community'],
    [66, 69.5, 'Discover', 'Hidden APPA', 'Offbeat acts in fields and forests, by cycle or on foot'],
    [70, 74.2, 'On the lake', 'Island Cinema', 'Films on an island, reached by boat'],
    // the four festival weeks, recapped over a wide hold before the finale zooms into Calmshet
    [74.5, 77.9, 'Week 1 · 25 Jan to 1 Feb', 'Roots & Raga', 'Classical, Maharashtra culture, fusion, desi cool and global artists'],
    [78.1, 81.5, 'Week 2 · 2 to 8 Feb', 'Keeping it Real', 'Hip-hop, rap, spoken word, poetry, rock and youth culture'],
    [81.7, 85.1, 'Week 3 · 9 to 15 Feb', 'Tech, Electronica & AI', 'Electronic music, digital art, AI and immersive installations'],
    [85.3, 88.4, 'Weeks 4 and 5 · 16 to 25 Feb', 'All Forms, Together', 'A grand culmination: music, art, workshops and community creations'],
    [89.2, 100.5, 'Venue 4', 'Calmshet', 'The past two years, fashion, art, opening night'],
    [104, 109.5, 'The Encore · 26 to 28 Feb', 'VVIP & VIP only', 'Three bonus days: special access and personal meet-ups with resident artists']
  ],
  subs: [
    [11, 14.8, 'Park the car. Pick a cycle.'], [19.5, 23.5, 'Villages, fields, forests, hills.'], [28.5, 32.5, 'Music by the water.'],
    [36.5, 40.5, 'Different scales. Different experiences.'], [44.5, 48.5, 'Horror films after dark.'], [52.5, 56.5, 'Theatre, and stories after dark.'],
    [60, 63.5, 'Sing together.'], [70.3, 73.8, 'The lake lights up at dusk.']
  ]
};
export const camAt = makeCamera(KEYS);
let logo = null; if (typeof Image !== 'undefined') { logo = new Image(); logo.src = LOOK.logo.dark; }
export const overlay = (O, t, W, H, wCss, hCss) => drawOverlay(O, t, W, H, TOUR, { ...LOOK.ui.overlay, font: LOOK.ui.font, display: LOOK.ui.display }, logo && logo.complete && logo.naturalWidth ? logo : null, wCss, hCss);
