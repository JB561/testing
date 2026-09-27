// Vault — file browser (Files / Favorites / Recent / Trash) with
// grid & list layouts, sorting, type filters, breadcrumbs and multi-select.

import { icon } from '../icons.js';
import {
  esc, fmtBytes, fmtDate, relTime, kindOf, kindIconHtml,
  FILTERS, matchesFilter, emptyState,
} from '../ui.js';
import {
  state, rec, childrenOf, pathOf, recursiveSize,
  allFiles, allFolders, trashedItems, favorites, recentFiles,
} from '../store.js';

const MODES = {
  files: {
    title: 'Files',
    items: (s) => childrenOf(s.ui.folderId),
    empty: (s, destName) => emptyState({
      icon: 'folder', title: 'This folder is empty',
      sub: `Upload files or create a folder in ${destName}.`,
      actions: [
        { label: 'Upload', action: 'upload', primary: true, icon: 'upload', attrs: `data-dest="${s.ui.folderId || ''}"` },
        { label: 'New folder', action: 'new-folder', icon: 'folder', attrs: `data-dest="${s.ui.folderId || ''}"` },
      ],
    }),
  },
  favorites: {
    title: 'Favorites',
    items: () => favorites(),
    empty: () => emptyState({ icon: 'star', title: 'Nothing here yet', sub: 'Favorite files and folders to access them quickly.', actions: [{ label: 'Browse files', action: 'go-files', primary: true, icon: 'files' }] }),
  },
  recent: {
    title: 'Recent',
    items: () => recentFiles(100),
    empty: () => emptyState({ icon: 'clock', title: 'No recent files', sub: 'Files you open will appear here.', actions: [{ label: 'Browse files', action: 'go-files', primary: true, icon: 'files' }] }),
  },
  trash: {
    title: 'Trash',
    items: () => trashedItems(),
    empty: () => emptyState({ icon: 'trash', title: 'Trash is empty', sub: 'Deleted files will appear here and can be restored.' }),
  },
};

