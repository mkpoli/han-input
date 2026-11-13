# Materials

What this site is built from and where its limits are. Retrieved 2026-11-05 unless noted. Every table's
own source and terms are also in the site, on its Sources page and on each method's page.

## Scope

The site finds characters of sinographic writing systems: Han and its Small Seal forms, the extended
sinographies that reuse and extend it such as Chữ Nôm and Sawndip, and the kana and Nüshu derived from it. Siniform scripts (Tangut,
Khitan, Jurchen) stay out. A standard's table can be browsed in full where it lists characters outside
this scope, as GB/T 12052 does for Hangul and symbols; a search still covers only the scripts above.
The terms follow Zev Handel's "sinographic" and "siniform", Marc Miyake's
"extended sinography" (2017, *Encyclopedia of Chinese Language and Linguistics*) and 吉池孝一 (2006,
「中国周辺の漢字系文字」), who counts kana and Nüshu as 漢字系文字. They are taken from a summary in a private
Discord discussion of 2026-10-27, and the works themselves were not read.

## Characters, codes, readings

| Source | Gives | Terms |
| --- | --- | --- |
| [Unihan 18.0.0](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip), SHA-256 `4c93ea9c…d43e` | readings, shape codes, dictionary positions, encodings, variant relations, the one-line gloss, ordering | Unicode License v3 |
| [漢字音典 MCPDict](https://github.com/osfans/MCPDict) release 20261104, APK SHA-256 `1b562a6e…ccb0`, with [音典](https://nk2028.shn.hk/yindian/) by nk2028 | 3,314 varieties' readings: historical, dialect, foreign, opera | Repository MIT. Its README asks to be told of copyright concerns and states no terms for the tables; each variety's own source is shown on its page |
| [TshetUinh.js](https://github.com/nk2028/tshet-uinh-js) 0.15.4 and [tshet-uinh-examples](https://github.com/nk2028/tshet-uinh-examples) 20260629.0.1 by nk2028, over [tshet-uinh-data](https://github.com/nk2028/tshet-uinh-data) | Guangyun positions and fanqie, and romanizations and reconstructions computed from them | MIT; data CC0-1.0 |
| [葦手入力](https://ashide.otodo.net/) version 5, 中山春明, 2021-12-10 | kana shape codes | None stated for version 5; the [2018 repository](https://github.com/haruakira/Ashide) is GPL-3.0 |
| [cin-tables](https://github.com/chinese-opendesktop/cin-tables) | 106 `.cin` tables | Per file; the header line is shown on each method's page. Repository CC0-1.0 |
| [宇浩輸入法 Yuhao](https://github.com/forfudan/yuhao-ime-release) v3.13.0, 朱宇浩, retrieved 2026-11-08 | the five schemes’ full and short codes: 123,380 characters before scope filtering, 103,964 indexed | CC BY-NC-ND 4.0: non-commercial use, and modified works may not be distributed. Indexed for search, with the licence shown on each method’s page |
| Rime tables named in `scripts/sources/index.mjs` | codes and spellings | Per repository |
| [UnicodeData.txt and NushuSources.txt](https://www.unicode.org/Public/18.0.0/ucd/), Unicode 18.0 | kana names, Nüshu readings and Nüshu Duben positions | Unicode License v3 |
| [SealSources.txt](https://www.unicode.org/Public/18.0.0/ucd/SealSources.txt), Unicode 18.0, SHA-256 `05ba2c22…aa90` | each Small Seal form's modern character, Shuowen radical, and number in four Shuowen editions; simplified forms of the modern characters are converted by OpenCC | Unicode License v3 |
| Michel Suignard, [Considerations concerning the Small Seal encoding initiative](https://www.unicode.org/wg2/docs/n5294R3-ConsiderationsSmallSeal.pdf), WG2 N5294R3 (L2/25-049R), 2025-01-26 | the editions behind the source tags: Tenghuaxie (THX) and Chen Changzhi (CCZ) of Xu Xuan's text, Qi Junzao's 1839 carving of Xu Kai's (QJZ), and Duan Yucai's 經韻樓本 (DYC). The draft writes extra THX numbers as X- and KD-; the final file writes TH-X and TH-Y, and what those mark was not checked | Unicode document; cited, not reproduced |
| [hentaigana.el](https://github.com/kawabata/hentaigana) 1.170817, 川幡太一 | the Han character each hiragana and hentaigana form was written from, and hentaigana by modern kana | GPL-3.0-or-later |
| [rime-hentaigana](https://github.com/yuanhao-chen-nyoeghau/rime-hentaigana) | kana by spelling | Apache-2.0 |
| `unicode_nushu_data.csv` in [漢字音典 MCPDict](https://github.com/osfans/MCPDict), commit `cc3e293` | the Han characters each Nüshu character corresponds to, with traditional forms converted by OpenCC | MCPDict repository MIT; no separate terms stated for this table |
| [自造字轉換字碼工具](https://happyhakka.moe.edu.tw/crechar/index.html), Ministry of Education, Taiwan; [wordbooks.js](https://happyhakka.moe.edu.tw/crechar/wordbooks.js), retrieved 2026-11-07, SHA-256 `685336386d696c30114ab779ebafef2bbb56a098f22de60f1f6ef68475d16923` | 59 PUA-to-Unicode assignments for the early Windows Taiwanese/Hakka fonts | ©2024 Ministry of Education, R.O.C. All rights reserved; no separate data licence stated |
| [Unicode-今昔文字鏡番号対照表](https://www.seiwatei.net/info/chtucmj/), 青蛙亭漢語塾 | 今昔文字鏡 numbers for 28,934 BMP characters | Free download and use. The author states it is unofficial, made without permission from 文字鏡研究会, and covers the BMP only |
| [HKSCS-2008 mapping table](https://www.ccli.gov.hk/en/archive/mapping_table_2008.html), [file](https://www.ccli.gov.hk/doc/hkscs-2008-big5-iso.txt) | 2,353 PUA-to-Unicode assignments, from the ISO/IEC 10646-1:1993 PUA to the 2003 characters | CCLI Terms of Use; the code-point mapping is treated here as factual data |
| [hypua-unicoder](https://github.com/SaschaNaz/hypua-unicoder), Kagami Sascha Rosylight | 5,661 Hanyang PUA codes to Hangul jamo sequences | ISC. The table was obtained via hypua2jamo and the KTUG HanyangPuaTableProject; terms for the upstream table are not stated |
| [CNS11643全字庫](https://www.cns11643.gov.tw/), [MapingTables.zip](https://www.cns11643.gov.tw/opendata/MapingTables.zip) 20260805, `CNS2UNICODE_Unicode 15.txt`, crossed with Unihan `kIRG_TSource` | the CNS code of all 20,659 private-use slots, and the Unicode character of the 516 assigned since | Open Government Data License 1.0; Unicode License v3 for Unihan |
| [CBETA 缺字資料庫](https://github.com/cbeta-org/cbeta_gaiji), commit 857156a | the CB code of 31,935 slots at U+F0000 plus the code's number (31,664 database codes and 271 from the image archive), and the Unicode character of 16,607 | No licence stated in the repository |
| [L2/06-394](http://www.unicode.org/L2/L2006/06394-gb18030-2005.txt), Ken Lunde, Adobe Systems, 2006 | 24 PUA-to-Unicode assignments kept by GB 18030-2005 | Unicode UTC document; the code-point mapping is treated as factual data |
| [yi-bai/iwds](https://github.com/yi-bai/iwds), `iwds.xml`, fetched 2026-11-08, SHA-256 `886b426ea3d1d329749e02b32cccd5082d31d6cf1b996ea37bdae5ac593ca491` | which spellings of a part count as one, and the character pairs they disunify | No repository-wide licence was located |
| [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT), Andrew West | which parts each character is written with | As stated in the file |
| [CHISE IDS](https://www.chise.org/ids/), the eighteen `IDS-UCS-*.txt` files at `chise/ids` `main@2026-11-04` | further descriptions of the same, including characters BabelStone leaves out | GPL-2.0-or-later; the build copies the descriptions, so the generated site data carries that licence |
| [漢字構形資料庫](https://cdp.sinica.edu.tw/cdphanzi/), 莊德明, 〈[構字式的處理技巧](https://cdp.sinica.edu.tw/service/documents/T960419.pdf)〉, 中央研究院資訊科學研究所, 2007 | the thirteen composition symbols (Big5 8DF1–8DFD, Unicode U+F6A3–U+F6AF) and their meanings; table 1 is the reference for the shapes redrawn into `cdp-composition.woff2` | No licence is stated for the handout. The font's drawings are this project's own, under the repository's MIT licence |
| [Korean History Database, 파자 검색 help](https://db.history.go.kr/resources/unicode/help/help07.jsp), 국사편찬위원회 | the 破字 signs `+` (left-right), `-` (delete), `/` (top-bottom), `*` (combine), grouping, and the database's `▼` variant mark | A public help page; no separate data licence is stated. The rules are implemented; no records are copied |
| [GB/T 12052-1989 信息交換用朝鮮文字編碼字符集](https://archive.org/details/GB-T12052-1989/page/n1/mode/2up), 国家技术监督局 (1989-12-29 批准, 1990-07-01 實施) | the layout §4.3–§5.2 and Appendix A: 5,979 graphic characters in a 94×94 table, 682 symbols and 5,297 Korean rows (3,424 first-level, 1,873 second-level including the 94 吏讀字 at 71-89–72-88). The standard prints 5,300 Korean characters and a second level of 1,876, three more than the table holds; 5,297 reconciles with the stated total. The GK set lists every printed position: 5,954 distinct characters after 23 repeated glyphs, with the two 吏讀字 positions whose printed glyph has no scalar (72-33 and 72-67) kept as records. Read on the Internet Archive (OCR checked against page images); the standard itself is cited, not reproduced |
| [Jaemin Chung, GB 12052-89 to Unicode](https://github.com/harjitmoe/ecma35lib/blob/3ac8f4561c388b3744e0a2b221773eb602c09702/ecma35/data/multibyte/mbmaps/Other/gb12052-uni.txt), 2014-12-20, in [ecma35lib](https://github.com/harjitmoe/ecma35lib) | each of the 5,979 positions with its kuten code and Unicode scalar or two- to three-jamo sequence; the site's GK set follows it, keeps 23 repeated glyphs once, and leaves the two positions 字統 describes as IDS to its records. The transcription assigns 壭 (U+58ED) and 噕 (U+5655) to 72-33 and 72-67; 字統 reads the printed forms as ⿱土𰆊 and ⿱爲𰆊, so the site records the disagreement rather than choosing between them. Its agreement with the standard's layout, with GB 2312's three glyph choices (01-04, 01-10, 03-04) and with UTN #60 was checked before the data was read | No licence is stated for the repository; the code-point mapping is treated as factual data, and none of its comments or prose is copied |
| [UTN #60, Legacy Hangul Syllables Mappings](https://www.unicode.org/notes/tn60/), Ken Lunde and Jaemin Chung, 2026-07-02 | the GB/T 12052 column's 3,373 first-level Hangul assignments, every one equal to the transcription above; a check on the rows, not a source of them. The archaic second level maps to jamo sequences, which the note does not cover | Unicode Terms of Use |
| [CBETA, 一般組字式基本規則](https://cbetaonline.dila.edu.tw/doc/en/02-04_create_word.php) ([Chinese](https://archive.cbeta.org/data-format/rare-rule.htm)) | the general arithmetic signs `*` (left-right), `/` (top-bottom), `@` (contain), `-` (delete), `-+` (replace), `?` (unknown), `()` and `[]` | Public pages; no separate data licence is stated. The rules are implemented; no records are copied |
| [Noto Sans Nushu and Noto Serif Hentaigana](https://github.com/notofonts) | glyphs for Nüshu and hentaigana | OFL-1.1 |
| [Jigmo](https://kamichikoichi.github.io/jigmo/) 2025-09-12, 上地宏一 | glyphs for the extension blocks, cut by `scripts/build_fonts.py` | CC0-1.0 |
| [Sealie](https://github.com/iebb/sealie) 1.2.0 Regular, ieb, [release](https://github.com/iebb/sealie/releases/tag/v1.2.0) 2026-10-26, SHA-256 `5d949eaf…c212` | glyphs for the 11,328 Small Seal characters, cut by `scripts/build_fonts.py` into 256-code-point slices | OFL-1.1. A monoline display design marked experimental by its author; its README says OpenAI image generation made the first drawings and reviewed centrelines form the source. Its forms are a modern stylisation, not a facsimile of any Shuowen edition |
| [全字庫正宋體 TW-Sung-Plus](https://www.cns11643.gov.tw/downloadList.jsp?ID=2), 數位發展部, `Fonts_Sung.zip` 20260805 | glyphs for the private-use slots of unencoded CNS source rows, cut by `scripts/build_fonts.py` | 政府資料開放授權條款第1版 (OGDL 1.0), attribution「數位發展部，CNS11643中文標準交換碼全字庫網站」 |
| BabelStone Han PUA 1.472, Andrew West | glyphs for the numbered components IDS.TXT leaves without a fragment, cut to `app/public/fonts/IDSNumbered.woff2` | Arphic Public License, `LICENSE-BabelStoneHanPUA.txt` |
| [han-compose](https://github.com/mkpoli/han-compose), MIT; outlines from Noto Sans CJK JP and Plangothic (SIL OFL 1.1), with KanjiVG-assisted cuts (CC BY-SA 3.0) | draws an IDS as sans-serif outlines; the three composed CNS rows in `app/public/fonts/cns-composed.woff2` | MIT code; the drawn glyphs carry the fonts' OFL and, for KanjiVG cuts, CC BY-SA 3.0 |

The 構字式 converter (`src/legacy.js`) reads the thirteen symbols and writes IDS; a shape marker yields
its parts joined by `·`, since the writing order it records does not give their arrangement. The font
draws the symbols after the handout's table; it does not reuse the handout's embedded font.

The arithmetic converter (`src/arithmetic.js`) reads two notations. The Korean History Database uses
`+` for left-right and `*` for a combination with no fixed position, so `*` becomes IDS overlap `⿻`;
`-` becomes the IDS subtraction sign `㇯`, and `▼` marks a variant. CBETA's general formula uses `*` for
left-right, `@` for containment (IDS `⿴`) and `-+` for a replacement (IDS `⿻` of the remainder and the
addition); `?` is an unknown part and `[]` separates a formula from running text. Precedence is read from
the arithmetic signs (`*`, `/` before `+`, `-`, with `()` overriding); the Korean help states only that
`()` comes first. Search converts the formula to its parts and asks the same part index the finder uses.
The example `▼(乙*車)` and the report that the database's rendering is not deterministic come from
[@sebansios's post of 2026-07-26](https://x.com/sebansios/status/2081348644020916467).

The general formula is CBETA's, not a Korean-only convention. Japan's
[SAT project](https://21dzk.l.u-tokyo.ac.jp/SAT/ucs_encoded.pdf) and the
[Nôm Foundation](https://nomfoundation.org/Conf2006/NomNa_Csttc_dequy.pdf) take different routes for their
own unencoded characters: SAT uses CHISE and Unicode assignment, and the Nôm Foundation's composition data
uses IDS operators U+2FF0–2FFB. No arithmetic-sign description for Hong Kong or Vietnamese material was
located.

BabelStone writes some parts by number. Where note 6 of its file gives the IDS that writes the
number out, the card draws it ({12}, the right of 龍, as ⿷己三); a number the note leaves without a
fragment is drawn from BabelStone Han PUA's glyph for it. A part drawn this way is underlined with
dots and shows the number and note 6's description on hover. Where CHISE's description of a
character differs from BabelStone's only in one operand, and that operand is a CHISE entity against a
number, the two are taken for one component: the entity is drawn as that number's glyph and the
hover text names both. BabelStone's `？` for an unnamed part, and an entity with no such alignment,
have no character to draw, so they stay as written and carry the same mark.

The research behind these choices, with every candidate and what was checked, is in
[`research-input-methods.md`](research-input-methods.md) and
[`research-extended-sinography.md`](research-extended-sinography.md). Those tables record uncertainty row
by row and were compiled by a delegated research pass, so a row marked uncertain has not been reconfirmed.

## Variant spellings

A part is searched under every spelling IWDS groups with it: `口匕` also asks for `口七`, and the results
name the spelling each group came from. A character's card and search result also list the code points
Unicode calls the same character (叱 and 叱, through UnicodeData's compatibility decomposition) and the
pairs IWDS marks as disunified variants.

The seal radical has a group of its own: the unified 卩 and the Kangxi radical ⼙ (U+2F19), which
UnicodeData maps to 卩 with a compatibility decomposition. 卪 is a different character whose shape is close;
it is offered as a similar part in its own section, never merged into the results. The Korean Idu -n mark
that prompted this is a longer form of 卩 with no encoded character of its own (NGWU YOH, personal
communication, 2026-11-09). Groups are checked in at
[data/variant-groups.json](../data/variant-groups.json), separately from IWDS.

Both relations are readings of the sources, not proof that the forms are one character. IWDS calls most
of its groups unifiable, and a compatibility mapping only states that one code point stands for another;
neither makes the glyphs identical in every font.

## Search by meaning

Dictionaries serve only as an index here: a word to the characters it describes. Sources: Unihan's
`kDefinition`, and Wiktionary's English, Chinese and Japanese editions (dumps of 2026-11-01, and the
wiktextract extract), CC BY-SA 4.0 and GFDL. The search matches words of the gloss; it does not compute
semantic similarity, so a synonym the gloss does not use will not be found.

## Linked, not copied

字統網 zi.tools, 漢典 zdic, 新葉典 yedict, 韻典網 ytenx, 古音小鏡 kaom, Web韻圖 (鈴木慎吾), Glyph Atlas,
IDS Workshop, GlyphWiki. Ytenx's `DATA_LICENSE.md` grants nothing for its data, and no bulk data was
found for kaom, so both stay links. Web韻圖 and kaom have no address for a single character, and those
links open the site's search page.

## Known gaps

- No drawing pad yet.
- Kana written with a combining mark (か゚, カ̣, ㇷ゚) are not indexed, since an entry is one code point. That leaves out the dotted Taiwanese kana and some Ainu kana.
- Katakana have no source characters: `hentaigana.el` gives them for hiragana and hentaigana only.
- 26 kana have no bundled glyph, among them the Minnan letters (U+1AFF0–U+1AFFF) and U+1B150, and depend on the reader's system fonts.
- The readings of a variety lose their notes (文白 and usage) in this index; 音典 keeps them.
- CHISE describes some characters with parts that have no code point. The description keeps the source's entity name (`&CDP-88CD;`), as BabelStone's `{13}` and `？` stay.
- Some tables grant only non-commercial use (表形碼, 導碼, E碼, 華象, 嘸蝦米, the 通用 Hakka tables), and
  some carry terms that do not permit redistribution (中易拼形, 宇浩). The build writes every indexed table
  as search shards under `app/public/data`, which the browser fetches to answer a query; the method page
  shows the terms. Whether that use is permitted is for each rights holder.
