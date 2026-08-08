export {};
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'affixes_raw.html');
const OUT = path.join(ROOT, 'backend', 'data', 'affixes.json');
const WRITE = process.argv.includes('--write');

const $ = load(readFileSync(HTML, 'utf8'));
const affixes = JSON.parse(readFileSync(OUT, 'utf8'));
const byName = new Map(affixes.map(a => [a.name, a]));

const runs = [];
$('h3').each((_, node) => {
  const h3 = $(node);
  // 1) name = leading text node of the <h3> (before the group <span>)
  const nameNode = h3.contents().get().find(c => c.type === 'text' && c.data.trim());
  if (!nameNode) return;
  const name = nameNode.data.trim();
  if (!byName.has(name)) return; // only affixes we track

  // 2) group/role = the trailing <span> inside the <h3>
  const role = h3.find('span').text().trim() || null;

  // 3) description = the line-clamped paragraph inside the card body
  let desc = h3.parent().find('p').first().text().trim() || null;

  // 4) unlock levels = "Lv N" text anywhere in the card footer/body
  const card = h3.parent().parent();
  let levels = [];
  const lvM = card.text().match(/Lv\s*(\d+)/g);
  if (lvM) levels = [...new Set(lvM.map(t => parseInt(t.replace(/\D/g, ''), 10)))];
  // sanity: real unlock levels range 1..40
  levels = levels.filter(n => n >= 1 && n <= 40 && levels.length <= 4);

  runs.push({ name, role, desc, levels });
});

console.log('Affixes matched on page:', runs.length, '/', affixes.length);
const changed = runs.filter((r, i) => {
  const cur = byName.get(r.name);
  return (r.desc && cur.desc !== r.desc) || (r.role && cur.group !== r.role) ||
    (r.levels && r.levels.length && !cur.level) ||
    (r.levels && r.levels.length && cur.level && JSON.stringify(cur.level) !== JSON.stringify(r.levels));
});
console.log('With changes:', changed.length);
changed.slice(0, 5).forEach(r => {
  const cur = byName.get(r.name);
  console.log(' ', r.name, '| old lv:', JSON.stringify(cur.level), '-> new lv:', JSON.stringify(r.levels), '| old grp:', cur.group, '->', r.role, '| descLen:', (cur.desc||'').length, '->', (r.desc||'').length);
});

if (WRITE) {
  let updated = 0;
  for (const r of runs) {
    const a = byName.get(r.name);
    if (!r.desc) continue;
    a.desc = r.desc;
    if (r.role) a.group = r.role;
    if (r.levels && r.levels.length) a.level = [...new Set(r.levels)];
    updated++;
  }
  writeFileSync(OUT, JSON.stringify(affixes, null, 2), 'utf8');
  console.log('Wrote affixes.json — updated entries:', updated);
}