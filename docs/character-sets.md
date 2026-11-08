# Character sets

Find accepts one character-set filter at a time. An empty query browses its mapped characters; a query intersects the set with every result channel. The address stores the selection in `?set=`, alongside `?q=` and `?c=`.

## Catalogue

| Collection | Coverage |
| --- | --- |
| 字統網 | All 119 metadata entries, including 115 visible catalogues and four hidden entries |
| IWDS | Explicit encoded component forms and examples, with entry IDs and field roles |
| Unicode 18.0.0 | Literal compatibility, radical, stroke, kana and Nüshu blocks |
| Extension E withdrawn | 134 glyphs printed in IRGN1841 and four further documented records; three verified Unicode correspondences |
| Extension D removed | 78 J-source glyphs printed in IRGN1250, withdrawn from the CJK D candidate |
| Ext.F withdrawn · SAT | 64 Z_SAT glyphs printed in IRGN1925, withdrawn from the CJK F candidates |
| Ext.F withdrawn · JMJ | 26 MJ glyphs printed in IRGN1924 with their unification targets |
| Ext.F1 · 50 SAT drops | 50 sequence and Z_SAT pairs from IRGN2041, a list without glyphs |
| CNS11643全字庫 | All 123 exact registration-source labels from the 2026-08-05 bulk release, across Han, other scripts and symbols |

Each set has a unique character count and a source-row count. A source row joins through its assigned scalars, or through its private-use glyph slot where no scalar is assigned. A row whose only glyph is an Ideographic Description Sequence stays out of the scalar count and is kept as a record on the set. Repeated mappings, variation sequences and IDS descriptions can make the counts differ. Draft row numbers never establish Unicode assignments.

A selected set also shows its source coverage: `encoded` counts source characters that resolve to an assigned, non-private-use Unicode scalar, including characters outside the search scope. It counts distinct glyphs for 字統 and Ext.E, and rows for CNS. `unencoded` counts rows without such a scalar, including IDS descriptions and private-use slots. Repeated 字統 scalars and variation sequences are not counted, so the two totals need not add up to the source-row count. `chars` remains the browsable count, which includes CNS private-use slots, and IWDS `total` counts entries rather than its example characters. Catalogue pies mark sets with unencoded rows, and their title gives the exact numbers.

The four hidden 字統 entries currently return empty objects. Their catalogue entries retain zero mapped characters and a source-unavailable note. Sets with unencoded rows link to their records; 50 字統網 sets carry IDS descriptions this way. Proposal sets with unencoded forms link to their source rows.

## CNS source categories

The **CNS source categories** shortcut opens the source list without choosing a character first. Categories include 常用國字標準字體表、次常用字國字標準字體表、罕用國字標準字體表、異體國字字表、戶政、地政、財稅、工商登記、文獻 and local-language collections. Edition qualifiers remain part of each exact source label.

`CNS_source.txt` records the source at registration for each CNS code. The catalogue lists every source row: an assigned scalar is browsable as that character, and a row with only a private-use mapping is browsable as its PUA-A glyph slot, drawn from its IDS by han-compose where one is recorded and otherwise by the bundled TW-Sung-Plus slice. Unihan 18 `kIRG_TSource` supplies scalars assigned after the bulk release (TB-7D29 is U+324D6), while the row keeps its earlier private-use mapping. The bulk release is dated 2026-08-05; individual pages on the live CNS site can contain later changes.

CNS plane numbers in these files are decimal. Source categories, planes and historical provisional status have separate meanings. The source table has no Extension E withdrawal category.

## Printed proposal records

A proposed character that was never encoded has no scalar, so its set cannot be a list of characters. The proposal sets keep the printed record instead: the codes printed beside each glyph, and the glyph cut from the document's page. Records the documents explain without a glyph stay text-only, and a record with a verified correspondence links to that character's card.

`bun scripts/import_irg_records.mjs` reads each pinned PDF with poppler's `pdftohtml`, which gives text and image boxes in one coordinate system. `scripts/sources/irg.mjs` pairs every glyph with the codes beside it: a serial stacked over its source (IRGN1841, IRGN1330) or beside it (IRGN1925), or one line of two codes (IRGN1250). ImageMagick then draws the strokes black on a transparent ground, since the documents use both polarities. A set is written only when its record count matches and every serial and source is distinct. Regenerating needs poppler and ImageMagick.

These are proposal numbers, not scalar assignments. IRGN1841 lists characters for withdrawal while leaving later resubmission possible; IRGN1250 removes J sources from the CJK D candidate for lack of evidence, and some of its characters were proposed again.

## G source labels

