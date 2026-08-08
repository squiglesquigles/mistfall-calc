/**
 * Extracts the real catalog data (weapons, armor, gems, affixes) from the
 * MistfallDB SSR payloads saved in backend/raw/*.html and writes structured
 * JSON to backend/data/.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAW = path.join(__dirname, 'raw');
const DATA = path.join(__dirname, 'data');

function read(p) { return fs.readFileSync(path.join(RAW, p), 'utf8'); }

// Find the balanced expression starting at 'expr' (e.g. '$R[13]={') and return its
// full text including the braces. Respects string literals and escapes.
function extractBalanced(html, startMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"' || c === "'" || c === '`') inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}


// Evaluate a $R expression and return the graph array
function evalR(expr) {
  const code = '$R = []; (' + expr + ');';
  const sandbox = { $R: [] };
  vm.createContext(sandbox);
  try {
    const ret = vm.runInContext(code, sandbox);
    console.log('evalR expr len:', expr.length, '| ret type:', typeof ret, '| R13:', typeof sandbox.$R[13], '| R14:', Array.isArray(sandbox.$R[14]) ? sandbox.$R[14].length : typeof sandbox.$R[14]);
  } catch (err) {
    console.log('evalR ERROR:', err.message);
  }
  return sandbox.$R;
}

// Parse a catalog page's $R[13] object from its raw html
function parsePage(file) {
  const html = read(file);
  const expr = extractBalanced(html, '$R[13]={');
  if (!expr) throw new Error(`No $R[13] in ${file}`);
  const R = evalR(expr);
  console.log('parsePage', file, 'R13:', typeof R[13], R[13] && Object.keys(R[13]));
  return R[13];
}

function save(name, data) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ ${name}: ${Array.isArray(data) ? data.length + ' entries' : 'object'}`);
}

function main() {
  // Weapons
  const weapons = parsePage('weapons.html').items || [];
  save('weapons.json', weapons);

  // Armor - all 4 pages (each embeds the full list; dedupe by slug)
  const armor = [];
  for (const p of [1, 2, 3, 4]) {
    const page = parsePage(`armor-p${p}.html`);
    if (page && page.items) armor.push(...page.items);
  }
  const armorU = unique(armor);
  console.log('armor raw:', armor.length, '-> unique:', armorU.length);
  save('armor.json', armorU);

  // Gems - all 4 pages (each embeds the full list; dedupe by slug)
  const gems = [];
  for (const p of [1, 2, 3, 4]) {
    const page = parsePage(`gems-p${p}.html`);
    if (page && page.items) gems.push(...page.items);
  }
  const gemsU = unique(gems);
  console.log('gems raw:', gems.length, '-> unique:', gemsU.length);
  save('gems.json', gemsU);

  // Affixes
  const affixesPage = parsePage('affixes.html');
  if (affixesPage && Array.isArray(affixesPage.items)) {
    save('affixes-live.json', affixesPage.items);
  } else {
    console.log('affixes.html: no items key ->', affixesPage && Object.keys(affixesPage));
  }
}

function unique(arr) {
  const seen = new Set();
  return arr.filter(x => {
    const k = x.slug || x.id;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

main();
