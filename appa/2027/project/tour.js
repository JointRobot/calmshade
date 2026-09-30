// APPA Art Fest 2027 · the guided tour (105 s): the camera path, captions and subtitles.
// Camera keys: [t, x, y, z, S] = at time t look at plan point (x, y, z) with S pixels per metre (at 1920 px wide).
// Keep each venue on screen for 5 to 8 seconds; pull back (smaller S) between far-apart venues.
import { makeCamera, drawOverlay } from '../src/engine/overlay.js';
import { LOOK } from './look.js';
import { TS } from './story.js';

const KEYS0 = [
  [0, 65, 66, 0, 6.9], [7, 65, 68, 0, 7.6],
  [10.5, 90, 100, 3.4, 140, -2.2], [16, 90, 100, 3.4, 140, -2.2],
  [19.5, 22, 39, 1, 37.8], [24, 22, 39, 1, 43.2],
  [26.5, 48, 19, 0, 37.8], [30.5, 48, 18, 0, 41.9],
  [33, 74, 17, 0, 37.8], [37, 75, 17, 0, 41.9],
  [38.5, 95, 42, 0, 12], [41, 112, 68, 0, 36.5], [44, 113, 68, 0, 39.2],
  [46.5, 92, 92, 0, 14], [48.5, 60, 107, 0, 37.8], [52.5, 60, 108, 0, 41.9],
  [55, 34, 87, 0, 37.8], [59, 34, 86, 0, 41.9],
  [61.5, 15, 67, 0, 37.8], [65.5, 15, 66, 0, 41.9],
  [67.7, 66, 90, 0, 12], [70, 118, 113, 0, 35.1], [73.5, 117, 112, 0, 36.5],
  [75, 100, 88, 0, 14], [76.5, 80, 64, 0, 19], [82.5, 76, 60, 0, 21],
  [86, 65, 67, 0, 10], [91, 65, 67, 0, 8.5],
  [96, 90, 100, 5.4, 120, 2.2], [105, 90, 100, 5.4, 126, 2.2]
];
const scaleRow = r => [r[0] * TS, r[1] * TS, ...r.slice(2)];
export const KEYS = KEYS0.map(k => [k[0] * TS, k[1], k[2], k[3], k[4]]);
// on a tall phone screen the arch is framed higher (a lower look-at height), so it sits above the caption text instead of behind it
export const KEYS_PORTRAIT = KEYS0.map(k => [k[0] * TS, k[1], k[2], k[5] ?? k[3], k[4]]);
const TOUR0 = {
  title: [0.6, 8.2, 'APPA ART FEST 2027', 'When minds co-create', '25 Jan to 25 Feb 2027  ·  One lake. Many venues. A living ecosystem.'],
  end: [101.2, 105, 'APPA ART FEST 2027', 'People · Planet · Art · Community', '25 Jan to 25 Feb 2027  ·  A brighter tomorrow'],
  captions: [
    [9, 16, 'Your festival journey', 'Check-in & the square', 'Walk in under the arch, pick your ride, gather at the fire'],
    [18, 25.5, 'Venue 1', 'Calmshet', 'The past two years, fashion, art, opening night'],
    [26, 31.5, 'Venue 2', 'Purrom', 'A horror film festival in a healing retreat'],
    [32.5, 38, 'Venue 3', 'The Company Theatre', 'Their own theatre festival'],
    [40, 45.5, 'Venue 4', 'Theeya Creation Village', 'Voice, craft and community'],
    [47, 53.5, 'Venue 5', 'Le Farm', 'Big events, open debate and long tables'],
    [54.5, 60, 'Venue 6', 'Shambhala by the Lake', 'Intimate music, long meals, artist residencies'],
    [61, 67, 'Venue 7', 'Secret Farm', 'The biggest gatherings, forums and large-scale art'],
    [68, 74, 'Discover', 'Hidden APPA', 'Offbeat acts in fields and forests, by cycle or on foot'],
    [77, 82, 'On the lake', 'Island Cinema', 'Films on an island, reached by boat'],
    // the four festival weeks, recapped over a wide hold before the Encore
    [82.3, 85, 'Week 1 · 25 Jan to 1 Feb', 'Roots & Raga', 'Classical, Maharashtra culture, fusion, desi cool and global artists'],
    [85.2, 87.9, 'Week 2 · 2 to 8 Feb', 'Keeping it Real', 'Hip-hop, rap, spoken word, poetry, rock and youth culture'],
    [88.1, 90.8, 'Week 3 · 9 to 15 Feb', 'Tech, Electronica & AI', 'Electronic music, digital art, AI and immersive installations'],
    [91, 93.7, 'Weeks 4 and 5 · 16 to 25 Feb', 'All Forms, Together', 'A grand culmination: music, art, workshops and community creations'],
    [94.5, 100.5, 'The Encore · 26 to 28 Feb', 'VVIP & VIP only', 'Three bonus days: special access and personal meet-ups with resident artists']
  ],
  subs: [
    [11, 14.8, 'Park the car. Pick a cycle.'], [20, 23.5, 'Where the story begins.'], [27, 30.5, 'Horror films after dark.'],
    [33.5, 37, 'Theatre, and stories after dark.'], [41.5, 44.5, 'Sing together.'], [49, 52.5, 'Villages, fields, forests, hills.'],
    [55.5, 58.5, 'Music by the water.'], [62, 65.5, 'Different scales. Different experiences.'], [70.5, 73.5, 'Off the map, after dark.'],
    [77.5, 81.5, 'The lake lights up.']
  ]
};
export const TOUR = { title: scaleRow(TOUR0.title), end: scaleRow(TOUR0.end), captions: TOUR0.captions.map(scaleRow), subs: TOUR0.subs.map(scaleRow) };
export const camAt = makeCamera(KEYS);
export const camAtPortrait = makeCamera(KEYS_PORTRAIT);
let logo = null; if (typeof Image !== 'undefined') { logo = new Image(); logo.src = LOOK.logo.dark; }
export const overlay = (O, t, W, H, wCss, hCss) => drawOverlay(O, t, W, H, TOUR, { ...LOOK.ui.overlay, font: LOOK.ui.font, display: LOOK.ui.display }, logo && logo.complete && logo.naturalWidth ? logo : null, wCss, hCss);
