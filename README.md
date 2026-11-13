# Han Input

A site for finding a Chinese character through whatever you know about it: a code in any input method,
a reading in any variety, a part, a stroke count, a meaning. Several clues combine until one character
remains. The card of a character shows it under every method and how it is written, and links on to 字統網
and the other sites that say more.

It covers Han, extended sinographies such as Chữ Nôm and Sawndip, and kana and Nüshu. Scope and sources are in
[`docs/materials.md`](docs/materials.md).

## Pages

- **Find**: one box. A clue is tried as a code in every method, as a reading in every variety and as a
  word of meaning. Spaces separate clues: `氵 12畫`, `river ジ`, `cangjie5:jnd`. A part is also tried under
  the spellings on record for it, so `口匕` brings characters sources write `口七`; the seal shape also
  covers `⼙` (Kangxi radical) and `𰆊` (Idu -n mark), and offers `卪` as a look-alike.
  A [character-set filter](docs/character-sets.md) narrows the results or browses a set on its own. A browsed set
  prints each character's code in that set under it, orders by that code or by character, and can show only
  encoded or only unencoded members.
- **Methods**: every input method, each usable as an input method of its own.
- **Readings**: every variety in 漢字音典, each typed the same way.
- **Rhyme tables**: the Guangyun by rhyme, initial, grade and tone.
- **Radicals**: the 214 Kangxi radicals by residual strokes.
- **PUA conversion**: convert text from the Ministry of Education's Taiwanese/Hakka fonts to Unicode and browse the mappings. Each character's card lists its own PUA codes and those of its Unihan variants.
- **Composition**: convert the 構字式 of Taiwan's 漢字構形資料庫 (Big5 8DF1–8DFD) and arithmetic composition to IDS. The thirteen symbols and the arithmetic signs are palettes; the Korean History Database and CBETA assign those signs differently.

## Development

```sh
bun install
bun run build:data      # the tables, from sources pinned in scripts/ and cached in cache/
bun run dev
bun run verify          # unit tests, type check, messages
```

`bun scripts/build_readings.mjs` builds the readings from the database in 漢字音典's release APK, unpacked to
`cache/mcpdict/x`. `bun scripts/build_wiktionary.mjs <dir>` builds the meaning index from Wiktionary dumps
before `build:data` reads it. The generated `app/public/data/` is about 300 MB and is not committed.

The proposal sets carry the glyphs printed in their IRG documents. `bun scripts/import_irg_records.mjs`
cuts them from the pinned PDFs (poppler and ImageMagick), matches each to the codes printed beside it,
and writes `app/public/charsets/glyphs/` plus one records file per set.

The part spellings and character variants come from the committed [variant snapshot](data/variants.json),
built by `bun scripts/import_variants.mjs` from IWDS, the curated [Idu groups](data/variant-groups.json)
and UnicodeData.

The composition converter uses the thirteen symbols of the 漢字構形資料庫, read from old text at
U+F6A3–U+F6AF. `uv run scripts/build_composition_font.py` draws them after table 1 of the
[CDP handout](https://cdp.sinica.edu.tw/service/documents/T960419.pdf) and writes
`app/public/fonts/cdp-composition.woff2`.

The PUA converter uses the committed [MOE mapping snapshot](data/moe-pua.json), independently of the
search tables. `bun scripts/import_moe_pua.mjs` imports the checksum-pinned official source;
`bun scripts/import_moe_pua_variants.mjs [Unihan_Variants.txt]` rebuilds the Unihan variant index from
Unihan 18.0; `SITE_URL=http://127.0.0.1:5317 bun scripts/check_pua.mjs` checks a running preview in Chromium.
