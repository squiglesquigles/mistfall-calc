/**
 * codec.js — runtime decoder for the obfuscated data blob (scripts/encode-data.mjs).
 * The KEY here MUST match scripts/encode-data.mjs.
 */
const KEY = 'mistfall-2026-hunter';

export function decodePack(b64) {
  const raw = atob(b64); // "binary string" of bytes
  const n = raw.length;
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    bytes[i] = raw.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
  }
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}