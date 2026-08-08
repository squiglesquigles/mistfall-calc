#!/usr/bin/env python3
"""Import Mistfall game data from Class_Gear_and_Gem_Database.xlsx into backend/data/.

Sheets:
  Gear Database  -> gear.json        (gear drop variants: built-in affix + sockets)
  Gem Catalog    -> gem_catalog.json (socket shape/tier -> granted affixes)
  Affix Registry -> affix_registry.json
"""
import zipfile, re, json, os
import xml.etree.ElementTree as ET

PATH = os.path.join(os.path.dirname(__file__), '..', 'Class_Gear_and_Gem_Database.xlsx')
OUT = os.path.join(os.path.dirname(__file__), 'data')
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
RNS = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

z = zipfile.ZipFile(PATH)
wb = ET.fromstring(z.read('xl/workbook.xml'))
sheets = [(s.get('name'), s.get(RNS + 'id')) for s in wb.find(NS + 'sheets')]
rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
rpath = {r.get('Id'): r.get('Target') for r in rels}

ss = ET.fromstring(z.read('xl/sharedStrings.xml'))
shared = [''.join(t.text or '' for t in si.iter(NS + 't')) for si in ss.findall(NS + 'si')]

def colnum(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    c = 0
    for ch in m.group(1):
        c = c * 26 + (ord(ch) - 64)
    return c - 1, int(m.group(2))

def read_sheet(name):
    rid = dict(sheets)[name]
    root = ET.fromstring(z.read('xl/' + rpath[rid]))
    rows = []
    for sdn in root.iter(NS + 'sheetData'):
        for row in sdn.findall(NS + 'row'):
            rn = int(row.get('r'))
            cells = {}
            for c in row.findall(NS + 'c'):
                col, _ = colnum(c.get('r'))
                t = c.get('t'); v = c.find(NS + 'v')
                if t == 's':
                    val = shared[int(v.text)] if v is not None and v.text else ''
                elif t == 'inlineStr':
                    iso = c.find(NS + 'is')
                    val = ''.join(x.text or '' for x in iso.iter(NS + 't')) if iso is not None else ''
                elif v is not None and v.text is not None:
                    val = v.text
                else:
                    val = ''
                cells[col] = val
            rows.append((rn, cells))
    rows.sort(key=lambda r: r[0])
    # build 2D grid of row values
    maxc = max((max(cells) for _, cells in rows if cells), default=0)
    grid = []
    for rn, cells in rows:
        grid.append([cells.get(i, '').strip() for i in range(maxc + 1)])
    return grid

def shape_tier(val):
    """'Octagon T2' -> ('Octagon', 2); 'Octagon' -> ('Octagon',1); '-'/'*'/'' -> None"""
    if not val or val in ('-', '—', '*'): return None
    m = re.match(r'^(.*?)\s*(T\d)?$', val)
    shape = m.group(1).strip()
    t = int(m.group(2)[1:]) if m.group(2) else 1
    return (shape, t)

# ---------------- Gear Database ----------------
gear_grid = read_sheet('Gear Database')
header = gear_grid[0]
gear_dbs = []
for row in gear_grid[3:]:  # data starts after 'Class' header row (idx 3 in this sheet)
    # detect header row (Class at col0) mid-sheet and skip
    if not row or not row[0]: continue
    if row[0].lower() == 'gear database' or (row[0].lower() == 'class' and row[2].lower() == 'gear slot'):
        continue
    cls_v, gear, slot, rarity = row[0], row[1], row[2], row[3]
    if not cls_v or cls_v in ('Class',): continue
    built = row[4] if row[4] and row[4] not in ('-', '—') else None
    sockets = []
    for colv in (row[5], row[6], row[7]):
        st = shape_tier(colv)
        if st: sockets.append({'shape': st[0], 'tier': st[1]})
    gear_dbs.append({
        'class': cls_v, 'gear': gear, 'slot': slot, 'rarity': rarity,
        'built_in_affix': built, 'sockets': sockets
    })
json.dump(gear_dbs, open(os.path.join(OUT, 'gear.json'), 'w'), indent=2)

# ---------------- Gem Catalog ----------------
gem_grid = read_sheet('Gem Catalog')
gems = []
for row in gem_grid[4:]:
    if not row or not row[0] or row[0].lower() in ('shape / socket icon', 'rectangle / pill'): pass
    if not row or not row[0]: continue
    if row[0].lower() in ('shape / socket icon',) or 'Gem Catalog' in row[0]: continue
    shape, border, tier, color, a1, a2, note = row[0], row[1], row[2], row[3], row[4], row[5], row[6]
    if not shape: continue
    shape_clean = re.sub(r'\s*/\s*.*', '', shape)  # 'Rectangle / Pill' -> 'Rectangle'
    if shape_clean == 'Circle': shape_clean = 'Circle/Swirl'
    gems.append({
        'shape': shape_clean,
        'border': border,          # 'Standard (Silver)' | 'Gold Outline'
        'tier': int(re.sub(r'\D', '', tier)) if re.search(r'\d', tier) else 1,
        'color': color,
        'affix1': a1 if a1 and a1 not in ('-', '—') and not a1.startswith('[') else None,
        'affix2': a2 if a2 and a2 not in ('-', '—') and not a2.startswith('[') else None,
        'note': note
    })
json.dump(gems, open(os.path.join(OUT, 'gem_catalog.json'), 'w'), indent=2)

# ---------------- Affix Registry ----------------
affix_grid = read_sheet('Affix Registry')
reg = []
for row in affix_grid[4:]:
    if not row or not row[0] or row[0] in ('-', 'Octagon','Square','Rectangle','Triangle','Octagon T2','Square T2','Rectangle T2','Triangle T2'): continue
    if row[0].lower() == 'affix name': continue
    if len(row) > 1 and row[1] and 'ignore' in row[1].lower(): continue  # skip sheet-note rows (e.g. Circle — "Ignore cells on the left")
    reg.append({'name': row[0], 'source': row[1], 'visual': row[2], 'gem_socket': row[3], 'effect': row[4]})
json.dump(reg, open(os.path.join(OUT, 'affix_registry.json'), 'w'), indent=2)

print('gear.json        :', len(gear_dbs), 'variants')
print('gem_catalog.json :', len(gems), 'gems')
print('affix_registry.. :', len(reg), 'affixes')
