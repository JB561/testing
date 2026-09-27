// Vault — file preview.
// Images (zoom + pan), real PDFs (native viewer), audio/video players,
// syntax-highlighted code/text, and a clean fallback for everything else.

import { icon } from './icons.js';
import { esc, fmtBytes, fmtDateTime, kindIconHtml, kindOf } from './ui.js';
import { rec, A, state } from './store.js';

let objectUrls = [];
function track(url) { objectUrls.push(url); return url; }
function releaseUrls() {
  for (const u of objectUrls) URL.revokeObjectURL(u);
  objectUrls = [];
}

// ---------- tiny syntax highlighter (regex tokenizer) ----------
const GRAMMARS = {
  js: {
    kw: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|class|extends|new|delete|typeof|instanceof|in|of|async|await|try|catch|finally|throw|this|super|yield|static|get|set|void|null|undefined|true|false)\b/g,
    re: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g,
  },
  py: {
    kw: /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|lambda|pass|break|continue|global|nonlocal|assert|del|yield|async|await|in|not|and|or|is|None|True|False|self)\b/g,
    re: /(#[^@\n]*$)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(?<=[A-Za-z_])[#@][A-Za-z_@.]*|\b(\d+(?:\.\d+)?)\b/gm,
  },
  json: {
    kw: /\b(true|false|null)\b/g,
    re: /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
  },
  css: {
    kw: /@[\w-]+|\b(important)\b/g,
    re: /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(\d+(?:\.\d+)?)(px|em|rem|vh|vw|s|ms|fr|%)?/g,
  },
  md: null,
};
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function highlight(code, ext) {
  const lang = { js: 'js', jsx: 'js', ts: 'js', tsx: 'js', mjs: 'js', cjs: 'js', py: 'py', json: 'json', css: 'css', scss: 'css' }[ext] || null;
  const g = lang && GRAMMARS[lang];
  if (!g) {
    // markdown-ish: headings, bold, code, links
    if (ext === 'md') {
      return escHtml(code)
        .replace(/^(\s*#{1,6}\s.*)$/gm, '<span class="tok-kw">$1</span>')
        .replace(/`([^`\n]+)`/g, '<span class="tok-str">`$1`</span>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<span class="tok-fn">**$1**</span>')
        .replace(/^(&gt; .*)$/gm, '<span class="tok-com">$1</span>');
    }
    return escHtml(code);
  }
  const parts = [];
  let last = 0;
  const re = new RegExp(g.re.source, g.re.flags.includes('m') ? 'gm' : 'g');
  let m;
  while ((m = re.exec(code))) {
    parts.push(escHtml(code.slice(last, m.index)));
    const [full, a, b, c, d] = m;
    let cls = null, text = full;
    if (a != null) cls = 'tok-com';
    else if (b != null) cls = 'tok-str';
    else if (c != null || (lang === 'json' && d != null && m.index && code[m.index - 1] !== ':' && !/^\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index).split(' ').pop()))) cls = 'tok-num';
    else if (d != null && lang !== 'json') cls = 'tok-fn';
    if (lang === 'json' && b != null) {
      // key vs string
      const after = code.slice(m.index + full.length).match(/^\s*:/);
      cls = after ? 'tok-fn' : 'tok-str';
    }
    if (lang === 'json' && c != null) cls = 'tok-num';
    parts.push(cls ? `<span class="${cls}">${escHtml(text)}</span>` : escHtml(text));
    last = m.index + full.length;
  }
  parts.push(escHtml(code.slice(last)));
  let out = parts.join('');
  // keywords (run last on plain-text gaps — approximate but visually correct)
  if (g.kw) {
    const kwre = new RegExp(g.kw.source, 'g');
    out = out.replace(/>([^<>{}]*?)</g, (match, inner) => {
      if (inner.includes('<span')) return match;
      return '>' + escHtml(inner).replace(kwre, (k) => `<span class="tok-kw">${k}</span>`) + '<';
    });
  }
  return out;
}

// ---------- preview body ----------
async function previewBody(item) {
  const db = state.db;
  if (item.type === 'file' && item.contentId) {
    const blob = await db.get('blobs', item.contentId);
    if (!blob) {
      return fallbackBody(item, 'The file content could not be found on this device.');
    }
    const url = track(URL.createObjectURL(blob));
    const kind = item.kind;
    if (kind === 'image') {
      return `<div style="position:relative;width:100%;height:100%;display:grid;place-items:center">
        <img id="preview-img" src="${url}" alt="${esc(item.name)}" style="cursor:grab" draggable="false"/>
      </div>`;
    }
    if (kind === 'pdf') return `<iframe src="${url}" title="${esc(item.name)}"></iframe>`;
    if (kind === 'audio') return `<div style="display:flex;flex-direction:column;align-items:center;gap:18px">
      <div class="ficon lg" style="background:color-mix(in srgb, #2fb7a3 16%, transparent);color:#2fb7a3">${icon('audio', 28)}</div>
      <audio controls src="${url}" style="width:min(440px,92%)"></audio></div>`;
    if (kind === 'video') return `<video controls src="${url}"></video>`;
    const textKinds = ['text', 'code'];
    if (textKinds.includes(kind) || ['txt','log','md','json','html','xml','yaml','yml','toml','sh'].includes(item.ext)) {
      const text = await blob.text();
      if (text.length > 600000) {
        return fallbackBody(item, 'This file is too large to preview here. Download it to view locally.');
      }
      return `<div class="code-view"><pre><code>${highlight(text, item.ext)}</code></pre></div>`;
    }
  }
  return fallbackBody(item, null);
}

function fallbackBody(item, reason) {
  const k = kindOf(item);
  const c = k.hue;
  return `<div class="preview-fallback">
    <div class="pf-ic" style="background:color-mix(in srgb, ${c} 15%, transparent);color:${c}">${icon(k.icon, 34)}</div>
    <h3>${esc(item.name)}</h3>
    <p>${reason || 'There is no built-in preview for this file type on this device.'} You can still download it and open it with an app of your choice.</p>
    <div class="pf-actions">
      <button class="btn btn-primary" data-action="dl" data-id="${item.id}">${icon('download', 15)} Download</button>
      <button class="btn" data-action="details" data-id="${item.id}">${icon('info', 15)} Details</button>
    </div>
  </div>`;
}

// ---------- open / close ----------
export async function openPreview(id) {
  const item = rec(id);
  if (!item) return;
  A.open(id);
  state.ui.preview = { id, zoom: 1 };
  const k = kindOf(item);
  const root = document.getElementById('modal-root');
  releaseUrls();
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-wrap" style="padding:0">
      <div class="preview-modal" role="dialog" aria-modal="true" aria-label="Preview ${esc(item.name)}">
        <div class="preview-head">
          ${kindIconHtml(item, 20)}
          <div class="ph-name">
            <div class="ph-title">${esc(item.name)}</div>
            <div class="ph-sub">${k.label} · ${fmtBytes(item.size)} · modified ${fmtDateTime(item.modifiedAt)}</div>
          </div>
          <div class="ph-actions">
            <button class="icon-btn ${item.favorite ? 'fav-btn on' : 'fav-btn'}" data-action="fav" data-id="${id}" aria-label="Favorite" title="Favorite">${icon('star', 17)}</button>
            <button class="icon-btn" data-action="dl" data-id="${id}" aria-label="Download" title="Download">${icon('download', 17)}</button>
            <button class="icon-btn" data-action="ctx-preview" data-id="${id}" aria-label="More options">${icon('dots', 17)}</button>
            <button class="icon-btn" data-action="close-preview" aria-label="Close preview">${icon('x', 17)}</button>
          </div>
        </div>
        <div class="preview-body" id="preview-body"><div class="skel" style="width:200px;height:120px"></div></div>
        ${item.kind === 'image' ? `
        <div class="zoom-ctrl">
          <button class="icon-btn sm" data-action="zoom" data-delta="-1" aria-label="Zoom out">${icon('zoomOut', 16)}</button>
          <span class="z-val" id="zoom-val">100%</span>
          <button class="icon-btn sm" data-action="zoom" data-delta="1" aria-label="Zoom in">${icon('zoomIn', 16)}</button>
        </div>` : ''}
      </div>
    </div>`;
  root.hidden = false;
  root.dataset.preview = '1';
  document.body.style.overflow = 'hidden';
  const body = document.getElementById('preview-body');
  const html = await previewBody(item);
  if (state.ui.preview?.id !== id) return; // preview changed while loading
  body.innerHTML = html;
  if (item.kind === 'image') {
    const img = document.getElementById('preview-img');
    if (img) {
      let zoom = state.ui.preview.zoom;
      let panX = 0, panY = 0, dragging = false, sx = 0, sy = 0;
      const apply = () => {
        img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        const zv = document.getElementById('zoom-val');
        if (zv) zv.textContent = Math.round(zoom * 100) + '%';
        img.style.cursor = zoom > 1 ? 'grab' : 'default';
      };
      img._apply = apply;
      img.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoom = Math.min(5, Math.max(0.4, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
        apply();
      }, { passive: false });
      img.addEventListener('pointerdown', (e) => {
        if (zoom <= 1) return;
        dragging = true; sx = e.clientX - panX; sy = e.clientY - panY;
        img.setPointerCapture(e.pointerId);
        img.style.cursor = 'grabbing';
      });
      img.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        panX = e.clientX - sx; panY = e.clientY - sy; apply();
      });
      img.addEventListener('pointerup', () => { dragging = false; img.style.cursor = 'grab'; });
      img.addEventListener('dblclick', () => { zoom = zoom > 1.1 ? 1 : 2; if (zoom === 1) { panX = 0; panY = 0; } apply(); });
      state.ui.preview.applyZoom = (d) => { zoom = Math.min(5, Math.max(0.4, zoom + d * 0.25)); apply(); };
      apply();
    }
  }
}

export function closePreview() {
  const root = document.getElementById('modal-root');
  if (root.dataset.preview === '1') {
    root.hidden = true;
    root.innerHTML = '';
    root.dataset.preview = '';
    releaseUrls();
    state.ui.preview = null;
    document.body.style.overflow = '';
  }
}
