// APPA Art Fest 2027 · every word in the app, and what every control does.
// Controls (see src/app/app.js):
//   { type: 'button', label, actions: [...] , primary }
//   { type: 'toggle', label, labelOn, channel, arg, on: value, off: value, also: [{ channel, arg, on, off }] }
//   { type: 'slider', label, channel, min, max, step, readout: v => text }
//   { type: 'choice', label, channel, options: [{ label, value, text, actions }] }
// Actions: { set: channel, arg, value } · { pulse: channel, arg, dur } · { go: 'area:<id>' | 'spot:<key>' | 'overview' } · { reveal: areaId } · { say: text }

// four 9-day chapters (3-6-9): every 3rd, 6th and 9th day of a chapter is a big night
const WEEKS = [
  { label: 'Roots & Raga', dates: 'Chapter 1 · 12 to 20 Feb', text: 'Classical, Maharashtra culture, fusion, desi cool and global artists. The festival opens on 12 February. Big nights 14, 17 and 20 Feb.', value: 0 },
  { label: 'Keeping it Real', dates: 'Chapter 2 · 21 Feb to 1 Mar', text: 'Hip-hop, rap, spoken word, poetry, rock and youth culture. Big nights 23 and 26 Feb, 1 Mar.', value: 1 },
  { label: 'Tech, Electronica & AI', dates: 'Chapter 3 · 2 to 10 Mar', text: 'Electronic music, digital art, AI, immersive installations and tech-driven creativity. Big nights 4, 7 and 10 Mar.', value: 2 },
  { label: 'All forms, together', dates: 'Chapter 4 · 11 to 19 Mar', text: 'A grand culmination of everything: music, art, workshops, community creations and special collaborations. Big nights 13, 16 and 19 Mar.', value: 3 }
];
const weekOptions = WEEKS.map(w => ({ label: w.label, value: w.value, text: `${w.dates}. ${w.text}`, actions: [{ set: 'dronesOn', value: w.value === 2 ? 1 : 0 }] }));
const showToggle = (area, label, labelOn) => ({ type: 'toggle', label, labelOn, channel: 'stageOn', arg: area, on: 1, off: 0, also: [{ channel: 'crowd', arg: area, on: 1, off: 0.45 }] });
// a day/night button: once it has gone dark the same button offers to bring the morning back
const nightBtn = (night, label = 'Make it night') => ({ type: 'daynight', label, labelBack: 'Let the morning come', night, day: 0.3 });
const dusk = nightBtn(0.86, 'Let the evening come');
// a venue's own site, opened in a new tab so the festival app keeps running behind it.
// venues with no official website of their own get a plain search link instead of a made-up address.
const site = (label, url) => ({ label, url });
const search = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// ticket tiers for the ticket counter. Booking, payment and availability live on calmshade.in (fest.php);
// keep these prices in step with the APPA Fest desk (Creator console → APPA Fest desk → Festival prices).
const BOOK = '../../';
const TICKETS = {
  title: 'Tickets & stays', eyebrow: 'The ticket counter',
  intro: 'Everything to come to APPA Art Fest 2027, from a single day to all 36 days. Book online with live availability; pay by UPI.',
  tiers: [
    { name: 'Day pass', price: '₹2,000', unit: 'per person, per day', blurb: 'Entry to the festival for one day: every venue, every open show.', bullets: ['Access to all open venues for the day', 'Exhibitions, art walks and open workshops', 'No stay included'], book: { label: 'Buy day passes', href: BOOK + '#appa-pass' } },
    { name: 'Stay + festival, for 2', price: 'from ₹10,500', unit: 'per couple, per night, inside the festival', blurb: 'The venue’s own room rate for the night, plus a festival ticket for each guest.', bullets: ['A room at Calmshet, Le Farm, Shambhala by the Lake, Theeya or The Company Theatre', 'Each venue sets its own rate; weekends may cost more', 'Festival tickets ₹2,000 per guest, every night you stay', 'Purrom single rooms from ₹6,000 a night; VIP tents ₹9,000 for 2', 'Cycle or e-bike pickup at check-in', 'Mix venues night by night', 'Kids under 10: free entry with a paying adult'], book: { label: 'See live availability', href: BOOK + '#appa' } },
    { name: 'VIP · 6+ nights', price: '6% off', unit: 'any 6 or more nights inside the festival', blurb: 'Six nights or more at the festival, with full access to every show and experience.', bullets: ['All shows and experiences for your nights', 'Priority entry at every venue', 'Stay inside the festival, across one or several venues', 'Curate your route, or let us plan it'], book: { label: 'Curate a VIP stay', href: BOOK + '#appa-curate' } },
    { name: 'VVIP · 9+ nights', price: '9% off', unit: 'a full 9-day chapter or more, stay + experience', blurb: 'A whole chapter of the festival or more: full access plus a few things nobody else gets.', bullets: ['Priority seating on all 12 big nights (every 3rd, 6th and 9th day)', 'One artist studio visit per chapter', 'One free adventure slot', 'All access, every venue, for your nights'], book: { label: 'Curate a VVIP stay', href: BOOK + '#appa-curate-month' } },
    { name: 'Adventures', price: '₹50 deposit', unit: 'per person to book a slot; the rest at the venue', blurb: 'The lake and the hills, best on quieter weekdays.', bullets: ['Kayaking ₹350 · 20 minutes, mornings and evenings', 'Tandem paragliding ₹3,500 · once a day, timed by the wind', 'Night jeep ride ₹1,000 · about an hour, from 8:30 pm', 'Sunrise and sunset treks, crystal hunting: details soon'], book: { label: 'Book an adventure', href: BOOK + '#appa-adv' } },
    { name: 'Partner stays nearby', price: 'Host rate + ₹2,000', unit: 'per guest, per night', blurb: 'Homestays and camps around the lake, approved by the festival team, with festival entry included.', bullets: ['Festival entry for every guest, every night', 'Hosts can list their own place too'], book: { label: 'See partner stays', href: BOOK + '#appa' } }
  ],
  note: 'Kids under 10 always enter free, on every ticket type. Prices inside the festival rise up to 20% as venues fill, so earlier is cheaper. Payments go by UPI to Karthikeyan Ramachandran (xtrathindesign@okicici); the booking page gives you the exact amount and QR.',
  links: [{ label: 'Book tickets & stays', href: BOOK + '#appa', primary: true }, { label: 'My Art Passport', href: BOOK + '#passport' }],
  // a quick way to reach the team (shown near the top of the ticket counter): WhatsApp chat and a tap-to-call button
  help: { text: 'Questions about tickets, stays or dates? Message us on WhatsApp or give us a call.',
    links: [{ label: 'Message us on WhatsApp', href: 'https://wa.me/918799938193?text=' + encodeURIComponent('Hi! I have a question about APPA Art Fest 2027 tickets and stays.'), primary: true },
      { label: 'Call +91 87999 38193', href: 'tel:+918799938193' }] },
  contact: 'Every booking comes with an APPA Art Passport: your itinerary, the map, and a stamp from each venue you visit. Questions? WhatsApp +91 87999 38193.'
};


