// Vault — shared UI: formatting, kind metadata, toasts, modals,
// confirm dialogs, context menus, drawers, empty states.

import { icon } from './icons.js';

// ---------- formatting ----------
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function fmtBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function relTime(ts) {
  if (!ts) return '—';
  const s = (Date.now() - ts) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(ts);
}
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------- file kinds ----------
export const KINDS = {
  image:   { label: 'Image', icon: 'image', hue: '#5b8def' },
  video:   { label: 'Video', icon: 'video', hue: '#9b7cf6' },
  audio:   { label: 'Audio', icon: 'audio', hue: '#2fb7a3' },
  archive: { label: 'Archive', icon: 'archive', hue: '#c99a4b' },
  code:    { label: 'Code', icon: 'code', hue: '#4fa36b' },
  pdf:     { label: 'PDF', icon: 'filePdf', hue: '#d05656' },
  doc:     { label: 'Document', icon: 'fileDoc', hue: '#4c8dff' },
  sheet:   { label: 'Spreadsheet', icon: 'fileSheet', hue: '#3fa66a' },
  slides:  { label: 'Presentation', icon: 'fileSlides', hue: '#e07b45' },
  text:    { label: 'Text', icon: 'fileText', hue: '#9a9aa3' },
  other:   { label: 'File', icon: 'fileGeneric', hue: '#8a8a93' },
  folder:  { label: 'Folder', icon: 'folder', hue: '#7d8db0' },
};
export function kindOf(rec) {
  if (rec.type === 'folder') return KINDS.folder;
  return KINDS[rec.kind] || KINDS.other;
}
export function kindIconHtml(rec, size = 20, lg = false) {
  const k = kindOf(rec);
  const c = rec.color || k.hue;
  const bg = `color-mix(in srgb, ${c} 14%, transparent)`;
  const fg = `color-mix(in srgb, ${c} 82%, var(--text))`;
  return `<span class="ficon ${lg ? 'lg' : ''}" style="background:${bg};color:${fg}">${icon(k.icon, lg ? 26 : 20)}</span>`;
}
export function detectKind(name) {
  const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
  const map = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image', bmp: 'image', avif: 'image',
    mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', m4v: 'video',
    mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive',
    pdf: 'pdf',
    doc: 'doc', docx: 'doc', rtf: 'doc', odt: 'doc', pages: 'doc',
    xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet', ods: 'sheet',
    ppt: 'slides', pptx: 'slides', key: 'slides', odp: 'slides',
    js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', rb: 'code', go: 'code', rs: 'code',
    java: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code', php: 'code', swift: 'code', kt: 'code',
    sh: 'code', bash: 'code', zsh: 'code', sql: 'code', css: 'code', scss: 'code', html: 'code', htm: 'code',
    json: 'code', xml: 'code', yaml: 'code', yml: 'code', toml: 'code', md: 'code', vue: 'code',
    txt: 'text', log: 'text',
  };
  const kind = map[ext] || 'other';
  return { kind, ext };
}
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'doc', label: 'Documents' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'archive', label: 'Archives' },
  { id: 'code', label: 'Code' },
];
export function matchesFilter(rec, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'folder') return rec.type === 'folder';
  if (rec.type === 'folder') return false;
  if (filter === 'doc') return ['doc', 'sheet', 'slides', 'pdf'].includes(rec.kind);
  return rec.kind === filter;
}

