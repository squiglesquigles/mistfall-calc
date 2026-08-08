/**
 * Scrape Mistfall Hunter auction/seed prices from https://mistfalldb.com/prices.
 *
 * The page is a React SSR app; each price row is embedded in the router payload
 * as:
 *   $R[N]={id,slug,kind:"weapon"|"armor"|"item"|...,name,icon,rarity,rarityTier,price,listNum}
 *
 * The list is paginated via /prices?page=1..N (currently 23 pages). We fetch every
 * page, regex-extract the price objects, dedupe by slug, and average repeated
 * entries. Output is written to backend/data/prices.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://mistfalldb.com';
const DATA_DIR = path.join(__dirname, 'data');
const OUT = path.join(DATA_DIR, 'prices.json');
const MAX_PAGES = 30;

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchPage(new URL(res.headers.location, BASE_URL).href).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout ' + url)); });
  });
}

// Extract price-bearing $R objects from a page's HTML.
const PRICE_RE = /\$R\[\d+\]=\{id:\d+,slug:"([^"]*)",kind:"([^"]*)",name:"([^"]*)",icon:"[^"]*",rarity:"([^"]*)",rarityTier:\d+,price:(\d+),listNum:\d+\}/g;

function extractPrices(html) {
  const out = [];
  let m;
  PRICE_RE.lastIndex = 0;
  while ((m = PRICE_RE.exec(html)) !== null) {
    out.push({
      slug: m[1],
      kind: m[2],
      name: m[3].replace(/\\'/g, "'"),
      rarity: m[4],
      price: parseInt(m[5], 10)
    });
  }
  return out;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const bySlug = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let html;
    try { html = await fetchPage(BASE_URL + '/prices?page=' + page); }
    catch (e) { console.error('  page', page, 'error', e.message); if (page === 1) return; break; }
    const items = extractPrices(html);
    if (items.length === 0) { console.log('page', page, 'empty — stopping'); break; }
    for (const it of items) {
      if (!bySlug.has(it.slug)) bySlug.set(it.slug, { slug: it.slug, name: it.name, kind: it.kind, rarity: it.rarity, prices: [] });
      bySlug.get(it.slug).prices.push(it.price);
    }
    console.log('  page', page, '->', items.length, 'items (running total', bySlug.size, ')');
    await delay(600);
  }

  const out = [];
  for (const e of bySlug.values()) {
    const p = e.prices.slice().sort((a, b) => a - b);
    const mid = Math.floor(p.length / 2);
    const price = p.length ? p[mid] : null;
    out.push({
      slug: e.slug,
      name: e.name,
      kind: e.kind,
      rarity: e.rarity,
      price,
      samples: p.length,
      min: p[0],
      max: p[p.length - 1]
    });
  }
  out.sort((a, b) => a.price - b.price);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const kinds = {};
  for (const e of out) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  console.log('\nSaved', out.length, 'price entries to', OUT);
  console.log('By kind:', kinds);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
