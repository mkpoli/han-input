# Renders the ebag glyphs from the pinned GlyphWiki dump into SVG sprite sheets. The KAGE engine is
# GPL-3.0 and is installed separately from https://github.com/HowardZorn/kage-engine, with numpy and
# svgwrite; this script only writes GlyphWiki's free glyph data.
#   python scripts/build_ebag_sprites.py cache/glyphwiki-dump.tar.gz app/public/charsets/ebag-sprites
import argparse, os, re, sys, tarfile

try:
    from kage import Kage
    from kage.font.sans import Sans
except ImportError:
    sys.exit('The KAGE engine is not installed. See https://github.com/HowardZorn/kage-engine')

parser = argparse.ArgumentParser()
parser.add_argument('dump', nargs='?', default='cache/glyphwiki-dump.tar.gz')
parser.add_argument('out', nargs='?', default='app/public/charsets/ebag-sprites')
parser.add_argument('--per-sheet', type=int, default=1000)
args = parser.parse_args()

ebag = {}
components = {}
with tarfile.open(args.dump) as tar:
    for raw in tar.extractfile('dump_newest_only.txt'):
        line = raw.decode('utf-8', 'replace').rstrip('\n')
        parts = line.split('|')
        if len(parts) < 3:
            continue
        name, data = parts[0].strip(), parts[2].strip()
        if name and data:
            components[name] = data
            if name.startswith('ebag_'):
                ebag[name] = data

engine = Kage(ignore_component_version=True)
engine.font = Sans()
for name, data in components.items():
    engine.components.push(name, data)

os.makedirs(args.out, exist_ok=True)
symbol = re.compile(r'<svg[^>]*>(.*)</svg>', re.S)
names = sorted(ebag)
skipped = []
for sheet, start in enumerate(range(0, len(names), args.per_sheet), 1):
    body = []
    for name in names[start:start + args.per_sheet]:
        try:
            inner = symbol.search(engine.make_glyph(name).tostring()).group(1)
            inner = inner.replace('<defs />', '').replace('<defs/>', '').strip()
            body.append(f'<symbol id="{name}" viewBox="0 0 200 200">{inner}</symbol>')
        except Exception as error:
            skipped.append((name, type(error).__name__))
    with open(os.path.join(args.out, f'{sheet:04d}.svg'), 'w', encoding='utf-8') as out:
        out.write('<svg xmlns="http://www.w3.org/2000/svg"><defs>' + ''.join(body) + '</defs></svg>')
print(f'{len(names) - len(skipped)} glyphs in {(len(names) + args.per_sheet - 1) // args.per_sheet} sheets; skipped {skipped}')