Character cards show the G source beside its code, and a printed record card does the same; the record grid puts the source in the tile title. The glossary lists GCH 辭海, GCYY 中國測繪科學研究院用字, GBK 中國大百科全書, GJZ 商務印書館用字, GZFY 漢語方言大詞典, GH GB/T 15564 and GKX 康熙字典; a code outside these stays plain. The code stays text; the source name opens a note with the edition or institution. The notes live in [sources.js](../app/lib/sources.js). [UAX #38](https://www.unicode.org/reports/tr38/#kIRG_GSource) defines the codes and the edition behind GCH; the institutional dates come from [CASM](https://www.casm.ac.cn/chbyjj/chyjj/index.html), the [Commercial Press](http://cpem.cp.com.cn/home/aboutcpem) and [Cihai](https://www.cihai.com.cn).

## Sources

- **字統網**, [catalogue metadata](https://zi.tools/api/ma/ma/metadata.json) and each cited `/api/ma/ma/{id}.json` endpoint, retrieved 2026-11-07. These are editorial glyph mappings: some compatibility characters appear as unified forms, dictionary sets can include variants, and G5/KP1 include reconstructions. They do not establish literal membership in every original standard. No blanket redistribution licence was located; the snapshot contains names and factual membership mappings, with no source images or descriptive prose.
- **yi-bai/iwds**, [IWDS XML](https://raw.githubusercontent.com/yi-bai/iwds/master/iwds.xml), retrieved 2026-11-07. This is a maintained transcription of component-variation rules and examples. Example lists contain ellipses and cover both unifiable and non-unifiable cases. The filter indexes explicitly listed scalar forms; their entry IDs and roles are in [the evidence file](../app/public/charsets/iwds-evidence.json). No repository-wide licence was located.
- **數位發展部**, [CNS11643中文標準交換碼全字庫網站](https://www.cns11643.gov.tw), [Properties.zip](https://www.cns11643.gov.tw/opendata/Properties.zip), [MapingTables.zip](https://www.cns11643.gov.tw/opendata/MapingTables.zip), [bulk release dates](https://www.cns11643.gov.tw/opendata/release.txt), version 20260805. The included README defines `CNS_source.txt` column 2 as「該CNS字碼收錄編碼時之來源」. [政府資料開放授權條款第1版](https://www.cns11643.gov.tw/pageView.jsp?ID=59) permits reuse with attribution:「數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw」。 Live category counts can differ from this release. Private-use mappings are shown as glyph slots and do not establish an assigned scalar. Unihan 18 `kIRG_TSource` fills a scalar assigned after this release; a row keeps its private-use mapping as record evidence. The mapping README's count says three Unicode tables while the archive supplies four; all four named files are read. [Category provenance](../app/public/charsets/cns-sources.json) records exact labels, source counts, member digest and verified official category links.
- **Unicode, Inc.**, [Unihan 18.0.0](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip) `kIRG_TSource`, for a scalar that the CNS bulk release still maps to private use; [UnicodeData 18.0.0](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt) and [Blocks 18.0.0](https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt), [Unicode Licence v3](https://www.unicode.org/license.txt). Literal block sets include assigned scalars only.
- **Chen Zhuang**, [IRGN1596, CJK_Ev60 Directions,2009-08-07](https://www.unicode.org/irg/docs/n1596r-ExtensionEv6-Directions.pdf). Draft directions identify 06721/U+2AC66 and 06728/U+2AC69 as already encoded in Extension C; the historical status includes withdrawals, deletions and unifications.
- **China**, [IRGN1841,2012-01-01](https://www.unicode.org/irg/docs/n1841-ExtensionEWithdraw.pdf). Lists 134 proposed withdrawals, with possible later resubmission. Their final dispositions and scalar crosswalks remain unverified here. The set's glyphs are cut from the document's pages 2–3, matched to the serial and G source printed beside each one; the document states no reuse terms for its images, and these are proposal glyphs rather than evidence for a scalar.
- **Vietnam**, [IRGN1881,2012-08-28](https://www.unicode.org/irg/docs/n1881-ExtensionEWithdraw.pdf); **IRG editorial group**, [IRGN1896](https://www.unicode.org/irg/docs/n1896-EditorialReport.pdf), accepted through [IRGN1910, M39.3](https://www.unicode.org/irg/docs/n1910-Resolutions.pdf). V04-486A was deleted from version 8.1. G_K0642.17 was temporarily withdrawn after unification with U+26C73. The [withdrawal records](../app/public/charsets/ext_e_records.json) distinguish requests, dispositions and mapped targets.
- **NGWU YOH**, personal communications dated 2026-11-06 and 2026-11-07 requesting character-set search and an Extension E withdrawn set; privately supplied screenshots of 字統網 and CNS11643. These establish the interface reference and requested category, with no independent character-membership evidence.

## Data and checks

The checked-in [catalogue](../app/public/charsets/index.json), per-set text files and [source digests](../app/public/charsets/sources.json) work without requests to external services. The generator checks downloaded bytes against recorded SHA-256 values. Source files are cached under `cache/`; changed inputs require a reviewed digest update.

```sh
bun scripts/build_charsets.mjs
bun scripts/import_irg_records.mjs
bun run verify
bun run build
bun scripts/check_charsets.mjs
```

The browser check serves the built distribution through Playwright request routing, so it requires no preview server. It covers selection, browsing, every search channel, URL history, stale requests, failures, retry, keyboard focus and both themes at desktop and phone widths. Screenshots are written under `shots/`.
