// APPA Art Fest 2027 · every word in the app, and what every control does.
// Controls (see src/app/app.js):
//   { type: 'button', label, actions: [...] , primary }
//   { type: 'toggle', label, labelOn, channel, arg, on: value, off: value, also: [{ channel, arg, on, off }] }
//   { type: 'slider', label, channel, min, max, step, readout: v => text }
//   { type: 'choice', label, channel, options: [{ label, value, text, actions }] }
// Actions: { set: channel, arg, value } · { pulse: channel, arg, dur } · { go: 'area:<id>' | 'spot:<key>' | 'overview' } · { reveal: areaId } · { say: text }

const WEEKS = [
  { label: 'Roots & Raga', dates: 'Week 1 · 25 Jan to 1 Feb', text: 'Classical, Maharashtra culture, fusion, desi cool and global artists. The festival opens on 25 January, the eve of Republic Day.', value: 0 },
  { label: 'Keeping it Real', dates: 'Week 2 · 2 to 8 Feb', text: 'Hip-hop, rap, spoken word, poetry, rock and youth culture.', value: 1 },
  { label: 'Tech, Electronica & AI', dates: 'Week 3 · 9 to 15 Feb', text: 'Electronic music, digital art, AI, immersive installations and tech-driven creativity.', value: 2 },
  { label: 'All forms, together', dates: 'Weeks 4 and 5 · 16 to 25 Feb', text: 'A grand culmination of everything: music, art, workshops, community creations and special collaborations.', value: 3 }
];
const weekOptions = WEEKS.map(w => ({ label: w.label, value: w.value, text: `${w.dates}. ${w.text}`, actions: [{ set: 'dronesOn', value: w.value === 2 ? 1 : 0 }] }));
const showToggle = (area, label, labelOn) => ({ type: 'toggle', label, labelOn, channel: 'stageOn', arg: area, on: 1, off: 0, also: [{ channel: 'crowd', arg: area, on: 1, off: 0.45 }] });
const dusk = { type: 'button', label: 'Let the evening come', actions: [{ set: 'timeOfDay', value: 0.86 }] };