export function browserHTML(mode) {
  const s = state;
  const M = MODES[mode];
  const isTrash = mode === 'trash';
  const isRecent = mode === 'recent';

  // ----- items -----
  let items = M.items(s);
  const filter = s.ui.filter;
  if (mode === 'files' && filter !== 'all') {
    items = items.filter((r) => matchesFilter(r, filter) || (filter === 'folder' && r.type === 'folder'));
  } else if (mode !== 'files' && filter !== 'all') {
    items = items.filter((r) => matchesFilter(r, filter));
  }
  const dir = s.ui.sortDir === 'asc' ? 1 : -1;
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    modified: (a, b) => (a.modifiedAt || 0) - (b.modifiedAt || 0),
    size: (a, b) => (a.type === 'folder' ? recursiveSize(a.id) : a.size) - (b.type === 'folder' ? recursiveSize(b.id) : b.size),
    type: (a, b) => kindOf(a).label.localeCompare(kindOf(b).label),
  };
  items = [...items].sort((a, b) => {
    // folders first in normal Files mode
    if (mode === 'files') {
      const fa = a.type === 'folder' ? 0 : 1, fb = b.type === 'folder' ? 0 : 1;
      if (fa !== fb) return fa - fb;
    }
    return sorters[s.ui.sort](a, b) * dir;
  });

  // ----- head / crumbs -----
  const folder = mode === 'files' ? (s.ui.folderId ? rec(s.ui.folderId) : null) : null;
  const crumb = mode === 'files' ? `
    <nav class="crumb" aria-label="Breadcrumb">
      ${crumbsHtml(folder)}
    </nav>` : '';

  const count = items.length;
  const sel = s.ui.selection.size;
  const viewMode = s.ui.viewMode || s.settings.defaultView;

  // ----- toolbar -----
  const chips = (mode === 'files' || mode === 'favorites' || mode === 'recent') ? `
    <div class="chips" role="group" aria-label="Filter by type">
      ${FILTERS.filter((f) => f.id !== 'doc' || mode === 'files').map((f) =>
        `<button class="chip ${filter === f.id ? 'active' : ''}" data-action="set-filter" data-filter="${f.id}" aria-pressed="${filter === f.id}">${f.label}</button>`).join('')}
      ${mode === 'files' ? `<button class="chip ${filter === 'folder' ? 'active' : ''}" data-action="set-filter" data-filter="folder" aria-pressed="${filter === 'folder'}">Folders</button>` : ''}
    </div>` : '';

  const sortSel = `
    <select class="select" data-action-input="sort" aria-label="Sort by">
      <option value="modified" ${s.ui.sort === 'modified' ? 'selected' : ''}>Modified</option>
      <option value="name" ${s.ui.sort === 'name' ? 'selected' : ''}>Name</option>
      <option value="size" ${s.ui.sort === 'size' ? 'selected' : ''}>Size</option>
      <option value="type" ${s.ui.sort === 'type' ? 'selected' : ''}>Type</option>
    </select>
    <button class="icon-btn sm" data-action="sort-dir" title="Sort direction: ${s.ui.sortDir === 'asc' ? 'ascending' : 'descending'}" aria-label="Toggle sort direction">
      ${icon('chevD', 15, s.ui.sortDir === 'asc' ? '' : 'rot-180')}
    </button>`;

  const viewSeg = `
    <div class="seg" role="group" aria-label="View mode">
      <button class="${viewMode === 'grid' ? 'active' : ''}" data-action="set-view" data-view="grid" title="Grid view" aria-label="Grid view">${icon('grid', 15)}</button>
      <button class="${viewMode === 'list' ? 'active' : ''}" data-action="set-view" data-view="list" title="List view" aria-label="List view">${icon('list', 15)}</button>
    </div>`;

  const headActions = mode === 'trash'
    ? `<button class="btn" data-action="empty-trash" ${count ? '' : 'disabled'}>${icon('trash', 14)} Empty trash</button>`
    : mode === 'recent'
      ? `<button class="btn" data-action="clear-recents" ${count ? '' : 'disabled'}>${icon('x', 14)} Clear recent</button>`
      : mode === 'files'
        ? `<div style="display:flex;gap:8px">
            <button class="btn" data-action="upload" data-dest="${s.ui.folderId || ''}">${icon('upload', 14)} Upload</button>
            <button class="btn btn-primary" data-action="new-folder" data-dest="${s.ui.folderId || ''}">${icon('plus', 14)} New folder</button>
          </div>`
        : '';

  // ----- body -----
  let body;
  if (!count) {
    body = M.empty(s, folder ? `“${folder.name}”` : 'the root');
  } else if (viewMode === 'grid') {
    body = `<div class="file-grid">${items.map(gridItem).join('')}</div>`;
  } else {
    body = `
      <div class="file-list">
        <div class="ll-head"><span>Name</span><span class="h-type">Type</span><span>Size</span><span class="h-mod">Modified</span><span></span></div>
        ${items.map(listItem).join('')}
      </div>`;
  }

  return `
    ${crumb}
    <div class="view-title-row">
      <h1>${M.title}</h1>
      <span class="vt-count">${count} item${count === 1 ? '' : 's'}${mode === 'trash' && count ? ' · kept until emptied' : ''}</span>
    </div>
    <div class="toolbar">
      ${chips}
      <div class="tb-right">${sortSel}${viewSeg}</div>
    </div>
    ${body}
    ${selbarHtml(mode)}`;
}

function crumbsHtml(folder) {
  const parts = folder ? pathOf(folder) : [state.settings.vaultName];
  // build clickable chain from root
  const chain = [];
  let cur = folder;
  while (cur) { chain.unshift(cur); cur = cur.parentId ? rec(cur.parentId) : null; }
  let html = `<button data-action="go-root" ${!folder ? 'class="current"' : ''}>${esc(state.settings.vaultName)}</button>`;
  chain.forEach((f, i) => {
    const isLast = i === chain.length - 1;
    html += `<span class="c-sep">${icon('chevR', 12)}</span>
      <button data-action="go-folder" data-id="${f.id}" ${isLast ? 'class="current"' : ''}>${esc(f.name)}</button>`;
  });
  return html;
}

