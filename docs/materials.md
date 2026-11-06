# Materials

What this site is built from and where its limits are. Retrieved 2026-11-05 unless noted. Every table's
own source and terms are also in the site, on its Sources page and on each method's page.

## Scope

The site finds characters of sinographic writing systems: Han, the extended sinographies that reuse and
extend it such as Chữ Nôm and Sawndip, and the kana and Nüshu derived from it. Siniform scripts (Tangut,
Khitan, Jurchen) stay out. The terms follow Zev Handel's "sinographic" and "siniform", Marc Miyake's
"extended sinography" (2017, *Encyclopedia of Chinese Language and Linguistics*) and 吉池孝一 (2006,
「中国周辺の漢字系文字」), who counts kana and Nüshu as 漢字系文字. They are taken from a summary in a private
Discord discussion of 2026-10-27, and the works themselves were not read.

## Characters, codes, readings

| Source | Gives | Terms |
| --- | --- | --- |
| [Unihan 18.0.0](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip), SHA-256 `4c93ea9c…d43e` | readings, shape codes, dictionary positions, encodings, the one-line gloss, ordering | Unicode License v3 |
| [漢字音典 MCPDict](https://github.com/osfans/MCPDict) release 20261104, APK SHA-256 `1b562a6e…ccb0`, with [音典](https://nk2028.shn.hk/yindian/) by nk2028 | 3,314 varieties' readings: historical, dialect, foreign, opera | Repository MIT. Its README asks to be told of copyright concerns and states no terms for the tables; each variety's own source is shown on its page |
| [TshetUinh.js](https://github.com/nk2028/tshet-uinh-js) 0.15.4 and [tshet-uinh-examples](https://github.com/nk2028/tshet-uinh-examples) 20260629.0.1 by nk2028, over [tshet-uinh-data](https://github.com/nk2028/tshet-uinh-data) | Guangyun positions and fanqie, and romanizations and reconstructions computed from them | MIT; data CC0-1.0 |
| [葦手入力](https://ashide.otodo.net/) version 5, 中山春明, 2021-12-10 | kana shape codes | None stated for version 5; the [2018 repository](https://github.com/haruakira/Ashide) is GPL-3.0 |
| [cin-tables](https://github.com/chinese-opendesktop/cin-tables) | 103 `.cin` tables | Per file; the header line is shown on each method's page. Repository CC0-1.0 |
| Rime tables named in `scripts/sources/index.mjs` | codes and spellings | Per repository |
| [UnicodeData.txt and NushuSources.txt](https://www.unicode.org/Public/18.0.0/ucd/), Unicode 18.0 | kana names, Nüshu readings and Nüshu Duben positions | Unicode License v3 |
| [hentaigana.el](https://github.com/kawabata/hentaigana) 1.170817, 川幡太一 | the Han character each kana form was written from, and hentaigana by modern kana | GPL-3.0-or-later |
| [rime-hentaigana](https://github.com/yuanhao-chen-nyoeghau/rime-hentaigana) | kana by spelling, with Taiwanese and Ainu kana | Apache-2.0 |
| [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT), Andrew West | which parts each character is written with | As stated in the file |
| [Noto Sans Nushu and Noto Serif Hentaigana](https://github.com/notofonts) | glyphs for Nüshu and hentaigana | OFL-1.1 |
| [Jigmo](https://kamichikoichi.github.io/jigmo/) 2025-09-12, 上地宏一 | glyphs for the extension blocks, cut by `scripts/build_fonts.py` | CC0-1.0 |

The research behind these choices, with every candidate and what was checked, is in
[`research-input-methods.md`](research-input-methods.md) and
[`research-extended-sinography.md`](research-extended-sinography.md). Those tables record uncertainty row
by row and were compiled by a delegated research pass, so a row marked uncertain has not been reconfirmed.

## Search by meaning

Dictionaries serve only as an index here: a word to the characters it describes. Sources: Unihan's
`kDefinition`, and Wiktionary's English, Chinese and Japanese editions (dumps of 2026-11-01, and the
wiktextract extract), CC BY-SA 4.0 and GFDL. The search matches words of the gloss; it does not compute
semantic similarity, so a synonym the gloss does not use will not be found.

## Linked, not copied

字統網 zi.tools, 漢典 zdic, 葉典 yedict, 韻典網 ytenx, 古音小鏡 kaom, Web韻圖 (鈴木慎吾), Glyph Atlas, IDS
Workshop, GlyphWiki, CHISE. Ytenx's `DATA_LICENSE.md` grants nothing for its data, and no bulk data was
found for kaom, so both stay links. Web韻圖 and kaom have no address for a single character, and those
links open the site's search page.

## Known gaps

- No drawing pad yet.
- The readings of a variety lose their notes (文白 and usage) in this index; 音典 keeps them.
- Tables with no stated terms are published with that fact shown. Those, and the non-commercial ones
  (表形碼, 導碼, E碼, 華象, the 通用 Hakka tables), are a question to settle before any public deployment.