// ---------- toasts ----------
let toastSeq = 0;
export function toast(msg, opts = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${opts.type || ''}`;
  const icName = opts.icon || (opts.type === 'error' ? 'alert' : opts.type === 'success' ? 'check' : 'info');
  el.innerHTML = `<span class="t-ic">${icon(icName, 15)}</span><span class="t-msg">${esc(msg)}</span>`;
  if (opts.action) {
    const b = document.createElement('button');
    b.className = 't-act';
    b.textContent = opts.action.label;
    b.addEventListener('click', () => { opts.action.fn(); dismiss(); });
    el.appendChild(b);
  }
  root.appendChild(el);
  const dismiss = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  };
  setTimeout(dismiss, opts.timeout || 3600);
}

// ---------- modal ----------
let confirmResolver = null;
export function takeConfirmResolver() {
  const r = confirmResolver;
  confirmResolver = null;
  return r;
}
export function openModal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  const wide = opts.wide ? ' style="width:min(640px,100%)"' : '';
  root.innerHTML = `
    <div class="modal-backdrop" data-mclose></div>
    <div class="modal-wrap">
      <div class="modal" role="dialog" aria-modal="true"${wide}>
        <div class="modal-head">
          <h3>${opts.title || ''}</h3>
          <button class="icon-btn sm" data-mclose aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="modal-body">${html}</div>
        ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ''}
      </div>
    </div>`;
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  const f = root.querySelector('input, select, textarea, button:not([data-mclose])');
  if (f) setTimeout(() => f.focus(), 30);
}
export function closeModal() {
  const root = document.getElementById('modal-root');
  root.hidden = true;
  root.innerHTML = '';
  document.body.style.overflow = '';
  if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(false); }
}
export function isModalOpen() { return !document.getElementById('modal-root').hidden; }

export function askConfirm({ title, body, label = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    openModal(`
      <p style="font-size:13.5px;color:var(--text-2);line-height:1.6">${body}</p>`, {
      title,
      foot: `
        <button class="btn" data-mclose>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-yes">${label}</button>`,
    });
  });
}

// ---------- drawer (right side / bottom sheet) ----------
export function openDrawer(title, bodyHtml, opts = {}) {
  const root = document.getElementById('drawer-root');
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  root.innerHTML = `
    <div class="drawer-backdrop" data-dclose></div>
    <div class="drawer ${isMobile ? 'sheet' : ''} ${isMobile ? 'bottom-0 left-0 right-0 top-auto rounded-t-2xl flex-col max-h-[86vh] w-full' : ''}" role="dialog" aria-label="${esc(title)}"
      style="${isMobile ? 'position:absolute;inset:auto 0 0 0;height:auto;max-height:86vh;border-radius:20px 20px 0 0;border-left:none;border-bottom:none' : ''}">
      <div class="d-head"><h3>${title}</h3><button class="icon-btn sm" data-dclose aria-label="Close">${icon('x', 16)}</button></div>
      <div class="d-body">${bodyHtml}</div>
      ${opts.foot ? `<div class="d-foot">${opts.foot}</div>` : ''}
    </div>`;
  root.hidden = false;
  document.body.style.overflow = 'hidden';
}
export function closeDrawer() {
  const root = document.getElementById('drawer-root');
  root.hidden = true;
  root.innerHTML = '';
  document.body.style.overflow = '';
}
export function isDrawerOpen() { return !document.getElementById('drawer-root').hidden; }

// ---------- context menu ----------
export function openContextMenu(items, x, y) {
  const root = document.getElementById('ctx-root');
  const html = items.map((it, i) => {
    if (it.sep) return `<div class="ctx-sep"></div>`;
    return `<button class="ctx-item ${it.danger ? 'danger' : ''}" data-ctx="${i}" ${it.disabled ? 'disabled' : ''}>
      ${icon(it.icon || 'dots', 16)}<span>${esc(it.label)}</span>
      ${it.shortcut ? `<span class="ci-kbd"><span class="kbd">${it.shortcut}</span></span>` : ''}
    </button>`;
  }).join('');
  root.innerHTML = `<div class="ctx">${html}</div>`;
  root.hidden = false;
  const menu = root.firstChild;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const px = Math.min(x, window.innerWidth - mw - 10);
  const py = Math.min(y, window.innerHeight - mh - 10);
  menu.style.left = `${Math.max(8, px)}px`;
  menu.style.top = `${Math.max(8, py)}px`;
  root._items = items;
}
export function closeContextMenu() {
  const root = document.getElementById('ctx-root');
  root.hidden = true;
  root.innerHTML = '';
  root._items = null;
}
export function isCtxOpen() { return !document.getElementById('ctx-root').hidden; }

// ---------- empty state ----------
export function emptyState({ icon: ic = 'folder', title, sub, actions = [] }) {
  return `<div class="empty">
    <div class="e-ic">${icon(ic, 24)}</div>
    <b>${esc(title)}</b>
    ${sub ? `<p>${sub}</p>` : ''}
    ${actions.length ? `<div class="e-actions">${actions.map((a) =>
      `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-action="${a.action}" ${a.attrs || ''}>${a.icon ? icon(a.icon, 15) : ''} ${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
}

// ---------- skeleton ----------
export function skeletonGrid(n = 8) {
  return `<div class="skel-grid">${Array.from({ length: n }, () => `<div class="skel" style="height:150px"></div>`).join('')}</div>`;
}
