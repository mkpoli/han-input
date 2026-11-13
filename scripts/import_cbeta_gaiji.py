# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow>=11", "openpyxl>=3.1"]
# ///
# Imports CBETA's missing-character database and its glyph images from pinned commits of
# cbeta-org/cbeta_gaiji and cbeta-org/gaiji-CB. Each glyph is fitted to a 64-pixel cell and packed
# 256 to a one-bit sheet, so a browsed page loads one or two images. Two privately supplied workbooks,
# copied to cache/cbeta-workbooks/ and pinned by digest, add the radical, strokes and zhuyin of CBETA's
# web pages and an IDS for many codes.
#   uv run scripts/import_cbeta_gaiji.py
import hashlib, io, json, os, re, tarfile, urllib.request
import openpyxl
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
CACHE = os.path.join(ROOT, 'cache')
OUT = os.path.join(ROOT, 'app', 'public', 'charsets')
SHEETS = 'cbeta-glyphs'
CELL, COLUMNS, PAD = 64, 16, 2
PER_SHEET = COLUMNS * COLUMNS

DATABASE = {
    'url': 'https://raw.githubusercontent.com/cbeta-org/cbeta_gaiji/857156a6d9f37a020d34099447b51a0b72264620/cbeta_gaiji.json',
    'as': 'cbeta_gaiji-857156a.json',
    'repository': 'https://github.com/cbeta-org/cbeta_gaiji',
    'committed': '2026-11-09',
}
IMAGES = {
    'url': 'https://codeload.github.com/cbeta-org/gaiji-CB/tar.gz/e402e97cf0065bd3f13854c0b1c92efe23f859c1',
    'as': 'gaiji-CB-e402e97.tar.gz',
    'repository': 'https://github.com/cbeta-org/gaiji-CB',
    'committed': '2026-11-01',
}
RETRIEVED = '2026-11-14'
WORKBOOKS = {
    'notes': {'file': 'CBETA難字庫.xlsx', 'sha256': '20bd336863f10da880c4883eae10bb06775d73f8752569d7a41af9180ed3dd38'},
    'ids': {'file': 'CBETA難字庫IDS版_1.2.xlsx', 'sha256': '9fce87c4dfd6a93e8f185bf96640e5db29bc720ea99e1b7667b840341d6bd02a'},
}
IDC = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿㇯')
HAN = re.compile('[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\U00020000-\U0003FFFF]')


def fetch_once(source):
    path = os.path.join(CACHE, source['as'])
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        with urllib.request.urlopen(source['url'], timeout=300) as response:
            data = response.read()
        with open(path, 'wb') as file:
            file.write(data)
        print(f'  fetched {source["url"]}')
    with open(path, 'rb') as file:
        return path, hashlib.sha256(file.read()).hexdigest()


lock_path = os.path.join(OUT, 'cbeta_gaiji_source.json')
locked = json.load(open(lock_path, encoding='utf-8')) if os.path.exists(lock_path) else {}
lock = {}
for key, source in (('database', DATABASE), ('images', IMAGES)):
    path, digest = fetch_once(source)
    if key in locked and locked[key]['sha256'] != digest:
        raise SystemExit(f'Source digest changed: {source["url"]}')
    source['path'] = path
    lock[key] = {'url': source['url'], 'repository': source['repository'], 'committed': source['committed'], 'retrieved': RETRIEVED, 'sha256': digest}

database = json.load(open(DATABASE['path'], encoding='utf-8'))


def sheet_rows(key):
    path = os.path.join(CACHE, 'cbeta-workbooks', WORKBOOKS[key]['file'])
    with open(path, 'rb') as file:
        if hashlib.sha256(file.read()).hexdigest() != WORKBOOKS[key]['sha256']:
            raise SystemExit(f'Workbook changed: {path}')
    lock[f'workbook-{key}'] = {'url': f'file:cbeta-workbooks/{WORKBOOKS[key]["file"]}', 'sha256': WORKBOOKS[key]['sha256'], 'supplied': RETRIEVED}
    return list(openpyxl.load_workbook(path, read_only=True).worksheets[0].iter_rows(values_only=True))[1:]


