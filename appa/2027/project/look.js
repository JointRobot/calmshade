// APPA Art Fest 2027 · the look. style = a preset key from src/engine/style.js (the style gate picks it);
// overrides tweak it; ui sets the app's colours and fonts (house colours of the festival poster).
export const LOOK = {
  style: 'H',                 // H clay: the real-time default. Others: see STYLES in src/engine/style.js
  overrides: { key: 3.0, hemi: 1.4, colorFx: { sat: 1.15, lift: 0.03 } },
  shadowBox: [-6, -6, 136, 136], // plan rectangle the sun's shadow map covers
  ui: {
    font: 'Mukta', display: 'Fraunces',
    paper: '#F6EEDD', card: '#FFF9EE', ink: '#23202A', muted: '#6A6258', rule: '#E2D3BA', accent: '#D9502F', accent2: '#2F7F7A', gold: '#E2A33A', bg: '#EDE0CC',
    overlay: { box: 'rgba(12,10,16,0.84)', text: '#FFF4E2', soft: '#E4D6C0', accent: '#F2A93B', rule: '#D9502F' }
  },
  logo: { dark: './assets/nolabel_logo_white.png', light: './assets/nolabel_logo_black.png' }
};
