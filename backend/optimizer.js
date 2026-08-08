/**
 * Mistfall Hunter Build Optimizer — MILP / Constraint-Satisfaction engine.
 *
 * Replaces the previous brute-force DFS with a proper Integer Linear Program,
 * solved with the pure-JS `javascript-lp-solver` package (no Python, no external
 * solver binary). Results are produced in ascending order of total Cost Score.
 *
 * Model:
 *   - User picks affixes and a level for each; combined target <= 32.
 *   - A build = exactly one gear variant per (Head, Chest, Gloves, Pants, Boots)
 *     and one weapon variant, plus optional Ring / Necklace accessories.
 *   - Each gear variant contributes its built-in affix (+1) and has sockets of a
 *     given shape + tier. Each socket holds 0 or 1 matching gem.
 *   - Gem-shape must equal the socket shape (Circle sockets are wildcards and
 *     accept ANY shape); gem.tier <= socket.tier. T1 gem = +1, T2 gem = +2.
 *   - A target affix is satisfied when the sum of granted levels >= its level.
 *   - Wine is AUTO-SELECTED: the solver picks the cheapest of {none, Wine 1..4}
 *     AND chooses which affixes to grant, bounded by the wine level's budget.
 *       Wine 1: 2 unique affixes  (free)     Wine 2:  4 unique (150g)
 *       Wine 3: 6 total, up to 2 of one (270g)  Wine 4: 8 total, up to 2 (530g)
 *   - Constraint variables: one binary per gear variant, one binary per
 *     compatible gem, and one integer per target affix for wine grants.
 *   - Objective: minimize total Cost Score (gear + gem + wine costs).
 */

const fs = require('fs');
const path = require('path');
const solver = require('javascript-lp-solver');
const { buildPriceIndex, gearCost, gemCost } = require('./pricing');

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

// Valid affix names (source of truth for filtering data artifacts from the Excel,
// e.g. bogus socket shapes / lowercased names that leak in as "built-ins").
function validAffixSet() {
  const { affixes, affixRegistry } = loadData();
  const set = new Set();
  for (const a of affixes) if (a.name) set.add(a.name);
  for (const a of affixRegistry) if (a.name) set.add(a.name);
  return set;
}

const RARITY_TIER = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Holy: 5 };

// Rarity -> max affix capacity. A built-in affix counts as 1; each socket
// contributes its tier (T1 socket -> up to 1 affix, T2 -> up to 2).
const RARITY_CAPACITY = { Common: 1, Rare: 2, Epic: 3, Legendary: 5, Holy: 6 };

const WEAPONS_BY_CLASS = {
  Blackarrow: ['Weapon'],
  Mercenary: ['Weapon'],
  Seer: ['Mace', 'Catalyst'],
  Shadowstrix: ['Weapon'],
  Sorcerer: ['Weapon'],
  'Withered Knight': ['Weapon']
};

const ARMOR_SLOTS = ['Head', 'Chest', 'Gloves', 'Pants', 'Boots'];
const ACCESSORY_SLOTS = ['Ring', 'Necklace'];
const SLOT_ORDER = ['Head', 'Chest', 'Gloves', 'Pants', 'Boots', 'Ring', 'Necklace', 'Weapon', 'Mace', 'Catalyst'];

// Wine System (global buffs) — Level 1..4, with craft/avg costs and display names.
const WINES = {
  'Wine 1': { name: 'Mortal Tonic', label: 'Lv 1: Mortal Tonic', cap: 2, stacking: false, maxStack: 1, cost: 0, desc: 'Level 1 Wine — 2 unique affixes (+1 level each)' },
  'Wine 2': { name: "Hero's Ale", label: "Lv 2: Hero's Ale", cap: 4, stacking: false, maxStack: 1, cost: 150, desc: 'Level 2 Wine — 4 unique affixes (+1 level each)' },
  'Wine 3': { name: 'Warblood', label: 'Lv 3: Warblood', cap: 6, stacking: true, maxStack: 2, cost: 270, desc: 'Level 3 Wine — 6 affixes total (can pick up to two affixes twice)' },
  'Wine 4': { name: "God's Brew", label: "Lv 4: God's Brew", cap: 8, stacking: true, maxStack: 2, cost: 530, desc: 'Level 4 Wine — 8 affixes total (can pick up to four affixes twice)' }
};

