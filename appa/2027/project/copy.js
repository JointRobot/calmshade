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
  { label: 'All forms, together', dates: 'Weeks 4 and 5 · 16 to 25 Feb', text: 'A grand culmination of everything: music, art, workshops, community creations and special collaborations.', value: 3 },
  { label: 'The Encore · VVIP/VIP only', dates: 'Bonus · 26 to 28 Feb', text: 'Three extra days after the festival closes, open only to VVIP and VIP guests: special access and personal meet-ups with resident artists.', value: 4, restricted: true }
];
const weekOptions = WEEKS.map(w => ({ label: w.label, value: w.value, text: `${w.dates}. ${w.text}`, actions: [{ set: 'dronesOn', value: w.value === 2 ? 1 : 0 }] }));
const showToggle = (area, label, labelOn) => ({ type: 'toggle', label, labelOn, channel: 'stageOn', arg: area, on: 1, off: 0, also: [{ channel: 'crowd', arg: area, on: 1, off: 0.45 }] });
const dusk = { type: 'button', label: 'Let the evening come', actions: [{ set: 'timeOfDay', value: 0.86 }] };
// a venue's own site, opened in a new tab so the festival app keeps running behind it.
// venues with no official website of their own get a plain search link instead of a made-up address.
const site = (label, url) => ({ label, url });
const search = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// ticket tiers for the ticket counter (subject to change as the plan firms up)
const TICKETS = {
  title: 'Tickets & stays', eyebrow: 'The ticket counter',
  intro: 'Everything to come to APPA Art Fest 2027, from a single day to the whole month. Prices are early plans and may change.',
  tiers: [
    { name: 'Day pass', price: '₹2,000', unit: 'per person, per day', blurb: 'Entry to the festival for one day: every venue, every open show.', bullets: ['Access to all open venues for the day', 'Exhibitions, art walks and open workshops', 'No stay included'] },
    { name: 'Stay + festival, for 2', price: '₹10,000', unit: 'per night (a 24-hour stay)', blurb: 'A night’s stay for two, with festival tickets for two included.', bullets: ['One night’s stay for 2 guests at a partner venue', 'Festival tickets for 2 people, for that day', 'Cycle or e-bike pickup at check-in', 'Kids under 10: free entry with a paying adult'] },
    { name: 'VIP · 1 week', price: 'On request', unit: 'a 7-day booking', blurb: 'A week at the festival with full access to every show and experience.', bullets: ['All shows and experiences for 7 days', 'Priority entry at every venue', 'A stay for the week (partner venue, subject to availability)'] },
    { name: 'VVIP · 30 days', price: 'On request', unit: 'the full month, stay + experience', blurb: 'The whole festival, start to finish: full access plus a few things nobody else gets.', bullets: ['All access, all 30 days, every venue', 'A few special-access moments across the month', 'Personal meet-ups with resident artists', 'Stay for the full run (partner venue, subject to availability)'] }
  ],
  note: 'Kids under 10 always enter free, on every ticket type. Exact stay partner is assigned at booking, based on availability.',
  qr: { image: './assets/tickets_qr.png', caption: 'Scan to pay by UPI', payee: 'Karthikeyan Ramachandran', upi: 'xtrathindesign@okicici' },
  contact: 'To book, scan the QR to pay, then share the payment screenshot along with your dates and headcount on WhatsApp.'
};

