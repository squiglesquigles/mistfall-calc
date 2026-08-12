/**
 * buildWorker.js — runs the build optimizer off the main thread so the UI stays
 * responsive (the spinner can animate and the page never freezes during the
 * multi-second MILP computation).
 */
import { generateBuild, generateMoreBuilds } from './engine';

self.onmessage = (e) => {
  const { type = 'generate', className, weapon, wine, targets, rarityPref, forcedAccessories, seenKeys, minCost, id } = e.data || {};
  try {
    const result = type === 'more'
      ? generateMoreBuilds(className, weapon, wine, targets, rarityPref, forcedAccessories, seenKeys, 5, minCost, 5000)
      : generateBuild(className, weapon, wine, targets, rarityPref, forcedAccessories);
    self.postMessage({ id, ok: true, type, result });
  } catch (err) {
    self.postMessage({ id, ok: false, type, error: String((err && err.message) || err) });
  }
};