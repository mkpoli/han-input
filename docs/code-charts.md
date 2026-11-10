# Code charts

`/scripts` lists the encoded code points of Tangut, Jurchen and the Khitan small script. Components
and radicals are kept apart from characters, and the page charts the counts behind each table.

| Script | Characters | Components or radicals | Blocks |
| --- | ---: | ---: | --- |
| Tangut | 6,177 | 883 components | U+17000–U+187FF, U+18D00–U+18D7F, U+18800–U+18AFF, U+18D80–U+18DFF |
| Jurchen | 914 | 51 radicals | U+18E00–U+1919F, U+191A0–U+191DF |
| Khitan small script | 476 | none encoded | U+18B00–U+18CFF |

The counts follow Unicode 18.0.0. A block's unassigned positions stay empty; a code point whose
shape the bundled face does not draw stays in the table as a code-only cell. That is 32 Tangut
characters, 115 Tangut components and 5 Khitan characters. U+18CD6–U+18CDA and U+18C3E are marked
tentatively Jurchen Small Script in NamesList; U+18CFF marks a lost or illegible character.

The Khitan large script has no Unicode block, so it has no chart here. The page does not add these
scripts to Find; see [Scope](materials.md#scope).

## Data

`bun scripts/build_siniform.mjs` writes `app/public/data/siniform.json`; `bun run build:data` calls
the same script after the search tables. It reads:

- **Unicode 18.0.0** [`Blocks.txt`](https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt) for the block
  bounds, [`DerivedAge.txt`](https://www.unicode.org/Public/18.0.0/ucd/DerivedAge.txt) for the
  assigned code points and their versions, and
  [`JurchenSources.txt`](https://www.unicode.org/Public/18.0.0/ucd/JurchenSources.txt) for each
  Jurchen character's radical. [`NamesList.txt`](https://www.unicode.org/Public/18.0.0/ucd/NamesList.txt)
  supports the note on the tentatively Jurchen characters and U+18CFF. Unicode License v3.
- **BabelStone Tangut IDS**, Andrew West,
  [`TangutIDS.txt`](https://www.babelstone.co.uk/Tangut/TangutIDS.txt), SHA-256
  `6d3e24241ce608590b1bce249a8367e8371a34b61e59b150e50c51b639eabd44`, retrieved 2026-11-10, for the characters each
  Tangut component appears in. The page counts presence once per character; it does not reproduce
  the descriptions. No separate licence is stated for the file.
- **Noto Serif Tangut 2.170** (SIL OFL 1.1), **Noto Serif Khitan Small Script** (SIL OFL 1.1) and
  **Alari Xuwasun Jurchen** (SIL OFL 1.1) for the shapes. The Tangut face is subset to the page's
  code points; the other two are served whole. Licences are in `app/public/fonts/OFL-*.txt`.

The build pins the Unicode files and the BabelStone file by SHA-256, so a source change fails the
build instead of quietly changing a count.
