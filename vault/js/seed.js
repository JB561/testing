// Vault — first-launch demo content.
// Every demo file is a *real* generated file (valid PDF, ZIP, WAV, SVG,
// text) so previews, downloads and storage math behave authentically.

// ---------- helpers ----------
function strBytes(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; }
function concat(...parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- minimal valid PDF (Helvetica, one page) ----------
export function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let content = `BT\n/F1 20 Tf\n72 720 Td\n(${esc(title)}) Tj\n/F1 11 Tf\n`;
  lines.forEach((ln, i) => {
    const y = 720 - 34 - i * 17;
    content += `1 0 0 1 72 ${y} Tm\n(${esc(ln)}) Tj\n`;
  });
  content += 'ET';
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objs[5] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i <= 5; i++) { offsets[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length;
  out += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([strBytes(out)], { type: 'application/pdf' });
}

// ---------- minimal valid ZIP (STORED entries) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function makeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameB = strBytes(e.name);
    const data = e.data || new Uint8Array(0);
    const crc = crc32(data);
    const lh = new Uint8Array(30 + nameB.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);          // STORED
    lv.setUint16(12, 0x21, true);      // DOS date 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameB.length, true);
    lh.set(nameB, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + nameB.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameB, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  const cd = concat(...central);
  const eo = new Uint8Array(22);
  const ev = new DataView(eo.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, cd, eo], { type: 'application/zip' });
}

// ---------- valid WAV (8-bit PCM, gentle two-tone chime) ----------
export function makeWav(seconds = 1.8, base = 330) {
  const rate = 8000;
  const n = Math.floor(rate * seconds);
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + n, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  wstr(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, t * 5) * Math.min(1, (seconds - t) * 2.5);
    const f = base * (1 + 0.5 * Math.max(0, Math.sin(2 * Math.PI * 0.8 * t)));
    const s = Math.sin(2 * Math.PI * f * t) * 0.45 + Math.sin(4 * Math.PI * f * t) * 0.12;
    buf[44 + i] = Math.max(0, Math.min(255, Math.round(128 + s * 127 * env)));
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ---------- SVG artwork (real images) ----------
export function makeSvg(inner, w = 880, h = 560) {
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`], { type: 'image/svg+xml' });
}
function screenshotSvg() {
  const bars = Array.from({ length: 14 }, (_, i) => {
    const w = 120 + ((i * 67) % 220);
    return `<rect x="220" y="${150 + i * 24}" width="${w}" height="9" rx="4.5" fill="#2c2c33"/>`;
  }).join('');
  return makeSvg(`
    <rect width="880" height="560" fill="#131316"/>
    <rect x="40" y="30" width="800" height="500" rx="14" fill="#1c1c21" stroke="#2c2c33" stroke-width="1.5"/>
    <rect x="40" y="30" width="800" height="42" rx="14" fill="#232329"/>
    <circle cx="66" cy="51" r="5.5" fill="#ff5f57"/><circle cx="86" cy="51" r="5.5" fill="#febc2e"/><circle cx="106" cy="51" r="5.5" fill="#28c840"/>
    <rect x="150" y="39" width="280" height="22" rx="6" fill="#2c2c33"/>
    <rect x="60" y="92" width="140" height="420" rx="10" fill="#202026"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="76" y="${112 + i * 46}" width="${90 + (i % 3) * 24}" height="10" rx="5" fill="${i === 1 ? '#4c8dff' : '#33333b'}"/>`).join('')}
    <rect x="220" y="120" width="590" height="26" rx="7" fill="#2c2c33"/>
    ${bars}
    <rect x="220" y="496" width="590" height="8" rx="4" fill="#26262c"/>`, 880, 560);
}
function campusSvg() {
  return makeSvg(`
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#20304d"/><stop offset="1" stop-color="#48566e"/>
      </linearGradient>
      <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#243247"/><stop offset="1" stop-color="#1a2334"/>
      </linearGradient>
    </defs>
    <rect width="880" height="560" fill="url(#sky)"/>
    <circle cx="680" cy="140" r="52" fill="#e8e3d5" opacity="0.9"/>
    <circle cx="660" cy="128" r="46" fill="#20304d" opacity="0.55"/>
    <path d="M0 380 Q 220 300 440 372 T 880 356 V 560 H 0 Z" fill="url(#hill)"/>
    <path d="M0 452 Q 260 396 520 452 T 880 440 V 560 H 0 Z" fill="#161f2e"/>
    <g fill="#10161f">
      <rect x="120" y="330" width="150" height="120" rx="4"/>
      <polygon points="120,332 195,286 270,332"/>
      <rect x="330" y="352" width="110" height="98" rx="4"/>
      <rect x="470" y="368" width="70" height="82" rx="4"/>
    </g>
    <g fill="#e8d9a0" opacity="0.85">
      <rect x="140" y="352" width="18" height="24" rx="2"/><rect x="176" y="352" width="18" height="24" rx="2"/><rect x="212" y="352" width="18" height="24" rx="2"/>
      <rect x="348" y="372" width="15" height="20" rx="2"/><rect x="382" y="372" width="15" height="20" rx="2"/>
    </g>
    <g stroke="#0d1420" stroke-width="7" stroke-linecap="round">
      <line x1="640" y1="560" x2="600" y2="430"/><line x1="720" y1="560" x2="688" y2="452"/>
    </g>
    <g fill="#0d1420">
      <ellipse cx="596" cy="428" rx="26" ry="10"/><ellipse cx="684" cy="450" rx="22" ry="9"/>
    </g>`, 880, 560);
}

