// Imports ids-input's reviewed descriptions of the printed glyphs into app/public/charsets/glyph-ids.json,
// keyed by record (`<set id>:<serial or source>`). Rows with no description (wrong, unclear) are left out.
//   bun scripts/import_glyph_ids.mjs [<glyph-ids.tsv path or URL>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const OUT = join(import.meta.dirname, '../app/public/charsets')
const SOURCE = process.argv[2] ?? 'https://raw.githubusercontent.com/mkpoli/ids-input/main/data/glyph-ids.tsv'
let text
if (/^https?:/.test(SOURCE)) {
  const response = await fetch(SOURCE)
  if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`)
  text = await response.text()
} else text = readFileSync(SOURCE, 'utf8')

// Every key must name a record here, as loadRecords builds it.
const records = new Set()
for (const file of readdirSync(OUT).filter(name => name.endsWith('_records.json'))) {
  const body = JSON.parse(readFileSync(join(OUT, file), 'utf8'))
  for (const record of body.records) records.add(`${body.id}:${record.serial || record.source || ''}`)
}

/** @type {Record<string, [string, string, string]>} */
const glyphs = {}
for (const line of text.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [key, ids, verdict, by] = line.split('\t')
  if (!records.has(key)) throw new Error(`${key}: no such record`)
  if (ids) glyphs[key] = [ids, verdict, by]
}
writeFileSync(join(OUT, 'glyph-ids.json'), JSON.stringify({ source: /^https?:/.test(SOURCE) ? SOURCE : 'ids-input data/glyph-ids.tsv', sha256: createHash('sha256').update(text).digest('hex'), glyphs }) + '\n')
console.log(`${Object.keys(glyphs).length} reviewed glyphs`)
