// Vault — functional smoke test (Node, in-memory storage backend).
// Exercises the real store + seed + crypto + view rendering pipeline.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.sessionStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};
globalThis.location = { hash: '', reload: () => {} };
globalThis.document = {
  documentElement: { dataset: {} },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, click() {}, remove() {} }),
  addEventListener() {},
  body: { style: {}, appendChild() {} },
};

let fails = 0;
const ok = (cond, label) => {
  if (cond) console.log('  ok:', label);
  else { fails++; console.error('  FAIL:', label); }
};

console.log('== init & seed ==');
const { init, state, A, rec, childrenOf, allFiles, allFolders, storageStats, trashedItems, favorites, recentFiles, fullPathText } = await import('./js/store.js');
await init();
ok(state.ready, 'store ready');
ok(state.records.size === 20, `20 demo records (got ${state.records.size})`);
ok(allFolders().length === 5, '5 demo folders');
ok(allFiles().length === 15, '15 demo files');
ok(state.session.firstRun, 'first-run flag set');
const st = storageStats();
ok(st.used > 5000 && st.used < 2_000_000, `usage realistic: ${st.used} B`);
ok(st.folders === 5 && st.files === 15, 'stats counts');
ok(st.favs === 3, '3 favorites');

console.log('== generated files are valid ==');
const getBlob = async (id) => state.db.get('blobs', id);
const pdf = await getBlob('f_notes');
ok(new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 8).arrayBuffer())).startsWith('%PDF-1.4'), 'PDF magic header');
ok(new TextDecoder().decode(new Uint8Array(await (await getBlob('f_notes')).slice(-12, undefined).arrayBuffer())).includes('%%EOF'), 'PDF EOF marker');
const zip = new Uint8Array(await (await getBlob('f_zip')).arrayBuffer());
let eocd = -1;
for (let i = zip.length - 22; i >= 0; i--) if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 5 && zip[i + 3] === 6) { eocd = i; break; }
ok(eocd >= 0, 'ZIP EOCD signature');
const wav = new Uint8Array(await (await getBlob('f_wav')).arrayBuffer());
ok(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]) === 'RIFF' && String.fromCharCode(wav[8], wav[9], wav[10], wav[11]) === 'WAVE', 'WAV RIFF/WAVE headers');
const svg = await getBlob('f_shot');
ok(svg.type === 'image/svg+xml', 'SVG image blob type');

console.log('== folder actions ==');
const f = A.createFolder('Receipts', null, '#4c8dff');
ok(rec(f.id)?.type === 'folder' && rec(f.id)?.color === '#4c8dff', 'createFolder with color');
ok(childrenOf(null).some((r) => r.id === f.id), 'folder at root');
ok(A.rename(f.id, 'Old Receipts'), 'rename folder');
ok(rec(f.id)?.name === 'Old Receipts', 'rename applied');
const sub = A.createFolder('Invoices', f.id);
ok(rec(sub.id)?.parentId === f.id, 'nested folder');
ok(A.move(sub.id, null), 'move folder to root');
ok(rec(sub.id)?.parentId === null, 'move applied');
// moving a folder into its own descendant must be refused
const child = A.createFolder('Child', f.id);
ok(A.move(f.id, child.id) === false, 'cannot move folder into its own descendant');
A.move(child.id, null);
A.setColor(f.id, null);
ok(rec(f.id)?.color === null, 'clear folder color');

console.log('== file actions ==');
const saved = await A.saveFile({ name: 'test-upload.txt', size: 12, kind: 'text', ext: 'txt', blob: new Blob(['hello vault\n']), parentId: null });
ok(saved.ok, 'saveFile ok');
const up = saved.rec;
ok(rec(up.id)?.size === 12, 'file size stored');
const got = await state.db.get('blobs', up.contentId);
ok(new TextDecoder().decode(new Uint8Array(await got.arrayBuffer())) === 'hello vault\n', 'blob round-trip');
A.open(up.id);
ok(rec(up.id)?.openedAt, 'openedAt tracked');
ok(recentFiles(3).some((r) => r.id === up.id), 'recent includes new file');

const favId = A.toggleFav(up.id);
ok(favId === true && rec(up.id)?.favorite, 'favorite on');
A.toggleFav(up.id);
ok(rec(up.id)?.favorite === false, 'favorite off');

A.trash(up.id);
ok(rec(up.id)?.trashedAt, 'trashed');
ok(trashedItems().some((r) => r.id === up.id), 'in trash list');
A.restore(up.id);
ok(!rec(up.id)?.trashedAt, 'restored');

const cp = A.copy(up.id);
ok(cp && cp.id !== up.id && cp.name === 'test-upload copy.txt', 'copy with suffix');
const folderCopy = A.copy(sub.id);
ok(folderCopy && folderCopy.name === 'Invoices copy', 'folder copy name');
ok(childrenOf(folderCopy.id).length === 0, 'empty folder deep copy');

A.trash(up.id);
A.deleteForever(up.id);
ok(!rec(up.id), 'deleteForever removes record');
A.deleteForever(cp.id);
A.deleteForever(folderCopy.id);

