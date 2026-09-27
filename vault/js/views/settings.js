// Vault — Settings: Account, Security, Appearance, Storage, Privacy.

import { icon } from '../icons.js';
import { esc, fmtBytes, fmtDateTime, KINDS } from '../ui.js';
import { state, A, CAPACITY_GB, storageStats, trashedItems } from '../store.js';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'storage', label: 'Storage', icon: 'database' },
  { id: 'privacy', label: 'Privacy', icon: 'shield' },
];

export function settingsHTML() {
  const s = state;
  const sec = s.ui.settingsSection || 'account';
  return `
    <div class="view-title-row"><h1>Settings</h1></div>
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">
        ${SECTIONS.map((x) => `
          <button class="sn-item ${sec === x.id ? 'active' : ''}" data-action="settings-sec" data-sec="${x.id}">
            ${icon(x.icon, 16)} ${x.label}
          </button>`).join('')}
      </nav>
      <div class="settings-panel">
        ${sec === 'account' ? accountPanel() : ''}
        ${sec === 'security' ? securityPanel() : ''}
        ${sec === 'appearance' ? appearancePanel() : ''}
        ${sec === 'storage' ? storagePanel() : ''}
        ${sec === 'privacy' ? privacyPanel() : ''}
      </div>
    </div>`;
}

function accountPanel() {
  const s = state;
  const initials = (s.settings.profileName || 'You').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `
    <div class="settings-card">
      <div class="sc-title">Profile</div>
      <div class="profile-row">
        <div class="avatar-lg">${esc(initials)}</div>
        <div style="flex:1;min-width:0">
          <div class="field" style="margin-bottom:4px">
            <label for="set-name">Display name</label>
            <input class="input" id="set-name" value="${esc(s.settings.profileName)}" placeholder="Your name" maxlength="40" />
          </div>
        </div>
        <button class="btn" data-action="save-profile" style="margin-top:16px">Save</button>
      </div>
    </div>
    <div class="settings-card">
      <div class="sc-title">Vault</div>
      <div class="field" style="margin-bottom:6px">
        <label for="set-vault">Vault name</label>
        <input class="input" id="set-vault" value="${esc(s.settings.vaultName)}" placeholder="Vault name" maxlength="40" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div class="sr-s" style="margin:0">Used to greet you and label this space.</div>
        <button class="btn" data-action="save-vault-name">Save</button>
      </div>
    </div>`;
}

function securityPanel() {
  const s = state;
  const hasPin = !!s.settings.pinHash;
  const lockState = s.session.failed;
  return `
    <div class="settings-card">
      <div class="sc-title">PIN</div>
      <div class="setting-row">
        <div class="sr-main">
          <div class="sr-t">Change PIN</div>
          <div class="sr-s">${hasPin ? 'Your PIN is stored as a salted one-way hash on this device.' : 'No PIN set yet.'}</div>
        </div>
        <button class="btn" data-action="change-pin">${icon('lock', 14)} ${hasPin ? 'Change' : 'Set'}</button>
      </div>
      <div class="setting-row">
        <div class="sr-main">
          <div class="sr-t">Failed-attempt protection</div>
          <div class="sr-s">After 5 wrong PINs the pad locks for 30 seconds. ${lockState ? `Current failed attempts this session: ${lockState}.` : 'No failed attempts this session.'}</div>
        </div>
        <span class="tag">Active</span>
      </div>
    </div>
    <div class="settings-card">
      <div class="sc-title">Locking</div>
      <div class="setting-row">
        <div class="sr-main">
          <div class="sr-t">Auto-lock after inactivity</div>
          <div class="sr-s">The vault locks itself when you stop interacting with it.</div>
        </div>
        <select class="select" data-action="set-autolock" aria-label="Auto-lock duration">
          <option value="0" ${s.settings.autoLockMin === 0 ? 'selected' : ''}>Off</option>
          <option value="1" ${s.settings.autoLockMin === 1 ? 'selected' : ''}>1 minute</option>
          <option value="5" ${s.settings.autoLockMin === 5 ? 'selected' : ''}>5 minutes</option>
          <option value="15" ${s.settings.autoLockMin === 15 ? 'selected' : ''}>15 minutes</option>
          <option value="30" ${s.settings.autoLockMin === 30 ? 'selected' : ''}>30 minutes</option>
          <option value="60" ${s.settings.autoLockMin === 60 ? 'selected' : ''}>1 hour</option>
        </select>
      </div>
      <div class="setting-row">
        <div class="sr-main">
          <div class="sr-t">Lock on page refresh</div>
          <div class="sr-s">Ask for your PIN every time the page loads or refreshes.</div>
        </div>
        <label class="switch"><input type="checkbox" data-action="set-lockrefresh" ${s.settings.lockOnRefresh ? 'checked' : ''} /><span class="track"></span></label>
      </div>
      <div class="setting-row">
        <div class="sr-main">
          <div class="sr-t">Lock now</div>
          <div class="sr-s">Immediately lock the vault and return to the lock screen.</div>
        </div>
        <button class="btn" data-action="lock">${icon('lock', 14)} Lock</button>
      </div>
    </div>`;
}

