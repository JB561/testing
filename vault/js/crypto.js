// Vault — PIN hashing (WebCrypto SHA-256 with per-install salt).
// The PIN is never stored or displayed; only its salted hash is kept.

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digestHex(text) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node < 19 / exotic env fallback (djb2 chain — prototype only)
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = (h1 * 33) ^ c; h2 = (h2 * 31) ^ c;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function newSalt() { return randomHex(16); }

export async function hashPin(pin, salt) {
  // 4,096 rounds to slow down brute force on the local copy
  let acc = `${salt}:${pin}`;
  for (let i = 0; i < 4096; i++) acc = await digestHex(acc);
  return acc;
}

export async function verifyPin(pin, salt, expectedHash) {
  return (await hashPin(pin, salt)) === expectedHash;
}
