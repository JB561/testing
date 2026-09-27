// Vault — lock / first-run PIN screen.

import { vaultMark, icon } from '../icons.js';
import { state } from '../store.js';

export function lockScreenHTML() {
  const s = state;
  const first = s.session.firstRun;
  const pin = s.ui.lockPin || '';
  const showPin = !!s.ui.lockShowPin;
  const lockout = s.session.lockoutUntil > Date.now();
  const remaining = lockout ? Math.ceil((s.session.lockoutUntil - Date.now()) / 1000) : 0;
  const confirmStep = first && s.ui.lockStep === 2;

  const title = first
    ? (confirmStep ? 'Confirm your PIN' : 'Create a PIN')
    : 'Unlock Vault';
  const sub = first
    ? (confirmStep
      ? 'Enter the same PIN again to verify it.'
      : 'Choose a 4–6 digit PIN to protect your files. It never leaves this device.')
    : 'Enter your PIN to continue';

  const slots = Array.from({ length: 6 }, (_, i) => {
    const filled = i < pin.length;
    const ch = showPin && filled ? `<span class="pin-char">${pin[i]}</span>` : (filled ? '<span class="pin-char hide-char"></span>' : '');
    return `<span class="pin-slot ${filled ? 'filled' : ''}" aria-hidden="true">${ch}</span>`;
  }).join('');

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const eyeIcon = showPin ? icon('eyeOff', 18) : icon('eye', 18);
  const numpad = `
    <div class="numpad" role="group" aria-label="PIN pad">
      ${digits.map((d) => `<button data-action="pin-digit" data-digit="${d}" ${lockout ? 'disabled' : ''} aria-label="Digit ${d}">${d}</button>`).join('')}
      <button class="np-fn" data-action="pin-eye" ${lockout ? 'disabled' : ''} aria-label="${showPin ? 'Hide PIN' : 'Show PIN'}" title="Show / hide PIN">${eyeIcon}</button>
      <button data-action="pin-digit" data-digit="0" ${lockout ? 'disabled' : ''} aria-label="Digit 0">0</button>
      <button class="np-fn" data-action="pin-back" ${lockout ? 'disabled' : ''} aria-label="Delete digit">${icon('backspace', 17)}</button>
    </div>`;

  return `
  <div class="lock-screen" id="lock-screen">
    <div class="lock-inner">
      <div class="lock-mark" style="color:var(--text)">${vaultMark(58)}</div>
      <div class="lock-name">Vault</div>
      <div class="lock-tag">Your files. Your space.</div>

      <div class="lock-card" id="lock-card">
        <div class="lock-title">${title}</div>
        <div class="lock-sub">${sub}</div>
        <div class="pin-slots" id="pin-slots" aria-hidden="true">${slots}</div>
        <div class="lock-err" id="lock-err" aria-live="polite"></div>
        ${lockout ? `<div class="lock-count">Try again in ${remaining}s</div>` : ''}
        ${numpad}
      ${!confirmStep ? `<div style="margin-top:16px">
        <button class="btn btn-primary btn-block btn-lg" data-action="pin-submit" ${pin.length < 4 || lockout ? 'disabled' : ''}>
          ${first ? 'Create vault' : 'Unlock'}
        </button>
      </div>` : ''}
        ${first && confirmStep ? `<div style="margin-top:16px;display:flex;gap:9px">
          <button class="btn" style="flex:1" data-action="pin-back-step">Back</button>
          <button class="btn btn-primary" style="flex:1" data-action="pin-submit" ${pin.length < 4 || lockout ? 'disabled' : ''}>Confirm PIN</button>
        </div>` : ''}
        ${first ? '' : `<button class="btn btn-ghost btn-block" style="margin-top:8px" data-action="pin-forget">Forgot PIN?</button>`}
        <div class="lock-hint">
          ${first ? 'Your PIN is stored as a one-way hash on this device only.' : 'Vault is locked. Your files stay on this device.'}
        </div>
      </div>
    </div>
  </div>`;
}
