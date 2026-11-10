# Extended sinography lookup sources

Checked 2026-11-05. "Live" means the URL answered HTTP 200 from curl or `gh api` on that date. Row counts are line counts of the fetched file unless noted. Anything not fetched is marked uncertain. Tangut, Jurchen and Khitan are out of the finder's scope; their encoded ranges are listed on the [code charts](code-charts.md) page.

## Sources found

| # | Script | Source and URL (live) | What it maps | Rows | Licence as quoted | Unicode or PUA |
|---|---|---|---|---|---|---|
| 1 | Sawndip | DracoLoong/sawndip-tables, `https://raw.githubusercontent.com/DracoLoong/sawndip-tables/HEAD/Sawndip-table_2026-01-11-2205.txt` | character to Zhuang reading (tab separated, single characters only) | 15,914 lines including 3 header lines | GPL-3.0 (GitHub API `spdx_id`) | Unicode only. README says old PUA codes were moved to assigned code points and uncoded entries were dropped. Based on 古壮字字典·初稿, 古壮字大字典 and "Mapping the Old Zhuang Character Script". |
| 2 | Sawndip | Unihan `kZhuang`, `https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip`, file `Unihan_Readings.txt` | code point to Zhuang reading | 2,473 lines, 2,472 of them in planes 2 and 3 | "For terms of use and license, see https://www.unicode.org/terms_of_use.html" (file header) | Unicode |
| 3 | Sawndip | xyy25/zhuang-dict, `https://github.com/xyy25/zhuang-dict` (described as 壮语-古壮字数据库) | uncertain. The repo root held only `LICENSE` when read through the contents API, and the readme returned 404. | none found | Apache-2.0 (API) | uncertain. Not a usable data source as fetched. |
| 4 | Sawndip | chimingxu126/sawndip-dictionary, `https://github.com/chimingxu126/sawndip-dictionary` | scanned or electronic 古壮字字典 files, 18 MB; format not inspected | uncertain | none stated (API shows no licence). The underlying dictionary is a published work. | uncertain |
| 5 | Chữ Nôm | nomnaviet/rime-nom-viet, `https://raw.githubusercontent.com/nomnaviet/rime-nom-viet/main/nom_viet.dict.yaml` | Nôm word or character to Telex code, weight and comment (Rime dict) | 108,001 lines (README claims 100,000+ entries, 46,000 compounds) | MIT (README "## License" and API). Data comes from the Nôm Na Việt database (nomnaviet.com). The upstream data terms are not stated, uncertain. | Not inspected beyond the header; plane 2 characters present in other Nôm tables. PUA use uncertain. |
| 6 | Chữ Nôm | nomnaviet/nomnaviet-contrib, `https://github.com/nomnaviet/nomnaviet-contrib` (`classifications/character-classifications.csv` 648 KB, `variants/missing-variants.csv` 570 KB, `decompositions/*.csv`) | Nôm character classification codes (A1 to G2), variants, IDS decompositions | not counted, uncertain | New contributions CC0-1.0. NOTICE.md says the roughly 7,700 pre-filled classification rows come from Nguyễn Quang Hồng, *Tự Điển Chữ Nôm Dẫn Giải* (2014) via Digitizing Vietnam and are not CC0. The `CurrentIDS` column derives from cjkvi-ids (CHISE terms, GPLv2). | Unicode (columns use `unicode`); PUA not checked |
| 7 | Chữ Nôm | huangjunxin/Rime-Hannom, `https://raw.githubusercontent.com/huangjunxin/Rime-Hannom/HEAD/hannom.dict.yaml` | Hán Nôm character to Quốc ngữ code, weight, gloss (derived from HannomPS) | 46,811 lines | CC-BY-4.0 (API) | Unicode (sample rows include 𣎏) |
| 8 | Chữ Nôm | miketvo/rime-ime-han-nom-data, `https://github.com/miketvo/rime-ime-han-nom-data` (`hannom-telex.dict.yaml` 749 KB, `raw-data/combined-list.csv` 719 KB, `raw-data/standard-list.csv` 96 KB) | Hán Nôm to Telex | not counted, uncertain | MIT (LICENSE and README). The README "Data sources" section was not read in detail, so upstream terms are uncertain. | Unicode (not exhaustively checked) |
| 9 | Chữ Nôm | valestanov/ChuNomStandardization, `https://raw.githubusercontent.com/valestanov/ChuNomStandardization/HEAD/NomStandardization.csv` | Telex, Quốc ngữ, Nôm character, English gloss | 23,400 lines | MIT (API) | Unicode (sample 𩆢) |
| 10 | Chữ Nôm | nguyentutiensinh/rime-vietnamquoctu, `https://github.com/nguyentutiensinh/rime-vietnamquoctu` | Telex to Hán Nôm; ships the fonts CN-Khai and Chu-Nom-Khai (12 to 21 MB each) | not counted, uncertain | GPL-3.0 (API) | uncertain. Font and dict encoding not checked. |
| 11 | Chữ Nôm | pearapple123/rime-chunom, `https://github.com/pearapple123/rime-chunom` (`chu_nom.dict.yaml`) | Nôm IME dictionary | not counted, uncertain | none stated | uncertain |
| 12 | Chữ Nôm | Unihan `kVietnamese`, same zip as #2 | code point to Quốc ngữ reading | 8,307 lines, 4,240 in planes 2 and 3 | Unicode terms of use (file header) | Unicode |
| 13 | Chữ Nôm | Unicode IRG V-source, `kIRG_VSource` in `Unihan_IRGSources.txt` (same zip) | code point to V-source reference (Vietnam submissions) | 14,276 data lines | Unicode terms of use | Unicode |
| 14 | Chữ Nôm | Hán Nôm lookup sites: `https://nomfoundation.org/`, `https://chunom.org/`, `https://hannom.org/`, `https://hvdic.thivien.net/`, `https://nomnaviet.com`, `https://www.digitizingvietnam.com` | web lookup tools; no download link was found or tried | not available | none stated on the pages fetched (only the front page status was checked) | uncertain. NomNaTong font source `https://github.com/nomfoundation/font` is MIT (API). |
| 15 | Hán Nôm, all CJK | cjkvi/cjkvi-ids, `https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt` | code point to IDS | 88,939 lines | "'ids.txt' is derived from CHISE project. License follows their terms" (README); the rest of the repo GPLv2 | Unicode |
| 16 | Kokuji | MaruTama/kokuji-pinyin-data, `https://github.com/MaruTama/kokuji-pinyin-data` (`res/国字まとめ.xlsx` 556 KB, plus markdown lists under `docs/`) | Japanese kokuji to Chinese pinyin | not counted, uncertain | MIT (API) | Unicode (not checked per row) |
| 17 | Kokuji, Korean, Cantonese, all | kaikki.org Wiktionary extracts, e.g. `https://kaikki.org/dictionary/Japanese/kaikki.org-dictionary-Japanese.jsonl` (388 MB), Korean (208 MB), Vietnamese (83 MB), Cantonese (9.5 MB), Zhuang (7.5 MB, 2,981 distinct words per the index page) | headword to glosses, readings, etymology (JSONL). Sawndip headwords inside Zhuang are not separated from Latin spellings; not checked. | file sizes only; entry counts not taken | The pages I read name Wiktionary and Wiktextract and state no licence. The source text is Wiktionary (CC BY-SA, from general knowledge; not quoted from kaikki). Treat as uncertain. | Unicode |
| 18 | Wiktionary categories | `https://en.wiktionary.org/wiki/Category:Zhuang_Sawndip_forms` (API: 601 pages), `Category:Korean_hanja` (9,822 pages), `Category:Vietnamese_Han_tu` (294 pages). `Category:Japanese_kokuji` exists with 0 pages. | member lists through `https://en.wiktionary.org/w/api.php` | as listed | not fetched from the pages; uncertain | Unicode |
| 19 | Hong Kong | Unihan `kHKGlyph` (`Unihan_OtherMappings.txt`, 4,937 lines) and the HKSCS page `https://www.ogcio.gov.hk/en/our_work/business/tech_promotion/ccli/hkscs/` (live; data file not downloaded) | HKSCS glyph references | 4,937 for kHKGlyph | Unicode terms of use for Unihan; HKSCS data terms not read, uncertain | Unicode (HKSCS-2016 is mapped to Unicode; the old PUA mapping is why converters exist) |
| 20 | Hong Kong | chaklim/hkscs_unicode_converter and aaronhktan/hkscs-unicode-converter (both MIT per API) | HKSCS big5 and PUA to Unicode conversion | not counted | MIT | converts PUA to Unicode |
| 21 | Korean | Unihan `kKorean` (9,051 lines) and `kIRG_KSource` (21,631 lines) | code point to Korean readings and K-source references | as listed | Unicode terms of use | Unicode. Whether any entry covers 국자 specifically was not checked. |