export const COPY = {
  brand: 'APPA', title: 'APPA Art Fest 2027',
  tickets: TICKETS,
  intro: { eyebrow: '25 Jan to 25 Feb 2027', h1: 'APPA Art Fest 2027', tag: 'When minds co-create',
    text: 'A festival of festivals: a month of art, people, nature and a better tomorrow, where every venue curates its own festival. One lake, seven venues, a living ecosystem. Drag to look around, scroll or pinch to zoom, and tap any venue to see what happens there.',
    enter: 'Enter the festival', loading: 'Loading the festival…' },
  tourLabel: 'Guided tour', tourStop: 'Stop the tour',
  overview: { eyebrow: 'The festival at a glance', h2: 'One lake. Seven venues. A living ecosystem.', text: 'Each venue runs its own festival inside the big one: film, theatre, voice, fashion, forums and music. The two big farms take the largest gatherings.',
    controls: [
      { type: 'choice', label: '4 weeks, plus the Encore', channel: 'week', options: weekOptions },
      { type: 'slider', label: 'Time of day', channel: 'timeOfDay', min: 0.1, max: 1, step: 0.01, readout: v => (v < 0.3 ? 'Morning' : v < 0.45 ? 'Afternoon' : v < 0.62 ? 'Golden hour' : v < 0.8 ? 'Dusk' : 'Night') },
      { type: 'button', label: 'Light the lotus on the lake', actions: [{ pulse: 'lotusGlow', dur: 16 }, { go: 'spot:lotus' }] },
      { type: 'button', label: 'Find Hidden APPA', actions: [{ reveal: 'hidden' }, { go: 'area:hidden' }] }
    ],
    journey: ['Park your car at check-in', 'Pick your ride: cycles and e-bikes', 'Get your APPA passport and itinerary', 'Explore every venue: performances, exhibitions, workshops, flea, food and more', 'Stay, unwind, connect with nature', 'Be part of a bigger story'] },
  weeks: WEEKS,
  areas: {
    raiker: { n: 1, name: 'Raiker Farms', tagline: 'The biggest gatherings, with parking on site',
      website: site('Search Raiker Farms, Kamshet ↗', search('Raiker Farms Kamshet')),
      offerings: ['Big-scale music performances', 'Public forums, town halls and debates', 'Theatre performances and award functions', 'Different acoustic artists', 'Multiple art installations and multiple interactive installations', 'Four exhibitions, plus one mega K. N. Ramachandran exhibition', 'Farm visits, farm treks and permaculture', 'Farm to table under the fruit trees', 'On-site parking for the big crowds', 'Flower polyhouses, buffalo stables, lotus pond: the working farm stays part of the show', 'Facing the sunset: sound healing and meditation circles at dusk'] },
    lefarm: { n: 3, name: 'Le Farm', tagline: 'Big events and open debate',
      website: site('lefarm.in ↗', 'https://lefarm.in'),
      offerings: ['Big-scale concerts and music performances', 'Political forums, debates and rallies (all voices, curated)', 'Morning yoga, meditation and healing sessions', 'Wine and cheese sessions, and a beer fest', 'Fine dine', 'Farm visits, permaculture treks and temple visits', 'About 12 resident artists: painters and sculptors', 'About 5 exhibits: an antique exhibit, an AI futuristic interactive exhibit and the K. N. Ramachandran sketches', 'Woodcut workshop', 'On-site parking for the big crowds', 'Facing the sunrise: yoga and meditation on the lawns at first light'] },
    shambhala: { n: 2, name: 'Shambhala by the Lake', tagline: 'Intimate music by the water',
      website: site('shambalabythelake.com ↗', 'https://shambalabythelake.com'),
      offerings: ['One art exhibition', '3 resident artists: painters, a rock-balancing artist, and acoustic musicians and singers', 'Tricks and a carpentry workshop', 'Intimate music on the lakeside stage', 'Jetty sessions, sunrise yoga and lakeside reflections', 'Paragliding base for the brave', 'Homely food and weekend barbecue'] },
    purrom: { n: 5, name: 'Purrom', tagline: 'Horror film festival in a healing retreat',
      website: site('purrom.com ↗', 'https://purrom.com'),
      offerings: ['Horror film festival, curated by Purrom', 'Late-night screenings under the Sahyadri sky', '2 to 3 resident artists and painters', 'One acoustic act, and music performances', 'One workshop and one exhibition', 'Sunrise meditation and yoga', 'Sound healing, baths and nature walks', 'Stays in the solo domes, the Glass House and the Chickoo house', 'Flea and local food'] },
    company: { n: 6, name: 'The Company Theatre', tagline: 'Their own theatre festival',
      website: site('thecompanytheatre.net ↗', 'https://thecompanytheatre.net'),
      offerings: ['Theatre performances: the Company Theatre’s own festival', 'Theatre workshops', '6 resident artists: painters and sculptors', '2 installations and 1 interactive installation', 'An exhibit of K. N. Ramachandran’s work', 'Film screenings and talks', 'Facing the sunset: meditation at dusk'] },
    theeya: { n: 7, name: 'Theeya Creation Village', tagline: 'Voice, craft and community',
      website: site('Search Theeya Creation Village, Kamshet ↗', search('Theeya The Creation Village Kamshet')),
      offerings: ['Singers and song performances: the vocal stage', 'Theatre', 'Fine dine', 'About 4 resident artists, working on about 3 installations', 'Music performances and sing-along evenings by the village fire', 'Sunrise meditation, yoga and sound healing', 'Workshops with local makers', 'Sustainable living and food'] },
    calmshet: { n: 4, name: 'Calmshet', tagline: 'The past two years, fashion and art',
      website: site('calmshet.com ↗', 'https://calmshet.com'),
      offerings: ['Opening night and major performances', 'Art exhibition: paintings by the late K. N. Ramachandran', 'Exhibit: artists from around India’s independence era', 'Antique prints and lithographs', 'Comics corner with an interactive, immersive AI exhibit', 'Interactive installations and immersive experiences', 'Short films', '10 resident painters, plus a sculptor and sculpture on the lawn', 'Pottery workshop', 'Acoustic sets, sunset sets and sunset evening views', 'The archive: every event of the last two years and their formats', 'Fashion segment with a runway', 'Facing the sunset: sound healing and meditation at dusk'] },
    checkin: { name: 'Check-in & Festival Square', tagline: 'Where the journey starts, and where everyone gathers', offerings: ['Park your car and walk in under the APPA arch', 'Pick up a cycle or an e-bike', 'Your APPA passport and itinerary', 'The fire pit: sing-alongs and stories every night', 'A stage for open mics, local bands and the day’s surprises', 'Flea, food and craft stalls on the shore', 'Boats out to the Island Cinema'] },
    island: { name: 'Island Cinema', tagline: 'Films on an island in the middle of the lake', offerings: ['Open-air screenings every evening, under string lights', 'Reached by boat from the jetties', 'Short films, documentaries and the horror festival’s late shows', 'Blankets and benches: bring a friend'] },
    camp: { name: 'Stay & Unwind', tagline: 'More than a festival, a place to belong', offerings: ['Camping and eco-stays', 'Homestays and local stays', 'Quiet zones, wellness and retreats', 'Stay for a night or the whole month'] },
    hidden: { name: 'Hidden APPA', tagline: 'Offbeat acts in fields, forests and villages', offerings: ['Pop-up performances', 'Reached by cycle or on foot', 'Ask at any venue where tonight’s act is'] }
  },
  spots: {
    'raiker-stage': { area: 'raiker', pos: [52, 112, 3], title: 'The forum stage', text: 'The largest stage on the farm, with parking behind and hills beyond: public forums, town halls and big performances. The crowd fills in when it starts.', controls: [showToggle('raiker', 'Open the forum', 'Close the forum'), dusk] },
    'raiker-head': { area: 'raiker', pos: [69, 115, 4], title: 'The head in the field', text: 'A giant, calm face in brass with a slow ring around it. Come back at dusk: its eyes light up.', controls: [dusk] },
    'raiker-table': { area: 'raiker', pos: [69, 99, 2], title: 'Farm to table', text: 'Long tables under a roof, food from the fields around you.' },
    'raiker-farm': { area: 'raiker', pos: [70, 106, 2], title: 'The working farm', text: 'Flower polyhouses and buffalo stables stay part of the visit: walk the farm between sessions.' },
    'raiker-house': { area: 'raiker', pos: [60, 102, 4], title: 'The farmhouse', text: 'The cream farmhouse with its twin red gables and the double staircase curving up to the balcony. Resident artists work on the verandas.', controls: [dusk] },
    'lefarm-stage': { area: 'lefarm', pos: [19.5, 69, 3], title: 'The open-debate stage', text: 'Political forums, debates and rallies, curated for every voice. Parking is on site.', controls: [showToggle('lefarm', 'Open the forum', 'Close the forum'), dusk] },
    'lefarm-tops': { area: 'lefarm', pos: [7, 72, 5], title: 'The big tops', text: 'Two striped tents for music and performance, lit from inside after dark.', controls: [dusk] },
    'lefarm-house': { area: 'lefarm', pos: [12, 60, 4], title: 'The main house', text: 'A modern two-storey house with flat roofs, big glass windows, a rounded veranda and a carport: the artists’ green room.' },
    'lefarm-ring': { area: 'lefarm', pos: [26, 65.5, 3], title: 'The red sculpture', text: 'A tall faceted sculpture on the lawn, a major outdoor installation. It glows after dark.', controls: [dusk] },
    'shambhala-stage': { area: 'shambhala', pos: [44, 82, 2.5], title: 'The lakeside stage', text: 'Small, close, by the water: intimate sets for a few dozen people.', controls: [showToggle('shambhala', 'Start a lakeside set', 'End the set')] },
    'shambhala-house': { area: 'shambhala', pos: [31, 84, 3], title: 'The pavilion', text: 'A big open pavilion with a red tiled roof, up the stone steps: long meals, music and artists in residence, right by the water.', controls: [dusk] },
    'purrom-screen': { area: 'purrom', pos: [47, 23, 3], title: 'The horror film festival', text: 'Screenings after dark in the open air, beside a retreat that heals by day.', controls: [showToggle('horror', 'Start a screening', 'End the screening'), { type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.95 }] }] },
    'purrom-domes': { area: 'purrom', pos: [47, 13, 3], title: 'The clay huts and the Glass House', text: 'Square clay huts under red pyramid roofs, clay pots, and the Glass House dome with valley views, glowing softly at night.', controls: [dusk] },
    'purrom-market': { area: 'purrom', pos: [40, 28, 2], title: 'The flea and food', text: 'Handmade, sustainable, local products and food.' },
    'company-theatre': { area: 'company', pos: [73, 13, 4], title: 'The theatre house', text: 'The white house with the red roof and the railed veranda, home of The Company Theatre and its festival. Curtain up on new work.', controls: [showToggle('company', 'Curtain up', 'Curtain down')] },
    'company-screen': { area: 'company', pos: [69, 22, 3], title: 'The open-air screen', text: 'Film screenings and talks under the stars, on benches in the grass.', controls: [{ ...showToggle('company', 'Start the screening', 'End the screening') }, dusk] },
    'theeya-stage': { area: 'theeya', pos: [119.5, 69, 2.5], title: 'The vocal stage', text: 'Solo voices, choirs and voice workshops under the trees, led by the village’s own singer.', controls: [showToggle('theeya', 'Start the singing', 'End the singing'), dusk] },
    'theeya-pavilion': { area: 'theeya', pos: [121, 60, 3], title: 'The workshop pavilion', text: 'Hands-on workshops with local makers: clay, weaving, natural dyes, cooking.' },
    'theeya-deck': { area: 'theeya', pos: [107, 70, 2], title: 'The pergola deck', text: 'Long tables under the timber pergola beside the red house, wrapped in bougainvillea. Meals, conversations and quiet mornings.', controls: [dusk] },
    'theeya-fire': { area: 'theeya', pos: [113.5, 66.5, 1.5], title: 'The village fire', text: 'Where the day’s makers gather in the evening for a sing-along.', controls: [dusk] },
    'calmshet-stage': { area: 'calmshet', pos: [20, 40, 5], title: 'The main stage', text: 'Opening night on 25 January, and the festival’s biggest performances all month.', controls: [showToggle('calmshet', 'Start the opening night', 'End the show'), { type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.95 }] }] },
    'calmshet-house': { area: 'calmshet', pos: [24, 31, 5], title: 'The main house', text: 'The cream two-storey hill lodge, with wooden verandas and white railings wrapping every floor, on its stone terrace among the trees: home to the resident artists.', controls: [dusk] },
    'calmshet-runway': { area: 'calmshet', pos: [33, 31, 2], title: 'The fashion runway', text: 'A fashion segment inside the hub: collections, collectives and live runway shows.', controls: [showToggle('fashion', 'Start the runway show', 'End the show'), dusk] },
    'calmshet-archive': { area: 'calmshet', pos: [14, 31, 2], title: 'The archive: two years of events', text: 'Every event of the last two years, with the formats they ran in, laid out to walk through.' },
    'calmshet-towers': { area: 'calmshet', pos: [28.5, 42, 9], title: 'Towers and drones', text: 'In Tech, Electronica & AI week, a drone swarm lights up the sky over Calmshet.', controls: [{ type: 'button', label: 'Launch the drones', primary: true, actions: [{ set: 'week', value: 2 }, { set: 'dronesOn', value: 1 }, { set: 'timeOfDay', value: 0.9 }] }] },
    'checkin-arch': { area: 'checkin', pos: [90, 100, 4], title: 'Your festival journey', text: 'Park your car, walk in under the APPA arch, pick up a cycle or an e-bike, and get your APPA passport and itinerary. Slower travel, a cleaner festival.' },
    'square-fire': { area: 'checkin', pos: [88, 89, 1.5], title: 'The fire pit', text: 'The heart of the festival square: everyone ends up here at night, for songs, stories and the day’s gossip.', controls: [{ type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.92 }] }] },
    'square-stage': { area: 'checkin', pos: [96, 83, 3], title: 'The square stage', text: 'Open mics, local bands and surprise sets, right beside the fire and the food stalls.', controls: [showToggle('checkin', 'Start a set', 'End the set'), dusk] },
    'island-screen': { area: 'island', pos: [74.5, 56, 3], title: 'The Island Cinema', text: 'A screen on an island in the middle of the lake, benches under string lights, reached by boat. Films every evening.', controls: [showToggle('island', 'Start the film', 'End the film'), { type: 'button', label: 'Make it night', actions: [{ set: 'timeOfDay', value: 0.95 }] }] },
    'camp-tents': { area: 'camp', pos: [18, 114, 2], title: 'Stay & unwind', text: 'Tents, homestays and quiet zones. Stay for a night or for the whole month.', controls: [{ type: 'button', label: 'Night at the camp', actions: [{ set: 'timeOfDay', value: 0.92 }] }] },
    'hidden-act': { area: 'hidden', pos: [116, 111, 2.5], title: 'Tonight’s hidden act', text: 'Offbeat acts appear in fields, forests and villages. Follow the trail by cycle or on foot.', controls: [showToggle('hidden', 'Start the hidden act', 'End the act')] },
    lotus: { area: null, pos: [68, 38.5, 1.5], zoom: 0.55, title: 'The lotus on the lake', text: 'A floating installation at the heart of the festival. It lights up at dusk.', controls: [{ type: 'button', label: 'Light the lotus', primary: true, actions: [{ pulse: 'lotusGlow', dur: 16 }] }] }
  }
};
