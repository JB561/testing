# Vault

A private, local-first file vault for the browser. Premium dark UI, zero
dependencies, zero build step — plain ES modules served by any static host.

Your files live in your browser's IndexedDB. They never leave your device.

## Run it

Any static file server works (ES modules require `http://`, not `file://`):

```bash
cd vault
python3 -m http.server 8080
# → http://localhost:8080
```

First launch shows a lock screen: create a 4–6 digit PIN and you're in.

## Test it

```bash
cd vault
node smoke-test.mjs
```

Covers seeding, file/folder CRUD, trash, PIN hashing, upload state, and
renders of every view. No browser required (uses an in-memory IndexedDB).

## Features

- **PIN lock** — hashed (salted SHA-256, 4096 rounds), never stored or shown
  in plaintext; show/hide toggle; 5 failed attempts → 30 s lockout; optional
  auto-lock on inactivity and lock-on-refresh
- **Files browser** — grid/list, nested folders with colors, sort, type
  filters, search, favorites, multi-select (click / ctrl / shift), rename,
  move, copy, delete, download
- **Uploads** — multi-file, drag & drop, per-file progress with cancel/retry
- **Previews** — image zoom/pan, real PDFs, audio/video, syntax-highlighted
  code & text
- **Trash** — restore, delete forever, empty, with confirmation
- **⌘K / Ctrl+K command palette**, keyboard shortcuts (`/`, `N`, `U`, `Esc`,
  `Delete`), right-click context menus (touch-friendly)
- **Settings** — account, security, appearance (theme, density), storage,
  privacy, danger zone
- Fully responsive (desktop → mobile), reduced-motion support

## Honest security notes

- Files are stored **unencrypted** in IndexedDB on your device and are only
  protected by the PIN gate and normal browser storage isolation.
- The PIN is stored as a one-way salted hash — but that is an access gate,
  not file encryption. Anyone with export access to the browser profile can
  read the raw data.
- There is no server, no sync, and no end-to-end encryption — because there
  is no network at all. The storage layer (`js/db.js`) is isolated so a real
  backend (with real encryption) can be swapped in later.

## Architecture

```
vault/
├── index.html          shell + overlay roots
├── css/styles.css      design tokens, dark/light, density
└── js/
    ├── icons.js        inline SVG icon set
    ├── db.js           IndexedDB wrapper (in-memory fallback for tests)
    ├── crypto.js       salted, iterated SHA-256 PIN hashing
    ├── seed.js         generated demo content (real PDF/ZIP/WAV/SVG bytes)
    ├── store.js        state + all domain actions (A.*)
    ├── ui.js           toasts, modals, context menus, drawers, formatters
    ├── upload.js       upload queue with realistic progress + cancel
    ├── preview.js      file previews (zoom, PDF, media, syntax highlight)
    ├── palette.js      command palette
    ├── app.js          router, event delegation, keyboard, auto-lock
    └── views/          lock, dashboard, files, folders, settings
```

One-way data flow: views render from `state`, the UI mutates through the
`A.*` actions in `store.js`, and `render()` repaints. Swapping the backend
means reimplementing `db.js` and the persistence calls in `store.js`.
