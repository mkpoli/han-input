// Refresh the G source sets alone. The full charset build also calls the same writer, but it
// re-downloads the 字統 catalogue and stops on any changed source digest; this script leaves the
// other sets untouched and only appends the Unihan G source entries.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as OpenCC from 'opencc-js'
import { fetchOnce } from './lib.mjs'
import { writeGSourceSets } from './sources/charsets-g-sources.mjs'

const OUT = join(import.meta.dirname, '../app/public/charsets')
const UNIHAN_URL = 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip'
const catalogue = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
/** @type {any[]} */
const kept = catalogue.filter((/** @type {{id: string}} */ row) => !row.id.startsWith('g_src_'))
const unihanPath = await fetchOnce(UNIHAN_URL, 'Unihan.zip')
const pinned = JSON.parse(readFileSync(join(OUT, 'sources.json'), 'utf8')).inputs.find((/** @type {{url: string}} */ input) => input.url === UNIHAN_URL)
const sha256 = createHash('sha256').update(readFileSync(unihanPath)).digest('hex')
if (!pinned || pinned.sha256 !== sha256) throw new Error('Unihan 18.0.0 bytes changed; update the pinned digest first')
const unihanText = execFileSync('unzip', ['-p', unihanPath, 'Unihan_IRGSources.txt'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const added = writeGSourceSets(kept, unihanText, OUT, OpenCC.Converter({ from: 'tw', to: 'cn' }))
writeFileSync(join(OUT, 'index.json'), JSON.stringify(kept, null, 2) + '\n')
console.log(`${added.length} G source sets written`)
