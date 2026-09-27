// Vault — upload queue.
// Reads real Files, simulates transfer progress at a size-based rate
// (with jitter, so it feels like a network), supports parallel uploads,
// cancel, retry and quota-aware failure.

import { icon } from './icons.js';
import { toast, fmtBytes, detectKind, kindOf, kindIconHtml, esc } from './ui.js';
import { A, state, rec, storageStats } from './store.js';

const queue = new Map(); // id -> entry

function entryFrom(file, destId) {
  const { kind, ext } = detectKind(file.name);
  const size = file.size;
  // realistic rate: ~2.2 MB/s with jitter → small files ~1-2s, big ones longer
  const ms = Math.min(9000, Math.max(900, (size / (2.2 * 1024 * 1024)) * 1000));
  return {
    id: 'up_' + Math.random().toString(36).slice(2, 9),
    file, name: file.name, size, kind, ext, destId,
    progress: 0, status: 'uploading', error: null, timer: null,
    startedAt: Date.now(), ms,
  };
}

function start(entry) {
  entry.timer = setInterval(() => {
    const speed = 0.75 + Math.random() * 0.6; // jitter
    entry.progress = Math.min(100, entry.progress + (100 / (entry.ms / 120)) * speed);
    renderQueue();
    if (entry.progress >= 100) {
      clearInterval(entry.timer);
      finish(entry);
    }
  }, 120);
}

async function finish(entry) {
  entry.progress = 100;
  try {
    const res = await A.saveFile({
      name: entry.name, size: entry.size, kind: entry.kind, ext: entry.ext,
      blob: entry.file, parentId: entry.destId,
    });
    if (!res.ok) {
      entry.status = 'error';
      entry.error = res.error === 'storage-full' ? 'Not enough room in local storage' : 'Could not save the file';
      renderQueue();
      return;
    }
    entry.status = 'done';
    renderQueue();
  } catch (e) {
    entry.status = 'error';
    entry.error = 'Could not save the file';
    renderQueue();
  }
}

function cancel(entry) {
  if (entry.timer) clearInterval(entry.timer);
  entry.status = 'canceled';
  queue.delete(entry.id);
  renderQueue();
  if (!queue.size) closeUploads();
}

function retry(entry) {
  entry.status = 'uploading';
  entry.error = null;
  entry.progress = 0;
  start(entry);
  renderQueue();
}

export function openUploads(files, destId = null) {
  if (!files || !files.length) return;
  const list = [...files];
  state.ui.drawer = 'upload';
  for (const f of list) {
    const MAX = 2 * 1024 * 1024 * 1024; // 2 GB practical ceiling
    const e = entryFrom(f, destId);
    if (f.size > MAX) {
      e.status = 'error';
      e.error = 'File is larger than 2 GB';
      queue.set(e.id, e);
      continue;
    }
    queue.set(e.id, e);
    start(e);
  }
  renderUploadDrawer();
}

export function queueSize() { return queue.size; }
export function hasActive() { for (const e of queue.values()) if (e.status === 'uploading') return true; return false; }

