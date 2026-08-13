// Extract Withered Knight / Mercenary / Shadowstrix gear (with sockets + built-ins + prices)
// from the MIT wdthing optimizer database.json. Maps their catalogue to our gear.json format:
//   socket type: 1=Rectangle 2=Triangle 3=Square 4=Octagon 5=Circle
//   grade -> rarity: <=3 Common, 4 Rare, 5 Epic, 6 Legendary, 7 Holy
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DB = JSON.parse(readFileSync(join(ROOT, 'backend', 'vendor', 'wdthing', 'database.json'), 'utf8'));

const SLOT = { helmet: 'Head', clothes: 'Chest', gauntlets: 'Gloves', pants: 'Pants', boots: 'Boots' };
const SHAPE = { 1: 'Rectangle', 2: 'Triangle', 3: 'Square', 4: 'Octagon', 5: 'Circle' };
const RARITY = g => (g <= 3 ? 'Common' : g === 4 ? 'Rare' : g === 5 ? 'Epic' : g === 6 ? 'Legendary' : 'Holy');
const CLASS_WEAPONS = {
  Mercenary: ['Sword and Shield', 'Hammer', 'Polearm and Shield'],
  Shadowstrix: ['Dagger', 'Dual Blades'],
  'Withered Knight': ['Greatsword']
};
const CLASSES = Object.keys(CLASS_WEAPONS);
const ARMOR_SLOTS = Object.keys(SLOT);

const rows = [];
const seen = new Set();
const priceMap = {};
const usable = it =>
  (it.itemSockets && it.itemSockets.length > 0) ||
  (it.equipment && it.equipment.affixes && it.equipment.affixes.length > 0);

const pushRow = (cls, it, slot) => {
  if (!usable(it)) return;
  const built = it.equipment && it.equipment.affixes && it.equipment.affixes[0] ? it.equipment.affixes[0].name : null;
  const sockets = (it.itemSockets || []).map(s => ({ shape: SHAPE[s.type], tier: s.level }));
  const key = JSON.stringify([cls, it.name, slot, RARITY(it.grade), built, sockets]);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ class: cls, gear: it.name, slot, rarity: RARITY(it.grade), built_in_affix: built, sockets });
  if (!priceMap[it.name]) priceMap[it.name] = it.recommendedPrice || 0;
};

for (const it of DB.items) {
  if (it.category === 'weapon') {
    for (const cls of CLASSES) {
      if (CLASS_WEAPONS[cls].includes(it.subName)) pushRow(cls, it, 'Weapon');
    }
  } else if (it.category === 'armor' && ARMOR_SLOTS.includes(it.subName)) {
    for (const cls of CLASSES) pushRow(cls, it, SLOT[it.subName]);
  }
}

// merge into gear.json
const gearPath = join(ROOT, 'backend', 'data', 'gear.json');
const gear = JSON.parse(readFileSync(gearPath, 'utf8'));
const before = gear.length;
gear.push(...rows);
writeFileSync(gearPath, JSON.stringify(gear, null, 2), 'utf8');

// merge prices
const pricesPath = join(ROOT, 'backend', 'data', 'prices.json');
let prices = JSON.parse(readFileSync(pricesPath, 'utf8'));
if (!Array.isArray(prices)) prices = [];
const byName = new Map(prices.map(p => [p.name, p]));
for (const [name, price] of Object.entries(priceMap)) {
  if (!price) continue;
  const cur = byName.get(name);
  if (cur) cur.price = price;
  else { prices.push({ name, price }); byName.set(name, { name, price }); }
}
writeFileSync(pricesPath, JSON.stringify(prices, null, 2), 'utf8');

const byClass = {};
for (const r of rows) byClass[r.class] = (byClass[r.class] || 0) + 1;
console.log('gear.json:', before, '->', gear.length, '(+' + rows.length + ')');
console.log('per class:', byClass);
console.log('prices added/updated:', Object.keys(priceMap).filter(n => priceMap[n]).length);