// Auto-selection candidates incl. "no wine". Assumes any affix can be granted
// up to 2 extra levels (Wine 3 / 4 stacking) — per requirement.
const WINE_OPTIONS = [
  { key: null, name: null, label: null, cap: 0, maxStack: 0, cost: 0 },
  { key: 'Wine 1', name: 'Mortal Tonic', label: 'Lv 1: Mortal Tonic', cap: 2, maxStack: 1, cost: 0 },
  { key: 'Wine 2', name: "Hero's Ale", label: "Lv 2: Hero's Ale", cap: 4, maxStack: 1, cost: 150 },
  { key: 'Wine 3', name: 'Warblood', label: 'Lv 3: Warblood', cap: 6, maxStack: 2, cost: 270 },
  { key: 'Wine 4', name: "God's Brew", label: "Lv 4: God's Brew", cap: 8, maxStack: 2, cost: 530 }
];

const SOL_LIMIT = 15;
const RANK_BUDGET = 1000; // ms for the multi-build ranking phase of the winner
// Max combined affix level across a build (gear + gems + wine buffer).
const MAX_COMBINED_LEVEL = 40;

function poolFor(gear, className, slot) {
  if (ACCESSORY_SLOTS.includes(slot)) return gear.filter(v => v.class === 'All' && v.slot === slot);
  return gear.filter(v => v.class === className && v.slot === slot);
}

function compatibleGems(gemCatalog, sock) {
  const circle = sock.shape === 'Circle' || sock.shape === 'Circle/Swirl';
  return gemCatalog.filter(g => (circle || g.shape === sock.shape) && g.tier <= sock.tier);
}

// A gem "assists" if it grants at least one requested affix target.
function assists(need, a1, a2) {
  return (a1 && need[a1] > 0) || (a2 && need[a2] > 0);
}

