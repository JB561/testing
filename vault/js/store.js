// Vault — store: state, persistence and all domain actions.
// Single source of truth; UI renders from `state`, mutates via `A`.

import { openStore } from './db.js';
import { newSalt, hashPin, verifyPin } from './crypto.js';
import { DEMO_TREE, demoEntrySize } from './seed.js';

export const CAPACITY_GB = 10;

export const state = {
  ready: false,
  db: null,
  records: new Map(),      // id -> record
  activities: [],          // [{id, icon, text, ts}]
  settings: defaultSettings(),
  session: {
    unlocked: false,
    firstRun: false,
    failed: 0,
    lockoutUntil: 0,
    unlockedAt: null,
  },
  ui: {
    route: '/',
    folderId: null,
    viewMode: null,        // resolved from settings on demand
    sort: 'modified',
    sortDir: 'desc',
    filter: 'all',
    selection: new Set(),
    lastClickIndex: null,
    search: '',
    searchFocus: null,
    searchFilter: 'all',
    recentSearches: [],
    settingsSection: 'account',
    preview: null,         // {id, zoom}
    drawer: null,          // {type:'details'|'upload', id?}
    paletteOpen: false,
    paletteIndex: 0,
    recentView: 'files',   // recent view sub-tab
    folderModal: null,     // {mode:'create'|'edit', id?, parentId}
    moveModal: null,       // {id}
    renameModal: null,     // {id}
    confirm: null,
    detailsId: null,
    previewItem: null,
    uploadDestination: null,
    lockPin: '',
    lockShowPin: false,
    lockStep: 1,
    lockFirstPin: null,
  },
  storage: { used: 0, trash: 0, files: 0, folders: 0, favs: 0 },
};

function defaultSettings() {
  return {
    vaultName: 'My Vault',
    profileName: '',
    pinSalt: null,
    pinHash: null,
    autoLockMin: 5,          // 0 = off
    lockOnRefresh: true,
    theme: 'dark',
    density: 'comfortable',
    defaultView: 'grid',
    created: Date.now(),
  };
}

