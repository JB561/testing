// Vault — app core: bootstrap, router, shell, global interactions.

import { icon, vaultMark } from './icons.js';
import {
  esc, fmtBytes, fmtDate, fmtDateTime, relTime, kindOf, kindIconHtml,
  toast, openModal, closeModal, askConfirm, takeConfirmResolver,
  openDrawer, closeDrawer,
  openContextMenu, closeContextMenu, isCtxOpen, isModalOpen, isDrawerOpen,
} from './ui.js';
import {
  state, A, init, rec, applyThemeAttrs,
  storageStats, allFiles, allFolders, fullPathText, childrenOf, isDescendant, CAPACITY_GB,
  pushRecentSearch, clearRecentSearches, trashedItems,
} from './store.js';
import { lockScreenHTML } from './views/lock.js';
import { dashboardHTML } from './views/dashboard.js';
import { browserHTML, syncSelectionDom, currentModeFromRoute } from './views/files.js';
import { foldersHTML, folderModalHTML, FOLDER_COLORS } from './views/folders.js';
import { settingsHTML } from './views/settings.js';
import { openPreview, closePreview } from './preview.js';
import { openUploads, uploadDrawerBody, pickFiles, closeUploads } from './upload.js';
import { openPalette, closePalette, isPaletteOpen, renderPalette, paletteKey } from './palette.js';
import { verifyPin } from './crypto.js';

// ---------------------------------------------------------------- bootstrap
init().then(() => {
  loadLockState();
  applyThemeAttrs();
  render();
  window.__vaultPick = (dest) => pickFiles(dest ?? (state.ui.route.startsWith('/files') ? state.ui.folderId : null));
  window.__vaultNewFolder = (dest) => openFolderModal(state.ui.route.startsWith('/files') ? state.ui.folderId : null, 'create');
  window.__vaultLock = () => doLock();
  window.__vaultToggleView = () => {
    const next = (state.ui.viewMode || state.settings.defaultView) === 'grid' ? 'list' : 'grid';
    state.ui.viewMode = next;
    render();
  };
  window.__vaultOpenFile = (id) => openPreview(id);
  bindGlobalEvents();
}).catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML = `
    <div class="empty" style="padding-top:120px">
      <div class="e-ic">${icon('alert', 26)}</div>
      <b>Couldn’t open your vault</b>
      <p>Local storage is unavailable in this browser, so Vault can’t start. Try a different browser or clear site data.</p>
      <div class="e-actions"><button class="btn btn-primary" onclick="location.reload()">Reload</button></div>
    </div>`;
});

