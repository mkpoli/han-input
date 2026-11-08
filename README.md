# Han Input

A site for finding a Chinese character through whatever you know about it: a code in any input method,
a reading in any variety, a part, a stroke count, a meaning. Several clues combine until one character
remains. The card of a character shows it under every method and how it is written, and links on to 字統網
and the other sites that say more.

It covers Han, extended sinographies such as Chữ Nôm and Sawndip, and kana and Nüshu. Scope and sources are in
[`docs/materials.md`](docs/materials.md).

## Pages

- **Find**: one box. A clue is tried as a code in every method, as a reading in every variety and as a
  word of meaning. Spaces separate clues: `氵 12畫`, `river ジ`, `cangjie5:jnd`.
  A [character-set filter](docs/character-sets.md) narrows the results or browses a set on its own.
- **Methods**: every input method, each usable as an input method of its own.
- **Readings**: every variety in 漢字音典, each typed the same way.
- **Rhyme tables**: the Guangyun by rhyme, initial, grade and tone.
- **Radicals**: the 214 Kangxi radicals by residual strokes.
- **PUA conversion**: convert text from the Ministry of Education's Taiwanese/Hakka fonts to Unicode and browse the mappings. Each character's card lists its own PUA codes and those of its Unihan variants.

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

The Ext.E withdrawn set carries the glyphs printed in IRGN1841. `bun scripts/import_ext_e_glyphs.mjs`
cuts them from the pinned PDF (poppler and ImageMagick), matches each to the serial and G source printed
beside it, and writes `app/public/charsets/glyphs/ext-e/`.

The PUA converter uses the committed [MOE mapping snapshot](data/moe-pua.json), independently of the
search tables. `bun scripts/import_moe_pua.mjs` imports the checksum-pinned official source;
`bun scripts/import_moe_pua_variants.mjs [Unihan_Variants.txt]` rebuilds the Unihan variant index from
Unihan 18.0; `SITE_URL=http://127.0.0.1:5317 bun scripts/check_pua.mjs` checks a running preview in Chromium.