# The IDS workbook repeats every row of the notes workbook, with one note's punctuation revised, and
# adds the IDS columns, so its notes are the ones read.
notes = {row[0]: row for row in sheet_rows('notes') if row[0]}
workbook = {row[0]: row for row in sheet_rows('ids') if row[0]}
for code, row in notes.items():
    if code not in workbook or row[2] != workbook[code][3]:
        raise SystemExit(f'{code}: the two workbooks disagree')
    if code not in database or row[2] != database[code]['composition']:
        raise SystemExit(f'{code}: the workbook formula differs from the database')


def note(info, label):
    match = re.search(r'【' + label + r'[:：]\s*([^】]*)】', info or '')
    return match[1].strip() if match else ''


def is_ids(text):
    return bool(text) and any(char in IDC for char in text)


def scalar(hex_value, char, code):
    if chr(int(hex_value, 16)) != char:
        raise SystemExit(f'{code}: {hex_value} does not match {char}')
    return f'U+{int(hex_value, 16):04X}'


codes = sorted(database, key=lambda code: int(code[2:]))
for code in codes:
    if not re.fullmatch(r'CB\d{5}', code):
        raise SystemExit(f'Unexpected code {code}')
    if database[code]['pua'] != f'U+{0xF0000 + int(code[2:]):X}':
        raise SystemExit(f'{code}: private-use slot {database[code]["pua"]} is not U+F0000 + {int(code[2:])}')

glyphs = {}
with tarfile.open(IMAGES['path']) as tar:
    for member in tar:
        match = re.fullmatch(r'[^/]+/\d{2}/(CB\d{5})\.gif', member.name)
        if member.isfile() and match:
            glyphs[match[1]] = tar.extractfile(member).read()
extra = sorted(set(glyphs) - set(database))