// ---------- ids & misc ----------
let seq = 0;
export function uid(prefix = 'f') {
  return `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- persistence ----------
async function persist(rec) {
  if (!state.db) return;
  try { await state.db.put('meta', rec); } catch (e) { console.warn('persist failed', e); }
}
async function unpersist(id) {
  if (!state.db) return;
  try { await state.db.del('meta', id); } catch { /* noop */ }
}
function persistSettings() {
  try { localStorage.setItem('vault:settings', JSON.stringify(state.settings)); } catch { /* noop */ }
  applyThemeAttrs();
}
export function applyThemeAttrs() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.density = state.settings.density;
}

export function logActivity(icon, text) {
  state.activities.unshift({ id: uid('a'), icon, text, ts: Date.now() });
  if (state.activities.length > 40) state.activities.length = 40;
  try { localStorage.setItem('vault:activity', JSON.stringify(state.activities)); } catch { /* noop */ }
}

// ---------- derived data ----------
export function rec(id) { return state.records.get(id); }
export function isFolder(r) { return r && r.type === 'folder'; }
export function live(r) { return r && !r.trashedAt; }
export function childrenOf(id) {
  const out = [];
  for (const r of state.records.values()) if (r.parentId === id && !r.trashedAt) out.push(r);
  return out;
}
export function pathOf(r) {
  const parts = [];
  let cur = r;
  while (cur) { parts.unshift(cur.name); cur = cur.parentId ? rec(cur.parentId) : null; }
  parts[0] = state.settings.vaultName;
  return parts;
}
export function fullPathText(r) { return pathOf(r).join(' / '); }
export function isDescendant(ancestorId, maybeDescId) {
  let cur = maybeDescId ? rec(maybeDescId) : null;
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parentId ? rec(cur.parentId) : null;
  }
  return false;
}
export function recursiveSize(id) {
  const r = rec(id);
  if (!r) return 0;
  if (r.type === 'file') return r.size || 0;
  return childrenOf(id).reduce((s, c) => s + recursiveSize(c.id), 0);
}
export function allFolders() {
  return [...state.records.values()].filter((r) => isFolder(r) && live(r));
}
export function allFiles() {
  return [...state.records.values()].filter((r) => r.type === 'file' && live(r));
}
export function trashedItems() {
  return [...state.records.values()].filter((r) => r.trashedAt);
}
export function favorites() {
  return [...state.records.values()].filter((r) => r.favorite && live(r));
}
export function recentFiles(limit = 12) {
  return allFiles()
    .filter((r) => r.openedAt)
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, limit);
}
export function storageStats() {
  let used = 0, trash = 0, files = 0, folders = 0, favs = 0;
  for (const r of state.records.values()) {
    if (r.trashedAt) { if (r.type === 'file') trash += r.size || 0; continue; }
    if (r.type === 'file') { files++; used += r.size || 0; if (r.favorite) favs++; }
    else { folders++; if (r.favorite) favs++; }
  }
  state.storage = { used, trash, files, folders, favs };
  return state.storage;
}

// ---------- init ----------
export async function init() {
  state.db = await openStore();
  // settings
  try {
    const raw = localStorage.getItem('vault:settings');
    if (raw) state.settings = { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /* noop */ }
  // activities
  try {
    const raw = localStorage.getItem('vault:activity');
    if (raw) state.activities = JSON.parse(raw);
  } catch { /* noop */ }
  // records
  let meta = [];
  try { meta = await state.db.all('meta') || []; } catch { meta = []; }
  for (const r of meta) state.records.set(r.id, r);
  state.ui.recentSearches = loadRecentSearches();

  if (!meta.length && !state.settings.pinHash) {
    await seedDemo();
    state.session.firstRun = true;
  }
  // unlock-on-refresh handling
  let wasUnlocked = false;
  try { wasUnlocked = sessionStorage.getItem('vault:unlocked') === '1'; } catch { /* noop */ }
  if (!state.session.firstRun && !state.settings.lockOnRefresh && wasUnlocked && state.settings.pinHash) {
    state.session.unlocked = true;
    state.session.unlockedAt = Date.now();
  }
  storageStats();
  state.ready = true;
}

function loadRecentSearches() {
  try { return JSON.parse(localStorage.getItem('vault:recentSearches') || '[]'); } catch { return []; }
}
export function pushRecentSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  const list = state.ui.recentSearches.filter((x) => x !== q);
  list.unshift(q);
  state.ui.recentSearches = list.slice(0, 8);
  try { localStorage.setItem('vault:recentSearches', JSON.stringify(state.ui.recentSearches)); } catch { /* noop */ }
}
export function clearRecentSearches() {
  state.ui.recentSearches = [];
  try { localStorage.removeItem('vault:recentSearches'); } catch { /* noop */ }
}

async function seedDemo() {
  const now = Date.now();
  const recs = [];
  for (const e of DEMO_TREE) {
    let blob = null, contentId = null, size = 0;
    if (e.folder) {
      recs.push({
        id: e.id, type: 'folder', name: e.name, parentId: e.parent,
        size: 0, createdAt: now - (e.modifiedAgo || 0), modifiedAt: now - (e.modifiedAgo || 0),
        openedAt: null, favorite: false, trashedAt: null, color: null, demo: true,
      });
    } else {
      if (e.text != null) {
        blob = new Blob([e.text], { type: 'text/plain' });
      } else {
        blob = e.blob();
      }
      size = blob.size;
      recs.push({
        id: e.id, type: 'file', name: e.name, parentId: e.parent,
        kind: e.kind, ext: e.ext, size,
        createdAt: now - (e.modifiedAgo || 0) - 3 * 86400000,
        modifiedAt: now - (e.modifiedAgo || 0),
        openedAt: e.openedAgo ? now - e.openedAgo : null,
        favorite: !!e.fav, trashedAt: null, color: null, demo: true,
        contentId: e.id,
      });
    }
  }
  for (const r of recs) {
    state.records.set(r.id, r);
    await state.db.put('meta', r);
  }
  for (const e of DEMO_TREE) {
    if (e.folder) continue;
    const b = e.text != null ? new Blob([e.text], { type: 'text/plain' }) : e.blob();
    try { await state.db.put('blobs', b, e.id); } catch { /* demo content optional */ }
  }
  logActivity('spark', 'Sample content added to your vault');
}

// ---------- actions ----------
export const A = {
  // folders
  createFolder(name, parentId = null, color = null) {
    const now = Date.now();
    const r = {
      id: uid('d'), type: 'folder', name, parentId, size: 0,
      createdAt: now, modifiedAt: now, openedAt: null,
      favorite: false, trashedAt: null, color, demo: false,
    };
    state.records.set(r.id, r);
    persist(r);
    touchParent(parentId);
    logActivity('folder', `Created folder “${name}”`);
    storageStats();
    return r;
  },

  rename(id, name) {
    const r = rec(id);
    if (!r || !name.trim()) return false;
    r.name = name.trim();
    r.modifiedAt = Date.now();
    persist(r);
    logActivity('edit', `Renamed to “${r.name}”`);
    return true;
  },

  setColor(id, color) {
    const r = rec(id);
    if (!r) return;
    r.color = color;
    persist(r);
  },

  toggleFav(id) {
    const r = rec(id);
    if (!r) return;
    r.favorite = !r.favorite;
    persist(r);
    logActivity(r.favorite ? 'star' : 'star', r.favorite ? `Added “${r.name}” to favorites` : `Removed “${r.name}” from favorites`);
    storageStats();
    return r.favorite;
  },

  trash(id) {
    const r = rec(id);
    if (!r || r.trashedAt) return;
    r.trashedAt = Date.now();
    persist(r);
    logActivity('trash', `Moved “${r.name}” to Trash`);
    clearSelection(id);
    storageStats();
  },

  trashMany(ids) {
    const list = [...ids];
    const first = rec(list[0]);
    for (const id of list) A.trash(id);
    if (list.length > 1) logActivity('trash', `Moved ${list.length} items to Trash`);
    return first;
  },

  restore(id) {
    const r = rec(id);
    if (!r) return;
    let parentOk = r.parentId && rec(r.parentId) && !rec(r.parentId).trashedAt;
    if (!parentOk) {
      // walk up to nearest live ancestor
      let p = r.parentId ? rec(r.parentId) : null;
      let chain = [];
      while (p && p.trashedAt) { chain.push(p.id); p = p.parentId ? rec(p.parentId) : null; }
      r.parentId = p ? p.id : null;
      for (const cid of chain) { const c = rec(cid); c.parentId = r.id; persist(c); }
    }
    r.trashedAt = null;
    persist(r);
    logActivity('restore', `Restored “${r.name}”`);
    storageStats();
  },

  deleteForever(id) {
    const r = rec(id);
    if (!r) return;
    const toRemove = collectWithDescendants(id);
    for (const id2 of toRemove) {
      const rr = state.records.get(id2);
      state.records.delete(id2);
      unpersist(id2);
      if (rr?.contentId) { try { state.db.del('blobs', rr.contentId); } catch { /* noop */ } }
    }
    clearSelection(id);
    logActivity('trash', `Permanently deleted “${r.name}”`);
    storageStats();
  },

  emptyTrash() {
    const items = trashedItems();
    if (!items.length) return 0;
    const ids = new Set();
    for (const it of items) for (const d of collectWithDescendants(it.id)) ids.add(d);
    for (const id of ids) {
      const rr = state.records.get(id);
      state.records.delete(id);
      unpersist(id);
      if (rr?.contentId) { try { state.db.del('blobs', rr.contentId); } catch { /* noop */ } }
    }
    logActivity('trash', `Emptied Trash (${items.length} items)`);
    storageStats();
    return items.length;
  },

  move(id, destId) {
    const r = rec(id);
    if (!r || id === destId) return false;
    if (isFolder(r) && isDescendant(id, destId)) return false;
    const dest = destId ? rec(destId) : null;
    if (dest && dest.type !== 'folder') return false;
    if (dest && dest.trashedAt) return false;
    r.parentId = destId;
    r.modifiedAt = Date.now();
    persist(r);
    touchParent(destId);
    logActivity('move', `Moved “${r.name}” to ${dest ? `“${dest.name}”` : 'root'}`);
    clearSelection(id);
    return true;
  },

  copy(id) {
    const r = rec(id);
    if (!r) return null;
    const now = Date.now();
    // deep copy: only the top-level item gets a “copy” name suffix
    const clone = (source, top) => {
      const nr = {
        ...source, id: uid(source.type === 'folder' ? 'd' : 'f'),
        name: top ? insertCopySuffix(source.name) : source.name,
        favorite: false, trashedAt: null, demo: false,
        createdAt: now, modifiedAt: now,
      };
      state.records.set(nr.id, nr);
      persist(nr);
      if (source.type === 'folder') {
        for (const c of childrenOf(source.id)) clone(c, false);
      }
      return nr;
    };
    const nr = clone(r, true);
    logActivity('copy', `Copied “${r.name}”`);
    storageStats();
    return nr;
  },

  // files
  async saveFile({ name, size, kind, ext, blob, parentId, openedAt = null }) {
    const now = Date.now();
    const r = {
      id: uid('f'), type: 'file', name, parentId,
      kind, ext, size, createdAt: now, modifiedAt: now,
      openedAt: openedAt || null, favorite: false, trashedAt: null,
      color: null, demo: false, contentId: uid('c'),
    };
    try {
      await state.db.put('blobs', blob, r.contentId);
    } catch (e) {
      const msg = (e && (e.name === 'QuotaExceededError' || e.code === 22)) ? 'storage-full' : 'io';
      return { ok: false, error: msg };
    }
    state.records.set(r.id, r);
    persist(r);
    touchParent(parentId);
    storageStats();
    return { ok: true, rec: r };
  },

  open(id) {
    const r = rec(id);
    if (!r) return;
    if (r.type === 'file') {
      r.openedAt = Date.now();
      persist(r);
    } else {
      r.openedAt = Date.now();
      r.modifiedAt = Math.max(r.modifiedAt, r.openedAt);
      persist(r);
    }
  },

  clearRecents() {
    for (const r of state.records.values()) {
      if (r.openedAt) { r.openedAt = null; persist(r); }
    }
    logActivity('clock', 'Recent activity cleared');
  },

  removeDemoContent() {
    let n = 0;
    for (const r of [...state.records.values()]) {
      if (r.demo) { A.trash(r.id); n++; }
    }
    logActivity('spark', `Removed ${n} sample items`);
    return n;
  },

  // settings
  settings(patch) {
    Object.assign(state.settings, patch);
    persistSettings();
    storageStats();
  },

  async setPin(pin) {
    const salt = newSalt();
    const hash = await hashPin(pin, salt);
    state.settings.pinSalt = salt;
    state.settings.pinHash = hash;
    persistSettings();
    return true;
  },

  async changePin(currentPin, newPin) {
    if (state.settings.pinHash) {
      const ok = await verifyPin(currentPin, state.settings.pinSalt, state.settings.pinHash);
      if (!ok) return { ok: false, error: 'current' };
    }
    if (!/^\d{4,6}$/.test(newPin)) return { ok: false, error: 'format' };
    await A.setPin(newPin);
    logActivity('lock', 'PIN changed');
    return { ok: true };
  },

  // lock session
  unlock() {
    state.session.unlocked = true;
    state.session.unlockedAt = Date.now();
    state.session.failed = 0;
    try { localStorage.setItem('vault:lock', JSON.stringify({ fails: 0, until: 0 })); } catch { /* noop */ }
    if (!state.settings.lockOnRefresh) {
      try { sessionStorage.setItem('vault:unlocked', '1'); } catch { /* noop */ }
    }
  },

  lock() {
    state.session.unlocked = false;
    state.ui.selection.clear();
    try { sessionStorage.removeItem('vault:unlocked'); } catch { /* noop */ }
  },

  async wipe() {
    try { if (state.db) await state.db.clear(); } catch { /* noop */ }
    try {
      for (const k of ['vault:settings', 'vault:activity', 'vault:recentSearches', 'vault:lock']) localStorage.removeItem(k);
      sessionStorage.removeItem('vault:unlocked');
    } catch { /* noop */ }
    location.hash = '';
    location.reload();
  },
};

function touchParent(parentId) {
  if (!parentId) return;
  const p = rec(parentId);
  if (p) { p.modifiedAt = Date.now(); persist(p); }
}

function collectWithDescendants(id) {
  const out = [id];
  for (const r of state.records.values()) {
    if (isDescendant(id, r.id) && r.id !== id) out.push(r.id);
  }
  return out;
}

function insertCopySuffix(name) {
  const dot = name.lastIndexOf('.');
  if (dot > 0) return `${name.slice(0, dot)} copy${name.slice(dot)}`;
  return `${name} copy`;
}

function clearSelection(id) {
  state.ui.selection.delete(id);
}