function generateBuild(className, weapon, wine, targets) {
  const { gear, gemCatalog } = loadData();
  const priceIndex = buildPriceIndex();

  const weapons = WEAPONS_BY_CLASS[className];
  if (!weapons) return { error: 'Unknown class: ' + className };
  const weaponSlot = weapon;
  if (!weapons.includes(weapon)) {
    return { error: className + ' does not use weapon "' + weapon + '". Options: ' + weapons.join(', ') };
  }

  const mandatorySlots = ARMOR_SLOTS.concat([weaponSlot]);
  const allSlots = mandatorySlots.concat(ACCESSORY_SLOTS);

  if (!targets || targets.length === 0) return { error: 'Select at least one affix.' };

  // ---- Aggregate target levels ----
  const need = {};
  let combined = 0;
  for (const t of targets) {
    const lvl = Math.max(1, Math.min(MAX_COMBINED_LEVEL, Math.floor(t.level || 1)));
    need[t.affix] = (need[t.affix] || 0) + lvl;
    combined += lvl;
  }
  if (combined > MAX_COMBINED_LEVEL) return { error: 'Combined affix level ' + combined + ' exceeds the max of ' + MAX_COMBINED_LEVEL + '.' };

  // ---- Wine options: auto-select unless a specific level is forced ----
  let options;
  if (wine && wine.name) {
    const opt = WINE_OPTIONS.find(o => o.key === wine.name) || WINE_OPTIONS.find(o => o.name === wine.name);
    if (!opt) return { error: 'Unknown wine: ' + wine.name };
    options = [opt];
  } else {
    options = WINE_OPTIONS;
  }

  // ---- Reachability pre-check ----
  // An affix is reachable if gear/gems can provide it, OR wine alone could cover
  // its requested level (max stacking wine contribution per affix is 2).
  const reachable = new Set();
  for (const s of allSlots) {
    for (const v of poolFor(gear, className, s)) {
      if (v.built_in_affix) reachable.add(v.built_in_affix);
      for (const sock of v.sockets) {
        for (const g of compatibleGems(gemCatalog, sock)) {
          if (g.affix1) reachable.add(g.affix1);
          if (g.affix2) reachable.add(g.affix2);
        }
      }
    }
  }
  const unreachable = Object.keys(need).filter(a => !reachable.has(a) && need[a] > 2);
  if (unreachable.length) {
    return { error: 'Cannot reach affix(es): ' + unreachable.join(', ') + ' with ' + className + ' ' + weaponSlot + '.' };
  }

  // Ensure every mandatory slot has at least one variant.
  for (const s of mandatorySlots) {
    if (poolFor(gear, className, s).length === 0) {
      return { error: 'No gear found for slot "' + s + '" for class ' + className + '.' };
    }
  }

  // ---- Find the cheapest wine option (one ILP solve each) ----
  let best = null; // { opt, gearGemCost, total }
  for (const opt of options) {
    const { base } = buildModel(gear, gemCatalog, priceIndex, className, weaponSlot, mandatorySlots, allSlots, need, opt);
    const res = solveOnce(base);
    if (!res || !res.feasible) continue;
    const gearGem = costOf(res, base);
    const total = gearGem + opt.cost;
    if (!best || total < best.total) best = { opt, gearGemCost: gearGem, total };
  }

  if (!best) {
    return { error: 'No ' + className + ' ' + weaponSlot + ' build satisfies the selected affix levels. Try lowering a level or choosing different affixes.' };
  }

  // ---- Rank the winning wine option for a set of cheapest builds ----
  const { base: winnerBase, info } = buildModel(gear, gemCatalog, priceIndex, className, weaponSlot, mandatorySlots, allSlots, need, best.opt);
  const ranked = solveRanked(winnerBase, info, RANK_BUDGET);
  const rankWin = best.opt;
  const wineLabel = rankWin.label;
  const wineName = rankWin.name;
  const wineKey = rankWin.key;
  const wineCost = rankWin.cost;

  const builds = ranked.slice(0, SOL_LIMIT).map(sol => ({
    slots: sol.slots,
    wineGrants: sol.wineGrants,
    wine: wineLabel,
    wineKey,
    wineName,
    wineCost,
    cost: sol.cost + wineCost,
    capacityWarnings: sol.capacityWarnings
  }));

  return {
    className,
    weapon: weaponSlot,
    wine: {
      key: wineKey,
      name: wineName,
      label: wineLabel,
      cap: rankWin.cap,
      maxStack: rankWin.maxStack,
      cost: wineCost,
      grants: builds.length ? builds[0].wineGrants : []
    },
    targetAffixes: Object.keys(need).map(k => ({ affix: k, level: need[k] })),
    combinedLevel: combined,
    totalBuilds: builds.length,
    pricing: priceIndex.config,
    builds
  };
}

