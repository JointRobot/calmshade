// APPA Art Fest 2027 · the guided tour (authored on 105 s, plays in 90 s via tsc): the camera path, captions and subtitles.
// Camera keys: [t, x, y, z, S] = at time t look at plan point (x, y, z) with S pixels per metre (at 1920 px wide).
// Keep each venue on screen for 5 to 8 seconds; pull back (smaller S) between far-apart venues.
// Optional 6th/7th values: look-at height and S for tall (portrait) phone screens.
import { makeCamera, drawOverlay } from '../src/engine/overlay.js';
import { LOOK } from './look.js';
import { tsc } from './story.js';

// Each venue: arrive wide (S 40), push in to one of its signboards (S ~150; on a tall phone closer, S ~250,
// framed a little higher so the board clears the caption), then pull back out past the venue on the way to the next one.
const KEYS0 = [
  [0, 65, 66, 0, 6.9],
  [7, 65, 68, 0, 7.6],
  [10.5, 90, 100, 3.4, 140, -2.2],
  [16, 90, 100, 3.4, 140, -2.2],
  [19.5, 22, 39, 1, 40],
  [20.4, 22, 39, 1, 44],
  [21.8, 28, 46.5, 1.6, 150, -0.6, 250],
  [23.4, 28.15, 46.6, 1.6, 158, -0.6, 262],
  [24.95, 38, 32.75, 0, 27],
  [26.5, 48, 19, 0, 40],
  [27.4, 48, 19, 0, 44],
  [28.71, 51.7, 27.4, 1.6, 150, -0.6, 250],
  [30.27, 51.85, 27.5, 1.6, 158, -0.6, 262],
  [31.63, 62.85, 22.2, 0, 27],
  [33, 74, 17, 0, 40],
  [33.9, 74, 17, 0, 44],
  [35.3, 73, 18.6, 1.6, 150, -0.6, 250],
  [36.9, 73.15, 18.7, 1.6, 158, -0.6, 262],
  [38.95, 92.5, 43.3, 0, 27],
  [41, 112, 68, 0, 40],
  [41.9, 112, 68, 0, 44],
  [43.3, 108, 72.9, 1.6, 150, -0.6, 250],
  [44.9, 108.15, 73, 1.6, 158, -0.6, 262],
  [46.7, 84, 90, 0, 27],
  [48.5, 60, 107, 0, 40],
  [49.4, 60, 107, 0, 44],
  [50.71, 71.2, 110.5, 1.6, 150, -0.6, 250],
  [52.27, 71.35, 110.6, 1.6, 158, -0.6, 262],
  [53.63, 52.6, 98.8, 0, 27],
  [55, 34, 87, 0, 40],
  [55.9, 34, 87, 0, 44],
  [57.21, 39.8, 93.6, 1.6, 150, -0.6, 250],
  [58.77, 39.95, 93.7, 1.6, 158, -0.6, 262],
  [60.13, 27.4, 80.3, 0, 27],
  [61.5, 15, 67, 0, 40],
  [62.4, 15, 67, 0, 44],
  [63.8, 5.5, 60.4, 1.6, 150, -0.6, 250],
  [65.4, 5.65, 60.5, 1.6, 158, -0.6, 262],
  [67.7, 61.75, 86.7, 0, 27],
  [70, 118, 113, 0, 40],
  [73.5, 117, 112, 0, 40],
  [76.5, 80, 64, 0, 19],
  [82.5, 76, 60, 0, 21],
  [86, 65, 67, 0, 10],
  [91, 65, 67, 0, 8.5],
  [96, 90, 100, 5.4, 120, 2.2],
  [105, 90, 100, 5.4, 126, 2.2]
];
const scaleRow = r => [tsc(r[0]), tsc(r[1]), ...r.slice(2)];
export const KEYS = KEYS0.map(k => [tsc(k[0]), k[1], k[2], k[3], k[4]]);
// on a tall phone screen the arch is framed higher (a lower look-at height), so it sits above the caption text instead of behind it
export const KEYS_PORTRAIT = KEYS0.map(k => [tsc(k[0]), k[1], k[2], k[5] ?? k[3], k[6] ?? k[4]]);
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
