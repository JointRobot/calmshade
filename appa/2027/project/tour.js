// APPA Art Fest 2027 · the guided tour (authored on 99 s, plays in 84 s via tsc): the camera path, captions and subtitles.
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
  [55, 20, 65, 0, 40],
  [55.9, 20, 65, 0, 44],
  [57.21, 25.8, 71.6, 1.6, 150, -0.6, 250],
  [58.77, 25.95, 71.7, 1.6, 158, -0.6, 262],
  [60.13, 34, 80, 0, 27],
  [64, 118, 113, 0, 40],
  [67.5, 117, 112, 0, 40],
  [70.5, 80, 64, 0, 19],
  [76.5, 76, 60, 0, 21],
  [80, 65, 67, 0, 10],
  [85, 65, 67, 0, 8.5],
  [90, 90, 100, 5.4, 120, 2.2],
  [99, 90, 100, 5.4, 126, 2.2]
];
const scaleRow = r => [tsc(r[0]), tsc(r[1]), ...r.slice(2)];
export const KEYS = KEYS0.map(k => [tsc(k[0]), k[1], k[2], k[3], k[4]]);
// on a tall phone screen the arch is framed higher (a lower look-at height), so it sits above the caption text instead of behind it
export const KEYS_PORTRAIT = KEYS0.map(k => [tsc(k[0]), k[1], k[2], k[5] ?? k[3], k[6] ?? k[4]]);
const TOUR0 = {
  title: [0.6, 8.2, 'APPA ART FEST 2027', 'When minds co-create', '12 Feb to 20 Mar 2027  ·  One lake. Many venues. A living ecosystem.'],
  end: [95.2, 99, 'APPA ART FEST 2027', 'People · Planet · Art · Community', '12 Feb to 20 Mar 2027  ·  A brighter tomorrow'],
  captions: [
    [9, 16, 'Your festival journey', 'Check-in & the square', 'Walk in under the arch, pick your ride, gather at the fire'],
    [18, 25.5, 'Venue 1', 'Calmshet', 'The past two years, fashion, art, opening night'],
    [26, 31.5, 'Venue 2', 'Purrom', 'A horror film festival in a healing retreat'],
    [32.5, 38, 'Venue 3', 'The Company Theatre', 'Their own theatre festival'],
    [40, 45.5, 'Venue 4', 'Theeya Creation Village', 'Voice, craft and community'],
    [47, 53.5, 'Venue 5', 'Le Farm', 'Big events, open debate and long tables'],
    [54.5, 60, 'Venue 6', 'Shambhala by the Lake', 'Intimate music, long meals, artist residencies'],
    [62, 68, 'Discover', 'Hidden APPA', 'Offbeat acts in fields and forests, by cycle or on foot'],
    [71, 76, 'On the lake', 'Island Cinema', 'Films on an island, reached by boat'],
    // the four festival weeks, recapped over a wide hold before the Encore
    [76.3, 79, 'Week 1 · 12 to 19 Feb', 'Roots & Raga', 'Classical, Maharashtra culture, fusion, desi cool and global artists'],
    [79.2, 81.9, 'Week 2 · 20 to 26 Feb', 'Keeping it Real', 'Hip-hop, rap, spoken word, poetry, rock and youth culture'],
    [82.1, 84.8, 'Week 3 · 27 Feb to 5 Mar', 'Tech, Electronica & AI', 'Electronic music, digital art, AI and immersive installations'],
    [85, 87.7, 'Weeks 4 and 5 · 6 to 15 Mar', 'All Forms, Together', 'A grand culmination: music, art, workshops and community creations'],
    [88.5, 94.5, 'The Encore · 16 to 20 Mar', 'VVIP & VIP only', 'The final five days: special access and personal meet-ups with resident artists']
  ],
  subs: [
    [11, 14.8, 'Park the car. Pick a cycle.'], [20, 23.5, 'Where the story begins.'], [27, 30.5, 'Horror films after dark.'],
    [33.5, 37, 'Theatre, and stories after dark.'], [41.5, 44.5, 'Sing together.'], [49, 52.5, 'Villages, fields, forests, hills.'],
    [55.5, 58.5, 'Music by the water.'], [64.5, 67.5, 'Off the map, after dark.'],
    [71.5, 75.5, 'The lake lights up.']
  ]
};
export const TOUR = { title: scaleRow(TOUR0.title), end: scaleRow(TOUR0.end), captions: TOUR0.captions.map(scaleRow), subs: TOUR0.subs.map(scaleRow) };
export const camAt = makeCamera(KEYS);
export const camAtPortrait = makeCamera(KEYS_PORTRAIT);
let logo = null; if (typeof Image !== 'undefined') { logo = new Image(); logo.src = LOOK.logo.dark; }
export const overlay = (O, t, W, H, wCss, hCss) => drawOverlay(O, t, W, H, TOUR, { ...LOOK.ui.overlay, font: LOOK.ui.font, display: LOOK.ui.display }, logo && logo.complete && logo.naturalWidth ? logo : null, wCss, hCss);
