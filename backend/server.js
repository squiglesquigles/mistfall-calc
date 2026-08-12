const express = require('express');
const cors = require('cors');
const path = require('path');
const { generateBuild, loadData, WEAPONS_BY_CLASS, reachableAffixes, WINES } = require('./optimizer');
const { buildPriceIndex } = require('./pricing');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API: Get all classes
app.get('/api/classes', (req, res) => {
  const { classes } = loadData();
  res.json(classes);
});

// API: Get all affixes
app.get('/api/affixes', (req, res) => {
  const { affixes } = loadData();
  res.json(affixes);
});

// API: Class + weapon availability / build metadata
app.get('/api/meta', (req, res) => {
  const reachable = {};
  for (const cls of Object.keys(WEAPONS_BY_CLASS)) {
    for (const weapon of WEAPONS_BY_CLASS[cls]) {
      reachable[cls + '-' + weapon] = reachableAffixes(cls, weapon);
    }
  }
  res.json({
    weaponsByClass: WEAPONS_BY_CLASS,
    slots: {
      armor: ['Head', 'Chest', 'Gloves', 'Pants', 'Boots'],
      accessories: ['Ring', 'Necklace']
    },
    reachable,
    wines: WINES
  });
});

// API: Price index (gear names -> cost, gem affix keys -> cost, fallbacks)
app.get('/api/prices', (req, res) => {
  const index = buildPriceIndex();
  res.json({
    armor: index.armorPrice,
    gemByAffix: index.gemPriceByAffix,
    config: index.config
  });
});

// API: Generate a build
app.post('/api/builds', (req, res) => {
  const { className, weapon, wine, affixes, rarityPref, forcedAccessories } = req.body;

  if (!className) return res.status(400).json({ error: 'className is required' });
  if (!weapon) return res.status(400).json({ error: 'weapon is required' });
  if (!affixes || !Array.isArray(affixes) || affixes.length === 0) {
    return res.status(400).json({ error: 'affixes array is required' });
  }

  const result = generateBuild(className, weapon, wine, affixes, rarityPref, forcedAccessories);
  res.json(result);
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log('Mistfall Hunter Calculator API running on http://localhost:' + PORT);
});

