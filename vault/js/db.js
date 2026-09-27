// Vault — storage layer.
// Real IndexedDB in the browser; a memory-compatible fallback so the
// same code runs under Node (smoke tests) and a server backend can
// replace this module later without touching the app.

const STORE_META = 'meta';
const STORE_BLOBS = 'blobs';

// ---------- in-memory fallback (Node / tests) ----------
function createMemoryDB() {
  const tables = {};
  const table = (name) => (tables[name] = tables[name] || new Map());
  return {
    _memory: true,
    async put(store, value, key) {
      if (store === STORE_META) table(store).set(value.id, value);
      else table(store).set(key, value);
    },
    async get(store, key) { return table(store).get(key); },
    async del(store, key) { table(store).delete(key); },
    async all(store) { return [...table(store).values()]; },
    async clear() { for (const k of Object.keys(tables)) delete tables[k]; },
    async close() {},
  };
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- real IDB ----------
function openRealDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vault', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
    };
    req.onsuccess = () => {
      const db = req.result;
      resolve({
        put: (store, value, key) => new Promise((res, rej) => {
          const t = db.transaction(store, 'readwrite');
          const s = t.objectStore(store);
          const r = key == null ? s.put(value) : s.put(value, key);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        }),
        get: (store, key) => promisify(db.transaction(store, 'readonly').objectStore(store).get(key)),
        del: (store, key) => new Promise((res, rej) => {
          const r = db.transaction(store, 'readwrite').objectStore(store).delete(key);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        }),
        all: (store) => promisify(db.transaction(store, 'readonly').objectStore(store).getAll()),
        clear: () => new Promise((res) => {
          const d2 = indexedDB.deleteDatabase('vault');
          const done = () => { try { db.close(); } catch { /* noop */ } res(); };
          d2.onsuccess = done;
          d2.onerror = done;
          d2.onblocked = done;
        }),
        close: () => db.close(),
      });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function openStore() {
  if (globalThis.indexedDB) {
    try { return await openRealDB(); } catch { /* fall through */ }
  }
  return createMemoryDB();
}