## Scripts with nothing found

| Script | What I tried | Result |
|---|---|---|
| 方塊白文 (Bai) | `gh search repos` for "Bai 白文 方块"; no Unihan field for Bai | no table found |
| 方塊苗文 | `gh search repos` for 方块苗文, 古苗文 | only unrelated hits |
| 方塊瑤文 | `gh search repos` for 方块瑶文 | only unrelated hits |
| 方塊布依字 | `gh search repos` for 布依 古布依字 | no hits |
| 侗字 | `gh search repos` for 侗字 | only unrelated hits (a tea site, a Dong speech site) |
| 哈尼 (Hani) | `gh search repos` for "Hani 哈尼 汉字" | no hits |
| Korean 국자 / 固有漢字 | `gh search repos` for "hanja gukja 국자"; Wiktionary `Category:Korean_gukja` returned 404 | no dedicated table. Unihan `kKorean` and the Wiktionary Korean extract may cover some; uncertain. |
| Japanese 国字 as a Wiktionary list | `Category:Japanese_kokuji` has 0 pages | use #16 instead |
| Hong Kong 粵語字 with Jyutping | `gh search repos` for 香港字 粵語字 and "jyutping 粵語 字" returned nothing relevant; Rime Cantonese schemas were not searched by name | uncertain whether a table exists. Not found in this run. |
| rime-sawndip / 喃字 Rime named in the brief | `gh search repos sawndip`: no Rime schema; the closest are #1 and `Sawndip/Input-method-framework` (Windows IME, no licence, not inspected) | none found |
| sawndip.org, zhuang.sawndip.org, www.hkscs.gov.hk, hanviet.org | curl returned 000 (no connection) | unreachable from this machine; uncertain whether the sites are gone |
| Unicode L2/IRG documents (Zhuang, Vietnam) | `https://www.unicode.org/irg/` returned 200; the guessed PDF URLs returned 404 | no specific document verified |
| glyphwiki.org | HTTP 403 to curl | not accessible this way |

## Notes
- Unihan fields `kZhuang` and `kVietnamese` exist in the current release and are the only Unicode-official readings for Sawndip and Nôm.
- Wiktionary category names for Chữ Nôm were not confirmed ("Vietnamese Chữ Nôm", "Vietnamese Nôm forms" return no category info).
