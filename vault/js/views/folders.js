// Vault — Folders (all folders, nested, with color + stats).

import { icon } from '../icons.js';
import { esc, fmtBytes, fmtDate, kindIconHtml, emptyState } from '../ui.js';
import { state, allFolders, childrenOf, recursiveSize, pathOf } from '../store.js';

export function foldersHTML() {
  const s = state;
  const folders = allFolders().sort((a, b) => {
    const da = depth(a.id), db = depth(b.id);
    if (da !== db) return da - db;
    const pa = a.parentId || 'root', pb = b.parentId || 'root';
    if (pa !== pb) return pa.localeCompare(pb);
    return a.name.localeCompare(b.name);
  });

  const rows = folders.map((f) => {
    const d = depth(f.id);
    const c = f.color || '#7d8db0';
    return `
    <div class="folder-row" data-action="go-folder" data-id="${f.id}" role="button" tabindex="0" aria-label="Open folder ${esc(f.name)}">
      ${kindIconHtml(f, 18)}
      <div class="fr-main" style="margin-left:${d * 16}px">
        <div class="fr-name">
          ${esc(f.name)} ${f.favorite ? `<span class="fav-btn on" style="color:var(--warn);vertical-align:1px">${icon('star', 12)}</span>` : ''}
        </div>
        <div class="fr-sub">${pathOf(f).slice(1).join(' / ') || 'root'}</div>
      </div>
      <div class="fr-meta">
        <div>${childrenOf(f.id).length} items</div>
        <div style="opacity:.75">${fmtBytes(recursiveSize(f.id))} · ${fmtDate(f.modifiedAt)}</div>
      </div>
      <span class="fr-actions">
        <button class="icon-btn sm fav-btn ${f.favorite ? 'on' : ''}" data-action="fav" data-id="${f.id}" title="Favorite" aria-label="Toggle favorite">${icon('star', 14)}</button>
        <button class="icon-btn sm" data-action="folder-edit" data-id="${f.id}" title="Folder options" aria-label="Folder options">${icon('dots', 14)}</button>
      </span>
    </div>`;
  }).join('');

  return `
    <div class="view-title-row">
      <h1>Folders</h1>
      <span class="vt-count">${folders.length} folder${folders.length === 1 ? '' : 's'}</span>
    </div>
    <div class="toolbar">
      <div class="tb-right">
        <button class="btn btn-primary" data-action="new-folder" data-dest="">${icon('plus', 14)} New folder</button>
      </div>
    </div>
    <div class="panel" style="padding:0 8px">
      ${rows || emptyState({ icon: 'folder', title: 'No folders yet', sub: 'Create your first folder to start organizing.', actions: [{ label: 'New folder', action: 'new-folder', primary: true, icon: 'plus' }] })}
    </div>`;
}

function depth(id) {
  let d = 0, cur = state.records.get(id);
  while (cur && cur.parentId) { d++; cur = state.records.get(cur.parentId); }
  return d;
}

export const FOLDER_COLORS = ['#7d8db0', '#4c8dff', '#4fa36b', '#e07b45', '#9b7cf6', '#d05656', '#2fb7a3', '#c99a4b'];

export function folderModalHTML() {
  const m = state.ui.folderModal;
  if (!m) return '';
  const editing = m.mode === 'edit';
  const f = editing ? state.records.get(m.id) : null;
  const colors = FOLDER_COLORS.map((c) => `
    <button class="color-dot" style="background:${c};width:24px;height:24px;border-radius:8px;border:2px solid ${f?.color === c ? 'var(--text)' : 'transparent'};transition:transform .1s"
      data-action="folder-color" data-color="${c}" aria-label="Folder color ${c}"></button>`).join('') +
    `<button class="color-dot" style="width:24px;height:24px;border-radius:8px;border:2px dashed var(--border-2);background:var(--surface)"
      data-action="folder-color" data-color="" aria-label="Default color" title="Default"></button>`;
  return `
    <div class="field">
      <label for="fn-name">Name</label>
      <input class="input" id="fn-name" value="${esc(f?.name || '')}" placeholder="Folder name" maxlength="80" />
    </div>
    <div class="field" style="margin-bottom:6px">
      <label>Color</label>
      <div style="display:flex;gap:9px;flex-wrap:wrap">${colors}</div>
    </div>`;
}
