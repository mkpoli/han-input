# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools", "brotli"]
# ///
"""Draws the webfont for the thirteen composition symbols of the 漢字構形資料庫.

The symbols are the Big5 user-area characters 8DF1–8DFD, which the database maps to U+F6A3–U+F6AF.
Their arrangement and meaning follow table 1 of 莊德明, 〈構字式的處理技巧〉 (2007). The drawings
here are original: two stacked triangles for above-to-below, and so on. They are close to the table,
not a copy of its EUDC font, so the webfont carries this project's MIT licence.

Writes app/public/fonts/cdp-composition.woff2.
"""
from math import cos, sin, pi
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app/public/fonts/cdp-composition.woff2"
FIRST = 0xF6A3


def draw(pen, contours):
    for points in contours:
        pen.moveTo(points[0])
        for point in points[1:]:
            pen.lineTo(point)
        pen.closePath()


def circle(cx, cy, r, n=32, reverse=False):
    points = [(cx + r * cos(2 * pi * i / n), cy + r * sin(2 * pi * i / n)) for i in range(n)]
    return list(reversed(points)) if reverse else points


def ring(cx, cy, r, width):
    return [circle(cx, cy, r), circle(cx, cy, r - width, reverse=True)]


def triangle_ring(apex, left, right, scale=0.68):
    outer = [apex, right, left]
    cx = sum(p[0] for p in outer) / 3
    cy = sum(p[1] for p in outer) / 3
    inner = [(cx + (x - cx) * scale, cy + (y - cy) * scale) for x, y in outer]
    return [outer, list(reversed(inner))]


def rect(x1, y1, x2, y2):
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]


def stroke(x1, y1, x2, y2, width):
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    nx, ny = -dy / length * width / 2, dx / length * width / 2
    return [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]


def frame():
    return [rect(60, 80, 940, 800), list(reversed(rect(130, 150, 870, 730))), rect(30, 380, 60, 500), rect(940, 380, 970, 500)]


def xing():
    return [
        stroke(260, 620, 450, 620, 45),
        stroke(260, 490, 450, 490, 45),
        stroke(310, 680, 310, 300, 45),
        stroke(400, 680, 400, 300, 45),
        stroke(530, 650, 660, 520, 45),
        stroke(530, 540, 690, 400, 45),
        stroke(530, 430, 670, 290, 45),
    ]


shapes = {
    "uniF6A3": triangle_ring((500, 860), (100, 420), (900, 420)) + triangle_ring((500, 500), (100, 40), (900, 40)),
    "uniF6A4": triangle_ring((250, 860), (0, 100), (500, 100)) + triangle_ring((750, 860), (500, 100), (1000, 100)),
    "uniF6A5": triangle_ring((500, 860), (60, 100), (940, 100), 0.58) + triangle_ring((500, 620), (250, 280), (750, 280), 0.55),
    "uniF6A6": ring(500, 660, 120, 60) + ring(500, 320, 120, 60),
    "uniF6A7": ring(340, 480, 120, 60) + ring(660, 480, 120, 60),
    "uniF6A8": ring(500, 700, 105, 55) + ring(330, 360, 105, 55) + ring(670, 360, 105, 55),
    "uniF6A9": ring(500, 740, 95, 50) + ring(500, 450, 95, 50) + ring(500, 160, 95, 50),
    "uniF6AA": ring(230, 450, 95, 50) + ring(500, 450, 95, 50) + ring(770, 450, 95, 50),
    "uniF6AB": ring(350, 620, 95, 50) + ring(650, 620, 95, 50) + ring(350, 300, 95, 50) + ring(650, 300, 95, 50),
    "uniF6AC": ring(500, 770, 80, 45) + ring(500, 550, 80, 45) + ring(500, 330, 80, 45) + ring(500, 110, 80, 45),
    "uniF6AD": ring(190, 450, 80, 45) + ring(400, 450, 80, 45) + ring(610, 450, 80, 45) + ring(820, 450, 80, 45),
    "uniF6AE": frame() + xing(),
    "uniF6AF": frame() + [circle(500, 440, 85, 32)],
}
order = [".notdef", *shapes]
builder = FontBuilder(1000, isTTF=True)
builder.setupGlyphOrder(order)
builder.setupCharacterMap({FIRST + index: name for index, name in enumerate(shapes)})
glyphs = {".notdef": TTGlyphPen(None).glyph()}
for name, contours in shapes.items():
    pen = TTGlyphPen(None)
    draw(pen, contours)
    glyphs[name] = pen.glyph()
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics({name: (1000, 0) for name in order})
builder.setupHorizontalHeader(ascent=900, descent=-120)
builder.setupNameTable({
    "familyName": "CDP Composition",
    "styleName": "Regular",
    "uniqueFontIdentifier": "cdp-composition-2026",
    "fullName": "CDP Composition",
    "psName": "cdp-composition",
    "version": "Version 1.0",
    "copyright": "Drawings by the han-input project, after 莊德明, 〈構字式的處理技巧〉 (2007).",
})
builder.setupOS2(sTypoAscender=900, sTypoDescender=-120, usWinAscent=900, usWinDescent=120, achVendID="NONE", fsType=0)
builder.setupPost()
builder.font.flavor = "woff2"
builder.save(OUT)
print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size} bytes")
