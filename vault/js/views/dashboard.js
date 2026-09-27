// Vault — dashboard.

import { icon, vaultMark } from '../icons.js';
import { esc, fmtBytes, relTime, greeting, kindIconHtml, emptyState } from '../ui.js';
import { state, A, CAPACITY_GB, storageStats, recentFiles, allFiles, allFolders, favorites, pathOf } from '../store.js';

export function dashboardHTML() {
  const s = state;
  const st = storageStats();
  const name = s.settings.profileName;
  const pct = Math.min(100, (st.used / (CAPACITY_GB * 1024 ** 3)) * 100);
  const recent = recentFiles(6);
  const acts = s.activities.slice(0, 7);

  return `
  <div class="greet" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div>
      <h1>${greeting()}${name ? `, ${esc(name.split(' ')[0])}` : ''}</h1>
      <div class="gr-sub">
        <span style="color:var(--text-2);font-weight:650">${esc(s.settings.vaultName)}</span>
        <span>·</span><span>${st.files} files</span><span>·</span><span>${st.folders} folders</span>
      </div>
    </div>
    <button class="btn" data-action="lock">${icon('lock', 15)} Lock</button>
  </div>

  <div class="stat-strip">
    <div class="stat"><div class="s-k">${icon('files', 14)} Files</div><div class="s-v">${st.files}</div></div>
    <div class="stat"><div class="s-k">${icon('folder', 14)} Folders</div><div class="s-v">${st.folders}</div></div>
    <div class="stat"><div class="s-k">${icon('star', 14)} Favorites</div><div class="s-v">${st.favs}</div></div>
    <div class="stat"><div class="s-k">${icon('database', 14)} Storage</div><div class="s-v">${fmtBytes(st.used)} <small>of ${CAPACITY_GB} GB</small></div></div>
  </div>

  <div class="quick-actions">
    <button class="qa" data-action="upload">${icon('upload', 18)} Upload <span class="qa-kbd"><span class="kbd">U</span></span></button>
    <button class="qa" data-action="new-folder">${icon('folder', 18)} New folder <span class="qa-kbd"><span class="kbd">N</span></span></button>
    <button class="qa" data-action="import">${icon('download', 18)} Import</button>
    <button class="qa" data-action="focus-search">${icon('search', 18)} Search <span class="qa-kbd"><span class="kbd">/</span></span></button>
  </div>

  <div class="dash-grid">
    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <section class="panel">
        <div class="panel-head"><h3>Recently opened</h3>
          <a class="ph-link" href="#/recent">View all</a></div>
        <div class="panel-body">
          ${recent.length ? recent.map((f) => `
            <div class="row" data-action="open-item" data-id="${f.id}" role="button" tabindex="0" aria-label="Open ${esc(f.name)}">
              ${kindIconHtml(f, 18)}
              <div class="r-main">
                <div class="r-name">${esc(f.name)}</div>
                <div class="r-sub">${pathOf(f).slice(1).join(' / ')}</div>
              </div>
              <div class="r-meta">${relTime(f.openedAt)}<br>${fmtBytes(f.size)}</div>
            </div>`).join('')
          : emptyState({ icon: 'clock', title: 'No recent files', sub: 'Files you open will appear here.', actions: [{ label: 'Browse files', action: 'go-files', primary: true, icon: 'files' }] })}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>Recent activity</h3>
          <button class="ph-link" style="font-size:12.5px;font-weight:620;color:var(--text-3)" data-action="clear-activity" title="Clear activity log">Clear</button></div>
        <div class="activity">
          ${acts.length ? acts.map((a) => `
            <div class="act-item">
              <span class="a-ic">${icon(a.icon, 13)}</span>
              <div><div class="a-t">${a.text}</div><div class="a-time">${relTime(a.ts)}</div></div>
            </div>`).join('')
          : `<div class="empty" style="padding:26px 10px"><p style="margin:0">Activity in your vault will show up here.</p></div>`}
        </div>
      </section>
    </div>

    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <section class="panel storage-panel">
        <div class="panel-head"><h3>Storage</h3><a class="ph-link" href="#/settings/storage">Manage</a></div>
        <div class="panel-body pad">
          <div class="sp-num">${fmtBytes(st.used)} <small>of ${CAPACITY_GB} GB</small></div>
          <div class="sp-bar ${pct > 90 ? 'full' : ''}"><span style="width:${Math.max(1.5, pct)}%"></span></div>
          <div class="sp-line"><span>Files</span><b>${fmtBytes(st.used)}</b></div>
          <div class="sp-line"><span>In Trash</span><b>${fmtBytes(st.trash)}</b></div>
          <div class="sp-line"><span>Free</span><b>${fmtBytes(Math.max(0, CAPACITY_GB * 1024 ** 3 - st.used - st.trash))}</b></div>
        </div>
      </section>

      <div class="tip-card">
        <b style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${icon('spark', 15)} Vault tip</b>
        Press <span class="kbd">⌘</span> <span class="kbd">K</span> anywhere to open the command palette — upload, create folders, lock the vault and jump to any file without touching the mouse.
      </div>

      <section class="panel">
        <div class="panel-head"><h3>Sample content</h3></div>
        <div class="panel-body pad" style="padding-top:12px">
          <p style="font-size:12.5px;color:var(--text-2);line-height:1.6">Your vault came with a few realistic sample files so you could explore right away. You can remove them whenever you like.</p>
          <button class="btn btn-block" style="margin-top:12px" data-action="remove-demo">${icon('spark', 14)} Remove sample content</button>
        </div>
      </section>
    </div>
  </div>`;
}