function gridItem(r) {
  const s = state;
  const k = kindOf(r);
  const isSel = s.ui.selection.has(r.id);
  const isFolder = r.type === 'folder';
  const size = isFolder ? `${childrenOf(r.id).length} items` : fmtBytes(r.size);
  const when = r.trashedAt ? `In trash ${relTime(r.trashedAt)}` : relTime(r.modifiedAt);
  return `
    <div class="fitem ${isSel ? 'selected' : ''}" data-id="${r.id}" data-type="${r.type}"
      data-action="item-click" role="button" tabindex="0" aria-label="${esc(r.name)}" aria-pressed="${isSel}">
      <div class="fitem-head">
        ${kindIconHtml(r, 20)}
        <span class="fitem-actions">
          <button class="icon-btn sm fav-btn ${r.favorite ? 'on' : ''}" data-action="fav" data-id="${r.id}" title="Favorite" aria-label="Toggle favorite" aria-pressed="${!!r.favorite}">${icon('star', 14)}</button>
          <button class="icon-btn sm" data-action="item-more" data-id="${r.id}" title="More" aria-label="More actions">${icon('dots', 14)}</button>
        </span>
      </div>
      <div class="fname">${esc(r.name)}</div>
      <div class="fmeta"><span>${k.label}</span><span class="dot">·</span><span>${size}</span><span class="dot">·</span><span>${when}</span>${r.demo ? '<span class="tag" style="padding:2.5px 7px;font-size:9.5px">Sample</span>' : ''}</div>
    </div>`;
}

function listItem(r) {
  const s = state;
  const k = kindOf(r);
  const isSel = s.ui.selection.has(r.id);
  const isFolder = r.type === 'folder';
  const size = isFolder ? `${childrenOf(r.id).length} items` : fmtBytes(r.size);
  return `
    <div class="ll-row ${isSel ? 'selected' : ''}" data-id="${r.id}" data-type="${r.type}"
      data-action="item-click" role="button" tabindex="0" aria-label="${esc(r.name)}" aria-pressed="${isSel}">
      <div class="ll-name">
        ${kindIconHtml(r, 14)}
        <div style="min-width:0">
          <div class="n">${esc(r.name)} ${r.demo ? '<span class="tag" style="padding:2px 7px;font-size:9.5px;vertical-align:1px">Sample</span>' : ''}</div>
          <div class="ll-sub">${k.label}${r.trashedAt ? ` · in trash ${relTime(r.trashedAt)}` : ''}</div>
        </div>
      </div>
      <span class="ll-cell ll-type">${k.label}</span>
      <span class="ll-cell">${size}</span>
      <span class="ll-cell ll-mod">${fmtDate(r.modifiedAt)}</span>
      <span class="ll-actions"><button class="icon-btn sm" data-action="item-more" data-id="${r.id}" title="More" aria-label="More actions">${icon('dots', 14)}</button></span>
    </div>`;
}

function selbarHtml(mode) {
  const s = state;
  const n = s.ui.selection.size;
  if (!n) return `<div class="selbar" id="selbar"></div>`;
  const isTrash = mode === 'trash';
  return `
    <div class="selbar show" id="selbar">
      <span class="sb-count">${n} selected</span>
      ${isTrash ? `
        <button class="sb-btn" data-action="sel-restore">${icon('restore', 14)} Restore</button>
        <button class="sb-btn danger" data-action="sel-destroy">${icon('trash', 14)} Delete forever</button>`
      : `
        <button class="sb-btn" data-action="sel-open">${icon('chevR', 14)} Open</button>
        <button class="sb-btn" data-action="sel-move">${icon('move', 14)} Move</button>
        <button class="sb-btn" data-action="sel-copy">${icon('copy', 14)} Copy</button>
        <button class="sb-btn" data-action="sel-fav">${icon('star', 14)} Favorite</button>
        <button class="sb-btn" data-action="sel-download" ${n === 1 ? '' : 'style="display:none"'}>${icon('download', 14)} Download</button>
        <button class="sb-btn danger" data-action="sel-trash">${icon('trash', 14)} Trash</button>`}
      <button class="icon-btn sm sb-x" data-action="sel-clear" aria-label="Clear selection">${icon('x', 14)}</button>
    </div>`;
}

// live-update selection without a full re-render
export function syncSelectionDom() {
  const s = state;
  document.querySelectorAll('[data-action="item-click"]').forEach((el) => {
    const on = s.ui.selection.has(el.dataset.id);
    el.classList.toggle('selected', on);
    el.setAttribute('aria-pressed', String(on));
  });
  const bar = document.getElementById('selbar');
  if (bar) {
    const host = bar.parentElement;
    const tmp = document.createElement('div');
    tmp.innerHTML = selbarHtml(currentModeFromRoute());
    const nb = tmp.firstChild;
    host.replaceChild(nb, bar);
  }
}

export function currentModeFromRoute() {
  const p = state.ui.route;
  if (p.startsWith('/favorites')) return 'favorites';
  if (p.startsWith('/recent')) return 'recent';
  if (p.startsWith('/trash')) return 'trash';
  return 'files';
}
