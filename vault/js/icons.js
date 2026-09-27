// Vault — icon system (24px stroke icons, consistent 1.8 stroke)
const P = {
  home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  files: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2.5 3H17A2.5 2.5 0 0 1 19.5 10.5v6A2.5 2.5 0 0 1 17 19H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/>',
  folder: '<path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h4l2.5 3H18A2.5 2.5 0 0 1 20.5 10v6.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5V7Z"/>',
  folderOpen: '<path d="M3.5 18.5V7A2.5 2.5 0 0 1 6 4.5h4l2.5 3H18A2.5 2.5 0 0 1 20.5 10v1.5"/><path d="m3.5 18.5 2.2-5.8A2 2 0 0 1 7.5 11.8h12.3a1.6 1.6 0 0 1 1.54 2l-1.5 4.7a2 2 0 0 1-1.9 1.5H3.5Z"/>',
  star: '<path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8L12 4Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5M6.5 6.5 7.3 18a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-11.5"/><path d="M10 10.5v5.5M14 10.5v5.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 13 5a7.2 7.2 0 0 1 2.4 1l2.3-.8 1.6 2.7-1.7 1.8a7.3 7.3 0 0 1 0 2.6l1.7 1.8-1.6 2.7-2.3-.8a7.2 7.2 0 0 1-2.4 1l-1 2.2h-2.6l-1-2.2a7.2 7.2 0 0 1-2.4-1l-2.3.8-1.6-2.7 1.7-1.8a7.3 7.3 0 0 1 0-2.6L3.1 7.9l1.6-2.7 2.3.8a7.2 7.2 0 0 1 2.4-1l1-2.2h.6Z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.2v2.3"/>',
  unlock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/><path d="M12 14.2v2.3"/>',
  upload: '<path d="M12 15.5V4.5M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>',
  download: '<path d="M12 4.5v11M7.5 11.5 12 16l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  x: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevD: '<path d="m6 9.5 6 6 6-6"/>',
  dots: '<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 14.5A1.5 1.5 0 0 1 4 13V5.5A1.5 1.5 0 0 1 5.5 4H13a1.5 1.5 0 0 1 1.5 1.5"/>',
  edit: '<path d="m4 16.5 10.8-10.8a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L7.5 20H5.5A1.5 1.5 0 0 1 4 18.5v-2Z"/><path d="m13.5 7 3.5 3.5"/>',
  move: '<path d="M3.5 4.5h17v15h-17z" opacity="0"/><path d="M12 4v16M4 12h16"/><path d="m8.5 6.5 3.5-3.5 3.5 3.5M8.5 17.5l3.5 3.5 3.5-3.5M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"/>',
  share: '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="5.8" r="2.6"/><circle cx="17.5" cy="18.2" r="2.6"/><path d="m8.4 10.8 6.8-3.8M8.4 13.2l6.8 3.8"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17.4 17.4 0 0 1-3 3.9M6.1 6.6A16.8 16.8 0 0 0 2.5 12s3.5 7 9.5 7a8.9 8.9 0 0 0 4-.9"/><path d="M9.5 9.8a3 3 0 0 0 4.2 4.2"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8M11 8.5v5M8.5 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8M8.5 11h5"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  command: '<path d="M9 9V6a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v10a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V9Z"/><path d="M9 9h6v6H9z"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16.2v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5"/><path d="M4 3.5v5h5"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.9-3.6 3.7-5.6 7-5.6s6.1 2 7 5.6"/>',
  shield: '<path d="M12 3.5 5.5 6v5c0 4.3 2.8 7.4 6.5 8.7 3.7-1.3 6.5-4.4 6.5-8.7V6L12 3.5Z"/><path d="m9.2 11.8 2 2 3.6-3.6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 4.5-4 3.5 3 3-2.5 4 3.5"/>',
  video: '<rect x="3.5" y="6" width="13" height="12" rx="2.5"/><path d="m16.5 10 4-2.5v9l-4-2.5"/>',
  audio: '<path d="M9.5 17.5V7l10-2v10.5"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="15.5" r="2.5"/>',
  archive: '<rect x="4" y="4.5" width="16" height="4.5" rx="1.5"/><path d="M5.5 9v8A2.5 2.5 0 0 0 8 19.5h8a2.5 2.5 0 0 0 2.5-2.5V9"/><path d="M10 12.5h4"/>',
  code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/><path d="m13.2 6-2.4 12"/>',
  fileText: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/><path d="M8.5 12.5h7M8.5 16h4.5"/>',
  filePdf: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/><path d="M8 16.8v-4h1.3a1.4 1.4 0 0 1 0 2.8H8M12.5 16.8v-4h2.3M15.9 16.8v-4h1.4"/>',
  fileDoc: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/><path d="m8 13 1.5-3 1.5 3M8.4 12h2.2M13 10v5.5M13 10h2M13 12.5h1.6"/>',
  fileSheet: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/><path d="M8.5 11.5h7M8.5 14.5h7M12 11.5v6"/>',
  fileSlides: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/><path d="M8.5 15.5 10.5 12l2 2.5 1.5-1.5 1.5 2.5"/>',
  fileGeneric: '<path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M13 3.5V8h4.5"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  pin: '<path d="M12 20.5S5.5 14.8 5.5 10a6.5 6.5 0 0 1 13 0c0 4.8-6.5 10.5-6.5 10.5Z"/><circle cx="12" cy="10" r="2.3"/>',
  keyboard: '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M6.5 10.5h.1M10 10.5h.1M13.5 10.5h.1M17 10.5h.1M6.5 14.5h.1M9.5 14.5h5M17.5 14.5h.1"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"/>',
  play: '<circle cx="12" cy="12" r="8.5"/><path d="M10.2 9v6l5-3-5-3Z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
  spark: '<path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"/>',
  backspace: '<path d="M8.5 5.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-11L3 12l5.5-6.5Z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.9 0-1.3-1.1-1.7-1.1-2.8 0-1.1 1-1.8 2.3-1.8h1.6a3.2 3.2 0 0 0 3.2-3.2c0-4-4-7.3-8-7.3Z"/><circle cx="8" cy="10.5" r="1"/><circle cx="11" cy="7.8" r="1"/><circle cx="14.8" cy="8.4" r="1"/>',
};

export function icon(name, size = 18, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.fileGeneric}</svg>`;
}

// Vault mark — minimal container + dial. Monochrome, currentColor.
export function vaultMark(size = 34) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
    <rect x="6.5" y="6.5" width="35" height="35" rx="10" stroke-width="2.6"/>
    <circle cx="24" cy="24" r="8.2" stroke-width="2.4"/>
    <path d="M24 11.4v4.4M24 32.2v4.4M11.4 24h4.4M32.2 24h4.4" stroke-width="2.4"/>
    <circle cx="24" cy="24" r="2.1" fill="currentColor" stroke="none"/>
  </svg>`;
}
