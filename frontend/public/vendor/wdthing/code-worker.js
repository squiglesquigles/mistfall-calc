// Build-code bridge (MIT: WdThing/mistfall-hunter-optimizer).
// Classic worker: loads the Go wasm + DB, then converts our build
// (slots/gears/rarities/sockets/gems) into the game share-code via exportCode,
// and converts a pasted code back into readable pieces via importCode.
importScripts('./wasm_exec.js');

const ready = (async () => {
  const go = new Go();
  const response = await fetch('./mistfall.wasm');
  const result = await WebAssembly.instantiateStreaming(response, go.importObject);
  go.run(result.instance);
  while (!self.mistfallCore) await new Promise(r => setTimeout(r, 10));
  const bytes = await Promise.all(['./database.json', './affixes.json'].map(async p => {
    const r = await fetch(p);
    if (!r.ok) throw new Error('Could not load ' + p);
    return new Uint8Array(await r.arrayBuffer());
  }));
  const err = self.mistfallCore.init(bytes[0], bytes[1]);
  if (err) throw new Error(err);
})();

// Mappings derived by cross-referencing the game catalogue.
const SLOT_TYPE = { Head: 'Helmet', Chest: 'Clothes', Gloves: 'Gauntlets', Pants: 'Pants', Boots: 'Boots', Weapon: 'Weapon', Ring: 'Ring', Necklace: 'Necklace' };
const WEAPON_SLOTS = new Set(['Weapon', 'Mace', 'Catalyst', 'Sword and Shield', 'Hammer', 'Dagger', 'Dual Blades', 'Greatsword', 'Polearm and Shield']);
const SHAPE_NUM = { Rectangle: 1, Triangle: 2, Square: 3, Octagon: 4, Circle: 5 };
const GRADE_RARITY = { 1: 'Gray', 2: 'White', 3: 'Green', 4: 'Blue', 5: 'Purple', 6: 'Gold', 7: 'Gold' };
const RARITY_GRADE = { Common: 3, Rare: 4, Epic: 5, Legendary: 6, Holy: 7 };

let ITEMS = {};
let AFFIX_GEMS = [];

async function loadLookup() {
  const r = await fetch('./database.json');
  const db = await r.json();
  ITEMS = {};
  for (const it of db.items || []) {
    const k = String(it.name || '').toLowerCase();
    (ITEMS[k] = ITEMS[k] || []).push(it);
  }
  AFFIX_GEMS = (db.items || []).filter(i => i.category === 'affix_gem');
}

function holePattern(sockets) {
  return (sockets || [])
    .filter(s => s && s.shape)
    .map(s => Number((SHAPE_NUM[s.shape] || 0) + '' + (s.tier || 1)))
    .sort((a, b) => a - b);
}

function findItem(name, rarity, built, sockets) {
  const list = ITEMS[String(name || '').toLowerCase()] || [];
  if (!list.length) return null;
  // Base catalogue rows use nativeId 0 and are rejected by the game code
  // exporter ("unknown native equipment config"), so only consider rows that
  // carry a real nativeId. Fall back to the full list only if there are none.
  const candidates = list.some(it => it.nativeId) ? list.filter(it => it.nativeId) : list;
  const wp = holePattern(sockets);
  const builtX = built || null;
  const g = RARITY_GRADE[rarity] || 3;
  let best = null;
  for (const it of candidates) {
    const b = it.equipment && it.equipment.affixes && it.equipment.affixes.length ? it.equipment.affixes[0].name : null;
    const hg = ((it.equipment && it.equipment.holeGroup) || []).slice().sort((a, b) => a - b);
    const sameBuild = b === builtX;
    const sameSock = wp.length === hg.length && wp.every(v => hg.includes(v));
    if (sameBuild && sameSock) {
      if (!best) best = it;
      else if (Math.abs(it.grade - g) < Math.abs(best.grade - g)) best = it;
    }
  }
  if (best) return best;
  let close = candidates[0], d = Math.abs(close.grade - g);
  for (const it of candidates) {
    const dd = Math.abs(it.grade - g);
    if (dd < d) { d = dd; close = it; }
  }
  return close;
}

// Gem affixes in the game database are plain strings in some exports and
// {name, level} objects in newer ones — normalize both to a string.
function affixName(x) {
  return (typeof x === 'string' ? x : (x && x.name)) || '';
}

