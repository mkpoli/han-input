"""Subset Noto Serif Tangut 2.170 to the code points the siniform code charts list.

The subset keeps every Tangut character and component the page can show; the 32 characters and
115 components Noto does not draw are left out and stay code-only cells in the page. Run with:

    uv run --with fonttools --with brotli python scripts/build_siniform_font.py
"""
from __future__ import annotations

import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app/public/data/siniform.json"
OUT = ROOT / "app/public/fonts/noto-serif-tangut.woff2"
LICENCE = ROOT / "app/public/fonts/OFL-NotoSerifTangut.txt"
URL = "https://github.com/notofonts/tangut/releases/download/NotoSerifTangut-v2.170/NotoSerifTangut-v2.170.zip"
SHA256 = "741ef7bca66790c51c5f2efea3c291f5a82cc2e3992d9413a020aec26dbd75b1"


def archive() -> zipfile.ZipFile:
    cache = ROOT / "cache/siniform/NotoSerifTangut-v2.170.zip"
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        with urllib.request.urlopen(URL, timeout=120) as response:
            cache.write_bytes(response.read())
    payload = cache.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != SHA256:
        raise SystemExit(f"{URL}: pinned {SHA256}, fetched {digest}")
    return zipfile.ZipFile(io.BytesIO(payload))


def main() -> None:
    data = json.loads(DATA.read_text())
    text = set()
    for script in data["scripts"]:
        text.add(script["sample"])
        text.update(chr(cp) for cp in script["chars"]["cps"])
        if script["parts"]:
            text.update(chr(cp) for cp in script["parts"]["cps"])
    text = "".join(sorted(text, key=ord))

    package = archive()
    source = package.read("NotoSerifTangut/unhinted/ttf/NotoSerifTangut-Regular.ttf")
    LICENCE.write_bytes(package.read("OFL.txt"))

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.desubroutinize = True
    font = subset.load_font(io.BytesIO(source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(OUT), options)
    print(f"{OUT}: {OUT.stat().st_size:,} bytes, {len(text):,} code points")


if __name__ == "__main__":
    main()
