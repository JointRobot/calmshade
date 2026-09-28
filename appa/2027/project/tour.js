// APPA Art Fest 2027 · the 90-second guided tour: the camera path, captions and subtitles.
// Camera keys: [t, x, y, z, S] = at time t look at plan point (x, y, z) with S pixels per metre (at 1920 px wide).
// Keep each venue on screen for 5 to 8 seconds; pull back (smaller S) between far-apart venues.
import { makeCamera, drawOverlay } from '../src/engine/overlay.js';
import { LOOK } from './look.js';

export const KEYS = [
  [0, 65, 66, 0, 6.9], [7, 65, 68, 0, 7.6],
  [10.5, 57, 117, 0, 28], [15, 57, 116, 0, 31],
  [17.5, 36, 92, 0, 14], [19.5, 17, 59, 0, 28], [24.5, 16, 58, 0, 31],
  [28, 31, 28, 0, 28], [32.5, 32, 26, 0, 31],
  [36, 71, 27, 0, 28], [40.5, 72, 26, 0, 31],
  [44, 106, 42, 0, 28], [48.5, 107, 41, 0, 31],
  [52, 110, 77, 0, 28], [56.5, 110, 78, 0, 31],
  [58.5, 70, 90, 0, 12], [60.5, 31, 98, 0, 27], [63, 30, 97, 0, 29],
  [65, 75, 104, 0, 12], [67, 113, 107, 0, 26], [68.5, 112, 106, 0, 27],
  [71, 70, 70, 0, 17], [73, 66, 66, 0, 18],
  [76, 86, 106, 0, 22], [82, 87, 107, 1, 32], [84.5, 86, 106, 1, 29], [88.5, 65, 67, 0, 7.2], [90, 65, 67, 0, 7.1]
];
export const TOUR = {
  title: [0.6, 8.2, 'APPA ART FEST 2027', 'When minds co-create', '25 Jan to 25 Feb 2027  ·  One lake. Seven venues. A living ecosystem.'],
  end: [86.2, 90, 'APPA ART FEST 2027', 'People · Planet · Art · Community', '25 Jan to 25 Feb 2027  ·  A brighter tomorrow'],
  captions: [
    [9, 16, 'Your festival journey', 'Check-in', 'Park your car, pick your ride, get your itinerary'],
    [18, 25.5, 'Venue 1', 'Raiker Farms', 'The biggest gatherings, forums and large-scale art'],
    [27, 33.5, 'Venue 2', 'Le Farm', 'Big events and open debate on 15 acres'],
    [35, 41.5, 'Venue 3', 'Shambhala by the Lake', 'Intimate music, lakeside art, artist residencies'],
    [43, 49.5, 'Venue 4', 'Purrom', 'A horror film festival in a healing retreat'],
    [51, 57.5, 'Venue 6', 'The Company Theatre', 'Their own theatre festival'],
    [59.5, 64, 'Venue 7', 'Theeya Creation Village', 'Voice, craft and community'],
    [66, 69.5, 'Discover', 'Hidden APPA', 'Offbeat acts in fields and forests, by cycle or on foot'],
    [75, 85.5, 'Venue 5 · the main venue', 'Calmshet', 'The past two years, fashion, art, opening night']
  ],
  subs: [
    [11, 14.8, 'Park the car. Pick a cycle.'], [19.5, 23.5, 'Villages, fields, forests, hills.'], [28.5, 32.5, 'Different scales. Different experiences.'],
    [36.5, 40.5, 'Music by the water.'], [44.5, 48.5, 'Horror films after dark.'], [52.5, 56.5, 'Theatre, and stories after dark.'],
    [60, 63.5, 'Sing together.'], [70.5, 74, 'The lake lights up at dusk.'], [77, 80.5, 'Four weeks. Four vibes.'], [80.8, 84.8, 'Roots & Raga · Keeping it Real · Tech, Electronica & AI · All forms']
  ]
};
export const camAt = makeCamera(KEYS);
let logo = null; if (typeof Image !== 'undefined') { logo = new Image(); logo.src = LOOK.logo.dark; }
export const overlay = (O, t, W, H) => drawOverlay(O, t, W, H, TOUR, { ...LOOK.ui.overlay, font: LOOK.ui.font, display: LOOK.ui.display }, logo && logo.complete && logo.naturalWidth ? logo : null);
