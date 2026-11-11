# Reads the cmap of the 方正超大字符集 font copies and writes the BMP private-use table. The fonts
# stay outside the repository; this script only keeps the slot numbers and face coverage.
#   uv run --with fonttools python scripts/build_fz_pua.py --mirror <url> FZKTK.TTF FZKTJW.TTF FZJCGFKTK.TTF FZSongS.TTF
import argparse, hashlib, json, os
from datetime import date
from collections import defaultdict

from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument('fonts', nargs='+')
parser.add_argument('--mirror', required=True)
parser.add_argument('--out', default='app/public/charsets')
parser.add_argument('--retrieved', default=date.today().isoformat())
args = parser.parse_args()

slots = defaultdict(set)
meta = []
for path in args.fonts:
    font = TTFont(path)
    best = max((table for table in font['cmap'].tables if table.format in (4, 12)), key=lambda table: len(table.cmap))
    pua = {cp for cp in best.cmap if 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp <= 0xFFFFD or 0x100000 <= cp <= 0x10FFFD}
    name = os.path.splitext(os.path.basename(path))[0]
    for cp in pua:
        slots[cp].add(name)
    family = sorted({record.toUnicode() for record in font['name'].names if record.nameID == 1})
    version = sorted({record.toUnicode() for record in font['name'].names if record.nameID == 5})
    copyright = sorted({record.toUnicode() for record in font['name'].names if record.nameID == 0})
    meta.append({
        'name': name,
        'file': os.path.basename(path),
        'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest(),
        'family': family[0] if family else name,
        'version': version[0] if version else '',
        'copyright': copyright[0] if copyright else '',
        'pua': len(pua),
    })

records = [{
    'document': 'fz',
    'source': f'U+{cp:04X}',
    'status': ', '.join(sorted(slots[cp])),
} for cp in sorted(slots)]
os.makedirs(args.out, exist_ok=True)
open(os.path.join(args.out, 'fz_pua.txt'), 'w').write('')
open(os.path.join(args.out, 'fz_pua_records.json'), 'w', encoding='utf-8').write(json.dumps({
    'id': 'fz_pua',
    'title': '方正超大字符集私用區',
    'complete': True,
    'scope': 'BMP private-use slots in the cmap of the 方正超大字符集 fonts; the font files and glyph outlines are not included.',
    'documents': [{
        'id': 'fz',
        'document': '方正超大字符集',
        'title': '方正超大字符集字體',
        'source': 'Founder',
        'date': '2006',
        'url': args.mirror,
    }],
    'records': records,
}, ensure_ascii=False, separators=(',', ':')) + '\n')
open(os.path.join(args.out, 'fz_pua_source.json'), 'w', encoding='utf-8').write(json.dumps({
    'fonts': meta,
    'mirror': args.mirror,
    'retrieved': args.retrieved,
    'note': 'Unofficial copies. Only cmap facts are kept; the font files and glyph outlines are not redistributed.',
}, ensure_ascii=False, indent=2) + '\n')
print(f'{len(records)} private-use slots from {len(meta)} fonts')
