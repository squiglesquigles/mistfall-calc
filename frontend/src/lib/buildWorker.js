/**
 * buildWorker.js — runs the build optimizer off the main thread so the UI stays
 * responsive (the spinner can animate and the page never freezes during the
 * multi-second MILP computation).
 */
import { generateBuild } from './engine';

self.onmessage = (e) => {
  const { className, weapon, wine, targets, id } = e.data || {};
  try {
    const result = generateBuild(className, weapon, wine, targets);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};