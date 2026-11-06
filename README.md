# Han Input

A site for finding a Chinese character through whatever you know about it: a code in any input method,
a reading in any variety, a part, a stroke count, a meaning. Several clues combine until one character
remains. The card of a character shows it under every method, and links on to 字統網 and the other sites
that say more.

It covers Han, extended sinographies such as Chữ Nôm and Sawndip, and kana and Nüshu. Scope and sources are in
[`docs/materials.md`](docs/materials.md).

## Pages

- **Find**: one box. A clue is tried as a code in every method, as a reading in every variety and as a
  word of meaning. Spaces separate clues: `氵 12畫`, `river ジ`, `cangjie5:jnd`.
- **Methods**: every input method, each usable as an input method of its own.
- **Readings**: every variety in 漢字音典, each typed the same way.
- **Rhyme tables**: the Guangyun by rhyme, initial, grade and tone.
- **Radicals**: the 214 Kangxi radicals by residual strokes.

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
