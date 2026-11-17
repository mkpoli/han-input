// The Hokkien 訓用字 list: every headword the Ministry of Education dictionary marks 替 (替代字),
// with its reading, the characters recorded beside it and the first gloss. The download is pinned by
// the digest in app/public/kun/source.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchOnce, sha256 } from './lib.mjs'
import { kunRows } from './sources/kun.mjs'

const OUT = join(import.meta.dirname, '../app/public/kun')
const source = JSON.parse(readFileSync(join(OUT, 'source.json'), 'utf8'))
const path = await fetchOnce(source.url, `kun-${source.version}.json`)
if (sha256(path) !== source.sha256) throw new Error(`${source.url} changed; review it and update source.json`)
// The mirror keeps bare NaN in a few empty dialect cells, which JSON.parse rejects.
const rows = kunRows(JSON.parse(readFileSync(path, 'utf8').replace(/:\s*NaN(?=\s*[,}\]])/g, ':null')))
writeFileSync(join(OUT, 'readings.json'), JSON.stringify({ source, rows }) + '\n')
console.log(`${rows.length} readings, ${new Set(rows.map(row => row.char)).size} characters`)