// ---------- text content ----------
const PW_TEXT = `Personal lab notes — fictional demo data
========================================

Rules for the practice box:
  - No real credentials in this file, ever.
  - Use a manager (1Password / Bitwarden), not notes.
  - Rotate anything that looked at a real key.

Practice checklist
  [x] Enumerate services (nmap, tcp 22 80 443)
  [x] Identify software versions
  [ ] Subdomain enumeration
  [ ] Auth bypass exercises
  [ ] Report writing

Reminder: this file exists so the Vault demo has
something realistic to open. Everything above is made up.
`;
const MD_TEXT = `# Recon notes — demo

_Practice lab only. All targets are fictional._

## Scope
- Host: \`lab.example.internal\`
- Rules: no DoS, no social engineering, log everything.

## Findings
1. Web app responds in **12 ms** — same origin as the admin panel.
2. Version banners are disabled. Good.
3. One old API endpoint left open on :9090.

## Next
- [ ] Map the API surface
- [ ] Check auth on the forgotten endpoint
- [ ] Write it all up (see \`report-template.md\`)

> Keep notes boring and complete. A reviewer should be able
> to reproduce every step without calling you.
`;
const JS_TEXT = `// demo-app.js — sample source file for the Vault
const state = {
  items: [
    { id: 1, name: 'Cybersecurity Notes.pdf', size: 24128 },
    { id: 2, name: 'Screenshot.png', size: 48211 },
    { id: 3, name: 'website-source.zip', size: 15334 },
  ],
  query: '',
};

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let v = bytes, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
  return v.toFixed(1) + ' ' + units[i];
}

// Filter + sort, the way the file browser does it
export function visibleItems(sortBy = 'name') {
  const q = state.query.trim().toLowerCase();
  const list = state.items.filter((it) => !q || it.name.toLowerCase().includes(q));
  list.sort((a, b) =>
    sortBy === 'size' ? a.size - b.size : a.name.localeCompare(b.name)
  );
  return list;
}

visibleItems().forEach((it) => console.log(it.name, formatBytes(it.size)));
`;
const IDEAS_TEXT = `Loose ideas
-----------

- Morning block: inbox + plan (25 min)
- One deep-work block before lunch, phone in another room
- Friday review: what moved, what slipped, what next
- Read one paper before the weekend

Vault notes:
  - Keep this file at the root so it is always one tap away
  - Maybe a "Quick capture" folder?
`;
const BRIEF_TEXT = `PROJECT BRIEF
=============

Workstream: Vault mobile refresh
Owner: Product team
Status: Draft

1. Objective
   A fast, private file vault people actually open daily.

2. Scope
   - Upload with real progress and cancellation
   - PIN lock with sensible failure handling
   - Search that finds things in under a second
   - Trash that forgives

3. Non-goals
   - Sync/conflict UI (phase 2)
   - Team sharing (separate product)

4. Success
   - 90% of uploads finish without a retry
   - Median unlock-to-first-file time under 3 seconds
`;
const PLAN_TEXT = `STUDY PLAN — next two weeks
===========================

Focus: linear algebra + system design fundamentals

Week 1
  Mon/Wed/Fri  - 45 min vectors & matrices (10:00)
  Tue/Thu      - 30 min reading, one summary note
  Sat          - 1h mixed problem set, no peeking

Week 2
  Mon-Wed      - 45 min practice problems
  Thu          - 1h system design: caching & queues
  Fri          - Self-test + review of mistakes

Rules
  - Consistency beats marathon sessions
  - Log every session (this file)
  - One full rest day per week
`;
const REPORT_MD = `# Incident / recon report template

Date:
Analyst:
Scope:

## Summary
Two or three sentences. The result first.

## Timeline
| Time | Event |
|------|-------|
| 09:12 | Initial scan completed |
| 10:05 | Endpoint identified |

## Evidence
- Preserve raw output
- Screenshot each step
- Note tool version and flags

## Recommendations
1. Close the exposed endpoint
2. Add alerting on repeated auth failures
3. Re-test after remediation
`;