export const COPY = {
  brand: 'APPA', title: 'APPA Art Fest 2027',
  intro: { eyebrow: '25 Jan to 25 Feb 2027', h1: 'APPA Art Fest 2027', tag: 'When minds co-create',
    text: 'A festival of festivals: a month of art, people, nature and a better tomorrow, where every venue curates its own festival. One lake, seven venues, a living ecosystem. Drag to look around, scroll or pinch to zoom, and tap any venue to see what happens there.',
    enter: 'Enter the festival', loading: 'Loading the festival…', credit: 'A concept by Nolabel Immersive · drawn entirely in code' },
  tourLabel: 'Guided tour', tourStop: 'Stop the tour',
  overview: { eyebrow: 'The festival at a glance', h2: 'One lake. Seven venues. A living ecosystem.', text: 'Each venue runs its own festival inside the big one: film, theatre, voice, fashion, forums and music. The two big farms take the largest gatherings.',
    controls: [
      { type: 'choice', label: '4 weeks · 4 vibes', channel: 'week', options: weekOptions },
      { type: 'slider', label: 'Time of day', channel: 'timeOfDay', min: 0.1, max: 1, step: 0.01, readout: v => (v < 0.3 ? 'Morning' : v < 0.45 ? 'Afternoon' : v < 0.62 ? 'Golden hour' : v < 0.8 ? 'Dusk' : 'Night') },
      { type: 'button', label: 'Light the lotus on the lake', actions: [{ pulse: 'lotusGlow', dur: 16 }, { go: 'spot:lotus' }] },
      { type: 'button', label: 'Find Hidden APPA', actions: [{ reveal: 'hidden' }, { go: 'area:hidden' }] }
    ],
    journey: ['Park your car at check-in', 'Pick your ride: cycles and e-bikes', 'Get your APPA passport and itinerary', 'Explore every venue: performances, exhibitions, workshops, flea, food and more', 'Stay, unwind, connect with nature', 'Be part of a bigger story'] },
  weeks: WEEKS,
  areas: {
    raiker: { n: 1, name: 'Raiker Farms', tagline: 'The biggest gatherings, with parking on site',
      offerings: ['Public forums, town halls and politically inclined gatherings', 'Large-scale performances and open-air installations', 'Farm to table under the fruit trees', 'On-site parking for the big crowds', 'Curated 1 to 2 day festival takeovers', 'Flower polyhouses, buffalo stables, lotus pond: the working farm stays part of the show'] },
    lefarm: { n: 2, name: 'Le Farm', tagline: 'Big events and open debate on 15 acres',
      offerings: ['Political forums, debates and rallies (all voices, curated)', 'Large-scale art and music under the big tops', 'Major outdoor installations', 'Local food and workshops', 'On-site parking for the big crowds', 'The lake-touch main house as the green room'] },
    shambhala: { n: 3, name: 'Shambhala by the Lake', tagline: 'Intimate music by the water',
      offerings: ['Intimate music experiences on the lakeside stage', 'Artist residencies in the main house and dormitories', 'Jetty sessions and lakeside reflections', 'Paragliding base for the brave', 'Homely food and weekend barbecue'] },
    purrom: { n: 4, name: 'Purrom', tagline: 'Horror film festival in a healing retreat',
      offerings: ['Horror film festival, curated by Purrom', 'Late-night screenings under the Sahyadri sky', 'Stays in the solo domes, the Glass House and the Chickoo house', 'Sound baths, silence and nature walks by day', 'Flea and local food'] },
    company: { n: 6, name: 'The Company Theatre', tagline: 'Their own theatre festival',
      offerings: ['The Company Theatre festival, curated by the company', 'Stage plays, new work and workshops', 'Open-air staging beside the theatre', 'Film screenings and talks', 'Artist residencies'] },
    theeya: { n: 7, name: 'Theeya Creation Village', tagline: 'Voice, craft and community',
      offerings: ['Vocal stage: singing, choirs and voice workshops', 'Sing-along evenings by the village fire', 'Art, craft and community', 'Workshops with local makers', 'Sustainable living and food'] },
    calmshet: { n: 5, name: 'Calmshet (Main Venue)', tagline: 'The hub: the past two years, fashion and art',
      offerings: ['Opening night and major performances', 'The archive: every event of the last two years and the formats they ran in', 'Fashion segment with a runway', 'Art and large-scale installations', 'Exhibitions, food and flea', 'The festival hub'] },
    checkin: { name: 'Check-in', tagline: 'Where the journey starts', offerings: ['Park your car', 'Pick up a cycle or an e-bike', 'Your APPA passport and itinerary'] },
    camp: { name: 'Stay & Unwind', tagline: 'More than a festival, a place to belong', offerings: ['Camping and eco-stays', 'Homestays and local stays', 'Quiet zones, wellness and retreats', 'Stay for a night or the whole month'] },
    hidden: { name: 'Hidden APPA', tagline: 'Offbeat acts in fields, forests and villages', offerings: ['Pop-up performances', 'Reached by cycle or on foot', 'Ask at any venue where tonight’s act is'] }
  },
  spots: {
    'raiker-stage': { area: 'raiker', pos: [14, 52, 3], title: 'The forum stage', text: 'The largest stage on the farm, with parking behind and hills beyond: public forums, town halls and big performances. The crowd fills in when it starts.', controls: [showToggle('raiker', 'Open the forum', 'Close the forum'), dusk] },
    'raiker-head': { area: 'raiker', pos: [19, 65, 4], title: 'The head in the field', text: 'A giant, calm face in brass with a slow ring around it. Come back at dusk: its eyes light up.', controls: [dusk] },
    'raiker-table': { area: 'raiker', pos: [10, 64, 2], title: 'Farm to table', text: 'Long tables under a roof, food from the fields around you.' },
    'raiker-farm': { area: 'raiker', pos: [24, 58, 2], title: 'The working farm', text: 'Flower polyhouses and buffalo stables stay part of the visit: walk the farm between sessions.' },
    'lefarm-stage': { area: 'lefarm', pos: [37, 22, 3], title: 'The open-debate stage', text: 'Political forums, debates and rallies, curated for every voice. Parking is on site.', controls: [showToggle('lefarm', 'Open the forum', 'Close the forum'), dusk] },
    'lefarm-tops': { area: 'lefarm', pos: [24, 28, 5], title: 'The big tops', text: 'Two striped tents for music and performance, lit from inside after dark.', controls: [dusk] },
    'lefarm-house': { area: 'lefarm', pos: [24.5, 18, 4], title: 'The main house', text: 'A two-storey villa with balconies on the lake backwaters: the artists’ green room.' },
    'lefarm-ring': { area: 'lefarm', pos: [42, 35, 3], title: 'The ring', text: 'A major outdoor installation you can walk through.' },
    'shambhala-stage': { area: 'shambhala', pos: [75, 25, 2.5], title: 'The lakeside stage', text: 'Small, close, by the water: intimate sets for a few dozen people.', controls: [showToggle('shambhala', 'Start a lakeside set', 'End the set')] },
    'shambhala-house': { area: 'shambhala', pos: [66, 23, 3], title: 'The homestay', text: 'The main house and dormitories host artists in residence, right at the water’s edge.', controls: [dusk] },
    'purrom-screen': { area: 'purrom', pos: [108, 43, 3], title: 'The horror film festival', text: 'Screenings after dark in the open air, beside a retreat that heals by day.', controls: [showToggle('horror', 'Start a screening', 'End the screening'), { type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.95 }] }] },
    'purrom-domes': { area: 'purrom', pos: [102, 36, 3], title: 'Domes and the Glass House', text: 'Solo domes, the Glass House with valley views and the MotherShip glow softly at night.', controls: [dusk] },
    'purrom-market': { area: 'purrom', pos: [113, 49, 2], title: 'The flea and food', text: 'Handmade, sustainable, local products and food.' },
    'company-theatre': { area: 'company', pos: [112, 73, 4], title: 'The theatre', text: 'The home of The Company Theatre and its festival. Curtain up on new work.', controls: [showToggle('company', 'Curtain up', 'Curtain down')] },
    'company-screen': { area: 'company', pos: [106, 84, 3], title: 'The open-air screen', text: 'Film screenings and talks under the stars, on benches in the grass.', controls: [{ ...showToggle('company', 'Start the screening', 'End the screening') }, dusk] },
    'theeya-stage': { area: 'theeya', pos: [37, 94, 2.5], title: 'The vocal stage', text: 'Solo voices, choirs and voice workshops under the trees, led by the village’s own singer.', controls: [showToggle('theeya', 'Start the singing', 'End the singing'), dusk] },
    'theeya-pavilion': { area: 'theeya', pos: [37, 105, 3], title: 'The workshop pavilion', text: 'Hands-on workshops with local makers: clay, weaving, natural dyes, cooking.' },
    'theeya-fire': { area: 'theeya', pos: [31, 99, 1.5], title: 'The village fire', text: 'Where the day’s makers gather in the evening for a sing-along.', controls: [dusk] },
    'calmshet-stage': { area: 'calmshet', pos: [88, 103, 5], title: 'The main stage', text: 'Opening night on 25 January, and the festival’s biggest performances all month.', controls: [showToggle('calmshet', 'Start the opening night', 'End the show'), { type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.95 }] }] },
    'calmshet-runway': { area: 'calmshet', pos: [73.5, 109, 2], title: 'The fashion runway', text: 'A fashion segment inside the hub: collections, collectives and live runway shows.', controls: [showToggle('fashion', 'Start the runway show', 'End the show'), dusk] },
    'calmshet-archive': { area: 'calmshet', pos: [82, 121, 2], title: 'The archive: two years of events', text: 'Every event of the last two years, with the formats they ran in, laid out to walk through.' },
    'calmshet-towers': { area: 'calmshet', pos: [98, 104, 9], title: 'Towers and drones', text: 'In Tech, Electronica & AI week, a drone swarm lights up the sky over the main venue.', controls: [{ type: 'button', label: 'Launch the drones', primary: true, actions: [{ set: 'week', value: 2 }, { set: 'dronesOn', value: 1 }, { set: 'timeOfDay', value: 0.9 }] }] },
    'checkin-arch': { area: 'checkin', pos: [56, 119, 4], title: 'Your festival journey', text: 'Park your car at check-in, pick up a cycle or an e-bike, and get your APPA passport and itinerary. Slower travel, a cleaner festival.' },
    'camp-tents': { area: 'camp', pos: [12, 82, 2], title: 'Stay & unwind', text: 'Tents, homestays and quiet zones. Stay for a night or for the whole month.', controls: [{ type: 'button', label: 'Night at the camp', actions: [{ set: 'timeOfDay', value: 0.92 }] }] },
    'hidden-act': { area: 'hidden', pos: [116, 109, 2.5], title: 'Tonight’s hidden act', text: 'Offbeat acts appear in fields, forests and villages. Follow the trail by cycle or on foot.', controls: [showToggle('hidden', 'Start the hidden act', 'End the act')] },
    lotus: { area: null, pos: [66, 64, 1.5], zoom: 0.55, title: 'The lotus on the lake', text: 'A floating installation at the heart of the festival. It lights up at dusk.', controls: [{ type: 'button', label: 'Light the lotus', primary: true, actions: [{ pulse: 'lotusGlow', dur: 16 }] }] }
  }
};
