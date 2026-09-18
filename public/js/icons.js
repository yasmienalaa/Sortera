/**
 * Minimal outline icon set (no external assets, no emoji) shared by every
 * page. Each entry is the inner markup of a 20x20 stroke-based SVG.
 * Usage: icon('dashboard') -> full <svg> string, or icon('dashboard', 16)
 * for a specific pixel size. Meant to be dropped straight into a template
 * literal the same way an emoji character used to be.
 */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="6.5" height="6.5" rx="1.3"/><rect x="10.5" y="3" width="6.5" height="6.5" rx="1.3"/><rect x="3" y="10.5" width="6.5" height="6.5" rx="1.3"/><rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.3"/>',
  search: '<circle cx="9" cy="9" r="6"/><path d="M17 17l-4-4"/>',
  video: '<rect x="2.5" y="4.5" width="11" height="11" rx="2"/><path d="M13.5 8.2l4-2.3v8.2l-4-2.3"/>',
  image: '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><circle cx="7.2" cy="8.2" r="1.4"/><path d="M4 15l4.5-4.5 3 3 2-2L17 15"/>',
  document: '<path d="M5 2.5h7l3 3V17a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 17V3a.5.5 0 0 1 .5-.5Z"/><path d="M12 2.5V6h3.5"/><path d="M7 10h6M7 13h6"/>',
  clip: '<path d="M12.5 6.5l-6 6a2.5 2.5 0 0 0 3.5 3.5l6.5-6.5a4 4 0 0 0-5.7-5.7L4.3 10.3a5.5 5.5 0 0 0 7.8 7.8"/>',
  film: '<rect x="2.5" y="4" width="15" height="12" rx="1.5"/><path d="M6.5 4v12M13.5 4v12M2.5 8h4M13.5 8h4M2.5 12h4M13.5 12h4"/>',
  sparkle: '<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z"/>',
  people: '<circle cx="7" cy="7" r="2.6"/><circle cx="14" cy="8" r="2.2"/><path d="M2.5 16.5c.4-2.7 2.2-4.3 4.5-4.3s4.1 1.6 4.5 4.3"/><path d="M12.3 12.4c1.9.2 3.3 1.7 3.7 4.1"/>',
  shuffle: '<path d="M2.5 5.5h3.2l7 9h4.8"/><path d="M2.5 14.5h3.2l2.3-3"/><path d="M13 4.5l4 1-1 4M13 15.5l4-1-1-4"/>',
  tag: '<path d="M11 2.5H4.5A2 2 0 0 0 2.5 4.5V11l7.6 7.6a1.5 1.5 0 0 0 2.1 0l5.4-5.4a1.5 1.5 0 0 0 0-2.1L11 2.5Z"/><circle cx="7" cy="7" r="1.3"/>',
  user: '<circle cx="10" cy="6.5" r="3.3"/><path d="M3.3 17c.7-3.6 3.3-5.7 6.7-5.7s6 2.1 6.7 5.7"/>',
  book: '<path d="M3 4.2A1.7 1.7 0 0 1 4.7 2.5H10v15H4.7A1.7 1.7 0 0 0 3 19.2V4.2Z"/><path d="M17 4.2a1.7 1.7 0 0 0-1.7-1.7H10v15h5.3a1.7 1.7 0 0 1 1.7 1.7V4.2Z"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M4.6 5.6l1.4 1.4M14 13l1.4 1.4M2.5 10h2M15.5 10h2M4.6 14.4l1.4-1.4M14 7l1.4-1.4"/>',
  power: '<path d="M10 2.5V10"/><path d="M14.5 5.2a6 6 0 1 1-9 0"/>',
  mail: '<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M3 5.5l7 5.5 7-5.5"/>',
  lock: '<rect x="4" y="9" width="12" height="8.5" rx="1.8"/><path d="M6.5 9V6.3a3.5 3.5 0 0 1 7 0V9"/>',
  key: '<circle cx="6.2" cy="13.8" r="3.3"/><path d="M8.5 11.5L15 5M12.5 8l2 2M15 5l2.3 2.3"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z"/><circle cx="10" cy="10" r="2.3"/>',
  'eye-off': '<path d="M3 3l14 14"/><path d="M8.5 5.1A8.8 8.8 0 0 1 10 5c5 0 8 5 8 5a13.6 13.6 0 0 1-3.1 3.6M6 6.4C3.4 8 2 10 2 10s3 5 8 5c1 0 1.9-.2 2.7-.5"/><path d="M11.6 11.6a2.3 2.3 0 0 1-3.2-3.2"/>',
  x: '<path d="M5 5l10 10M15 5L5 15"/>',
  'external-link': '<path d="M8 3.5H4A1.5 1.5 0 0 0 2.5 5v11A1.5 1.5 0 0 0 4 17.5h11a1.5 1.5 0 0 0 1.5-1.5v-4"/><path d="M11.5 2.5h6v6M17 3l-8 8"/>',
  back: '<path d="M12.5 4l-6 6 6 6"/>',
  save: '<path d="M4 2.5h10l3.5 3.5V17a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z"/><path d="M6 2.5v5h6v-5M6 17.5V12h8v5.5"/>',
  clock: '<circle cx="10" cy="10" r="7.5"/><path d="M10 5.5V10l3 2"/>',
  list: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.3" cy="5" r=".9"/><circle cx="3.3" cy="10" r=".9"/><circle cx="3.3" cy="15" r=".9"/>',
  warning: '<path d="M10 3l8 14H2L10 3Z"/><path d="M10 8.3v3.6"/><circle cx="10" cy="14.3" r=".9"/>',
  clipboard: '<rect x="4.5" y="4" width="11" height="13.5" rx="1.8"/><rect x="7" y="2.5" width="6" height="3" rx="1"/><path d="M7 9.5h6M7 12.5h6M7 15.5h3.5"/>',
  archive: '<rect x="2.5" y="4" width="15" height="3.5" rx="1"/><path d="M3.5 7.5V16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5"/><path d="M8 10.7h4"/>',
  link: '<path d="M8.3 11.7a3.5 3.5 0 0 0 5 0l2.4-2.4a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M11.7 8.3a3.5 3.5 0 0 0-5 0L4.3 10.7a3.5 3.5 0 0 0 5 5l1.2-1.2"/>',
  folder: '<path d="M2.5 6a1.5 1.5 0 0 1 1.5-1.5h3.3l1.7 2H16a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5V6Z"/>',
};

function icon(name, size) {
  const s = size || 18;
  const inner = ICON_PATHS[name] || '';
  return `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