// Join the festival: volunteer, partner, sponsor. Early draft wording, all of it is meant to be edited.
const JOIN = {
  volunteer: { button: 'Be a volunteer', eyebrow: 'Be a volunteer', title: 'Help build a season',
    intro: 'A 36-day festival runs on people. Volunteers are the friendly faces at every venue: they greet guests, help artists set up, keep the cycle stands moving and make the whole lake feel like one big welcome.',
    blocks: [
      { h: 'Where you could help', bullets: ['Guest welcome and wayfinding at check-in and at every venue', 'The cycle and e-bike desk: fitting, handing out and checking bikes', 'Artist hosts: looking after resident artists and their materials', 'Workshop assistants: setting up, guiding and clearing', 'Stage and show crew: lights, sound, seating, backstage', 'The green team: waste, water and keeping the lake clean', 'Kids’ corner and family help', 'Photo, video and reels for the festival’s own channels'] },
      { h: 'What you get', bullets: ['Meals on shift and a place to stay', 'Free festival access on your days off, including workshops', 'A chance to meet and talk with the artists', 'A volunteer certificate and a reference on request', 'Being part of the first APPA season'] },
      { h: 'How it works', bullets: ['Open to everyone 18 and over; people from the villages around the lake are especially welcome', 'Shifts of about five hours; a minimum of three days', 'A short orientation before the festival opens on 12 February'] }
    ],
    contact: 'Tell us your name, the days you can come and where you would like to help. We will reply with a shift plan.',
    cta: { label: 'Volunteer: message us on WhatsApp', url: 'https://wa.me/918799938193?text=' + encodeURIComponent('Hi! I would like to volunteer at APPA Art Fest 2027. Name: , days I can come: , where I would like to help: ') } },
  partner: { button: 'Be a partner', eyebrow: 'Be a partner', title: 'Make Kamshet a season',
    intro: 'APPA is a festival of festivals, and it belongs to the whole lake. We are inviting stays, farms, theatres, collectives, schools, local businesses and civic bodies to become partners and grow a February–March season for Kamshet that people plan their year around.',
    blocks: [
      { h: 'Who we would love to work with', bullets: ['Stays, farms and retreats around the lake (venue partners)', 'Theatres, collectives, studios and schools that want to curate their own festival within ours', 'Local makers, food producers and village communities', 'Civic and government partners: district administration, police, tourism, forest and local bodies', 'Mobility partners: cycles, e-bikes and electric two-wheelers', 'Media and culture partners'] },
      { h: 'What we ask of venue partners', bullets: ['Open and common spaces for performances, exhibitions and workshops', 'About one room in five for a resident artist, whose work in progress your guests get to watch', 'Your own festival or programme inside APPA, if you would like one'] },
      { h: 'What partners receive', bullets: ['36 days of bookings, instead of the usual handful of busy days', 'A share of ticket income from paid events at your venue', 'Your name and logo in festival media, the app and the press', 'A place on the map, the tour and the itinerary every guest carries', 'Early-partner status as the festival grows year after year'] },
      { h: 'For government and civic partners', bullets: ['A public inauguration on 12 February', 'Recognition as a founding supporter in all press and communication', 'A safe, well-run and well-planned event, built together from day one'] }
    ],
    contact: 'Write to us about the space, service or programme you would like to bring, and we will set up a conversation.',
    cta: { label: 'Partner: message us on WhatsApp', url: 'https://wa.me/918799938193?text=' + encodeURIComponent('Hi! I would like to partner with APPA Art Fest 2027. About my space / service / programme: ') },
    cta2: { label: 'Have a stay near the lake? List your stay', url: BOOK + '#appa-host' } },
  sponsor: { button: 'Be a sponsor', eyebrow: 'Be a sponsor', title: 'Back the season',
    intro: 'APPA Art Fest 2027 is dedicated to the late artist K. N. Ramachandran: 36 days of art, people and nature across a whole lake, with cycles instead of cars and a new artist at work in every corner. Sponsors make it possible, and we make sure they are seen.',
    tiers: [
      { name: 'Title sponsor', unit: 'one only', blurb: 'The festival carries your name for all 36 days.', bullets: ['“APPA Art Fest 2027 presented by …” on everything', 'Main-stage and inauguration branding on 12 February', 'Your name in the app, the tour and the press release', 'A private evening and artist meet-up for your guests', 'A film and reels package across the four chapters'] },
      { name: 'Chapter sponsor', unit: 'four available, one per 9-day chapter', blurb: 'Own a chapter and its theme: Roots & Raga, Keeping it Real, Tech & AI, All Forms Together.', bullets: ['Your name on that chapter’s programme and stages', 'Branding on its three big nights', 'Social and reel features through the chapter'] },
      { name: 'Venue sponsor', unit: 'one per venue', blurb: 'Be the presenting sponsor of one of the venues.', bullets: ['Your name beside the venue’s on the map and in the app', 'Signage at the venue', 'A curated moment with the venue’s resident artists'] },
      { name: 'Event or stage sponsor', unit: 'many available', blurb: 'Back one show, workshop, screening or stage.', bullets: ['Your name on the show’s billing and stage', 'Mentions in social posts and reels for the event'] },
      { name: 'Artist sponsor', unit: 'many available', blurb: 'Support one resident artist: materials, stay and travel.', bullets: ['Your name beside the artist’s work and residency', 'A studio visit and a piece for your collection or office'] },
      { name: 'In-kind and barter', unit: 'cycles, e-bikes, food, sound, print, travel and more', blurb: 'Pay in product or service instead of cash.', bullets: ['Logo on signage, the map and the app', 'Reels and shout-outs matched to the value you bring', 'Cycle and e-bike partners: a presence at every check-in'] }
    ],
    note: 'Sponsorship figures are shared on request. Every sponsor is named in the app, on the signage and in the reels.',
    contact: 'Tell us which tier interests you and we will send the full proposal, with the numbers, on request.',
    cta: { label: 'Sponsorship enquiries: karthik@xtrathin.in', url: 'mailto:karthik@xtrathin.in?subject=APPA%20Art%20Fest%202027%20sponsorship' } }
};

