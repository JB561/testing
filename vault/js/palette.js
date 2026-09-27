// Vault — command palette (⌘K / Ctrl+K).

import { icon } from './icons.js';
import { esc, fmtBytes } from './ui.js';
import { state, allFiles, allFolders, fullPathText } from './store.js';

export function paletteActions() {
  const go = (hash) => () => { location.hash = hash; };
  return [
    { id: 'search', label: 'Search files', icon: 'search', kbd: '/', kw: 'find query lookup', run: () => document.getElementById('global-search')?.focus() },
    { id: 'upload', label: 'Upload files', icon: 'upload', kbd: 'U', kw: 'add import files', run: () => window.__vaultPick() },
    { id: 'newfolder', label: 'New folder', icon: 'folder', kbd: 'N', kw: 'create directory', run: () => window.__vaultNewFolder() },
    { id: 'home', label: 'Go to Home', icon: 'home', kbd: '', kw: 'dashboard overview', run: go('#/') },
    { id: 'files', label: 'Go to Files', icon: 'files', kbd: '', kw: 'browser all', run: go('#/files') },
    { id: 'favorites', label: 'Open Favorites', icon: 'star', kbd: '', kw: 'starred pinned', run: go('#/favorites') },
    { id: 'recent', label: 'Open Recent', icon: 'clock', kbd: '', kw: 'history opened', run: go('#/recent') },
    { id: 'trash', label: 'Open Trash', icon: 'trash', kbd: '', kw: 'deleted restore', run: go('#/trash') },
    { id: 'folders', label: 'Browse Folders', icon: 'folderOpen', kbd: '', kw: 'organize structure', run: go('#/folders') },
    { id: 'settings', label: 'Open Settings', icon: 'gear', kbd: '', kw: 'preferences security appearance', run: go('#/settings') },
    { id: 'lock', label: 'Lock vault', icon: 'lock', kbd: '', kw: 'secure close session', run: () => window.__vaultLock() },
    { id: 'view', label: 'Toggle grid / list view', icon: 'grid', kbd: '', kw: 'switch layout', run: () => window.__vaultToggleView() },
  ];
}

export function openPalette() {
  state.ui.paletteOpen = true;
  state.ui.paletteIndex = 0;
  renderPalette();
}
export function closePalette() {
  state.ui.paletteOpen = false;
  const root = document.getElementById('palette-root');
  root.hidden = true;
  root.innerHTML = '';
}
export function isPaletteOpen() { return state.ui.paletteOpen; }

export function paletteResults(q) {
  q = (q || '').trim().toLowerCase();
  const acts = paletteActions().filter((a) => !q || a.label.toLowerCase().includes(q) || (a.kw || '').includes(q)).slice(0, q ? 6 : 11);
  const items = [];
  const files = allFiles().filter((f) => !q || f.name.toLowerCase().includes(q) || (f.ext || '').includes(q));
  const folders = allFolders().filter((f) => !q || f.name.toLowerCase().includes(q));
  for (const f of files.slice(0, q ? 6 : 4)) items.push({ type: 'file', rec: f });
  for (const f of folders.slice(0, q ? 4 : 2)) items.push({ type: 'folder', rec: f });
  return { acts, items: items.slice(0, 8) };
}

function runItem(it) {
  closePalette();
  if (it.type === 'folder') {
    location.hash = '#/files/' + it.rec.id;
  } else {
    location.hash = '#/files' + (it.rec.parentId ? '/' + it.rec.parentId : '');
    window.__vaultOpenFile(it.rec.id);
  }
}
function runAction(a) {
  closePalette();
  a.run();
}