function findGem(affix1, affix2, tier, shape) {
  const names = [affix1, affix2].filter(Boolean).map(x => affixName(x).toLowerCase()).sort();
  const wantShape = shape ? (SHAPE_NUM[shape] || 0) : 0;
  for (const g of AFFIX_GEMS) {
    const ga = ((g.gem && g.gem.affixes) || []).filter(Boolean).map(x => affixName(x).toLowerCase()).sort();
    if (JSON.stringify(names) !== JSON.stringify(ga)) continue;
    if (g.gem.affixGemLevel !== (tier || 1)) continue;
    if (wantShape && g.gem.affixGemType !== wantShape) continue;
    return g;
  }
  for (const g of AFFIX_GEMS) {
    const ga = ((g.gem && g.gem.affixes) || []).filter(Boolean).map(x => affixName(x).toLowerCase()).sort();
    if (JSON.stringify(names) !== JSON.stringify(ga)) continue;
    if (g.gem.affixGemLevel !== (tier || 1)) continue;
    return g;
  }
  return null;
}

function slotsToPieces(slots) {
  const pieces = [];
  for (const s of slots || []) {
    if (!s.gear) continue;
    const item = findItem(s.gear, s.rarity, s.built_in_affix, s.sockets);
    const rarity = item ? (GRADE_RARITY[item.grade] || 'Green') : (s.rarity || 'Green');
    const gems = [];
    (s.gems || []).forEach((gem, i) => {
      if (!gem) return;
      const sock = (s.sockets || [])[i];
      const g = findGem(gem.affix1, gem.affix2, sock && sock.tier, sock && sock.shape);
      if (!g) return;
      gems.push({
        color: '', gemColor: '', name: g.name + '',
        affixes: [gem.affix1, gem.affix2].filter(Boolean).join(','),
        tier: (g.gem && g.gem.affixGemLevel) || 1, filled: true,
        nativeId: g.nativeId || Number(g.id) || 0
      });
    });
    pieces.push({
      type: WEAPON_SLOTS.has(s.slot) ? 'Weapon' : (SLOT_TYPE[s.slot] || s.slot), rarity,
      name: s.gear, nativeAffixes: s.built_in_affix || '-',
      nativeId: item ? (item.nativeId || Number(item.id) || 0) : 0,
      gems
    });
  }
  return pieces;
}

function buildSession(build) {
  const pieces = slotsToPieces(build.slots || []);
  const affixes = (build.targets || []).map(a => ({ name: a.affix, enabled: true, level: a.level, wine: 0 }));
  return {
    request: {
      characterClass: build.className || '', weaponClass: build.weapon || 'Weapon',
      weaponRarity: 'Any', minRarity: 'Gray', maxRarity: 'Gold',
      ring: 'Any/Any', amulet: 'Any/Any', fixedRarities: {},
      rarityPriority: ['weapon', 'helmet', 'clothes', 'gauntlets', 'pants', 'boots', 'necklace', 'ring'],
      affixes, fillGemSlots: true, lowPerformance: false
    },
    result: {
      possible: true, message: '',
      sets: [{
        code: '',
        affixes: (build.targets || []).map(a => ({ name: a.affix, result: a.level, target: a.level })),
        price: String(build.cost || 0), unusedGemSlots: 0, unusedAffixSlots: 0, pieces
      }],
      tested: 1, seconds: 0, rules: []
    },
    hasResult: true, help: false
  };
}

function piecesToSummary(res) {
  const sets = res && res.sets ? res.sets : (res && res.result && res.result.sets ? res.result.sets : []);
  const pieces = sets.length ? (sets[0].pieces || []) : [];
  return {
    code: sets.length ? sets[0].code : (res && res.code) || '',
    possible: res ? (res.possible != null ? res.possible : (res.result && res.result.possible)) : null,
    pieces: pieces.map(p => ({
      slot: p.type, rarity: p.rarity, name: p.name,
      built: p.nativeAffixes && p.nativeAffixes !== '-' ? p.nativeAffixes : null,
      gems: (p.gems || []).map(g => ({ affix: g.affixes || '', tier: g.tier, name: g.name }))
    }))
  };
}

async function ensure() { await ready; await loadLookup(); }

self.onmessage = async (e) => {
  const { type, id, build, code } = e.data || {};
  try {
    await ensure();
    if (type === 'export') {
      const session = buildSession(build);
      const out = await self.mistfallCore.exportCode(session);
      self.postMessage({ id, ok: true, type, code: typeof out === 'string' ? out : (out && out.code) || '', pieces: session.result.sets[0].pieces });
    } else if (type === 'import') {
      const out = await self.mistfallCore.importCode(code);
      self.postMessage({ id, ok: true, type, summary: piecesToSummary(out) });
    } else {
      self.postMessage({ id, ok: false, type, error: 'unknown type ' + type });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, type, error: String((err && err.message) || err) });
  }
};