// Builds the MILP model for one wine option. Wine grants become integer
// variables so the solver decides which affixes the wine levels up.
function buildModel(gear, gemCatalog, priceIndex, className, weaponSlot, mandatorySlots, allSlots, need, opt) {
  const info = {};
  const base = { optimize: 'cost', opType: 'min', constraints: {}, variables: {}, ints: {} };

  for (const s of allSlots) {
    const isMandatory = mandatorySlots.includes(s);
    const variants = poolFor(gear, className, s);
    base.constraints['slot_' + s] = { min: isMandatory ? 1 : 0, max: 1 };

    variants.forEach((v, vi) => {
      const id = 'g_' + s + '_' + vi;
      const cost = gearCost(priceIndex, v.gear, v.slot);
      const varObj = { cost };
      varObj['slot_' + s] = 1;
      if (v.built_in_affix && need[v.built_in_affix] > 0) {
        varObj['afx_' + v.built_in_affix] = (varObj['afx_' + v.built_in_affix] || 0) + 1;
      }
      base.variables[id] = varObj;
      base.ints[id] = 1;
      info[id] = { kind: 'gear', slot: s, variant: v, cost };
    });

    variants.forEach((v, vi) => {
      v.sockets.forEach((sock, si) => {
        const scName = 'sc_' + s + '_' + vi + '_' + si;
        base.constraints[scName] = { max: 0 };
        const gid = 'g_' + s + '_' + vi;
        base.variables[gid][scName] = -1;

        const opts = compatibleGems(gemCatalog, sock).filter(g => assists(need, g.affix1, g.affix2));
        opts.forEach((g, gi) => {
          const hid = 'h_' + s + '_' + vi + '_' + si + '_' + gi;
          const cost = gemCost(priceIndex, g.tier, g.affix1, g.affix2);
          const hObj = { cost };
          hObj[scName] = 1;
          if (g.affix1 && need[g.affix1] > 0) hObj['afx_' + g.affix1] = (hObj['afx_' + g.affix1] || 0) + 1;
          if (g.affix2 && need[g.affix2] > 0) hObj['afx_' + g.affix2] = (hObj['afx_' + g.affix2] || 0) + 1;
          base.variables[hid] = hObj;
          base.ints[hid] = 1;
          info[hid] = { kind: 'gem', slot: s, variant: v, socket: sock, socketIndex: si, gem: g, cost };
        });
      });
    });
  }

  // Affix requirement constraints (gear + gems + wine >= requested level).
  for (const a of Object.keys(need)) {
    base.constraints['afx_' + a] = { min: need[a] };
  }

  // Wine grant integer variables: sum over affixes <= wine cap; each affix
  // can receive at most `maxStack` levels from wine.
  if (opt.cap > 0) {
    base.constraints.wine_budget = { max: opt.cap };
    for (const a of Object.keys(need)) {
      const wid = 'w_' + a;
      base.variables[wid] = { ['afx_' + a]: 1, wine_budget: 1, ['wmax_' + a]: 1 };
      base.ints[wid] = 1;
      base.constraints['wmax_' + a] = { max: opt.maxStack };
      info[wid] = { kind: 'wine', affix: a };
    }
  }

  return { base, info };
}

function solveOnce(base) {
  const model = JSON.parse(JSON.stringify(base));
  try { return solver.Solve(model); } catch (e) { return null; }
}

// Total objective contribution of a solved model (gear + gem costs).
function costOf(res, model) {
  let total = 0;
  for (const name of Object.keys(model.variables)) {
    if (res[name] && res[name] > 0.0001) total += res[name] * (model.variables[name].cost || 0);
  }
  return Math.round(total);
}

