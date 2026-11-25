# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools", "brotli"]
# ///
"""Slices Jigmo 2025-09-12 (CC0) into web fonts, so a reader fetches only the slice a character needs,
and adds Noto faces (OFL-1.1) for Nüshu and hentaigana, Sealie 1.3.1 (OFL-1.1) and LXGW Seal
v0.001-alpha.10.8 (OFL-1.1) for Small Seal, and the CNS private-use glyphs (OGDL 1.0) that keep an
unencoded source row visible.

Planes 2 and 3 go into 4096-code-point slices under one family, 'Han Ext'; Small Seal goes into 256-code-point
slices, since its outlines are heavier, and LXGW Seal's Small Seal subset goes into one file under its own
family, 'LXGW Seal'. The rest of Han stays in one file, used only where a system has no face for it. The CNS
plane-15 private-use glyphs go into 4096-code-point slices under 'CNS PUA'. Writes app/public/fonts,
app/fonts.css and app/lib/lxgw-seal.js.
Run after unzipping Jigmo-20250912.zip into cache/jigmo, fetching the two Noto TTFs into cache/noto,
downloading Sealie-Regular.ttf from the v1.3.1-c8d4a98 snapshot into cache/sealie, downloading
LXGWSeal-Regular.ttf from v0.001-alpha.10.8 into cache/lxgw-seal, and downloading Fonts_Sung.zip
into cache/Fonts_Sung.zip.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument("--only", choices=("lxgw-seal",), help="Only rebuild one face while regenerating CSS and metadata.")
args = parser.parse_args()
rebuild_all = args.only is None

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app/public/fonts"
OUT.mkdir(parents=True, exist_ok=True)
if rebuild_all:
    for old in OUT.glob("*.woff2"):
        if old.name in {"IDSNumbered.woff2", "cns-composed.woff2", "cdp-composition.woff2"}:
            continue
        old.unlink()


def unicode_range(codes: list[int]) -> str:
    """Compact CSS unicode-range expression for sorted code points."""
    ranges = []
    start = prev = codes[0]
    for code in codes[1:]:
        if code == prev + 1:
            prev = code
            continue
        ranges.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        start = prev = code
    ranges.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
    return ", ".join(ranges)


def cut(source: Path, codes: list[int], name: str, *, keep_names: bool = False) -> None:
    options = subset.Options(
        flavor="woff2",
        layout_features=["*"],
        notdef_outline=True,
        name_IDs=["*"] if keep_names else subset.Options().name_IDs,
    )
    font = TTFont(source)
    tool = subset.Subsetter(options)
    tool.populate(unicodes=codes)
    tool.subset(font)
    font.flavor = "woff2"
    font.save(OUT / name)


faces = []
for file in ("Jigmo2.ttf", "Jigmo3.ttf"):
    source = ROOT / "cache/jigmo" / file
    cmap = TTFont(source, lazy=True).getBestCmap()
    plane = sorted(code for code in cmap if 0x20000 <= code < 0x40000)
    for block in sorted({code >> 12 for code in plane}):
        codes = [code for code in plane if code >> 12 == block]
        name = f"jigmo-{block:x}.woff2"
        if rebuild_all:
            cut(source, codes, name)
            print(name, len(codes), (OUT / name).stat().st_size)
        faces.append((name, f"U+{block:x}000-{block:x}FFF"))

if rebuild_all:
    source = ROOT / "cache/jigmo/Jigmo.ttf"
    cmap = TTFont(source, lazy=True).getBestCmap()
    cut(source, [code for code in cmap if 0x2E80 <= code < 0x10000], "jigmo-bmp.woff2")

for family_file, name, codes in (("NotoSansNushu", "noto-nushu.woff2", "U+16FE1, U+1B170-1B2FF"), ("NotoSerifHentaigana", "noto-hentaigana.woff2", "U+1B000-1B16F")):
    if rebuild_all:
        font = TTFont(ROOT / "cache/noto" / f"{family_file}.ttf")
        font.flavor = "woff2"
        font.save(OUT / name)
    faces.append((name, codes))

# Sealie at commit c8d4a98 of iebb/sealie, 38 minutes after release 1.3.1: upstream's own workflow build of that
# commit (run 44912812191), which differs from 1.3.1 in U+3EA9E alone, the left 匕 of 比 drawn with both strokes.
# No release holds it yet, so the file is kept at https://github.com/mkpoli/sealie/releases/tag/v1.3.1-c8d4a98.
# Return to iebb/sealie's releases with the first after 1.3.1.
SEALIE_SHA256 = "b69dc90a5cde9a063b94b69a199b4f15ed9781d394947af0a057f6ef65770714"
sealie = ROOT / "cache/sealie/Sealie-Regular.ttf"
if not sealie.exists():
    raise SystemExit("Missing cache/sealie/Sealie-Regular.ttf from https://github.com/mkpoli/sealie/releases/tag/v1.3.1-c8d4a98")
if hashlib.sha256(sealie.read_bytes()).hexdigest() != SEALIE_SHA256:
    raise SystemExit("cache/sealie/Sealie-Regular.ttf is not the pinned v1.3.1-c8d4a98 file")
cmap = TTFont(sealie, lazy=True).getBestCmap()
seal = sorted(code for code in cmap if 0x3D000 <= code <= 0x3FC3F)
for block in sorted({code >> 8 for code in seal}):
    codes = [code for code in seal if code >> 8 == block]
    name = f"sealie-{block:x}.woff2"
    if rebuild_all:
        cut(sealie, codes, name)
        print(name, len(codes), (OUT / name).stat().st_size)
    faces.append((name, f"U+{block:X}00-{block:X}FF"))

# https://github.com/lxgw/LxgwSeal/releases/tag/v0.001-alpha.10.8 (OFL-1.1).
LXGW_SEAL_SHA256 = "06100c9d0afd79612dc0cf7ef8ddef997cce4ec22bf7d93f7cf238ca08bac29e"
lxgw_seal = ROOT / "cache/lxgw-seal/LXGWSeal-Regular.ttf"
if not lxgw_seal.exists():
    raise SystemExit("Missing cache/lxgw-seal/LXGWSeal-Regular.ttf from https://github.com/lxgw/LxgwSeal/releases/tag/v0.001-alpha.10.8")
if hashlib.sha256(lxgw_seal.read_bytes()).hexdigest() != LXGW_SEAL_SHA256:
    raise SystemExit("cache/lxgw-seal/LXGWSeal-Regular.ttf is not the pinned v0.001-alpha.10.8 file")
cmap = TTFont(lxgw_seal, lazy=True).getBestCmap()
lxgw_codes = sorted(code for code in cmap if 0x3D000 <= code <= 0x3FC3F)
if not lxgw_codes:
    raise SystemExit("No Small Seal code points found in LXGWSeal-Regular.ttf")
cut(lxgw_seal, lxgw_codes, "lxgw-seal.woff2", keep_names=True)
lxgw_range = unicode_range(lxgw_codes)
print("lxgw-seal.woff2", len(lxgw_codes), (OUT / "lxgw-seal.woff2").stat().st_size)

cns_zip = ROOT / "cache/Fonts_Sung.zip"
if not cns_zip.exists():
    raise SystemExit("Missing cache/Fonts_Sung.zip from https://www.cns11643.gov.tw/opendata/Fonts_Sung.zip")
cns_source = ROOT / "cache/cns/TW-Sung-Plus-98_1.ttf"
if not cns_source.exists():
    cns_source.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(cns_zip) as archive:
        cns_source.write_bytes(archive.read("TW-Sung-Plus-98_1.ttf"))
cns_faces = []
cmap = TTFont(cns_source, lazy=True).getBestCmap()
pua = sorted(code for code in cmap if 0xF0000 <= code <= 0xFFFFD)
for block in sorted({code >> 12 for code in pua}):
    codes = [code for code in pua if code >> 12 == block]
    name = f"cns-pua-{block:x}.woff2"
    if rebuild_all:
        cut(cns_source, codes, name)
        print(name, len(codes), (OUT / name).stat().st_size)
    cns_faces.append((name, f"U+{block:X}000-{block:X}FFF"))

lines = [
    "/* Generated by scripts/build_fonts.py. Jigmo (CC0) draws what a system lacks. 'Han Ext' claims only",
    "   planes 1 to 3 and stands first in every stack: some system faces map those code points to an empty",
    "   box, which would hide this face. Each slice is fetched when a character from it is on screen.",
    "   Small Seal comes from Sealie 1.3.1 (OFL 1.1); 'LXGW Seal' adds LXGW Seal v0.001-alpha.10.8 (OFL 1.1)",
    "   for the Small Seal characters it covers.",
    "   'CNS PUA' carries the unencoded CNS source rows, from TW-Sung-Plus (數位發展部, OGDL 1.0).",
    "   'CNS Composed' draws the rows han-compose can build from an IDS, in GenZui Sans. */",
    "@font-face { font-family: 'CNS Composed'; src: url('/fonts/cns-composed.woff2') format('woff2'); font-display: swap; unicode-range: U+324D6, U+FFB0E-FFB0F; }",
    "@font-face { font-family: 'Jigmo'; src: url('/fonts/jigmo-bmp.woff2') format('woff2'); font-display: swap; unicode-range: U+2E80-FFFF; }",
    f"@font-face {{ font-family: 'LXGW Seal'; src: url('/fonts/lxgw-seal.woff2') format('woff2'); font-display: swap; unicode-range: {lxgw_range}; }}",
]
for name, codes in faces:
    # Sealie's monoline forms fill three quarters of the em, so they are scaled to stand beside Han.
    size = " size-adjust: 125%;" if name.startswith("sealie-") else ""
    lines.append(f"@font-face {{ font-family: 'Han Ext'; src: url('/fonts/{name}') format('woff2'); font-display: swap; unicode-range: {codes};{size} }}")
for name, codes in cns_faces:
    lines.append(f"@font-face {{ font-family: 'CNS PUA'; src: url('/fonts/{name}') format('woff2'); font-display: swap; unicode-range: {codes}; }}")
(ROOT / "app/fonts.css").write_text("\n".join(lines) + "\n", encoding="utf-8")

lxgw_chars = "".join(chr(code) for code in lxgw_codes)
(ROOT / "app/lib/lxgw-seal.js").write_text(
    "// Generated by scripts/build_fonts.py from LXGWSeal-Regular.ttf (v0.001-alpha.10.8, OFL-1.1).\n"
    "// The Small Seal characters LXGW Seal covers; the card renders a second specimen only for these.\n"
    f"const COVERED = new Set([...{json.dumps(lxgw_chars, ensure_ascii=False)}])\n\n"
    "/** Whether LXGW Seal has a glyph for this Small Seal character. @param {string} char */\n"
    "export const hasLxgwSeal = char => COVERED.has(char)\n\n"
    "/** All Small Seal characters covered by LXGW Seal, in code-point order. */\n"
    "export const LXGW_SEAL_CHARS = [...COVERED]\n",
    encoding="utf-8",
)