def ink(data):
    """The glyph's strokes as a mask fitted inside one cell, centred."""
    image = Image.open(io.BytesIO(data)).convert('RGBA')
    mask = Image.eval(image.convert('L'), lambda v: 255 - v)
    alpha = image.getchannel('A')
    mask = Image.composite(mask, Image.new('L', image.size, 0), alpha)
    box = CELL - 2 * PAD
    scale = min(box / image.width, box / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    mask = mask.resize(size, Image.Resampling.LANCZOS).point(lambda v: 255 if v >= 128 else 0)
    cell = Image.new('L', (CELL, CELL), 0)
    cell.paste(mask, ((CELL - size[0]) // 2, (CELL - size[1]) // 2))
    return cell


# Images whose code has no database row still carry CBETA's glyph; they follow the database's codes,
# so adding them leaves the earlier sheets as they were.
drawn = [code for code in codes if code in glyphs] + extra
sheet_dir = os.path.join(OUT, SHEETS)
os.makedirs(sheet_dir, exist_ok=True)
for name in os.listdir(sheet_dir):
    os.remove(os.path.join(sheet_dir, name))
atlas = {}
for start in range(0, len(drawn), PER_SHEET):
    number = start // PER_SHEET
    mask = Image.new('L', (CELL * COLUMNS, CELL * COLUMNS), 0)
    for index, code in enumerate(drawn[start:start + PER_SHEET]):
        mask.paste(ink(glyphs[code]), ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
        atlas[code] = {'sheet': f'{SHEETS}/{number:03d}.png', 'cell': index}
    sheet = mask.point(lambda v: 1 if v else 0).convert('P')
    sheet.putpalette([255, 255, 255, 0, 0, 0])
    sheet.save(os.path.join(sheet_dir, f'{number:03d}.png'), bits=1, transparency=0, optimize=True)

records = []
for code in codes:
    entry = database[code]
    record = {'document': 'cbeta', 'source': code}
    if 'unicode' in entry:
        record['mappedUnicode'] = scalar(entry['unicode'], entry['uni_char'], code)
    if 'norm_unicode' in entry:
        record['similarUnicode'] = scalar(entry['norm_unicode'], entry['norm_uni_char'], code)
    record['composition'] = entry['composition']
    if 'norm_big5_char' in entry:
        record['common'] = entry['norm_big5_char']
    if 'moe_variant_id' in entry:
        record['moeVariant'] = entry['moe_variant_id']
    if code in atlas:
        record['atlas'] = atlas[code]
    row = workbook.get(code)
    if row:
        # The workbook's notes and identifications stay apart from CBETA's own fields.
        info = row[6]
        added = {}
        if note(info, '部首'):
            added['radical'] = note(info, '部首')
        # A total written as `T=-R+S` counts the radical negatively and cannot be trusted.
        strokes = re.fullmatch(r'(\d+)=\d+\+\d+', note(info, '筆畫'))
        if strokes:
            added['strokes'] = int(strokes[1])
        if note(info, '注音'):
            added['zhuyin'] = re.split(r'[\s．]+', note(info, '注音').strip())
        if is_ids(row[5]):
            added['ids'] = row[5]
        if is_ids(row[4]) and row[4] != row[5]:
            added['idsMachine'] = row[4]
        # A single character the workbook names for an unencoded code is its identification, not CBETA's.
        proposed = row[5] or ''
        similar = chr(int(record['similarUnicode'][2:], 16)) if 'similarUnicode' in record else ''
        if 'mappedUnicode' not in record and HAN.fullmatch(proposed) and proposed not in (similar, record.get('common')):
            added['proposed'] = proposed
        if added:
            record['workbook'] = added
    records.append(record)
for code in extra:
    records.append({'document': 'cbeta', 'source': code, 'status': 'An image in gaiji-CB whose code has no row in the database.', 'atlas': atlas[code]})
records.sort(key=lambda record: int(record['source'][2:]))

with open(lock_path, 'w', encoding='utf-8') as file:
    json.dump(lock, file, ensure_ascii=False, indent=2)
    file.write('\n')
with open(os.path.join(OUT, 'cbeta_gaiji_records.json'), 'w', encoding='utf-8') as file:
    json.dump({
        'id': 'cbeta_gaiji',
        'group': 'CBETA',
        'label': 'CBETA缺字',
        'names': {'en': 'CBETA missing characters', 'zh': 'CBETA缺字', 'hans': 'CBETA缺字', 'ja': 'CBETA缺字', 'ko': 'CBETA 缺字'},
        'source': {'name': 'CBETA', 'url': DATABASE['repository']},
        'recordsNote': False,
        'search': True,
        'title': 'CBETA缺字資料庫',
        'complete': True,
        'scope': 'Every CB code in CBETA’s missing-character database and its image archive, with the formula and glyph CBETA gives; a workbook adds notes, IDS and proposed characters, kept under each record’s workbook field.',
        'documents': [{
            'id': 'cbeta',
            'document': 'cbeta_gaiji',
            'title': 'CBETA缺字資料庫',
            'source': 'CBETA',
            'date': DATABASE['committed'],
            'url': DATABASE['repository'],
            'workbook': 'CBETA難字庫IDS版 1.2',
        }],
        'records': records,
    }, file, ensure_ascii=False, separators=(',', ':'))
    file.write('\n')

# CBETA reserves U+F0000 plus the code's number for each code, the private-use form its texts carry.
pua = {
    'source': {
        'name': 'CBETA 缺字資料庫, pua field',
        'url': DATABASE['repository'],
        'dataUrl': DATABASE['url'],
        'retrieved': RETRIEVED,
        'sha256': lock['database']['sha256'],
        'licence': 'No licence stated in the repository.',
    },
    'mappings': {chr(0xF0000 + int(code[2:])): database[code]['uni_char'] for code in codes if 'unicode' in database[code]},
}
with open(os.path.join(ROOT, 'data', 'cbeta-pua.json'), 'w', encoding='utf-8') as file:
    json.dump(pua, file, ensure_ascii=False, indent=2)
    file.write('\n')
with open(os.path.join(ROOT, 'data', 'cbeta-pua-codes.json'), 'w', encoding='utf-8') as file:
    json.dump({'formula': {'base': 0xF0000, 'prefix': 'CB', 'digits': 5}, 'numbers': sorted(int(code[2:]) for code in codes + extra)}, file, separators=(',', ':'))
    file.write('\n')

encoded = sum('mappedUnicode' in record for record in records)
print(f'{len(records)} CB codes, {encoded} encoded, {len(atlas)} glyphs on {-(-len(drawn) // PER_SHEET)} sheets; '
      f'{sum(code not in atlas for code in codes if "unicode" not in database[code])} unencoded without a glyph; '
      f'{len(extra)} images without a database row ({", ".join(extra[:3])}…)')