// Returns up to SOL_LIMIT distinct builds for the given model, ascending cost,
// by repeatedly solving with no-good cuts until a time budget runs out.
function solveRanked(base, info, budgetMs) {
  const cuts = [];
  const solutions = [];
  const seen = new Set();
  const tStart = Date.now();
  for (let it = 0; it < SOL_LIMIT * 6 && seen.size < SOL_LIMIT && (Date.now() - tStart) < budgetMs; it++) {
    const model = JSON.parse(JSON.stringify(base));
    cuts.forEach((c, ci) => {
      const cname = 'cut_' + ci;
      model.constraints[cname] = { max: c.max };
      for (const id of c.vars) {
        if (!model.variables[id]) model.variables[id] = { cost: (info[id] ? info[id].cost : 0) };
        model.variables[id][cname] = 1;
        model.ints[id] = 1;
      }
    });

    let res;
    try { res = solver.Solve(model); } catch (e) { break; }
    if (!res || !res.feasible) break;

    const chosen = Object.keys(res).filter(k =>
      !['feasible', 'result', 'bounded', 'isIntegral', 'fractional'].includes(k) && res[k] >= 0.999);

    cuts.push({ vars: chosen, max: chosen.length - 1 });

    const sol = decode(chosen, info, res);
    const key = JSON.stringify(sol.slots.map(s => ({ slot: s.slot, gear: s.gear, gems: (s.gems || []).map(g => g && (g.affix1 + '/' + (g.affix2 || ''))) })));
    if (seen.has(key)) continue;
    seen.add(key);
    solutions.push(sol);
  }
  solutions.sort((a, b) => a.cost - b.cost);
  return solutions;
}
function decode(chosen, info, res) {
  const bySlot = {};
  const wineGrants = {};
  for (const id of chosen) {
    const i = info[id];
    if (!i) continue;
    if (i.kind === 'wine') {
      wineGrants[i.affix] = res ? Math.round(res[id]) : 1;
      continue;
    }
    if (!bySlot[i.slot]) bySlot[i.slot] = { gear: null, gems: [] };
    if (i.kind === 'gear') bySlot[i.slot].gear = i.variant;
    else {
      const si = i.socketIndex != null ? i.socketIndex : 0;
      bySlot[i.slot].gems[si] = i.gem;
    }
  }

  const slots = Object.keys(bySlot)
    .sort((a, b) => {
      const ia = SLOT_ORDER.indexOf(a), ib = SLOT_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(s => {
      const e = bySlot[s];
      const gear = e.gear;
      return {
        slot: s,
        gear: gear ? gear.gear : null,
        rarity: gear ? gear.rarity : null,
        built_in_affix: gear ? gear.built_in_affix : null,
        sockets: gear ? gear.sockets : [],
        gems: gear ? e.gems.map(g => g || null) : []
      };
    });

  let cost = 0;
  for (const id of chosen) {
    const i = info[id];
    if (i && (i.kind === 'gear' || i.kind === 'gem')) cost += i.cost || 0;
  }

  // Capacity validation warnings (rarity rules vs actual data).
  const capacityWarnings = [];
  for (const sl of slots) {
    if (!sl.gear) continue;
    const maxCap = RARITY_CAPACITY[sl.rarity];
    if (maxCap == null) continue;
    const cap = (sl.built_in_affix ? 1 : 0) + sl.sockets.reduce((a, sk) => a + (sk.tier || 1), 0);
    if (cap > maxCap) {
      capacityWarnings.push(sl.slot + ': ' + sl.gear + ' [' + sl.rarity + '] affix capacity ' + cap + ' exceeds rarity max ' + maxCap);
    }
  }

  const gr = Object.keys(wineGrants).sort().reduce((o, k) => { o[k] = wineGrants[k]; return o; }, {});
  return { slots, cost: Math.round(cost), capacityWarnings, wineGrants: gr };
}

// Reachable affixes for a class + weapon (built-ins + applicable socket gems).
function reachableAffixes(className, weapon) {
  const { gear, gemCatalog } = loadData();
  if (!WEAPONS_BY_CLASS[className] || !WEAPONS_BY_CLASS[className].includes(weapon)) return [];
  const valid = validAffixSet();
  const slots = ARMOR_SLOTS.concat([weapon]).concat(ACCESSORY_SLOTS);
  const set = new Set();
  for (const slot of slots) {
    for (const v of poolFor(gear, className, slot)) {
      if (v.built_in_affix && valid.has(v.built_in_affix)) set.add(v.built_in_affix);
      for (const sock of v.sockets) {
        for (const g of compatibleGems(gemCatalog, sock)) {
          if (g.affix1 && valid.has(g.affix1)) set.add(g.affix1);
          if (g.affix2 && valid.has(g.affix2)) set.add(g.affix2);
        }
      }
    }
  }
  return [...set];
}

module.exports = {
  generateBuild,
  loadData,
  WEAPONS_BY_CLASS,
  reachableAffixes,
  WINES,
  SOL_LIMIT
};

