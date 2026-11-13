# Reads the cmap of the 方正超大字符集 font copies and writes the BMP private-use table. The fonts
# are fetched from a pinned commit of an unofficial mirror into cache/fz-fonts/ and never enter the
# repository; this script only keeps the slot numbers, face coverage and each file's digest.
#   uv run --with fonttools python scripts/build_fz_pua.py
import argparse, hashlib, json, os, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPOSITORY = 'https://github.com/xiangrongjingujiu/FangZhengChaoDaZiFuJi'
COMMIT = '1ecfaafaa9a8f9661e878fd507094e83a33226b3'
COMMITTED = '2021-05-30'
FONTS = [
    '方正楷体超大字符集/FZKTK.TTF',
    '方正楷体超大字符集/FZKTJW.TTF',
    '方正楷体超大字符集/FZJCGFKTK.TTF',
    '方正宋体超大字符集/FZSongS.TTF',
    '方正楷体超大字符集/FZKaiS-Extended-1.ttf',
    '方正宋体超大字符集/FZSongS-SIP.TTF',
]

parser = argparse.ArgumentParser()
parser.add_argument('--out', default=os.path.join(ROOT, 'app/public/charsets'))
parser.add_argument('--retrieved', default=date.today().isoformat())
args = parser.parse_args()

cache = os.path.join(ROOT, 'cache', 'fz-fonts')
os.makedirs(cache, exist_ok=True)
slots = defaultdict(set)
lock = {}
for path in FONTS:
    url = f'https://raw.githubusercontent.com/xiangrongjingujiu/FangZhengChaoDaZiFuJi/{COMMIT}/{urllib.parse.quote(path)}'
    local = os.path.join(cache, os.path.basename(path))
    if not os.path.exists(local):
        urllib.request.urlretrieve(url, local)
    font = TTFont(local)
    best = max((table for table in font['cmap'].tables if table.format in (4, 12)), key=lambda table: len(table.cmap))
    pua = {cp for cp in best.cmap if 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp <= 0xFFFFD or 0x100000 <= cp <= 0x10FFFD}
    name = os.path.splitext(os.path.basename(path))[0]
    for cp in pua:
        slots[cp].add(name)
    names = lambda id: sorted({record.toUnicode() for record in font['name'].names if record.nameID == id})
    family, version, copyright = names(1), names(5), names(0)
    lock[name] = {
        'url': url,
        'repository': REPOSITORY,
        'committed': COMMITTED,
        'retrieved': args.retrieved,
        'sha256': hashlib.sha256(open(local, 'rb').read()).hexdigest(),
        'family': family[0] if family else name,
        'version': version[0] if version else '',
        'copyright': copyright[0] if copyright else '',
        'pua': len(pua),
    }

records = [{
    'document': 'fz',
    'source': f'U+{cp:04X}',
    'status': ', '.join(sorted(slots[cp])),
} for cp in sorted(slots)]
open(os.path.join(args.out, 'fz_pua_records.json'), 'w', encoding='utf-8').write(json.dumps({
    'id': 'fz_pua',
    'group': 'PUA',
    'label': 'FZ PUA',
    'names': {'en': 'FZ oversized PUA', 'zh': '方正超大字符集私用區', 'hans': '方正超大字符集私用区', 'ja': '方正超大字符集私用領域', 'ko': 'FZ 초대형 문자 집합 PUA'},
    'source': {'name': '方正超大字符集', 'url': REPOSITORY, 'licence': 'Commercial; cmap facts only'},
    'recordsNote': False,
    'title': '方正超大字符集私用區',
    'complete': True,
    'scope': 'BMP private-use slots in the cmap of the 方正超大字符集 fonts; the font files and glyph outlines are not included.',
    'documents': [{
        'id': 'fz',
        'document': '方正超大字符集',
        'title': '方正超大字符集字體',
        'source': 'Founder',
        'date': '2006',
        'url': REPOSITORY,
    }],
    'records': records,
}, ensure_ascii=False, separators=(',', ':')) + '\n')
open(os.path.join(args.out, 'fz_pua_source.json'), 'w', encoding='utf-8').write(json.dumps(lock, ensure_ascii=False, indent=2) + '\n')
print(f'{len(records)} private-use slots from {len(lock)} fonts')