console.log('== trash & demo ==');
A.trash('f_ideas');
const emptied = A.emptyTrash();
ok(emptied >= 1, `emptyTrash removed ${emptied}`);
ok(trashedItems().length === 0, 'trash now empty');
// f_ideas was already destroyed above, so 19 demo items remain
const demoRemoved = A.removeDemoContent();
ok(demoRemoved === 19, `removed ${demoRemoved} demo items`);
ok(trashedItems().length === 19, 'demo items in trash');
ok(allFiles().length === 0, 'no live files after demo removal');
// clean up the non-demo folders created in the folder-actions section
A.deleteForever(f.id);
A.deleteForever(sub.id);
A.deleteForever(child.id);
A.emptyTrash();
ok(state.records.size === 0, 'records cleared');
ok(trashedItems().length === 0, 'trash cleared after empty');

console.log('== PIN crypto ==');
const { hashPin, verifyPin, newSalt } = await import('./js/crypto.js');
const salt = newSalt();
const h = await hashPin('1234', salt);
ok(h.length === 64, 'hash is hex sha256');
ok(await verifyPin('1234', salt, h), 'verify correct pin');
ok(!(await verifyPin('9999', salt, h)), 'reject wrong pin');
ok(h !== (await hashPin('1234', newSalt())), 'salts differ hashes');

console.log('== views render ==');
// re-seed for view tests
store.clear();
await import('./js/store.js'); // fresh module state not possible; instead use A to recreate
const { dashboardHTML } = await import('./js/views/dashboard.js');
const { browserHTML } = await import('./js/views/files.js');
const { foldersHTML } = await import('./js/views/folders.js');
const { settingsHTML } = await import('./js/views/settings.js');
const { lockScreenHTML } = await import('./js/views/lock.js');
const { paletteResults } = await import('./js/palette.js');

state.settings.vaultName = 'Work Vault';
state.settings.profileName = 'Alex Doe';
// create minimal content
A.createFolder('Docs', null);
const rec2 = A.createFolder('Inner', null);
await A.saveFile({ name: 'note.txt', size: 4, kind: 'text', ext: 'txt', blob: new Blob(['ab\nc']), parentId: rec2.id });

const htmls = [
  ['dashboard', dashboardHTML()],
  ['files-root', browserHTML('files')],
  ['files-folder', browserHTML('files')],
  ['favorites', browserHTML('favorites')],
  ['recent', browserHTML('recent')],
  ['trash', browserHTML('trash')],
  ['folders', foldersHTML()],
  ['settings', settingsHTML()],
  ['lock', lockScreenHTML()],
];
for (const [name, html] of htmls) {
  ok(typeof html === 'string' && html.length > 120, `${name} renders (${html.length}B)`);
  ok(!/undefined|NaN|\[object Object\]/.test(html), `${name} no template leaks`);
}
const acts = paletteResults('');
ok(acts.acts.length >= 8 && acts.items.length >= 3, `palette has actions (${acts.acts.length}) + items (${acts.items.length})`);
ok(paletteResults('folder').acts.some((a) => a.label.includes('Folder')), 'palette action filter');

// list layout + sort
state.ui.viewMode = 'list';
state.ui.sort = 'name';
const listHtml = browserHTML('files');
ok(listHtml.includes('ll-row') || listHtml.includes('ll-head') || listHtml.includes('empty'), 'list layout renders');
state.ui.viewMode = 'grid';

// lock screen: initial state must be well-formed (regression: lockPin was undefined → digit clicks threw)
ok(typeof state.ui.lockPin === 'string' && state.ui.lockPin === '', 'initial lockPin is empty string (not undefined)');
ok(state.ui.lockStep === 1 && state.ui.lockFirstPin === null && state.ui.lockShowPin === false, 'initial lock ui fields initialized');

// lock screen first-run — simulate tapping the numpad with the handler's real expression
state.session.firstRun = true;
const press = (d) => { state.ui.lockPin = (state.ui.lockPin || '') + d; };
const backspace = () => { state.ui.lockPin = (state.ui.lockPin || '').slice(0, -1); };
for (const d of ['1', '2', '3', '4', '5', '4']) press(d);
backspace();
backspace();
const lockHtml = lockScreenHTML();
ok(lockHtml.includes('Create a PIN') && lockHtml.includes('1') && (lockHtml.match(/pin-slot filled/g) || []).length === 4,
  'first-run lock shows create PIN + 4 typed digits after backspaces');
ok(lockHtml.includes('Create vault'), 'first-run step 1 renders a submit button (was missing → 4–5 digit PINs stuck)');
ok(!/disabled/.test(lockHtml.split('pin-submit')[1].split('>')[0]), 'submit enabled once 4+ digits typed');
state.session.firstRun = false;
state.ui.lockPin = '';
const lockHtml2 = lockScreenHTML();
ok(lockHtml2.includes('Unlock Vault') && lockHtml2.includes('Enter your PIN to continue'), 'normal lock screen');

console.log(fails ? `\n${fails} FAILURES` : '\nALL SMOKE TESTS PASSED ✓');
process.exit(fails ? 1 : 0);
