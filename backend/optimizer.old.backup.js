/**
 * Mistfall Hunter Build Optimizer (Excel-data model)
 *
 * Model:
 *  - User picks affixes and a level (1..32) for each; sum(levels) <= 32.
 *  - A build = 1 gear variant per slot (Head, Chest, Gloves, Pants, Boots, Weapon).
 *  - Each gear variant contributes its built-in affix (+1 level) and has up to 3
 *    sockets (shape + tier). Each socket can hold a matching gem (shape, tier<=socket).
 *  - Each gem grants 1 affix (T1) or 2 affixes (T2) - each granted affix +1 level.
 *  - A target affix is satisfied when #sources granting it >= its level.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
function loadJ(f) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }

function loadData() {
  return {
    classes: loadJ('classes.json'),
    gear: loadJ('gear.json'),
    gemCatalog: loadJ('gem_catalog.json'),
    affixes: loadJ('affixes.json'),
    affixRegistry: loadJ('affix_registry.json')
  };
}

const SLOTS = {
  Seer: {
    Mace: ['Head', 'Chest', 'Gloves', 'Pants', 'Boots', 'Mace'],
    Catalyst: ['Head', 'Chest', 'Gloves', 'Pants', 'Boots', 'Catalyst']
  }
};

const RARITY_TIER = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Holy: 5 };

// Wines grant free extra affix levels (not counted in the 32 budget).
const WINES = {
  'Mortal Tonic': { cap: 2, stacking: false, maxStack: 1, desc: 'Basic, free-to-craft tier' },
  "Hero's Ale": { cap: 4, stacking: false, maxStack: 1, desc: 'Provides 4 affixes' },
  'War Blood': { cap: 5, stacking: true, maxStack: 2, desc: '5 affixes with stacking' },
  'Gods Brew': { cap: 6, stacking: true, maxStack: 2, desc: '6 affixes with stacking' }
};

function generateBuild(className, weapon, wine, targets) {
  const { gear, gemCatalog } = loadData();

  const slots = SLOTS[className] && SLOTS[className][weapon];
  if (!slots) return { error: 'Class ' + className + ' with weapon ' + weapon + ' is not available yet.' };
  if (!targets || targets.length === 0) return { error: 'Select at least one affix.' };

  const need = {};
  let combined = 0;
  for (const t of targets) {
    const lvl = Math.max(1, Math.min(32, Math.floor(t.level || 1)));
    need[t.affix] = (need[t.affix] || 0) + lvl;
    combined += lvl;
  }
  if (combined > 32) return { error: 'Combined affix level ' + combined + ' exceeds the max of 32.' };

  // ---- Wine (free extra affix levels, NOT counted in the 32 budget) ----
  const wineInfo = (wine && wine.name) ? WINES[wine.name] : null;
  const wineGrants = (wine && Array.isArray(wine.grants)) ? wine.grants : [];
  if (wine && wine.name) {
    if (!wineInfo) return { error: 'Unknown wine: ' + wine.name };
    if (wineGrants.length > wineInfo.cap) return { error: wine.name + ' allows only ' + wineInfo.cap + ' affix grants (you used ' + wineGrants.length + ').' };
    const cnt = {};
    for (const g of wineGrants) cnt[g] = (cnt[g] || 0) + 1;
    for (const k of Object.keys(cnt)) {
      const max = wineInfo.stacking ? wineInfo.maxStack : 1;
      if (cnt[k] > max) return { error: 'Cannot assign ' + k + ' more than ' + max + ' time(s) on ' + wine.name + '.' };
    }
  }

  const needKeys = Object.keys(need);
  const idxOf = a => needKeys.indexOf(a);

  // Wine grants are free +1-level sources applied up-front (excluded from `combined`).
  const wineBase = Array(needKeys.length).fill(0);
  if (wineInfo) {
    for (const g of wineGrants) {
      const i = needKeys.indexOf(g);
      if (i >= 0) wineBase[i] = Math.min(need[g], wineBase[i] + 1);
    }
  }

  const poolBySlot = slots.map(slot => gear.filter(v => v.class === className && v.slot === slot));

  // Reachability pre-check (wine grants can supply any affix they are assigned to)
  const reachable = new Set();
  wineGrants.forEach(g => reachable.add(g));
  poolBySlot.forEach(list => list.forEach(v => {
    if (v.built_in_affix) reachable.add(v.built_in_affix);
    v.sockets.forEach(s => gemCatalog.forEach(g => {
      if (g.shape === s.shape && g.tier <= s.tier) {
        if (g.affix1) reachable.add(g.affix1);
        if (g.affix2) reachable.add(g.affix2);
      }
    }));
  }));
  const unreachable = needKeys.filter(k => !reachable.has(k));
  if (unreachable.length) {
    return { error: 'Cannot reach affix(es): ' + unreachable.join(', ') + ' with ' + className + ' ' + weapon + (wineInfo ? ' or the ' + wineInfo.name + ' wine' : '') + '.' };
  }

  const solutions = [];
  let nodes = 0;
  const NODE_CAP = 1500000;
  const SOL_LIMIT = 20;

  function feasible(achieved) { return needKeys.every((k, i) => achieved[i] >= need[k]); }
  function record(plan) { solutions.push(plan.map(p => ({ ...p }))); }

  function dfsSlot(slotIdx, achieved, plan) {
    if (nodes++ > NODE_CAP) return;
    if (solutions.length >= SOL_LIMIT) return;
    if (slotIdx === slots.length) { if (feasible(achieved)) record(plan); return; }

    const variants = poolBySlot[slotIdx].slice();
    variants.sort((a, b) => a.sockets.length - b.sockets.length || (RARITY_TIER[a.rarity] || 1) - (RARITY_TIER[b.rarity] || 1));

    for (const v of variants) {
      const nw = achieved.slice();
      if (v.built_in_affix && idxOf(v.built_in_affix) >= 0) {
        nw[idxOf(v.built_in_affix)] = Math.min(need[v.built_in_affix], nw[idxOf(v.built_in_affix)] + 1);
      }
      assignSockets(slotIdx, v, 0, nw, [], plan);
    }
  }

  function assignSockets(slotIdx, v, si, achieved, gems, plan) {
    if (nodes++ > NODE_CAP) return;
    if (solutions.length >= SOL_LIMIT) return;
    if (si === v.sockets.length) {
      plan[slotIdx] = { ...v, gems: gems.slice() };
      dfsSlot(slotIdx + 1, achieved, plan);
      return;
    }
    const sock = v.sockets[si];

    assignSockets(slotIdx, v, si + 1, achieved, gems.concat([null]), plan);

    const opts = gemCatalog.filter(g =>
      g.shape === sock.shape && g.tier <= sock.tier &&
      ((g.affix1 && idxOf(g.affix1) >= 0 && achieved[idxOf(g.affix1)] < need[g.affix1]) ||
       (g.affix2 && idxOf(g.affix2) >= 0 && achieved[idxOf(g.affix2)] < need[g.affix2])));
    for (const g of opts) {
      const nw = achieved.slice();
      if (g.affix1 && idxOf(g.affix1) >= 0) nw[idxOf(g.affix1)] = Math.min(need[g.affix1], nw[idxOf(g.affix1)] + 1);
      if (g.affix2 && idxOf(g.affix2) >= 0) nw[idxOf(g.affix2)] = Math.min(need[g.affix2], nw[idxOf(g.affix2)] + 1);
      assignSockets(slotIdx, v, si + 1, nw, gems.concat([g]), plan);
    }
  }

  const plan = new Array(slots.length);
  dfsSlot(0, wineBase.slice(), plan);

  function score(sol) {
    const gems = sol.reduce((a, p) => a + (p.gems || []).filter(Boolean).length, 0);
    const rarity = sol.reduce((a, p) => a + (RARITY_TIER[p.rarity] || 1), 0);
    const socks = sol.reduce((a, p) => a + (p.sockets || []).length, 0);
    return { gems, rarity, socks };
  }
  solutions.sort((a, b) => {
    const sa = score(a), sb = score(b);
    return sa.gems - sb.gems || sa.rarity - sb.rarity || sa.socks - sb.socks;
  });

  if (solutions.length === 0) {
    return { error: 'No ' + className + ' ' + weapon + ' build satisfies the selected affix levels. Try lowering a level or choosing different affixes.' };
  }

  return {
    className, weapon,
    wine: wineInfo ? { name: wine.name, cap: wineInfo.cap, grants: wineGrants } : null,
    targetAffixes: needKeys.map(k => ({ affix: k, level: need[k] })),
    combinedLevel: combined,
    totalBuilds: solutions.length,
    builds: solutions.slice(0, SOL_LIMIT).map(sol => ({ slots: sol }))
  };
}

module.exports = { generateBuild, loadData, SLOTS, reachableAffixes, WINES };

// Reachable affixes for a class+weapon (built-ins + socket gems).
function reachableAffixes(className, weapon) {
  const { gear, gemCatalog } = loadData();
  if (!SLOTS[className] || !SLOTS[className][weapon]) return [];
  const set = new Set();
  SLOTS[className][weapon].forEach(slot => {
    gear.filter(v => v.class === className && v.slot === slot).forEach(v => {
      if (v.built_in_affix) set.add(v.built_in_affix);
      v.sockets.forEach(s => gemCatalog.forEach(g => {
        if (g.shape === s.shape && g.tier <= s.tier) {
          if (g.affix1) set.add(g.affix1);
          if (g.affix2) set.add(g.affix2);
        }
      }));
    });
  });
  return [...set];
}

