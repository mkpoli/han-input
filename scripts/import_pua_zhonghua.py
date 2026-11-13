# /// script
# requires-python = ">=3.12"
# dependencies = ["openpyxl>=3.1"]
# ///
# The 中华书局宋 font's plane 15 private-use slots. 字統網's gzhs payload names 27,939 of them by a
# Unicode character or an IDS; a privately supplied workbook lists the font's other slots, a few hundred
# of them described. Both inputs are pinned by SHA-256.
#   uv run scripts/import_pua_zhonghua.py
import hashlib, json, os
import openpyxl

ROOT = os.path.join(os.path.dirname(__file__), '..')
ZI = {
    'url': 'https://zi.tools/api/ma/ma/gzhs.json',
    'path': os.path.join(ROOT, 'cache', 'zi.tools_api_ma_ma_gzhs.json'),
}
WORKBOOK = {
    'file': '中华书局15平面失收IDS.xlsx',
    'sha256': '7a7502e3caee4cac78ecbeb46a8aa017945a46a9359289131e9f2cfc8646a484',
}
IDC = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿㇯')


def digest(path):
    with open(path, 'rb') as file:
        return hashlib.sha256(file.read()).hexdigest()


# 字統's payload is the one the character-set catalogue pins.
pinned = {item['url']: item['sha256'] for item in json.load(open(os.path.join(ROOT, 'app', 'public', 'charsets', 'sources.json')))['inputs']}
if digest(ZI['path']) != pinned[ZI['url']]:
    raise SystemExit('the 字統 gzhs payload differs from the pinned catalogue')
workbook_path = os.path.join(ROOT, 'cache', 'zhonghua', WORKBOOK['file'])
if digest(workbook_path) != WORKBOOK['sha256']:
    raise SystemExit(f'Workbook changed: {workbook_path}')


def is_ids(text):
    return any(char in IDC for char in text) or text.startswith('#(')


mappings, ids = {}, {}
for point, value, _ in json.load(open(ZI['path']))['rows']:
    slot = chr(int(point, 16))
    if not 0xF0000 <= ord(slot) <= 0xFFFFD:
        raise SystemExit(f'{point} is outside plane 15')
    if len(value) == 1 and not is_ids(value):
        mappings[slot] = value
    else:
        ids[slot] = value

rows = list(openpyxl.load_workbook(workbook_path, read_only=True).worksheets[0].iter_rows(values_only=True))[1:]
added = 0
for glyph, point, description, note in rows:
    slot = chr(int(point, 16))
    if glyph != slot:
        raise SystemExit(f'{point}: the glyph column does not match the code')
    # Two rows repeat slots 字統 already describes; 字統's description stands.
    if slot in mappings or slot in ids:
        continue
    text = (description or '').strip()
    note = (note or '').strip()
    # The note column records an agreed identification (认同X) or a revised IDS (处理后：…); a
    # consideration (考虑：…) leaves the IDS as it is.
    if note.startswith('认同'):
        text = note[2:]
    elif note.startswith('处理后：'):
        text = note[4:]
    # A single character identifies the slot; an empty cell, or a symbol, still claims it.
    if len(text) == 1 and not is_ids(text) and ord(text) > 0x2E7F:
        mappings[slot] = text
    else:
        ids[slot] = text if is_ids(text) else ''
    added += 1


def ordered(record):
    return dict(sorted(record.items(), key=lambda item: ord(item[0])))


source = {
    'name': '中华书局宋 plane 15 private-use slots (字統網 gzhs, with a list of slots it lacks)',
    'url': 'https://zi.tools/?secondary=character_set&set=G%E4%B8%AD%E5%8D%8E%E4%B9%A6%E5%B1%80%E5%AE%8B',
    'dataUrl': ZI['url'],
    'retrieved': '2026-11-07',
    'sha256': pinned[ZI['url']],
    'licence': 'No reuse terms stated at the 字統 endpoint; the slot list is a privately supplied workbook with no licence stated.',
}
with open(os.path.join(ROOT, 'data', 'zhonghua-pua.json'), 'w', encoding='utf-8') as file:
    json.dump({'source': source, 'mappings': ordered(mappings)}, file, ensure_ascii=False, indent=2)
    file.write('\n')
with open(os.path.join(ROOT, 'data', 'zhonghua-pua-codes.json'), 'w', encoding='utf-8') as file:
    json.dump({'ids': ordered(ids), 'workbook': {'file': WORKBOOK['file'], 'sha256': WORKBOOK['sha256']}}, file, ensure_ascii=False, separators=(',', ':'))
    file.write('\n')
print(f'{len(mappings) + len(ids)} slots: {len(mappings)} with a Unicode character, {sum(1 for v in ids.values() if v)} with an IDS, '
      f'{sum(1 for v in ids.values() if not v)} undescribed; {added} from the workbook')
