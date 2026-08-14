/**
 * buildCode.js - thin bridge to the MIT WdThing build-code worker.
 * Sends our generated build to the vendored Go wasm (exportCode) to produce a
 * game-pasteable build code, and decodes a pasted code (importCode) into gear.
 */

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    // Cache-bust the worker script: Web Workers are cached aggressively and a hard
    // refresh often doesn't clear them. Bump SB_VER whenever vendor/wdthing/code-worker.js
    // changes so every browser pulls the fresh exporter.
    const SB_VER = 3;
    worker = new Worker(import.meta.env.BASE_URL + 'vendor/wdthing/code-worker.js?v=' + SB_VER);
    worker.onmessage = (e) => {
      const { id, ok, error, code, pieces, summary, type } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve({ code, pieces, summary, type });
      else p.reject(new Error(error || 'build-code worker error'));
    };
    worker.onerror = (e) => {
      for (const [id, p] of pending) p.reject(new Error('build-code worker failed: ' + (e && e.message ? e.message : 'worker crashed')));
      pending.clear();
    };
  }
  return worker;
}

export function exportBuildCode(build) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'export', id, build });
  });
}

