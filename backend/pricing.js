/**
 * Pricing layer for the Mistfall Hunter Build Calculator.
 *
 * Builds a cost index for every gear variant and gem from the scraped MistfallDB
 * price data:
 *   - prices.json  -> the /prices auction seed price per item name (authoritative;
 *                     covers weapons, armor, rings/necklaces, gems).
 *   - armor.json   -> recommendedPrice fallback for any name /prices missed.
 *   - gems.json    -> recommendedPrice (fallback to average of minPrice/maxPrice)
 *                     per (gemLevel, sorted affix-name) key for gem costs.
 *
 * Any item still unresolved after both sources falls back to a small default so
 * the optimizer always has a finite cost.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const loadJ = f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));

// Configurable fallbacks (should rarely trigger now that /prices is scraped).
const DEFAULT_ARMOR_COST = 500;
const DEFAULT_WEAPON_COST = 1500;
const DEFAULT_GEM_COST = 150;

// Slots that represent a weapon (used only for fallback defaults).
const WEAPON_SLOTS = new Set(['Weapon', 'Mace', 'Catalyst', 'Greatsword', 'Bow', 'Staff', 'Dagger', 'Dual Blades', 'Hammer', 'Sword and Shield', 'Polearm and Shield']);

function buildPriceIndex() {
  const prices = loadJ('prices.json');
  const armor = loadJ('armor.json');
  const gemsDB = loadJ('gems.json');

  // Price by item name from /prices (authoritative, includes weapons).
  const priceByName = {};
  for (const p of prices) {
    if (p && p.name && p.price != null) {
      priceByName[p.name] = Number(p.price);
    }
  }

  // armor.json recommendedPrice fallback for names not covered by /prices.
  for (const a of armor) {
    if (a && a.name && a.recommendedPrice != null && priceByName[a.name] == null) {
      priceByName[a.name] = Number(a.recommendedPrice);
    }
  }

  // Gem price by (tier, sorted affix-name) key.
  const gemPriceByAffix = {};
  for (const g of gemsDB) {
    if (g == null || g.gemLevel == null || !Array.isArray(g.affixes)) continue;
    const names = g.affixes.map(a => (a && a.name) || '').filter(Boolean).sort();
    const key = g.gemLevel + '|' + names.join('|');
    let price = DEFAULT_GEM_COST;
    if (g.recommendedPrice != null) price = Number(g.recommendedPrice);
    else if (g.minPrice != null && g.maxPrice != null) price = Math.round((Number(g.minPrice) + Number(g.maxPrice)) / 2);
    gemPriceByAffix[key] = price;
  }

  return { priceByName, armorPrice: priceByName, gemPriceByAffix, config: { DEFAULT_ARMOR_COST, DEFAULT_WEAPON_COST, DEFAULT_GEM_COST } };
}

function gearCost(index, gearName, slot) {
  if (index.priceByName[gearName] != null) return index.priceByName[gearName];
  return WEAPON_SLOTS.has(slot) ? DEFAULT_WEAPON_COST : DEFAULT_ARMOR_COST;
}

function gemCost(index, tier, affix1, affix2) {
  const names = [affix1, affix2].filter(Boolean).sort();
  const key = tier + '|' + names.join('|');
  const p = index.gemPriceByAffix[key];
  return p != null ? p : DEFAULT_GEM_COST;
}

module.exports = { buildPriceIndex, gearCost, gemCost, WEAPON_SLOTS, DEFAULT_ARMOR_COST, DEFAULT_WEAPON_COST, DEFAULT_GEM_COST };
