# /// script
# requires-python = ">=3.11"
# dependencies = ["brotli", "fonttools"]
# ///
"""Write the code points the bundled faces draw, as ranges, for the coverage page.

Every woff2 in app/public/fonts is read from its cmap. The result is a committed snapshot because
the faces themselves are committed; run this again after `scripts/build_fonts.py`.

    uv run scripts/build_font_coverage.py
"""
from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "app/public/fonts"
OUT = ROOT / "data/font-coverage.json"

covered: set[int] = set()
faces = []
for path in sorted(FONTS.glob("*.woff2")):
    cmap = TTFont(path, lazy=True).getBestCmap()
    covered.update(cmap)
    faces.append({"file": path.name, "glyphs": len(cmap)})

ranges: list[list[int]] = []
for code in sorted(covered):
    if ranges and code == ranges[-1][1] + 1:
        ranges[-1][1] = code
    else:
        ranges.append([code, code])

OUT.write_text(json.dumps({
    "source": "app/public/fonts/*.woff2",
    "faces": faces,
    "points": len(covered),
    "ranges": ranges,
}, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"{len(faces)} faces, {len(covered)} code points, {len(ranges)} ranges -> {OUT.relative_to(ROOT)}")
