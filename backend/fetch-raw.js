/**
 * Fetch raw HTML from MistfallDB catalogs (all pagination pages) and save to backend/raw/
 * so we can inspect and parse the embedded SSR data for weapons, armor and gems.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://mistfalldb.com';
const OUT = path.join(__dirname, 'raw');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const u = new URL(res.headers.location, BASE).href;
        return fetch(u).then(resolve).catch(reject);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ url, status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
const delay = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const targets = [
    ['weapons', `${BASE}/weapons`],
    ['affixes', `${BASE}/affixes`],
    ['affix-gear', `${BASE}/affix-gear`]
  ];
  // armor + gems have pagination
  for (const p of [1, 2, 3, 4]) {
    targets.push([`armor-p${p}`, `${BASE}/armor${p > 1 ? `?page=${p}` : ''}`]);
    targets.push([`gems-p${p}`, `${BASE}/gems${p > 1 ? `?page=${p}` : ''}`]);
  }
  for (const [name, url] of targets) {
    try {
      const r = await fetch(url);
      fs.writeFileSync(path.join(OUT, `${name}.html`), r.body);
      console.log(`✓ ${name} (${r.status}) ${(r.body.length / 1024).toFixed(0)}KB -> ${name}.html`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
    }
    await delay(1200);
  }
}

run();