export const COPY = {
  join: JOIN,
  brand: 'APPA', title: 'APPA Art Fest 2027',
  tickets: TICKETS,
  intro: { eyebrow: '12 Feb to 19 Mar 2027', h1: 'APPA Art Fest 2027', tag: 'When minds co-create',
    text: 'A festival of festivals: 36 days of art, people, nature and a better tomorrow, where every venue curates its own festival. One lake, many venues, a living ecosystem. Drag to look around, scroll or pinch to zoom, and tap any venue to see what happens there.',
    enter: 'Enter the festival', loading: 'Loading the festival…' },
  tourLabel: 'Guided tour', tourStop: 'Stop the tour',
  overview: { eyebrow: 'The festival at a glance', h2: 'One lake. Many venues. A living ecosystem.', text: 'Welcome to the festival of festivals. Each venue runs its own festival inside one big fest. Wake up to fine arts, installations, films, theatre, spoken word, fashion, forums, workshops, digital interactive installations, music and nature. Curate your experiences to create your memories.',
    quote: { text: 'Art procreates when minds co\u2011create.', by: 'Appa' },
    badges: [{ icon: '🐾', label: 'Pet friendly' }, { icon: '🧒', label: 'Kid friendly', note: 'under 10 always free' }],
    controls: [
      { type: 'choice', label: 'Four 9-day chapters', channel: 'week', options: weekOptions },
      { type: 'slider', label: 'Time of day', channel: 'timeOfDay', min: 0.1, max: 1, step: 0.01, readout: v => (v < 0.3 ? 'Morning' : v < 0.45 ? 'Afternoon' : v < 0.62 ? 'Golden hour' : v < 0.8 ? 'Dusk' : 'Night') },
      { type: 'button', label: 'Light the lotus on the lake', actions: [{ pulse: 'lotusGlow', dur: 16 }, { go: 'spot:lotus' }] },
      { type: 'button', label: 'Find Hidden APPA', actions: [{ reveal: 'hidden' }, { go: 'area:hidden' }] }
    ],
    journey: ['Park your car at check-in', 'Pick your ride: cycles and e-bikes', 'Get your APPA passport and itinerary', 'Explore every venue: performances, exhibitions, workshops, flea, food and more', 'Stay, unwind, connect with nature', 'Be part of a bigger story'] },
  weeks: WEEKS,
  areas: {
    lefarm: { n: 5, name: 'Le Farm', tagline: 'Big events and open debate',
      website: site('lefarm.in ↗', 'https://lefarm.in'),
      offerings: [['Big-scale concerts and music performances', 'lefarm-stage'], ['Political forums, debates and rallies (all voices, curated)', 'lefarm-stage'], ['Morning yoga, meditation and healing sessions', 'lefarm-yoga'], ['Wine and cheese sessions, and fine dine', 'lefarm-tent2'], ['A beer fest under the big top', 'lefarm-beer'], ['Farm visits, permaculture treks and temple visits', 'lefarm-shrine'], ['About 12 resident artists: painters and sculptors', 'lefarm-house'], ['About 5 exhibits: an antique exhibit and the K. N. Ramachandran sketches', 'lefarm-exhibits'], ['An AI futuristic interactive exhibit', 'lefarm-ring'], ['Woodcut workshop', 'lefarm-woodcut'], ['On-site parking for the big crowds', 'lefarm-stage'], ['Facing the sunrise: yoga and meditation on the lawns at first light', 'lefarm-yoga']] },
    shambhala: { n: 6, name: 'Shambhala by the Lake', tagline: 'Intimate music by the water',
      website: site('shambalabythelake.com ↗', 'https://shambalabythelake.com'),
      offerings: [['One art exhibition', 'shambhala-exhibit'], ['3 resident artists: painters, a rock-balancing artist, and acoustic musicians and singers', 'shambhala-cottage'], ['Rock balancing by the water', 'shambhala-rocks'], ['Tricks and a carpentry workshop', 'shambhala-workshop'], ['Intimate music on the lakeside stage', 'shambhala-stage'], ['Jetty sessions, sunrise yoga and lakeside reflections', 'shambhala-stage'], 'Paragliding base for the brave', 'Homely food and weekend barbecue'] },
    purrom: { n: 2, name: 'Purrom', tagline: 'Horror film festival in a healing retreat',
      website: site('purrom.com ↗', 'https://purrom.com'),
      offerings: [['Horror film festival, curated by Purrom', 'purrom-screen'], ['Late-night screenings under the Sahyadri sky', 'purrom-screen'], ['2 to 3 resident artists and painters', 'purrom-domes'], ['One exhibition, in the clay huts', 'purrom-domes'], ['One acoustic act, and music performances', 'purrom-acoustic'], ['One hands-on workshop', 'purrom-workshop'], ['Sunrise meditation, yoga and sound healing', 'purrom-yoga'], ['Stays in the solo domes, the Glass House and the Chickoo house', 'purrom-glass'], ['Flea and local food', 'purrom-market']] },
    company: { n: 3, name: 'The Company Theatre', tagline: 'Their own theatre festival',
      website: site('thecompanytheatre.net ↗', 'https://thecompanytheatre.net'),
      offerings: [['Theatre performances: the Company Theatre’s own festival', 'company-theatre'], ['Theatre workshops', 'company-pavilion'], ['6 resident artists: painters and sculptors', 'company-studio'], ['2 installations', 'company-ring'], ['1 interactive installation', 'company-interactive'], ['An exhibit of K. N. Ramachandran’s work', 'company-studio'], ['Film screenings and talks', 'company-screen'], ['Facing the sunset: meditation at dusk', 'company-sunset']] },
    theeya: { n: 4, name: 'Theeya Creation Village', tagline: 'Voice, craft and community',
      website: site('Search Theeya Creation Village, Kamshet ↗', search('Theeya The Creation Village Kamshet')),
      offerings: [['Singers and song performances: the vocal stage', 'theeya-stage'], ['Theatre', 'theeya-theatre'], ['Fine dine', 'theeya-deck'], ['About 4 resident artists', 'theeya-house'], ['About 3 installations, made on site', 'theeya-installations'], ['Music performances and sing-along evenings by the village fire', 'theeya-fire'], ['Sunrise meditation, yoga and sound healing', 'theeya-yoga'], ['Workshops with local makers', 'theeya-pavilion'], 'Sustainable living and food'] },
    calmshet: { n: 1, name: 'Calmshet', tagline: 'The past two years, fashion and art',
      website: site('calmshet.com ↗', 'https://calmshet.com'),
      offerings: [['Opening night and major performances', 'calmshet-stage'], ['Art exhibition: paintings by the late K. N. Ramachandran', 'calmshet-archive'], ['Exhibit: artists from around India’s independence era', 'calmshet-archive'], ['Antique prints and lithographs', 'calmshet-prints'], ['Comics corner with an interactive, immersive AI exhibit', 'calmshet-ai'], ['Interactive installations and immersive experiences', 'calmshet-ai'], ['Short films', 'calmshet-film'], ['10 resident painters working on the verandas', 'calmshet-house'], ['A sculptor in residence, and sculpture on the lawn', 'calmshet-sculpture'], ['Pottery workshop', 'calmshet-pottery'], ['Acoustic sets, sunset sets and sunset evening views', 'calmshet-stage'], ['The archive: every event of the last two years and their formats', 'calmshet-archive'], ['Fashion segment with a runway', 'calmshet-runway'], ['Facing the sunset: sound healing and meditation at dusk', 'calmshet-sunset']] },
    checkin: { name: 'Check-in & Festival Square', tagline: 'Where the journey starts, and where everyone gathers', offerings: ['Park your car and walk in under the APPA arch', 'Pick up a cycle or an e-bike', 'Your APPA passport and itinerary', 'The fire pit: sing-alongs and stories every night', 'A stage for open mics, local bands and the day’s surprises', 'Flea, food and craft stalls on the shore', 'Boats out to the Island Cinema'] },
    island: { name: 'Island Cinema', tagline: 'Films on an island in the middle of the lake', offerings: ['Open-air screenings every evening, under string lights', 'Reached by boat from the jetties', 'Short films, documentaries and the horror festival’s late shows', 'Blankets and benches: bring a friend'] },
    cloudbase: { n: 7, name: 'Cloud Base', tagline: 'Shows under a giant wall, a café, restaurants and a bar',
      offerings: [['Shows on the stage under the giant wall', 'cloudbase-stage'], ['A café, restaurants and a bar', 'cloudbase-cafe'], ['A view over the lake', 'cloudbase-view']] },
    camp: { name: 'Stay & Unwind', tagline: 'More than a festival, a place to belong', offerings: ['Camping and eco-stays', 'Homestays and local stays', 'Quiet zones, wellness and retreats', 'Stay for a night or all 36 days'] },
    hidden: { name: 'Hidden APPA', tagline: 'Offbeat acts in fields, forests and villages', offerings: ['Pop-up performances', 'Reached by cycle or on foot', 'Ask at any venue where tonight’s act is'] }
  },
  spots: {
    'lefarm-stage': { area: 'lefarm', pos: [64.5, 111, 3], programme: ['Big-scale concerts', 'Music performances', 'Forums, debates and rallies'], title: 'The open-debate stage', text: 'Political forums, debates and rallies, curated for every voice. Parking is on site.', controls: [showToggle('lefarm', 'Open the forum', 'Close the forum'), dusk] },
    'lefarm-tops': { area: 'lefarm', pos: [52, 114, 5], programme: ['Beer fest', 'Big-scale concerts and music performances'], title: 'The big tops', text: 'Two striped tents for music and performance, lit from inside after dark.', controls: [dusk] },
    'lefarm-house': { area: 'lefarm', pos: [57, 102, 4], programme: ['About 12 resident artists: painters and sculptors', 'About 5 exhibits: the antique exhibit, the K. N. Ramachandran sketches, and more across the grounds'], title: 'The main house', text: 'A modern two-storey house with flat roofs, big glass windows, a rounded veranda and a carport: the artists’ green room.' },
    'lefarm-ring': { area: 'lefarm', pos: [71, 107.5, 3], zoom: 1.6, programme: ['An AI futuristic interactive exhibit', 'A major outdoor installation'], title: 'The red sculpture', text: 'A tall faceted sculpture on the lawn, a major outdoor installation. It glows after dark.', controls: [dusk] },
    'shambhala-stage': { area: 'shambhala', pos: [30, 60, 2.5], programme: ['Acoustic musicians and singers', 'Intimate sets by the water', 'Sunrise yoga on the jetty'], title: 'The lakeside stage', text: 'Small, close, by the water: intimate sets for a few dozen people.', controls: [showToggle('shambhala', 'Start a lakeside set', 'End the set')] },
    'shambhala-house': { area: 'shambhala', pos: [17, 62, 3], programme: ['One art exhibition', 'Long meals and music'], title: 'The pavilion', text: 'A big open pavilion with a red tiled roof, up the stone steps: long meals, music and artists in residence, right by the water.', controls: [dusk] },
    'purrom-screen': { area: 'purrom', pos: [47, 23, 3], programme: ['Horror film festival', 'Late-night screenings under the Sahyadri sky'], title: 'The horror film festival', text: 'Screenings after dark in the open air, beside a retreat that heals by day.', controls: [showToggle('horror', 'Start a screening', 'End the screening'), nightBtn(0.95, 'Make it night')] },
    'purrom-domes': { area: 'purrom', pos: [47, 13, 3], programme: ['2 to 3 resident artists and painters', 'One exhibition in the huts'], title: 'The clay huts and the Glass House', text: 'Square clay huts under red pyramid roofs, clay pots, and the Glass House dome with valley views, glowing softly at night.', controls: [dusk] },
    'purrom-market': { area: 'purrom', pos: [40, 28, 2], programme: ['Flea and local food', 'Handmade, sustainable products'], title: 'The flea and food', text: 'Handmade, sustainable, local products and food.' },
    'company-theatre': { area: 'company', pos: [73, 13, 4], programme: ['Theatre performances', 'The Company Theatre’s own festival'], title: 'The theatre house', text: 'The white house with the red roof and the railed veranda, home of The Company Theatre and its festival. Curtain up on new work.', controls: [showToggle('company', 'Curtain up', 'Curtain down')] },
    'company-screen': { area: 'company', pos: [69, 22, 3], programme: ['Film screenings', 'Talks under the stars'], title: 'The open-air screen', text: 'Film screenings and talks under the stars, on benches in the grass.', controls: [{ ...showToggle('company', 'Start the screening', 'End the screening') }, dusk] },
    'theeya-stage': { area: 'theeya', pos: [119.5, 69, 2.5], programme: ['Singers and song performances', 'Choirs and voice workshops'], title: 'The vocal stage', text: 'Solo voices, choirs and voice workshops under the trees, led by the village’s own singer.', controls: [showToggle('theeya', 'Start the singing', 'End the singing'), dusk] },
    'theeya-pavilion': { area: 'theeya', pos: [121, 60, 3], programme: ['Workshops with local makers', 'Sunrise meditation, yoga and sound healing'], title: 'The workshop pavilion', text: 'Hands-on workshops with local makers: clay, weaving, natural dyes, cooking.' },
    'theeya-deck': { area: 'theeya', pos: [107, 70, 2], programme: ['Fine dine', 'Long meals and quiet mornings'], title: 'The pergola deck', text: 'Long tables under the timber pergola beside the red house, wrapped in bougainvillea. Meals, conversations and quiet mornings.', controls: [dusk] },
    'theeya-fire': { area: 'theeya', pos: [113.5, 66.5, 1.5], programme: ['Sing-along evenings', 'Music performances'], title: 'The village fire', text: 'Where the day’s makers gather in the evening for a sing-along.', controls: [dusk] },
    'calmshet-stage': { area: 'calmshet', pos: [20, 40, 5], programme: ['Opening night on 12 February', 'Acoustic sets', 'Sunset sets, and sunset evening views', 'Music performances all festival'], title: 'The main stage', text: 'Opening night on 12 February, and the festival’s biggest performances on the big nights.', controls: [showToggle('calmshet', 'Start the opening night', 'End the show'), nightBtn(0.95, 'Make it night')] },
    'calmshet-house': { area: 'calmshet', pos: [24, 31, 5], programme: ['10 resident painters working on the verandas', 'Conversations with the artists as they work'], title: 'The main house', text: 'The cream two-storey hill lodge, with wooden verandas and white railings wrapping every floor, on its stone terrace among the trees: home to the resident artists.', controls: [dusk] },
    'calmshet-runway': { area: 'calmshet', pos: [33, 31, 2], title: 'The fashion runway', text: 'A fashion segment inside the hub: collections, collectives and live runway shows.', controls: [showToggle('fashion', 'Start the runway show', 'End the show'), dusk] },
    'calmshet-archive': { area: 'calmshet', pos: [14, 31, 2], zoom: 1.6, programme: ['Paintings by the late K. N. Ramachandran', 'Artists from around India’s independence era', 'Antique prints and lithographs', 'The archive of the last two years'], title: 'The galleries and the archive', text: 'A gallery pavilion: the late K. N. Ramachandran’s paintings, the artists of the independence era, antique prints, and every event of the last two years to walk through.' },
    'calmshet-towers': { area: 'calmshet', pos: [28.5, 42, 9], title: 'Towers and drones', text: 'In the Tech, Electronica & AI chapter, a drone swarm lights up the sky over Calmshet.', controls: [{ type: 'button', label: 'Launch the drones', primary: true, actions: [{ set: 'week', value: 2 }, { set: 'dronesOn', value: 1 }, { set: 'timeOfDay', value: 0.9 }] }] },
    'calmshet-pottery': { area: 'calmshet', pos: [34, 50, 3], zoom: 1.6, title: 'Pottery workshop', text: 'Hands in clay under the roof: a daily pottery workshop.', programme: ['Pottery workshop', 'Fire, glaze and take-home pieces'] },
    'calmshet-ai': { area: 'calmshet', pos: [28, 49, 3.5], zoom: 1.6, title: 'Comics corner and AI immersion', text: 'A dome for immersive, interactive AI installations, comics and short films.', programme: ['Comics corner: an interactive, immersive AI exhibit', 'Interactive installations and immersive experiences', 'Short films'] },
    'calmshet-sculpture': { area: 'calmshet', pos: [11.5, 46, 3.5], title: 'The sculptor’s lawn', text: 'A sculptor works on the grass through the month; visitors watch the piece take shape.', programme: ['A sculptor in residence', 'Sculpture and outdoor installations'] },
    'lefarm-tent2': { area: 'lefarm', pos: [68.5, 101.5, 4], title: 'Wine, cheese and fine dine', text: 'The second big top turns into a long-table dining room after dark.', programme: ['Wine and cheese sessions', 'Fine dine'], controls: [dusk] },
    'lefarm-yoga': { area: 'lefarm', pos: [50.5, 107, 2.5], title: 'The sunrise deck', text: 'A raised open deck facing the first light, above the lake.', programme: ['Morning yoga sessions', 'Meditation sessions', 'Healing sessions', 'Sunrise views'] },
    'lefarm-woodcut': { area: 'lefarm', pos: [57.5, 108.5, 2.5], zoom: 1.6, title: 'Woodcut workshop', text: 'Carve, inked and print: a woodcut workshop with the resident artists.', programme: ['Woodcut workshop'] },
    'lefarm-trail': { area: 'lefarm', pos: [57, 119, 2], title: 'Farm, trail and temple', text: 'The trails start at the farm stalls.', programme: ['Farm visits', 'Permaculture treks', 'Temple visits'] },
    'purrom-glass': { area: 'purrom', pos: [56, 15, 4], title: 'The Glass House', text: 'The dome with valley views is the morning room.', programme: ['Sunrise meditation', 'Yoga', 'Sound healing'], controls: [dusk] },
    'purrom-workshop': { area: 'purrom', pos: [40, 21.5, 3], zoom: 1.6, title: 'The workshop canopy', text: 'One hands-on workshop under the white canopy.', programme: ['One workshop'] },
    'purrom-acoustic': { area: 'purrom', pos: [56.5, 23, 3], title: 'The acoustic corner', text: 'A single acoustic act and music between films.', programme: ['One acoustic act', 'Music performances'] },
    'shambhala-cottage': { area: 'shambhala', pos: [12, 72, 3], title: 'The artists’ cottage', text: 'Three artists live and work here through the month.', programme: ['Painters', 'A rock-balancing artist', 'Acoustic musicians and singers'] },
    'shambhala-rocks': { area: 'shambhala', pos: [22, 73, 2], zoom: 1.6, title: 'Rock balancing', text: 'Stones stacked against gravity at the water’s edge.', programme: ['Rock balancing, with the artist on hand'] },
    'shambhala-workshop': { area: 'shambhala', pos: [33, 73, 2.5], title: 'The carpentry workshop', text: 'A hands-on workshop tent.', programme: ['Carpentry workshop', 'Tricks'] },
    'theeya-house': { area: 'theeya', pos: [113, 61, 4], title: 'The red house', text: 'The residents’ house, and a small theatre in the yard.', programme: ['About 4 resident artists', 'Theatre'], controls: [dusk] },
    'theeya-installations': { area: 'theeya', pos: [124, 66, 3], zoom: 1.6, title: 'The installations', text: 'About three installations are made here, on site, during the month.', programme: ['About 3 installations in progress', 'Resident artists at work'] },
    'company-ring': { area: 'company', pos: [77.5, 23, 3.5], title: 'The ring and the sunset circle', text: 'A ring installation on the lawn, facing the sunset. Meditation circles gather round it at dusk.', programme: ['2 installations in the grounds', 'Sunset meditation'], controls: [dusk] },
    'company-stage': { area: 'company', pos: [83.5, 11, 3], title: 'The open-air stage', text: 'The theatre’s stage beside the lawn.', programme: ['Theatre performances outdoors', 'The Company Theatre festival'], controls: [showToggle('company', 'Curtain up', 'Curtain down')] },
    'company-pavilion': { area: 'company', pos: [83, 22.5, 3], title: 'The workshop pavilion', text: 'Theatre workshops with the company.', programme: ['Theatre workshops'] },
    'company-studio': { area: 'company', pos: [66.5, 8.5, 3], zoom: 1.6, title: 'The artists’ studio', text: 'Six resident painters and sculptors work here; one wall carries the K. N. Ramachandran exhibit.', programme: ['6 resident artists: painters and sculptors', 'A K. N. Ramachandran exhibit'] },
    'company-interactive': { area: 'company', pos: [86.5, 18, 3], zoom: 1.6, title: 'The interactive installation', text: 'Touch it and it answers.', programme: ['1 interactive installation'], controls: [dusk] },
    'calmshet-prints': { area: 'calmshet', pos: [11.8, 27.2, 3], zoom: 1.6, title: 'Antique prints and lithographs', text: 'A small hall of old prints and lithographs, with painters at work beside it.', programme: ['Antique prints and lithographs', 'Resident painters at their easels'] },
    'calmshet-sunset': { area: 'calmshet', pos: [36.4, 26.6, 2], zoom: 1.8, title: 'Sunset meditation', text: 'Mats laid out to face the sunset: sound healing and meditation as the light goes.', programme: ['Sunset meditation', 'Sound healing'], controls: [dusk] },
    'calmshet-film': { area: 'calmshet', pos: [12.4, 50.8, 3], zoom: 1.6, title: 'Short films', text: 'A small screen under the trees for short films.', programme: ['Short films'], controls: [dusk] },
    'lefarm-exhibits': { area: 'lefarm', pos: [65, 106.6, 3], zoom: 1.6, title: 'The exhibits', text: 'An antique exhibit, an AI-futurist show, the K. N. Ramachandran sketches and more, on easels under one roof.', programme: ['The antique exhibit', 'K. N. Ramachandran sketches', 'About 5 exhibits in all'] },
    'lefarm-beer': { area: 'lefarm', pos: [71.3, 116.6, 3], zoom: 1.6, title: 'The beer fest', text: 'A beer garden beside the stage, open all evening.', programme: ['Beer fest'], controls: [dusk] },
    'lefarm-shrine': { area: 'lefarm', pos: [50.1, 99.6, 3], zoom: 1.6, title: 'The temple trail', text: 'A small shrine on the trail: the walk to the temples and the permaculture farm starts here.', programme: ['Temple visits', 'Permaculture treks', 'Farm visits'] },
    'purrom-yoga': { area: 'purrom', pos: [57.6, 10.4, 2], zoom: 1.8, title: 'Sunrise circle', text: 'Yoga mats laid out under the Sahyadri sunrise: yoga, meditation and sound healing.', programme: ['Sunrise meditation', 'Yoga', 'Sound healing'] },
    'theeya-theatre': { area: 'theeya', pos: [109.4, 57.5, 3], zoom: 1.6, title: 'The village theatre', text: 'A small open stage beside the red house for theatre through the month.', programme: ['Theatre'], controls: [showToggle('theeya', 'Start the show', 'End the show')] },
    'theeya-yoga': { area: 'theeya', pos: [107.5, 76.9, 2], zoom: 1.8, title: 'Sunrise yoga and sound healing', text: 'Mats out by the pergola at first light.', programme: ['Sunrise meditation', 'Yoga', 'Sound healing'] },
    'company-sunset': { area: 'company', pos: [79.6, 19.7, 2], zoom: 1.8, title: 'Sunset meditation', text: 'Facing the sunset, on mats beside the lawn.', programme: ['Sunset meditation'], controls: [dusk] },
    'shambhala-exhibit': { area: 'shambhala', pos: [24.6, 58.8, 3], zoom: 1.6, title: 'The art exhibition', text: 'The one exhibition of the smallest venue: a single artist’s work on easels.', programme: ['One art exhibition'] },
    'checkin-arch': { area: 'checkin', pos: [90, 100, 4], title: 'Your festival journey', text: 'Park your car, walk in under the APPA arch, pick up a cycle or an e-bike, and get your APPA passport and itinerary. Slower travel, a cleaner festival.' },
    'square-fire': { area: 'checkin', pos: [88, 89, 1.5], title: 'The fire pit', text: 'The heart of the festival square: everyone ends up here at night, for songs, stories and the day’s gossip.', controls: [nightBtn(0.92, 'Make it night')] },
    'square-stage': { area: 'checkin', pos: [96, 83, 3], title: 'The square stage', text: 'Open mics, local bands and surprise sets, right beside the fire and the food stalls.', controls: [showToggle('checkin', 'Start a set', 'End the set'), dusk] },
    'island-screen': { area: 'island', pos: [74.5, 56, 3], title: 'The Island Cinema', text: 'A screen on an island in the middle of the lake, benches under string lights, reached by boat. Films every evening.', controls: [showToggle('island', 'Start the film', 'End the film'), nightBtn(0.95, 'Make it night')] },
    'cloudbase-stage': { area: 'cloudbase', pos: [118, 26, 5], title: 'The wall stage', text: 'A stage set against a giant tiered concrete wall. After dark the wall lights up behind the acts.', programme: ['Shows and performances'], controls: [showToggle('cloudbase', 'Start the show', 'End the show'), nightBtn(0.9, 'See it after dark')] },
    'cloudbase-cafe': { area: 'cloudbase', pos: [113, 45, 4], title: 'The café', text: 'A stone cottage under a tiled roof, with a long verandah for coffee, meals and the bar.', programme: ['Café', 'Restaurants', 'The bar'] },
    'cloudbase-view': { area: 'cloudbase', pos: [111, 51, 1.5], title: 'The view', text: 'Benches over the water: the lake, the hills and the far shore.', programme: ['Sit, look, take your time'] },
    'camp-tents': { area: 'camp', pos: [34, 86, 2], title: 'Stay & unwind', text: 'Tents, homestays and quiet zones. Stay for a night or for all 36 days.', controls: [nightBtn(0.92, 'Night at the camp')] },
    'hidden-act': { area: 'hidden', pos: [116, 111, 2.5], title: 'Tonight’s hidden act', text: 'Offbeat acts appear in fields, forests and villages. Follow the trail by cycle or on foot.', controls: [showToggle('hidden', 'Start the hidden act', 'End the act')] },
    lotus: { area: null, pos: [68, 38.5, 1.5], zoom: 0.55, title: 'The lotus on the lake', text: 'A floating installation at the heart of the festival. It lights up at dusk.', controls: [{ type: 'button', label: 'Light the lotus', primary: true, actions: [{ pulse: 'lotusGlow', dur: 16 }] }] }
  }
};