function rowHtml(e) {
  const k = KINDS[e.kind] || KINDS.other;
  const c = k.hue;
  const pct = Math.round(e.progress);
  let statusHtml = '';
  if (e.status === 'uploading') statusHtml = `<span class="up-status">${pct}%</span>`;
  if (e.status === 'done') statusHtml = `<span class="up-status ok">Done</span>`;
  if (e.status === 'error') statusHtml = `<span class="up-status bad">${esc(e.error || 'Failed')}</span>`;
  return `<div class="up-row ${e.status}" data-up="${e.id}">
    <span class="ficon" style="background:color-mix(in srgb, ${c} 14%, transparent);color:${c}">${icon(k.icon, 19)}</span>
    <div class="up-main">
      <div class="up-name" title="${esc(e.name)}">${esc(e.name)}</div>
      <div class="up-sub"><span>${fmtBytes(e.size)}</span>${statusHtml}</div>
      <div class="up-bar"><span style="width:${e.status === 'done' ? 100 : pct}%"></span></div>
    </div>
    <div class="up-actions">
      ${e.status === 'uploading' ? `<button class="icon-btn sm" data-action="up-cancel" data-id="${e.id}" title="Cancel upload" aria-label="Cancel upload">${icon('x', 14)}</button>` : ''}
      ${e.status === 'error' ? `<button class="icon-btn sm" data-action="up-retry" data-id="${e.id}" title="Retry" aria-label="Retry">${icon('restore', 14)}</button>
        <button class="icon-btn sm" data-action="up-remove" data-id="${e.id}" title="Remove" aria-label="Remove">${icon('x', 14)}</button>` : ''}
      ${e.status === 'done' ? `<button class="icon-btn sm" data-action="up-remove" data-id="${e.id}" title="Remove" aria-label="Remove">${icon('x', 14)}</button>` : ''}
    </div>
  </div>`;
}

function renderQueue() {
  const body = document.getElementById('upload-queue');
  if (!body) return;
  const entries = [...queue.values()];
  body.innerHTML = entries.length
    ? entries.map(rowHtml).join('')
    : `<div class="empty" style="padding:30px 10px"><b>Queue is clear</b><p>Uploads will appear here with live progress.</p></div>`;
  // summary toast when everything settles
  const active = entries.filter((e) => e.status === 'uploading');
  if (!active.length && entries.length && !renderQueue._notified) {
    renderQueue._notified = true;
    const done = entries.filter((e) => e.status === 'done').length;
    const failed = entries.filter((e) => e.status === 'error').length;
    if (done === 1 && !failed) toast(`Uploaded “${entries.find((e) => e.status === 'done').name}”`, { type: 'success', icon: 'upload' });
    else if (done > 1 && !failed) toast(`${done} files uploaded`, { type: 'success', icon: 'upload' });
    else if (done > 1) toast(`${done} uploaded, ${failed} failed`, { type: 'error', icon: 'alert' });
    else if (failed) toast('Upload failed', { type: 'error', icon: 'alert' });
    storageStats();
  }
  if (active.length) renderQueue._notified = false;
}

function renderUploadDrawer() {
  // drawer is rendered by the shell on state.ui.drawer === 'upload';
  // if it's not open yet, the app render loop picks it up.
  if (!document.getElementById('drawer-root').hidden) renderQueue();
}

export function uploadDrawerBody() {
  const entries = [...queue.values()];
  const destId = entries[0]?.destId || state.ui.uploadDestination || null;
  const destName = destId ? rec(destId)?.name : state.settings.vaultName;
  return `
    <div style="font-size:12.5px;color:var(--text-3);margin-bottom:14px;display:flex;align-items:center;gap:8px">
      ${icon('folder', 14)} Uploading to <b style="color:var(--text-2)">${esc(destName)}</b>
    </div>
    <div id="upload-queue">${entries.map(rowHtml).join('')}</div>`;
}

export function closeUploads() {
  state.ui.drawer = null;
  queue.clear();
  renderQueue._notified = false;
  const root = document.getElementById('drawer-root');
  if (!root.hidden && state.ui.drawer === null) {
    root.hidden = true;
    root.innerHTML = '';
    document.body.style.overflow = '';
  }
}

// internal queue access (used by app.js actions)
export function _queueGet(id) { return queue.get(id); }
export function _cancel(e) { cancel(e); }
export function _retry(e) { retry(e); }
export function _delete(id) {
  const e = queue.get(id);
  if (e && e.timer) clearInterval(e.timer);
  queue.delete(id);
  renderQueue();
  if (!queue.size) closeUploads();
}

export function pickFiles(destId = null) {
  const input = document.getElementById('file-input');
  if (!input) return;
  state.ui.uploadDestination = destId;
  input.value = '';
  input.dataset.destId = destId || '';
  input.click();
}