// ---------- demo tree ----------
// { id, name, parent (id|null), kind, ext, blob|text, fav, openedAgoHrs, modifiedAgoHrs }
const H = 3600_000;
const D = 24 * H;

export const DEMO_TREE = [
  // folders
  { id: 'd_docs', name: 'Documents', parent: null, folder: true, modifiedAgo: 2 * D },
  { id: 'd_school', name: 'School', parent: null, folder: true, modifiedAgo: 5 * D },
  { id: 'd_projects', name: 'Projects', parent: 'd_school', folder: true, modifiedAgo: 3 * D },
  { id: 'd_cyber', name: 'Cybersecurity', parent: 'd_projects', folder: true, modifiedAgo: 3 * D },
  { id: 'd_photos', name: 'Photos', parent: null, folder: true, modifiedAgo: 8 * D },
  // files
  { id: 'f_notes', name: 'Cybersecurity Notes.pdf', parent: 'd_docs', ext: 'pdf', kind: 'pdf', fav: true, openedAgo: 2 * H, modifiedAgo: 2 * D,
    blob: () => makePdf('Cybersecurity Notes', [
      'Personal study notes - practice lab (fictional content)',
      '',
      '1. Recon: enumerate hosts, services and versions before anything else.',
      '2. Auth: never brute force without written scope approval.',
      '3. Web: check for forgotten debug endpoints and old API paths.',
      '4. Reporting: boring and complete beats clever and short.',
      '',
      'Next: read the full audit checklist and map it to this plan.',
    ]) },
  { id: 'f_brief', name: 'Project Brief.docx', parent: 'd_docs', ext: 'docx', kind: 'doc', openedAgo: 26 * H, modifiedAgo: 4 * D,
    blob: () => makeZip([{ name: 'brief.txt', data: strBytes(BRIEF_TEXT) }]) },
  { id: 'f_preso', name: 'Presentation.pptx', parent: 'd_docs', ext: 'pptx', kind: 'slides', modifiedAgo: 6 * D,
    blob: () => makeZip([{ name: 'README.txt', data: strBytes('Demo slide deck placeholder (Vault sample content).\n') }]) },
  { id: 'f_invoice', name: 'Invoice - March.pdf', parent: 'd_docs', ext: 'pdf', kind: 'pdf', openedAgo: 90 * H, modifiedAgo: 20 * D,
    blob: () => makePdf('Invoice - March', [
      'From: Northwind Studio    To: You',
      'Service: Design retainer - March',
      '',
      'Subtotal: 1,800.00      VAT: 25%',
      'Total due: 2,250.00',
      '',
      'Thank you for your business.',
    ]) },
  { id: 'f_shot', name: 'Screenshot.png', parent: 'd_photos', ext: 'png', kind: 'image', fav: true, openedAgo: 5 * H, modifiedAgo: 8 * D,
    blob: () => screenshotSvg() },
  { id: 'f_campus', name: 'Campus at dusk.jpg', parent: 'd_photos', ext: 'jpg', kind: 'image', openedAgo: 3 * D, modifiedAgo: 9 * D,
    blob: () => campusSvg() },
  { id: 'f_math', name: 'Math Worksheet.pdf', parent: 'd_school', ext: 'pdf', kind: 'pdf', openedAgo: 2 * D, modifiedAgo: 12 * D,
    blob: () => makePdf('Linear Algebra - Worksheet', [
      '1. Reduce the matrix to row echelon form.',
      '2. Find the null space of A.',
      '3. Determine whether the vectors span R3.',
      '4. Diagonalize S and explain the steps in words.',
      '',
      'Show your work. The path matters as much as the answer.',
    ]) },
  { id: 'f_plan', name: 'Study Plan.docx', parent: 'd_school', ext: 'docx', kind: 'doc', openedAgo: 4 * D, modifiedAgo: 7 * D,
    blob: () => makeZip([{ name: 'plan.txt', data: strBytes(PLAN_TEXT) }]) },
  { id: 'f_pw', name: 'passwords.txt', parent: 'd_cyber', ext: 'txt', kind: 'text', openedAgo: 6 * H, modifiedAgo: 3 * D,
    text: PW_TEXT },
  { id: 'f_md', name: 'recon-notes.md', parent: 'd_cyber', ext: 'md', kind: 'code', openedAgo: 12 * H, modifiedAgo: 3 * D,
    text: MD_TEXT },
  { id: 'f_report_md', name: 'report-template.md', parent: 'd_cyber', ext: 'md', kind: 'code', modifiedAgo: 3 * D,
    text: REPORT_MD },
  { id: 'f_js', name: 'app.js', parent: 'd_cyber', ext: 'js', kind: 'code', fav: true, openedAgo: 1 * H, modifiedAgo: 3 * D,
    text: JS_TEXT },
  { id: 'f_zip', name: 'website-source.zip', parent: 'd_projects', ext: 'zip', kind: 'archive', openedAgo: 30 * H, modifiedAgo: 5 * D,
    blob: () => makeZip([
      { name: 'README.txt', data: strBytes('Demo web project (Vault sample content).\nRun: npm start\n') },
      { name: 'src/main.js', data: strBytes(JS_TEXT) },
      { name: 'notes/recon-notes.md', data: strBytes(MD_TEXT) },
    ]) },
  { id: 'f_wav', name: 'Voice memo.wav', parent: null, ext: 'wav', kind: 'audio', openedAgo: 8 * H, modifiedAgo: 4 * D,
    blob: () => makeWav() },
  { id: 'f_ideas', name: 'Ideas.txt', parent: null, ext: 'txt', kind: 'text', openedAgo: 7 * D, modifiedAgo: 30 * D,
    text: IDEAS_TEXT },
];

export function demoEntrySize(entry) {
  if (entry.folder) return 0;
  if (entry.text != null) return new TextEncoder().encode(entry.text).length;
  const b = entry.blob();
  return b.size;
}