export function renderPalette() {
  const root = document.getElementById('palette-root');
  const input = document.getElementById('palette-input');
  const q = input ? input.value : '';
  const { acts, items } = paletteResults(q);
  const flat = [
    ...acts.map((a) => ({ kind: 'action', a })),
    ...items.map((it) => ({ kind: 'item', it })),
  ];
  if (state.ui.paletteIndex >= flat.length) state.ui.paletteIndex = 0;

  root.innerHTML = `
    <div class="palette-backdrop" data-pclose></div>
    <div class="palette" role="dialog" aria-label="Command palette">
      <div class="pal-input-row">
        ${icon('search', 17)}
        <input id="palette-input" autocomplete="off" spellcheck="false" placeholder="Type a command or search…" value="${esc(q)}" aria-label="Command" />
        <span class="kbd">esc</span>
      </div>
      <div class="pal-results" id="pal-results">
        ${flat.length === 0 ? `<div class="pal-empty">No matches for “${esc(q)}”.</div>` : `
          ${acts.length ? `<div class="pal-sec">Actions</div>` : ''}
          ${acts.map((a) => {
            const i = flat.findIndex((f) => f.kind === 'action' && f.a.id === a.id);
            return `<div class="pal-item ${i === state.ui.paletteIndex ? 'active' : ''}" data-pal="action" data-id="${a.id}">
              <span class="pi-ic">${icon(a.icon, 15)}</span>
              <div class="pi-main"><div class="pi-label">${esc(a.label)}</div></div>
              ${a.kbd ? `<span class="pi-right"><span class="kbd">${a.kbd}</span></span>` : ''}
            </div>`;
          }).join('')}
          ${items.length ? `<div class="pal-sec">Files &amp; folders</div>` : ''}
          ${items.map((it) => {
            const i = flat.findIndex((f) => f.kind === 'item' && f.it.rec.id === it.rec.id);
            const r = it.rec;
            return `<div class="pal-item ${i === state.ui.paletteIndex ? 'active' : ''}" data-pal="item" data-id="${r.id}">
              <span class="pi-ic">${icon(it.type === 'folder' ? 'folder' : iconForKind(r), 15)}</span>
              <div class="pi-main"><div class="pi-label">${esc(r.name)}</div>
              <div class="pi-sub">${it.type === 'folder' ? 'Folder' : `${r.ext?.toUpperCase() || ''} · ${fmtBytes(r.size)}`}</div></div>
              <span class="pi-right"><span class="pi-sub" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${esc(fullPathText(r))}</span></span>
            </div>`;
          }).join('')}`
        }
      </div>
      <div class="pal-foot">
        <span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span>
        <span><span class="kbd">↵</span> open</span>
        <span><span class="kbd">esc</span> close</span>
      </div>
    </div>`;
  root.hidden = false;
  const ni = root.querySelector('#palette-input');
  if (ni) {
    ni.focus();
    ni.setSelectionRange(ni.value.length, ni.value.length);
  }
  // item clicks (keep the palette open-state logic local)
  root.querySelectorAll('.pal-item').forEach((el) => {
    el.addEventListener('click', () => {
      const input = document.getElementById('palette-input');
      const res = paletteResults(input ? input.value : '');
      const flat = [...res.acts.map((a) => ({ kind: 'action', a })), ...res.items.map((x) => ({ kind: 'item', it: x }))];
      const isAction = el.dataset.pal === 'action';
      const idx = flat.findIndex((f) =>
        isAction ? f.kind === 'action' && f.a.id === el.dataset.id
                 : f.kind === 'item' && f.it.rec.id === el.dataset.id);
      if (idx < 0) return;
      const f = flat[idx];
      f.kind === 'action' ? runAction(f.a) : runItem(f.it);
    });
  });
}
function iconForKind(r) {
  const map = { image: 'image', video: 'video', audio: 'audio', archive: 'archive', code: 'code', pdf: 'filePdf', doc: 'fileDoc', sheet: 'fileSheet', slides: 'fileSlides', text: 'fileText' };
  return map[r.kind] || 'fileGeneric';
}

export function paletteKey(e, key) {
  // key: 'down' | 'up' | 'enter'
  const input = document.getElementById('palette-input');
  const { acts, items } = paletteResults(input ? input.value : '');
  const flat = [...acts.map((a) => ({ kind: 'action', a })), ...items.map((it) => ({ kind: 'item', it }))];
  if (!flat.length) return;
  if (key === 'down') state.ui.paletteIndex = (state.ui.paletteIndex + 1) % flat.length;
  if (key === 'up') state.ui.paletteIndex = (state.ui.paletteIndex - 1 + flat.length) % flat.length;
  if (key === 'enter') {
    const f = flat[state.ui.paletteIndex];
    if (f) f.kind === 'action' ? runAction(f.a) : runItem(f.it);
    return;
  }
  // move highlight
  document.querySelectorAll('.pal-item').forEach((el, i) => {
    el.classList.toggle('active', i === state.ui.paletteIndex);
  });
  const active = document.querySelector('.pal-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}
