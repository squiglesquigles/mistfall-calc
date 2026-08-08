/**
 * Mistfall Hunter Data Scraper
 * Scrapes MistfallDB for game data: classes, weapons, armor, affixes, gems, prices
 * The site is a React SSR app - data is embedded in $_TSR.router script tags
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://mistfalldb.com';
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Simple fetch wrapper
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirects
        const redirectUrl = new URL(res.headers.location, BASE_URL).href;
        fetchPage(redirectUrl).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout fetching ' + url));
    });
  });
}

// Wait helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract the embedded JSON data from the SSR script
function extractEmbeddedData(html) {
  // The data is in the $_TSR.router script tag - look for the l= items
  const tsrMatch = html.match(/\$R\[13\]=\{items:\$R\[14\]=\[(.*?)\]\},\$\]/s);
  if (tsrMatch) {
    try {
      // Parse individual item objects
      const itemsRaw = tsrMatch[1];
      const items = [];
      const itemRegex = /\$R\[(\d+)\]=\{([^}]+)\}/g;
      let match;
      while ((match = itemRegex.exec(itemsRaw)) !== null) {
        const objStr = '{' + match[2] + '}';
        try {
          // Clean up the JS object syntax to valid JSON-ish
          const cleaned = objStr
            .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
            .replace(/undefined/g, 'null');
          items.push(JSON.parse(cleaned));
        } catch (e) {
          // Skip malformed objects
        }
      }
      return items;
    } catch (e) {
      console.error('Error parsing embedded data:', e.message);
    }
  }
  return null;
}

// Generic extraction - look for JSON-LD or data attributes
function extractJsonLd(html) {
  const results = [];
  const regex = /<script type="application\/ld\+json">(.*?)<\/script>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch (e) {
      // Skip malformed JSON-LD
    }
  }
  return results;
}

// Extract catalog data - MistfallDB uses a catalog-vTRtJb6b.js with structured data
// The SSR pages include inline JSON in script tags with item data
function extractCatalogItems(html) {
  const items = [];
  
  // Look for ItemList JSON-LD
  const jsonLd = extractJsonLd(html);
  for (const doc of jsonLd) {
    if (doc['@type'] === 'ItemList' && doc.itemListElement) {
      for (const item of doc.itemListElement) {
        items.push({
          name: item.name,
          position: item.position,
          url: item.url
        });
      }
    }
  }
  
  return items;
}

// Extract prices from the auction prices page
function extractPrices(html) {
  // Look for table rows with item names and prices
  const prices = [];
  
  // Try to find structured data in the SSR payload
  // The site embeds data in the router manifest
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || [];
    if (cells.length >= 2) {
      const nameMatch = cells[0].match(/>([^<]+)</);
      const priceMatch = cells[1].match(/(\d[\d,.]*)/);
      if (nameMatch && priceMatch) {
        prices.push({
          name: nameMatch[1].trim(),
          price: parseFloat(priceMatch[1].replace(/,/g, ''))
        });
      }
    }
  }
  
  return prices;
}

// Parse classes from the classes page
function parseClasses(html) {
  const classes = [];
  
  // Look for class cards in the page
  // Each class is an <a href="/classes/slug"> with icon, name, role, weapons
  const cardRegex = /<a href="\/classes\/([a-z-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  const seen = new Set();
  
  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1];
    const content = match[2];
    
    // Skip if it's just a link in the nav/header
    if (seen.has(slug)) continue;
    
    // Extract icon
    const iconMatch = content.match(/src="([^"]*(?:10400\d)\.webp)"/);
    const icon = iconMatch ? iconMatch[1] : null;
    
    // Extract name
    const nameMatch = content.match(/>([A-Z][a-zA-Z\s]+?)<\/h3>/);
    const name = nameMatch ? nameMatch[1].trim() : slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    
    // Extract tier
    const tierMatch = content.match(/style="color:var\(--rarity-([a-z]+)\).*?>([A-F])</s);
    const tier = tierMatch ? tierMatch[2] : null;
    
    // Extract role and weapons
    const roleWeaponMatch = content.match(/([A-Za-z\s]+?)\s*·\s*([A-Za-z\s&/]+?)<\/div>/);
    const role = roleWeaponMatch ? roleWeaponMatch[1].trim() : null;
    const weapon = roleWeaponMatch ? roleWeaponMatch[2].trim() : null;
    
    // Extract blurb
    const blurbMatch = content.match(/line-clamp-3[^>]*>([\s\S]*?)<\/p>/);
    const blurb = blurbMatch ? blurbMatch[1].trim() : '';
    
    // Only add unique class entries (the tier list appears first)
    if (tier && name && !seen.has(slug)) {
      classes.push({
        id: slug,
        slug,
        name,
        icon,
        role,
        weapon,
        tier,
        blurb
      });
      seen.add(slug);
    }
  }
  
  // Also try to extract from the router data
  if (classes.length === 0) {
    const embedded = html.match(/\{key:"([a-z-]+)",id:(\d+),name:"([^"]+)",slug:"([^"]+)",icon:"([^"]+)",portrait:"([^"]+)",blurb:"([^"]+)",weapon:"([^"]+)",role:"([^"]+)"\}/g);
    if (embedded) {
      for (const e of embedded) {
        const m = e.match(/\{key:"([a-z-]+)",id:(\d+),name:"([^"]+)",slug:"([^"]+)",icon:"([^"]+)",portrait:"([^"]+)",blurb:"([^"]+)",weapon:"([^"]+)",role:"([^"]+)"\}/);
        if (m) {
          classes.push({
            id: m[1],
            slug: m[4],
            name: m[3],
            icon: m[5],
            portrait: m[6],
            blurb: m[7],
            weapon: m[8],
            role: m[9]
          });
        }
      }
    }
  }
  
  return classes;
}

// Extract affixes from the affixes page
function parseAffixes(html) {
  const affixes = [];
  
  // Look for structured data in the SSR payload
  const regex = /\{name:"([^"]+)"[\s\S]*?\}/g;
  let match;
  const seen = new Set();
  
  // Try to find affix entries from the catalog data
  const affixMatches = html.match(/\{id:\d+,slug:"([a-z0-9-]+)",name:"([^"]+)",description:"([^"]*)",category:"([^"]*)"/g);
  if (affixMatches) {
    for (const a of affixMatches) {
      const m = a.match(/\{id:(\d+),slug:"([a-z0-9-]+)",name:"([^"]+)",description:"([^"]*)",category:"([^"]*)"/);
      if (m && !seen.has(m[2])) {
        affixes.push({
          id: parseInt(m[1]),
          slug: m[2],
          name: m[3],
          description: m[4],
          category: m[5]
        });
        seen.add(m[2]);
      }
    }
  }
  
  return affixes;
}

// Main scrape function
async function scrape() {
  console.log('=== Mistfall Hunter Data Scraper ===');
  console.log('Fetching data from MistfallDB...\n');
  
  const results = {};
  
  // 1. Classes
  try {
    console.log('Fetching classes...');
    const html = await fetchPage(BASE_URL + '/classes');
    const classes = parseClasses(html);
    if (classes.length > 0) {
      results.classes = classes;
      fs.writeFileSync(path.join(DATA_DIR, 'classes.json'), JSON.stringify(classes, null, 2));
      console.log(`  ✓ Saved ${classes.length} classes`);
    } else {
      console.log('  ⚠ No classes parsed - will use manual data');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching classes:', e.message);
  }
  
  // 2. Affixes
  try {
    console.log('Fetching affixes...');
    const html = await fetchPage(BASE_URL + '/affixes');
    const affixes = parseAffixes(html);
    if (affixes.length > 0) {
      results.affixes = affixes;
      fs.writeFileSync(path.join(DATA_DIR, 'affixes.json'), JSON.stringify(affixes, null, 2));
      console.log(`  ✓ Saved ${affixes.length} affixes`);
    } else {
      console.log('  ⚠ No affixes parsed');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching affixes:', e.message);
  }
  
  // 3. Gems (Affix Gems)
  try {
    console.log('Fetching gems...');
    const html = await fetchPage(BASE_URL + '/gems');
    const gems = extractCatalogItems(html);
    if (gems.length > 0) {
      results.gems = gems;
      fs.writeFileSync(path.join(DATA_DIR, 'gems.json'), JSON.stringify(gems, null, 2));
      console.log(`  ✓ Saved ${gems.length} gems`);
    } else {
      console.log('  ⚠ No gems parsed - will use manual data');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching gems:', e.message);
  }
  
  // 4. Prices (auction)
  try {
    console.log('Fetching auction prices...');
    const html = await fetchPage(BASE_URL + '/prices');
    const prices = extractPrices(html);
    if (prices.length > 0) {
      results.prices = prices;
      fs.writeFileSync(path.join(DATA_DIR, 'prices.json'), JSON.stringify(prices, null, 2));
      console.log(`  ✓ Saved ${prices.length} price entries`);
    } else {
      console.log('  ⚠ No prices parsed - will use manual price data');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching prices:', e.message);
  }
  
  // 5. Weapons
  try {
    console.log('Fetching weapons...');
    const html = await fetchPage(BASE_URL + '/weapons');
    const weapons = extractCatalogItems(html);
    if (weapons.length > 0) {
      results.weapons = weapons;
      fs.writeFileSync(path.join(DATA_DIR, 'weapons.json'), JSON.stringify(weapons, null, 2));
      console.log(`  ✓ Saved ${weapons.length} weapons`);
    } else {
      console.log('  ⚠ No weapons parsed - will use manual data');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching weapons:', e.message);
  }
  
  // 6. Armor
  try {
    console.log('Fetching armor...');
    const html = await fetchPage(BASE_URL + '/armor');
    const armor = extractCatalogItems(html);
    if (armor.length > 0) {
      results.armor = armor;
      fs.writeFileSync(path.join(DATA_DIR, 'armor.json'), JSON.stringify(armor, null, 2));
      console.log(`  ✓ Saved ${armor.length} armor pieces`);
    } else {
      console.log('  ⚠ No armor parsed - will use manual data');
    }
    await delay(1500);
  } catch (e) {
    console.error('  ✗ Error fetching armor:', e.message);
  }
  
  console.log('\n=== Scrape complete ===');
  console.log(`Saved data to: ${DATA_DIR}`);
}

// Run the scraper
scrape().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});