function appearancePanel() {
  const s = state;
  return `
    <div class="settings-card">
      <div class="sc-title">Theme</div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Dark theme</div><div class="sr-s">The vault is built around a deep, calm dark surface.</div></div>
        <label class="switch"><input type="checkbox" data-action="set-theme" ${s.settings.theme === 'dark' ? 'checked' : ''} /><span class="track"></span></label>
      </div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Density</div><div class="sr-s">Compact fits more on screen; comfortable is roomier.</div></div>
        <div class="seg">
          <label class="seg-lbl ${s.settings.density === 'comfortable' ? 'active' : ''}"><button data-action="set-density" data-density="comfortable" style="width:auto;padding:0">Comfortable</button></label>
          <label class="seg-lbl ${s.settings.density === 'compact' ? 'active' : ''}"><button data-action="set-density" data-density="compact" style="width:auto;padding:0">Compact</button></label>
        </div>
      </div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Default file view</div><div class="sr-s">Used when you open the Files section.</div></div>
        <div class="seg">
          <label class="seg-lbl ${s.settings.defaultView === 'grid' ? 'active' : ''}"><button data-action="set-default-view" data-view="grid" style="width:auto;padding:0">${icon('grid', 14)} Grid</button></label>
          <label class="seg-lbl ${s.settings.defaultView === 'list' ? 'active' : ''}"><button data-action="set-default-view" data-view="list" style="width:auto;padding:0">${icon('list', 14)} List</button></label>
        </div>
      </div>
    </div>`;
}

function storagePanel() {
  const st = storageStats();
  const pct = Math.min(100, (st.used / (CAPACITY_GB * 1024 ** 3)) * 100);
  const trashItems = trashedItems();
  return `
    <div class="settings-card">
      <div class="sc-title">Usage</div>
      <div style="padding:14px 0 6px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700"><span>${fmtBytes(st.used)}</span><span style="color:var(--text-3);font-weight:600">of ${CAPACITY_GB} GB</span></div>
        <div class="sp-bar" style="height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin:12px 0"><span style="display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),#7db1ff);width:${Math.max(1.5, pct)}%"></span></div>
        <div class="sp-line" style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:var(--text-2)"><span>Files (${st.files})</span><b style="color:var(--text)">${fmtBytes(st.used)}</b></div>
        <div class="sp-line" style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:var(--text-2)"><span>Folders (${st.folders})</span><b style="color:var(--text)">—</b></div>
        <div class="sp-line" style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:var(--text-2)"><span>Trash (${trashItems.length} items)</span><b style="color:var(--text)">${fmtBytes(st.trash)}</b></div>
        <div class="sp-line" style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;color:var(--text-2)"><span>Free</span><b style="color:var(--text)">${fmtBytes(Math.max(0, CAPACITY_GB * 1024 ** 3 - st.used - st.trash))}</b></div>
      </div>
      <p style="font-size:12px;color:var(--text-3);padding-bottom:14px;line-height:1.6">Files are stored in this browser's local storage (IndexedDB). The ${CAPACITY_GB} GB figure is your personal plan ceiling — real usage is measured from actual file sizes.</p>
    </div>`;
}

function privacyPanel() {
  const s = state;
  const rs = s.ui.recentSearches;
  return `
    <div class="settings-card">
      <div class="sc-title">Recent searches</div>
      ${rs.length ? `
        <div style="padding:8px 0 14px;display:flex;flex-direction:column;gap:2px">
          ${rs.map((q) => `
            <div class="row" data-action="run-search" data-q="${esc(q)}" style="cursor:pointer" role="button" tabindex="0">
              ${icon('search', 14)}
              <div class="r-main"><div class="r-name" style="font-weight:560">${esc(q)}</div></div>
              <button class="icon-btn sm" data-action="del-recent-search" data-q="${esc(q)}" aria-label="Remove search">${icon('x', 13)}</button>
            </div>`).join('')}
        </div>
        <div style="padding-bottom:12px"><button class="btn btn-ghost btn-sm" data-action="clear-recent-searches">Clear all searches</button></div>`
      : `<p style="font-size:13px;color:var(--text-3);padding:10px 0 16px">No recent searches yet.</p>`}
    </div>
    <div class="settings-card">
      <div class="sc-title">Activity &amp; data</div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Clear recent activity</div><div class="sr-s">Removes “recently opened” history and the activity log.</div></div>
        <button class="btn" data-action="clear-recents">${icon('clock', 14)} Clear</button>
      </div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Session</div>
        <div class="sr-s">${s.session.unlocked ? `Unlocked at ${fmtDateTime(s.session.unlockedAt)} · ${s.session.failed} failed attempt${s.session.failed === 1 ? '' : 's'}` : 'Vault is locked.'} Storage engine: IndexedDB (this device only).</div></div>
      </div>
    </div>
    <div class="settings-card danger-zone">
      <div class="sc-title">Danger zone</div>
      <div class="setting-row">
        <div class="sr-main"><div class="sr-t">Clear local data</div><div class="sr-s">Deletes every file, folder, setting and your PIN from this device. This cannot be undone.</div></div>
        <button class="btn btn-danger" data-action="wipe">${icon('trash', 14)} Erase</button>
      </div>
    </div>`;
}