// ---------------------------------------------------------------- router
function parseRoute() {
  let h = location.hash.replace(/^#/, '') || '/';
  const [pathPart] = h.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  const base = '/' + (segs[0] || '');
  const param = segs[1] || null;
  return { path: base, param };
}

const ROUTE_TITLES = {
  '/': 'Home', '/files': 'Files', '/favorites': 'Favorites', '/recent': 'Recent',
  '/trash': 'Trash', '/folders': 'Folders', '/settings': 'Settings',
};

function render() {
  const app = document.getElementById('app');
  if (!state.ready) return;
  clearLockoutTicker();

  if (!state.session.unlocked) {
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = lockScreenHTML();
    if (state.session.lockoutUntil > Date.now()) startLockoutTicker();
    return;
  }

  const { path, param } = parseRoute();
  state.ui.route = path;

  // folder for files route
  if (path.startsWith('/files')) {
    if (param) {
      const f = rec(param);
      if (!f || f.type !== 'folder' || f.trashedAt) { state.ui.folderId = null; }
      else state.ui.folderId = param;
    } else state.ui.folderId = null;
  }

  const inner = viewHtml();
  app.setAttribute('aria-busy', 'false');
  app.innerHTML = shellHtml(inner);
  afterRender();
}

function viewHtml() {
  const p = state.ui.route;
  if (p === '/') return dashboardHTML();
  if (p.startsWith('/files')) return browserHTML('files');
  if (p.startsWith('/favorites')) return browserHTML('favorites');
  if (p.startsWith('/recent')) return browserHTML('recent');
  if (p.startsWith('/trash')) return browserHTML('trash');
  if (p.startsWith('/folders')) return foldersHTML();
  if (p.startsWith('/settings')) return settingsHTML();
  return dashboardHTML();
}

function afterRender() {
  // overlays that live outside #app
  if (state.ui.drawer === 'upload') {
    if (!isDrawerOpen()) openDrawer('Uploads', uploadDrawerBody(), { foot: `<button class="btn btn-block" data-action="close-upload-drawer">Done</button>` });
    else {
      const body = document.querySelector('#drawer-root .d-body');
      if (body) body.innerHTML = uploadDrawerBody();
    }
  } else if (state.ui.drawer === 'details' && state.ui.detailsId) {
    syncDetailsDrawer();
  }
  // restore search focus/caret
  if (state.ui.searchFocus) {
    const el = document.getElementById('global-search');
    if (el) { el.focus(); if (state.ui.searchFocus.pos != null) { try { el.setSelectionRange(state.ui.searchFocus.pos, state.ui.searchFocus.pos); } catch { /* noop */ } } }
    state.ui.searchFocus = null;
  }
}

// ---------------------------------------------------------------- shell
function navItemsHtml() {
  const p = state.ui.route;
  const st = storageStats();
  const trashed = trashedItems().length;
  const favs = state.storage.favs;
  const item = (route, iconN, label, count, current) => `
    <a class="nav-item ${current ? 'active' : ''}" href="${route}" ${current ? 'aria-current="page"' : ''}>
      ${icon(iconN, 17)} ${label}
      ${count ? `<span class="count ${count > 9 ? 'hot' : ''}">${count}</span>` : ''}
    </a>`;
  return `
    <nav class="side-nav" style="flex:1;overflow-y:auto">
      <div class="nav-sec">Vault</div>
      ${item('#/', 'home', 'Home', 0, p === '/')}
      ${item('#/files', 'files', 'Files', 0, p.startsWith('/files'))}
      ${item('#/favorites', 'star', 'Favorites', favs, p.startsWith('/favorites'))}
      ${item('#/recent', 'clock', 'Recent', 0, p.startsWith('/recent'))}
      ${item('#/trash', 'trash', 'Trash', trashed, p.startsWith('/trash'))}
      <div class="nav-sec">Organize</div>
      ${item('#/folders', 'folderOpen', 'Folders', 0, p.startsWith('/folders'))}
      <div class="nav-sec">System</div>
      ${item('#/settings', 'gear', 'Settings', 0, p.startsWith('/settings'))}
    </nav>`;
}

function storageMiniHtml() {
  const st = storageStats();
  const pct = Math.max(1, Math.min(100, (st.used / (CAPACITY_GB * 1024 ** 3)) * 100));
  return `
    <div class="side-foot">
      <div class="storage-mini">
        <div class="sm-top"><span><b>${fmtBytes(st.used)}</b> of ${CAPACITY_GB} GB</span></div>
        <div class="mini-bar"><span style="width:${pct}%"></span></div>
        <div class="sec-line">${icon('shield', 13)} Vault protected · files stay on this device</div>
      </div>
    </div>`;
}

function shellHtml(inner) {
  const st = storageStats();
  const mobItem = (route, iconN, label, current) =>
    `<button data-mobnav="${route}" class="${current ? 'active' : ''}" aria-label="${label}">${icon(iconN, 19)}<span>${label}</span></button>`;
  return `
  <div class="shell">
    <aside class="sidebar" aria-label="Main navigation">
      <div class="brand">
        <span style="color:var(--text)">${vaultMark(34)}</span>
        <div><div class="brand-name">Vault</div><div class="brand-tag">Local file vault</div></div>
      </div>
      ${navItemsHtml()}
      ${storageMiniHtml()}
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-action="toggle-mobnav" aria-label="Open navigation">${icon('menu', 19)}</button>
        <div class="gsearch">
          ${icon('search', 15)}
          <input id="global-search" type="search" placeholder="Search files, folders, types…" aria-label="Search Vault" autocomplete="off" spellcheck="false" />
          <span class="gs-kbd"><span class="kbd">/</span></span>
          <div class="search-panel" id="search-panel" hidden></div>
        </div>
        <div class="tb-spacer"></div>
        <button class="icon-btn" data-action="open-palette" title="Command palette (⌘K)" aria-label="Command palette">
          ${icon('command', 17)}
        </button>
        <button class="icon-btn" data-action="lock" title="Lock vault" aria-label="Lock vault">${icon('lock', 17)}</button>
      </header>
      <div class="content" id="content">
        <div class="view">${inner}</div>
      </div>
    </div>
    <nav class="mobnav" aria-label="Mobile navigation">
      ${mobItem('#/', 'home', 'Home', state.ui.route === '/')}
      ${mobItem('#/files', 'files', 'Files', state.ui.route.startsWith('/files'))}
      ${mobItem('#/favorites', 'star', 'Favorites', state.ui.route.startsWith('/favorites'))}
      ${mobItem('#/trash', 'trash', 'Trash', state.ui.route.startsWith('/trash'))}
      ${mobItem('#/settings', 'gear', 'Settings', state.ui.route.startsWith('/settings'))}
    </nav>
    <div class="drawer-nav" id="drawer-nav" aria-label="Navigation">
      <div class="brand">
        <span style="color:var(--text)">${vaultMark(34)}</span>
        <div><div class="brand-name">Vault</div><div class="brand-tag">Local file vault</div></div>
        <button class="icon-btn sm" data-action="toggle-mobnav" style="margin-left:auto" aria-label="Close navigation">${icon('x', 16)}</button>
      </div>
      ${navItemsHtml()}
      ${storageMiniHtml()}
    </div>
    <div class="scrim" id="scrim" data-action="toggle-mobnav"></div>
  </div>`;
}

// ---------------------------------------------------------------- global search
function searchResultsHtml() {
  const q = (state.ui.search || '').trim().toLowerCase();
  const f = state.ui.searchFilter || 'all';
  const panel = document.getElementById('search-panel');
  if (!panel) return;

  if (!q) {
    const recent = state.ui.recentSearches;
    if (!recent.length) {
      panel.innerHTML = `<div class="sp-empty"><b>Search your vault</b>Type a file name, extension or type — e.g. “invoice”, “pdf”, “photos”.</div>`;
    } else {
      panel.innerHTML = `
        <div class="sp-head"><b>Recent searches</b><button data-action="search-clear-recent">Clear</button></div>
        ${recent.map((r) => `
          <div class="sp-item sp-recent-clear" data-action="search-use" data-q="${esc(r)}">
            ${icon('clock', 14)}
            <div class="si-main"><div class="si-name" style="font-weight:560">${esc(r)}</div></div>
            <button class="icon-btn sm" data-action="search-del" data-q="${esc(r)}" aria-label="Remove ${esc(r)}">${icon('x', 12)}</button>
          </div>`).join('')}`;
    }
    return;
  }

  const files = allFiles().filter((r) =>
    r.name.toLowerCase().includes(q) ||
    (r.ext || '').toLowerCase().includes(q) ||
    kindOf(r).label.toLowerCase().includes(q) ||
    (r.kind || '').includes(q));
  const folders = allFolders().filter((r) => r.name.toLowerCase().includes(q));
  let list = [
    ...files.map((r) => ({ type: 'file', r })),
    ...folders.map((r) => ({ type: 'folder', r })),
  ];
  if (f === 'folder') list = list.filter((x) => x.type === 'folder');
  else if (f !== 'all') list = list.filter((x) => x.type === 'file' && (f === 'doc' ? ['doc', 'sheet', 'slides', 'pdf'].includes(x.r.kind) : x.r.kind === f));

  const row = (x, i) => {
    const r = x.r;
    return `<div class="sp-item" data-action="search-open" data-id="${r.id}" data-type="${x.type}">
      ${kindIconHtml(r, 16)}
      <div class="si-main">
        <div class="si-name">${esc(r.name)}</div>
        <div class="si-sub">${fullPathText(r)}</div>
      </div>
      <span class="si-meta">${x.type === 'folder' ? 'Folder' : `${kindOf(r).label} · ${fmtBytes(r.size)}`}</span>
    </div>`;
  };

  panel.innerHTML = `
    <div class="sp-head"><b>${list.length} result${list.length === 1 ? '' : 's'} for “${esc(state.ui.search.trim())}”</b></div>
    <div class="sp-chips">
      ${[['all', 'All'], ['image', 'Images'], ['doc', 'Documents'], ['video', 'Videos'], ['pdf', 'PDFs'], ['folder', 'Folders']].map(([id, label]) =>
        `<button class="chip ${f === id ? 'active' : ''}" data-action="search-filter" data-filter="${id}">${label}</button>`).join('')}
    </div>
    ${list.length ? list.slice(0, 30).map(row).join('') : `
      <div class="sp-empty"><b>No results</b>Try a different filename or filter.</div>`}`;
}

function openSearchPanel() { searchResultsHtml(); const p = document.getElementById('search-panel'); if (p) p.hidden = false; }
function closeSearchPanel() { const p = document.getElementById('search-panel'); if (p) p.hidden = true; }

// ---------------------------------------------------------------- overlays: details drawer
function detailsDrawerBody(r) {
  const k = kindOf(r);
  const c = r.color || k.hue;
  return `
    <div class="detail-hero">
      <span class="ficon lg" style="background:color-mix(in srgb, ${c} 15%, transparent);color:${c}">${icon(k.icon, 26)}</span>
      <div class="dh-name">${esc(r.name)}</div>
      <div class="dh-sub">${k.label}${r.demo ? ' · sample content' : ''}</div>
    </div>
    <div class="kv"><span class="k">Type</span><span class="v">${k.label}${r.ext ? ` (.${esc(r.ext)})` : ''}</span></div>
    ${r.type === 'file' ? `<div class="kv"><span class="k">Size</span><span class="v">${fmtBytes(r.size)}</span></div>` : `<div class="kv"><span class="k">Contents</span><span class="v">${childrenOf(r.id).length} items</span></div>`}
    <div class="kv"><span class="k">Created</span><span class="v">${fmtDateTime(r.createdAt)}</span></div>
    <div class="kv"><span class="k">Modified</span><span class="v">${fmtDateTime(r.modifiedAt)}</span></div>
    ${r.openedAt ? `<div class="kv"><span class="k">Last opened</span><span class="v">${fmtDateTime(r.openedAt)}</span></div>` : ''}
    <div class="kv"><span class="k">Location</span><span class="v">${esc(fullPathText(r))}</span></div>
    <div class="detail-actions">
      <button class="btn" data-action="rename" data-id="${r.id}">${icon('edit', 14)} Rename</button>
      <button class="btn" data-action="move" data-id="${r.id}">${icon('move', 14)} Move</button>
      <button class="btn" data-action="copy" data-id="${r.id}">${icon('copy', 14)} Copy</button>
      ${r.type === 'file' ? `<button class="btn" data-action="dl" data-id="${r.id}">${icon('download', 14)} Download</button>` : ''}
      <button class="btn" data-action="fav" data-id="${r.id}">${icon('star', 14)} ${r.favorite ? 'Unfavorite' : 'Favorite'}</button>
      ${r.trashedAt
        ? `<button class="btn" data-action="restore" data-id="${r.id}">${icon('restore', 14)} Restore</button>`
        : `<button class="btn btn-danger" data-action="trash" data-id="${r.id}">${icon('trash', 14)} Delete</button>`}
    </div>`;
}
function openDetails(id) {
  const r = rec(id);
  if (!r) return;
  state.ui.drawer = 'details';
  state.ui.detailsId = id;
  openDrawer('Details', detailsDrawerBody(r));
}
function syncDetailsDrawer() {
  const r = rec(state.ui.detailsId);
  if (!r) { closeDrawer(); state.ui.drawer = null; state.ui.detailsId = null; return; }
  const body = document.querySelector('#drawer-root .d-body');
  if (body) body.innerHTML = detailsDrawerBody(r);
}

// ---------------------------------------------------------------- modals
function openFolderModal(parentId, mode, id = null) {
  state.ui.folderModal = { mode, parentId, id };
  openModal(
    folderModalHTML(),
    {
      title: mode === 'create' ? 'New folder' : 'Edit folder',
      foot: `
        <div style="display:flex;gap:9px;width:100%">
          ${mode === 'edit' ? `<button class="btn btn-danger" data-action="folder-delete" data-id="${id}" style="margin-right:auto">${icon('trash', 14)} Delete</button>` : ''}
          <button class="btn" data-mclose>Cancel</button>
          <button class="btn btn-primary" data-action="submit-folder" data-mode="${mode}" data-id="${id || ''}" data-parent="${parentId || ''}">${mode === 'create' ? 'Create' : 'Save'}</button>
        </div>`,
    });
  setTimeout(() => document.getElementById('fn-name')?.focus(), 40);
}

function openRename(id) {
  const r = rec(id);
  if (!r) return;
  state.ui.renameModal = { id };
  openModal(`
    <div class="field" style="margin-bottom:4px">
      <label for="rn-name">Name</label>
      <input class="input" id="rn-name" value="${esc(r.name)}" maxlength="120" />
      <span class="hint">Keep the extension if you want the file type unchanged.</span>
    </div>`, {
    title: 'Rename',
    foot: `
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn btn-primary" data-action="submit-rename" data-id="${id}">Rename</button>`,
  });
  setTimeout(() => {
    const el = document.getElementById('rn-name');
    if (el) { el.focus(); const dot = r.name.lastIndexOf('.'); el.setSelectionRange(0, dot > 0 ? dot : r.name.length); }
  }, 40);
}

function openMove(id) {
  const r = rec(id);
  if (!r) return;
  state.ui.moveModal = { id };
  const options = [{ id: '', name: state.settings.vaultName + ' (root)', depth: 0 }];
  const build = (parentId, depth) => {
    const kids = allFolders().filter((f) => f.parentId === parentId && !isDescendant(id, f.id) && f.id !== id);
    for (const f of kids.sort((a, b) => a.name.localeCompare(b.name))) {
      options.push({ id: f.id, name: f.name, depth });
      build(f.id, depth + 1);
    }
  };
  build(null, 1);
  const current = r.parentId || '';
  openModal(`
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:6px;margin-bottom:6px">
      ${options.map((o) => `
        <label class="sp-item" style="cursor:pointer">
          <input type="radio" name="move-dest" value="${o.id}" ${o.id === current ? 'checked' : ''} style="accent-color:var(--accent)" />
          <span style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">
            ${icon('folder', 15)}
            <span style="padding-left:${(o.depth - 1) * 16}px">${esc(o.name)}</span>
          </span>
        </label>`).join('')}
    </div>
    <div class="hint" style="font-size:11.5px;color:var(--text-3)">“${esc(r.name)}” will move to the selected folder.</div>`, {
    title: 'Move to…',
    foot: `
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn btn-primary" data-action="submit-move" data-id="${id}">${icon('move', 14)} Move</button>`,
  });
}

function openChangePin() {
  const hasPin = !!state.settings.pinHash;
  openModal(`
    ${hasPin ? `<div class="field">
      <label for="cp-cur">Current PIN</label>
      <input class="input" id="cp-cur" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••" style="letter-spacing:.35em" />
    </div>` : ''}
    <div class="field">
      <label for="cp-new">New PIN</label>
      <input class="input" id="cp-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="4–6 digits" style="letter-spacing:.35em" />
      <span class="hint">A 4–6 digit number. Never shown or stored in plain text.</span>
    </div>
    <div class="field">
      <label for="cp-conf">Confirm new PIN</label>
      <input class="input" id="cp-conf" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="Repeat PIN" style="letter-spacing:.35em" />
    </div>
    <div class="form-error" id="cp-err" hidden></div>`, {
    title: hasPin ? 'Change PIN' : 'Set PIN',
    foot: `
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn btn-primary" data-action="submit-pin-change">${hasPin ? 'Change PIN' : 'Set PIN'}</button>`,
  });
}

function openForgotPin() {
  openModal(`
    <p style="font-size:13.5px;color:var(--text-2);line-height:1.65">
      Vault keeps your files only on this device and stores just a one-way hash of your PIN —
      there is no server, no recovery email and no “forgot PIN” reset.
    </p>
    <p style="font-size:13.5px;color:var(--text-2);line-height:1.65;margin-top:10px">
      If you can’t remember your PIN, the only option is to erase the vault and start fresh.
      Everything on this device will be deleted.
    </p>`, {
    title: 'Forgot PIN?',
    foot: `
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn btn-danger" data-action="wipe">${icon('trash', 14)} Erase vault</button>`,
  });
}

// ---------------------------------------------------------------- item ops
export async function downloadItem(id) {
  const r = rec(id);
  if (!r) return;
  if (r.type === 'folder') { toast('Folders can’t be downloaded here', { type: 'info' }); return; }
  const blob = await state.db.get('blobs', r.contentId).catch(() => null);
  if (!blob) { toast('File content is unavailable on this device', { type: 'error', icon: 'alert' }); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = r.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Downloading “${r.name}”`, { type: 'success', icon: 'download' });
}

function openItem(id) {
  const r = rec(id);
  if (!r) return;
  if (r.trashedAt) { toast('This item is in Trash', { type: 'info' }); return; }
  A.open(id);
  if (r.type === 'folder') {
    location.hash = '#/files/' + r.id;
    if (location.hash === '#/files/' + r.id) render();
  } else {
    openPreview(id);
  }
  renderIfVisible();
}
function renderIfVisible() {
  // update openedAt-related views without disturbing a modal
  if (state.ui.route.startsWith('/recent') || state.ui.route === '/') render();
}

function selectOnly(id) { state.ui.selection = new Set([id]); state.ui.lastClickIndex = null; }
function clearSelection() { state.ui.selection.clear(); state.ui.lastClickIndex = null; }

function orderedItems() {
  // current visible order (mirrors browser sorting, without re-sort code drift)
  const mode = currentModeFromRoute();
  const M = { files: () => childrenOf(state.ui.folderId), favorites: () => allFiles().concat(allFolders()).filter((r) => r.favorite && !r.trashedAt), recent: () => allFiles().filter((r) => r.openedAt && !r.trashedAt).sort((a, b) => b.openedAt - a.openedAt), trash: () => trashedItems() }[mode];
  return M();
}

function handleItemClick(el, e) {
  const id = el.dataset.id;
  const mode = currentModeFromRoute();
  const ordered = orderedItems();
  const idx = ordered.findIndex((r) => r.id === id);
  if (e.shiftKey && state.ui.lastClickIndex != null) {
    const [a, b] = [Math.min(state.ui.lastClickIndex, idx), Math.max(state.ui.lastClickIndex, idx)];
    const set = new Set(state.ui.selection);
    for (let i = a; i <= b; i++) if (ordered[i]) set.add(ordered[i].id);
    state.ui.selection = set;
  } else if (e.metaKey || e.ctrlKey) {
    const set = new Set(state.ui.selection);
    if (set.has(id)) set.delete(id); else set.add(id);
    state.ui.selection = set;
    state.ui.lastClickIndex = idx;
  } else if (state.ui.selection.size > 1 && state.ui.selection.has(id)) {
    state.ui.selection.clear();
  } else {
    selectOnly(id);
    state.ui.lastClickIndex = idx;
  }
  syncSelectionDom();
}

function fileContextMenuItems(id) {
  const r = rec(id);
  if (!r) return [];
  const trashed = !!r.trashedAt;
  const items = [];
  if (!trashed) {
    items.push({ label: 'Open', icon: 'chevR', run: () => openItem(id) });
    if (r.type === 'file') items.push({ label: 'Preview', icon: 'eye', run: () => openPreview(id) });
    if (r.type === 'file') items.push({ label: 'Download', icon: 'download', run: () => downloadItem(id) });
    items.push({ label: 'Copy', icon: 'copy', run: () => { A.copy(id); toast(`Copied “${r.name}”`, { type: 'success' }); render(); } });
    items.push({ label: 'Move', icon: 'move', run: () => openMove(id) });
    items.push({ label: 'Rename', icon: 'edit', run: () => openRename(id) });
    items.push({ label: r.favorite ? 'Remove from Favorites' : 'Add to Favorites', icon: 'star', run: () => { A.toggleFav(id); toast(r.favorite ? 'Removed from favorites' : 'Added to favorites', { type: 'success', icon: 'star' }); render(); } });
    items.push({ label: 'Details', icon: 'info', run: () => openDetails(id) });
    items.push({ sep: true });
    items.push({ label: 'Move to Trash', icon: 'trash', danger: true, shortcut: 'Del', run: () => trashWithUndo(id) });
  } else {
    items.push({ label: 'Restore', icon: 'restore', run: () => { A.restore(id); toast(`Restored “${r.name}”`, { type: 'success', icon: 'restore' }); render(); } });
    items.push({ label: 'Details', icon: 'info', run: () => openDetails(id) });
    items.push({ sep: true });
    items.push({ label: 'Delete Forever', icon: 'trash', danger: true, shortcut: 'Del', run: () => destroyWithConfirm(id) });
  }
  return items;
}

async function trashWithUndo(id) {
  const r = rec(id);
  if (!r) return;
  A.trash(id);
  render();
  toast(`Moved “${r.name}” to Trash`, { type: 'info', icon: 'trash', action: { label: 'Undo', fn: () => { A.restore(id); toast('Restored', { type: 'success' }); render(); } } });
}
async function destroyWithConfirm(id) {
  const r = rec(id);
  const ok = await askConfirm({
    title: 'Delete forever?',
    body: `“${esc(r?.name)}” will be permanently removed from this device. This can’t be undone.`,
    label: 'Delete forever', danger: true,
  });
  if (!ok) return;
  A.deleteForever(id);
  toast('Deleted forever', { type: 'info', icon: 'trash' });
  render();
}

// ---------------------------------------------------------------- selection ops
function sel() { return [...state.ui.selection]; }
function selOp(action) {
  const ids = sel();
  if (!ids.length) return;
  const mode = currentModeFromRoute();
  if (action === 'trash') {
    const names = ids.length === 1 ? `“${rec(ids[0])?.name}”` : `${ids.length} items`;
    A.trashMany(ids);
    render();
    toast(`${names.length > 60 ? ids.length + ' items' : names} moved to Trash`, { type: 'info', icon: 'trash' });
  } else if (action === 'restore') {
    ids.forEach((i) => A.restore(i));
    render();
    toast(ids.length === 1 ? 'Restored' : `${ids.length} items restored`, { type: 'success', icon: 'restore' });
  } else if (action === 'destroy') {
    askConfirm({
      title: `Delete ${ids.length} item${ids.length === 1 ? '' : 's'} forever?`,
      body: 'They will be permanently removed from this device. This can’t be undone.',
      label: 'Delete forever', danger: true,
    }).then((ok) => { if (ok) { ids.forEach((i) => A.deleteForever(i)); render(); toast('Deleted forever', { type: 'info' }); } });
  } else if (action === 'move') {
    if (ids.length === 1) openMove(ids[0]);
    else toast('Select a single item to move', { type: 'info' });
  } else if (action === 'copy') {
    ids.forEach((i) => A.copy(i));
    render();
    toast(ids.length === 1 ? 'Copied' : `${ids.length} items copied`, { type: 'success', icon: 'copy' });
  } else if (action === 'fav') {
    ids.forEach((i) => A.toggleFav(i));
    render();
    toast('Favorites updated', { type: 'success', icon: 'star' });
  } else if (action === 'download') {
    downloadItem(ids[0]);
  } else if (action === 'open') {
    openItem(ids[0]);
  }
}

// ---------------------------------------------------------------- lock flow
let lockoutTimer = null;
function startLockoutTicker() {
  lockoutTimer = setInterval(() => {
    const el = document.getElementById('lock-err');
    const count = document.querySelector('.lock-count');
    const until = state.session.lockoutUntil;
    if (until <= Date.now()) {
      clearInterval(lockoutTimer);
      state.session.lockoutUntil = 0;
      persistLockState();
      render();
      return;
    }
    if (count) count.textContent = `Try again in ${Math.ceil((until - Date.now()) / 1000)}s`;
  }, 500);
}
function clearLockoutTicker() { if (lockoutTimer) { clearInterval(lockoutTimer); lockoutTimer = null; } }
function persistLockState() {
  try { localStorage.setItem('vault:lock', JSON.stringify({ fails: state.session.failed, until: state.session.lockoutUntil })); } catch { /* noop */ }
}
function loadLockState() {
  try {
    const raw = localStorage.getItem('vault:lock');
    if (raw) {
      const o = JSON.parse(raw);
      state.session.failed = o.fails || 0;
      state.session.lockoutUntil = (o.until || 0) > Date.now() ? o.until : 0;
    }
  } catch { /* noop */ }
}

function updateLockDom() {
  const slots = document.getElementById('pin-slots');
  const err = document.getElementById('lock-err');
  const submit = document.querySelector('[data-action="pin-submit"]');
  const pin = state.ui.lockPin || '';
  const showPin = !!state.ui.lockShowPin;
  if (slots) {
    slots.innerHTML = Array.from({ length: 6 }, (_, i) => {
      const filled = i < pin.length;
      const ch = showPin && filled ? `<span class="pin-char">${pin[i]}</span>` : (filled ? '<span class="pin-char hide-char"></span>' : '');
      return `<span class="pin-slot ${filled ? 'filled' : ''}">${ch}</span>`;
    }).join('');
  }
  if (submit) submit.disabled = pin.length < 4;
}
function lockError(msg, shake = true) {
  const err = document.getElementById('lock-err');
  const card = document.getElementById('lock-card');
  if (err) err.textContent = msg;
  if (shake && card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
  }
}
function pinFail(msg) {
  state.session.failed += 1;
  if (state.session.failed >= 5) {
    state.session.lockoutUntil = Date.now() + 30000;
    state.session.failed = 0;
    persistLockState();
    render();
    return;
  }
  persistLockState();
  state.ui.lockPin = '';
  lockError(msg);
  updateLockDom();
  const slots = document.getElementById('pin-slots');
  if (slots) { slots.classList.add('err'); setTimeout(() => slots.classList.remove('err'), 700); }
}

async function pinSubmit() {
  const pin = state.ui.lockPin || '';
  const s = state;
  if (pin.length < 4) return;

  if (s.session.firstRun) {
    if (s.ui.lockStep === 1) {
      s.ui.lockStep = 2;
      s.ui.lockFirstPin = pin;
      s.ui.lockPin = '';
      render();
      return;
    }
    if (s.ui.lockFirstPin !== pin) {
      s.ui.lockStep = 1;
      s.ui.lockFirstPin = null;
      s.ui.lockPin = '';
      lockError('PINs didn’t match — start over.', true);
      render();
      return;
    }
    await A.setPin(pin);
    s.session.firstRun = false;
    A.unlock();
    logUnlockToast();
    animateUnlock();
    return;
  }

  const ok = await verifyPin(pin, s.settings.pinSalt, s.settings.pinHash);
  if (!ok) { pinFail('Incorrect PIN — try again.'); return; }
  A.unlock();
  logUnlockToast();
  animateUnlock();
}
function logUnlockToast() {
  setTimeout(() => toast('Vault unlocked', { type: 'success', icon: 'unlock', timeout: 2200 }), 380);
}
function animateUnlock() {
  const el = document.getElementById('lock-screen');
  if (el) el.classList.add('leaving');
  setTimeout(() => { state.ui.lockPin = ''; state.ui.lockStep = 1; state.ui.lockFirstPin = null; render(); }, 330);
}
function doLock() {
  A.lock();
  state.ui.lockPin = '';
  state.ui.lockStep = 1;
  state.ui.lockFirstPin = null;
  clearLockoutTicker();
  closeModalsAndDrawers();
  render();
}
function closeModalsAndDrawers() {
  closePalette();
  closeModal();
  closeDrawer();
  closeContextMenu();
  closeSearchPanel();
  closeUploads();
  closePreview();
}

// ---------------------------------------------------------------- actions
const Actions = {
  // navigation
  'go-root': () => { location.hash = '#/files'; },
  'go-folder': (el) => { location.hash = '#/files/' + el.dataset.id; },
  'go-files': () => { location.hash = '#/files'; },
  'open-item': (el) => openItem(el.dataset.id),
  'toggle-mobnav': () => {
    const dn = document.getElementById('drawer-nav');
    const sc = document.getElementById('scrim');
    if (!dn) return;
    const open = dn.classList.toggle('open');
    sc?.classList.toggle('open', open);
  },

  // lock
  'lock': () => doLock(),
  'pin-digit': (el) => {
    if (state.session.lockoutUntil > Date.now()) return;
    const cur = state.ui.lockPin || '';
    if (cur.length >= 6) return;
    state.ui.lockPin = cur + el.dataset.digit;
    updateLockDom();
    if (state.ui.lockPin.length === 6) setTimeout(pinSubmit, 120);
  },
  'pin-back': () => {
    state.ui.lockPin = (state.ui.lockPin || '').slice(0, -1);
    updateLockDom();
  },
  'pin-eye': () => {
    state.ui.lockShowPin = !state.ui.lockShowPin;
    render();
  },
  'pin-submit': () => pinSubmit(),
  'pin-back-step': () => {
    state.ui.lockStep = 1;
    state.ui.lockFirstPin = null;
    state.ui.lockPin = '';
    render();
  },
  'pin-forget': () => openForgotPin(),

  // upload / create
  'upload': (el) => { pickFiles(el?.dataset?.dest ? el.dataset.dest || null : (state.ui.route.startsWith('/files') ? state.ui.folderId : null)); },
  'import': (el) => { pickFiles(el?.dataset?.dest ? el.dataset.dest || null : null); },
  'focus-search': () => document.getElementById('global-search')?.focus(),
  'new-folder': (el) => openFolderModal(el?.dataset?.dest ? (el.dataset.dest || null) : (state.ui.route.startsWith('/files') ? state.ui.folderId : null), 'create'),
  'open-palette': () => isPaletteOpen() ? closePalette() : openPalette(),

  // file items
  'item-click': (el, e) => handleItemClick(el, e),
  'item-more': (el, e) => {
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const items = fileContextMenuItems(el.dataset.id);
    state.ui.selection = new Set([el.dataset.id]);
    syncSelectionDom();
    openContextMenu(items, rect.left - 180, rect.bottom + 6);
  },
  'fav': (el) => {
    const id = el.dataset.id;
    const nowFav = A.toggleFav(id);
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 340);
    el.classList.toggle('on', nowFav);
    el.querySelector('svg')?.setAttribute('fill', nowFav ? 'var(--warn)' : 'none');
    toast(nowFav ? 'Added to favorites' : 'Removed from favorites', { type: 'success', icon: 'star', timeout: 2200 });
    storageStats();
    // update counts in sidebar without full render
    document.querySelectorAll('.nav-item').forEach((n) => {
      if (n.textContent.includes('Favorites')) {
        const c = n.querySelector('.count');
        if (c) c.textContent = state.storage.favs;
        else if (state.storage.favs) n.insertAdjacentHTML('beforeend', `<span class="count">${state.storage.favs}</span>`);
      }
    });
  },
  'dl': (el) => downloadItem(el.dataset.id),
  'details': (el) => openDetails(el.dataset.id),
  'rename': (el) => openRename(el.dataset.id),
  'move': (el) => openMove(el.dataset.id),
  'copy': (el) => { const r = rec(el.dataset.id); A.copy(el.dataset.id); toast(`Copied “${r?.name}”`, { type: 'success', icon: 'copy' }); render(); },
  'trash': (el) => trashWithUndo(el.dataset.id),
  'restore': (el) => { A.restore(el.dataset.id); toast('Restored', { type: 'success', icon: 'restore' }); render(); },
  'destroy': (el) => destroyWithConfirm(el.dataset.id),

  // view controls
  'set-filter': (el) => { state.ui.filter = el.dataset.filter; render(); },
  'sort-dir': () => { state.ui.sortDir = state.ui.sortDir === 'asc' ? 'desc' : 'asc'; render(); },
  'set-view': (el) => { state.ui.viewMode = el.dataset.view; render(); },

  // selection bar
  'sel-clear': () => { clearSelection(); syncSelectionDom(); },
  'sel-open': () => selOp('open'),
  'sel-move': () => selOp('move'),
  'sel-copy': () => selOp('copy'),
  'sel-fav': () => selOp('fav'),
  'sel-download': () => selOp('download'),
  'sel-trash': () => selOp('trash'),
  'sel-restore': () => selOp('restore'),
  'sel-destroy': () => selOp('destroy'),

  // trash / recent
  'empty-trash': () => {
    const n = trashedItems().length;
    if (!n) return;
    askConfirm({ title: 'Empty Trash?', body: `${n} item${n === 1 ? '' : 's'} will be permanently removed from this device. This can’t be undone.`, label: 'Empty trash', danger: true })
      .then((ok) => { if (ok) { A.emptyTrash(); toast('Trash emptied', { type: 'info', icon: 'trash' }); render(); } });
  },
  'clear-recents': () => { A.clearRecents(); toast('Recent activity cleared', { type: 'info' }); render(); },
  'clear-activity': () => { state.activities = []; try { localStorage.removeItem('vault:activity'); } catch { /* noop */ } render(); },
  'remove-demo': () => {
    const n = A.removeDemoContent();
    toast(`Removed ${n} sample items`, { type: 'info', icon: 'spark' });
    render();
  },

  // folder modal
  'folder-edit': (el) => openFolderModal(rec(el.dataset.id)?.parentId || null, 'edit', el.dataset.id),
  'folder-color': (el) => {
    const m = state.ui.folderModal;
    if (!m) return;
    m.color = el.dataset.color || null;
    document.querySelectorAll('[data-action="folder-color"]').forEach((b) => {
      b.style.border = b === el ? '2px solid var(--text)' : '2px solid transparent';
    });
  },
  'submit-folder': (el) => {
    const name = document.getElementById('fn-name')?.value.trim();
    if (!name) {
      const inp = document.getElementById('fn-name');
      inp?.classList.add('invalid');
      inp?.focus();
      return;
    }
    const m = state.ui.folderModal;
    if (el.dataset.mode === 'create') {
      const r = A.createFolder(name, m.parentId, m.color || null);
      toast(`Folder “${name}” created`, { type: 'success', icon: 'folder' });
      closeModal();
      location.hash = '#/files/' + r.id;
      if (location.hash === '#/files/' + r.id) render();
    } else {
      A.rename(m.id, name);
      if (m.color !== undefined) A.setColor(m.id, m.color);
      toast('Folder updated', { type: 'success' });
      closeModal();
      render();
    }
  },
  'folder-delete': (el) => {
    const r = rec(el.dataset.id);
    closeModal();
    askConfirm({
      title: 'Delete folder?',
      body: `“${esc(r?.name)}” and everything inside will move to Trash.`,
      label: 'Move to Trash', danger: true,
    }).then((ok) => { if (ok) { A.trash(el.dataset.id); render(); toast(`“${r?.name}” moved to Trash`, { type: 'info', icon: 'trash' }); } });
  },

  // rename / move / pin modals
  'submit-rename': (el) => {
    const name = document.getElementById('rn-name')?.value.trim();
    if (!name) { document.getElementById('rn-name')?.classList.add('invalid'); return; }
    if (A.rename(el.dataset.id, name)) {
      toast('Renamed', { type: 'success', icon: 'edit' });
      closeModal();
      render();
      if (state.ui.drawer === 'details' && state.ui.detailsId === el.dataset.id) syncDetailsDrawer();
    }
  },
  'submit-move': (el) => {
    const dest = document.querySelector('input[name="move-dest"]:checked')?.value || null;
    const ok = A.move(el.dataset.id, dest);
    if (ok) {
      const destName = dest ? rec(dest)?.name : 'root';
      toast(`Moved to ${dest ? `“${destName}”` : 'root'}`, { type: 'success', icon: 'move' });
      closeModal();
      render();
    } else toast('Can’t move into its own subfolder', { type: 'error' });
  },
  'confirm-yes': () => {
    const r = takeConfirmResolver();
    closeModal();
    if (r) r(true);
  },

  'submit-pin-change': async () => {
    const cur = document.getElementById('cp-cur')?.value || '';
    const nw = document.getElementById('cp-new')?.value || '';
    const conf = document.getElementById('cp-conf')?.value || '';
    const err = document.getElementById('cp-err');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    if (!/^\d{4,6}$/.test(nw)) return fail('New PIN must be 4–6 digits.');
    if (nw !== conf) return fail('PINs don’t match.');
    const res = await A.changePin(cur, nw);
    if (!res.ok) return fail(res.error === 'current' ? 'Current PIN is incorrect.' : 'Invalid PIN.');
    toast('PIN updated', { type: 'success', icon: 'lock' });
    closeModal();
  },

  // search panel
  'search-filter': (el) => { state.ui.searchFilter = el.dataset.filter; searchResultsHtml(); },
  'search-open': (el) => {
    pushRecentSearch(state.ui.search);
    clearSelection();
    closeSearchPanel();
    const input = document.getElementById('global-search');
    input?.blur();
    if (el.dataset.type === 'folder') {
      location.hash = '#/files/' + el.dataset.id;
      if (location.hash === '#/files/' + el.dataset.id) render();
    } else {
      const r = rec(el.dataset.id);
      if (r?.parentId) { location.hash = '#/files/' + r.parentId; if (location.hash !== '#/files/' + r.parentId) return; }
      render();
      openPreview(el.dataset.id);
    }
  },
  'search-use': (el) => {
    state.ui.search = el.dataset.q;
    const input = document.getElementById('global-search');
    if (input) input.value = el.dataset.q;
    searchResultsHtml();
  },
  'search-del': (el) => {
    state.ui.recentSearches = state.ui.recentSearches.filter((x) => x !== el.dataset.q);
    try { localStorage.setItem('vault:recentSearches', JSON.stringify(state.ui.recentSearches)); } catch { /* noop */ }
    searchResultsHtml();
  },
  'search-clear-recent': () => { clearRecentSearches(); searchResultsHtml(); },

  // settings
  'settings-sec': (el) => { state.ui.settingsSection = el.dataset.sec; render(); },
  'save-profile': () => {
    const v = document.getElementById('set-name')?.value.trim() || '';
    A.settings({ profileName: v });
    toast('Profile saved', { type: 'success' });
    render();
  },
  'save-vault-name': () => {
    const v = document.getElementById('set-vault')?.value.trim();
    if (!v) { document.getElementById('set-vault')?.classList.add('invalid'); return; }
    A.settings({ vaultName: v });
    toast('Vault name saved', { type: 'success' });
    render();
  },
  'change-pin': () => openChangePin(),
  'set-autolock': (el) => { A.settings({ autoLockMin: +el.value }); toast(`Auto-lock: ${el.value === '0' ? 'off' : el.value + ' min'}`, { type: 'success', timeout: 2000 }); },
  'set-lockrefresh': (el) => { A.settings({ lockOnRefresh: el.checked }); },
  'set-theme': (el) => { A.settings({ theme: el.checked ? 'dark' : 'light' }); },
  'set-density': (el) => { A.settings({ density: el.dataset.density }); },
  'set-default-view': (el) => { A.settings({ defaultView: el.dataset.view }); toast('Default view saved', { type: 'success', timeout: 1800 }); },
  'clear-recent-searches': () => { clearRecentSearches(); toast('Search history cleared', { type: 'info' }); render(); },
  'run-search': (el) => {
    state.ui.search = el.dataset.q;
    state.ui.searchFocus = null;
    location.hash = '#/files';
    render();
    const input = document.getElementById('global-search');
    if (input) { input.value = el.dataset.q; input.focus(); openSearchPanel(); }
  },
  'del-recent-search': (el) => {
    state.ui.recentSearches = state.ui.recentSearches.filter((x) => x !== el.dataset.q);
    try { localStorage.setItem('vault:recentSearches', JSON.stringify(state.ui.recentSearches)); } catch { /* noop */ }
    render();
  },
  'wipe': async () => {
    await A.wipe();
  },

  // upload drawer
  'up-cancel': (el) => { const e = queueGet(el.dataset.id); if (e) cancelEntry(e); },
  'up-retry': (el) => { const e = queueGet(el.dataset.id); if (e) retryEntry(e); },
  'up-remove': (el) => { queueDelete(el.dataset.id); renderUploadBody(); },
  'close-upload-drawer': () => {
    if (hasActiveLocal()) { toast('Uploads still in progress', { type: 'info' }); return; }
    closeUploads();
    closeDrawer();
    render();
  },
  'ctx-preview': (el) => {
    const r = rec(el.dataset.id);
    const items = fileContextMenuItems(el.dataset.id).filter((i) => !i.sep);
    const rect = el.getBoundingClientRect();
    openContextMenu(items, rect.left - 200, rect.bottom + 6);
  },
  'close-preview': () => closePreview(),
  'zoom': (el) => {
    const d = +el.dataset.delta;
    state.ui.preview?.applyZoom?.(d);
  },
};

// queue helpers (defined in upload.js)
import * as uploadMod from './upload.js';
function queueGet(id) { return uploadMod._queueGet(id); }
function cancelEntry(e) { uploadMod._cancel(e); }
function retryEntry(e) { uploadMod._retry(e); }
function queueDelete(id) { uploadMod._delete(id); }
function hasActiveLocal() { return uploadMod.hasActive(); }
function renderUploadBody() {
  const body = document.querySelector('#drawer-root .d-body');
  if (body) body.innerHTML = uploadDrawerBody();
}

// ---------------------------------------------------------------- events
function bindGlobalEvents() {
  loadLockState();

  window.addEventListener('hashchange', () => {
    if (!state.session.unlocked) return;
    closeSearchPanel();
    render();
  });

  document.addEventListener('click', (e) => {
    // close popovers first
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot.hidden) {
      if (e.target.closest('[data-mclose]')) { closeModal(); return; }
      if (!e.target.closest('.modal')) { closeModal(); }
      // still process action buttons inside modal
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) { runAction(actionEl, e); }
      return;
    }
    const drawerRoot = document.getElementById('drawer-root');
    if (!drawerRoot.hidden) {
      if (e.target.closest('[data-dclose]')) { onDrawerClose(); return; }
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) { runAction(actionEl, e); return; }
      return;
    }
    const ctxRoot = document.getElementById('ctx-root');
    if (!ctxRoot.hidden) {
      const it = e.target.closest('[data-ctx]');
      if (it) {
        const item = ctxRoot._items?.[+it.dataset.ctx];
        closeContextMenu();
        item?.run?.();
        return;
      }
      closeContextMenu();
      return;
    }
    const palRoot = document.getElementById('palette-root');
    if (!palRoot.hidden) {
      if (e.target.closest('[data-pclose]')) { closePalette(); return; }
      return; // palette items handle their own clicks
    }
    // outside search panel
    if (!e.target.closest('.gsearch')) closeSearchPanel();

    const actionEl = e.target.closest('[data-action]');
    if (actionEl) { runAction(actionEl, e); return; }

    // mobile nav buttons
    const mob = e.target.closest('[data-mobnav]');
    if (mob) {
      document.getElementById('drawer-nav')?.classList.remove('open');
      document.getElementById('scrim')?.classList.remove('open');
      location.hash = mob.dataset.mobnav;
      if (location.hash === mob.dataset.mobnav) render();
      return;
    }
    // click on empty content area clears selection
    if (e.target.closest('#content') && !e.target.closest('[data-action]') && !e.target.closest('.fitem') && !e.target.closest('.ll-row') && !e.target.closest('.folder-row') && state.ui.selection.size) {
      clearSelection();
      syncSelectionDom();
    }
  });

  // context menu
  document.addEventListener('contextmenu', (e) => {
    const target = e.target.closest?.('.fitem, .ll-row, .folder-row');
    const id = target?.dataset.id;
    if (!id) return;
    e.preventDefault();
    state.ui.selection = new Set([id]);
    syncSelectionDom();
    openContextMenu(fileContextMenuItems(id), e.clientX, e.clientY);
  });

  // double click opens
  document.addEventListener('dblclick', (e) => {
    const el = e.target.closest('[data-action="item-click"]');
    if (el) openItem(el.dataset.id);
    const fr = e.target.closest('.folder-row');
    if (fr) { location.hash = '#/files/' + fr.dataset.id; }
  });

  // inputs
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'global-search') {
      state.ui.search = el.value;
      state.ui.searchFocus = { pos: el.selectionStart };
      searchResultsHtml();
      const p = document.getElementById('search-panel');
      if (p) p.hidden = false;
      return;
    }
    if (el.id === 'palette-input') {
      renderPalette();
      const ni = document.getElementById('palette-input');
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
      return;
    }
    if (el.dataset.actionInput === 'sort') {
      state.ui.sort = el.value;
      render();
    }
  });

  // search focus/blur
  document.addEventListener('focusin', (e) => {
    if (e.target.id === 'global-search') openSearchPanel();
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.id === 'global-search' && !document.getElementById('search-panel')?.contains(document.activeElement)) {
      setTimeout(() => {
        if (document.activeElement?.id !== 'global-search' && !document.getElementById('search-panel')?.contains(document.activeElement)) closeSearchPanel();
      }, 140);
    }
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches?.('input, textarea, select, [contenteditable]');

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.session.unlocked) isPaletteOpen() ? closePalette() : openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (isPaletteOpen()) { closePalette(); return; }
      if (document.getElementById('modal-root').dataset.preview === '1') { closePreview(); return; }
      if (isModalOpen()) { closeModal(); return; }
      if (isDrawerOpen()) { onDrawerClose(); return; }
      if (isCtxOpen()) { closeContextMenu(); return; }
      if (!document.getElementById('search-panel').hidden) { closeSearchPanel(); document.getElementById('global-search')?.blur(); return; }
      if (state.ui.selection.size) { clearSelection(); syncSelectionDom(); }
      return;
    }
    if (isPaletteOpen()) {
      if (e.key === 'ArrowDown') { e.preventDefault(); paletteKey(e, 'down'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); paletteKey(e, 'up'); return; }
      if (e.key === 'Enter') { e.preventDefault(); paletteKey(e, 'enter'); return; }
      return;
    }
    if (typing) {
      // allow keyboard PIN entry on lock screen (inputs? none — digits typed on body)
      return;
    }
    if (!state.session.unlocked) {
      // lock screen keyboard
      if (/^[0-9]$/.test(e.key)) { Actions['pin-digit']({ dataset: { digit: e.key } }); return; }
      if (e.key === 'Backspace') { Actions['pin-back'](); return; }
      if (e.key === 'Enter') { pinSubmit(); return; }
      return;
    }
    if (e.key === '/') { e.preventDefault(); document.getElementById('global-search')?.focus(); return; }
    if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); Actions['new-folder']({ dataset: { dest: state.ui.folderId || '' } }); return; }
    if (e.key.toLowerCase() === 'u' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); Actions['upload']({ dataset: {} }); return; }
    if ((e.key === 'Delete' || (e.key === 'Backspace' && e.target === document.body)) && state.ui.selection.size) {
      const mode = currentModeFromRoute();
      if (mode === 'trash') { selOp('destroy'); }
      else { selOp('trash'); }
      return;
    }
    if (e.key === 'Enter' && e.target.closest?.('[data-action="item-click"]')) {
      e.preventDefault();
      openItem(e.target.closest('[data-action="item-click"]').dataset.id);
    }
  });

  // drag & drop
  let dragDepth = 0;
  const content = () => document.getElementById('content');
  document.addEventListener('dragenter', (e) => {
    if (!state.session.unlocked) return;
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    const c = content();
    if (c && !c.querySelector('.dropzone')) {
      c.style.position = 'relative';
      c.insertAdjacentHTML('beforeend', `<div class="dropzone"><div class="dz-inner"><span class="dz-ic">${icon('upload', 26)}</span>Drop to upload</div></div>`);
    }
  });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) content()?.querySelector('.dropzone')?.remove();
  });
  document.addEventListener('drop', (e) => {
    if (!state.session.unlocked) return;
    dragDepth = 0;
    content()?.querySelector('.dropzone')?.remove();
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    openUploads(e.dataTransfer.files, state.ui.route.startsWith('/files') ? state.ui.folderId : null);
  });

  // file picker
  document.getElementById('file-input').addEventListener('change', (e) => {
    if (!e.target.files?.length) return;
    const dest = e.target.dataset.destId || (state.ui.route.startsWith('/files') ? state.ui.folderId : null);
    openUploads(e.target.files, dest);
  });

  // auto-lock
  let lastActivity = Date.now();
  const bump = () => { lastActivity = Date.now(); };
  window.addEventListener('pointerdown', bump, { passive: true });
  window.addEventListener('keydown', bump, { passive: true });
  window.addEventListener('wheel', bump, { passive: true });
  setInterval(() => {
    const min = state.settings.autoLockMin;
    if (state.session.unlocked && min > 0 && Date.now() - lastActivity > min * 60000) {
      toast('Vault locked after inactivity', { type: 'info', icon: 'lock', timeout: 2500 });
      doLock();
    }
  }, 15000);
}

function onDrawerClose() {
  state.ui.drawer = null;
  state.ui.detailsId = null;
  closeDrawer();
}

function runAction(el, e) {
  const fn = Actions[el.dataset.action];
  if (fn) {
    if (el.tagName === 'BUTTON' && el.disabled) return;
    fn(el, e);
  }
}
