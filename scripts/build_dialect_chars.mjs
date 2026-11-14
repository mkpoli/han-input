// Write the dialect-character sets alone, from the pinned inputs in dialect_source.json. The full
// charset build calls the same writer.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as OpenCC from 'opencc-js'
import { readDialectInputs } from './sources/dialect-inputs.mjs'
import { DIALECT_GROUP, writeDialectSets } from './sources/charsets-dialect.mjs'

const OUT = join(import.meta.dirname, '../app/public/charsets')
const catalogue = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
/** @type {any[]} */
const kept = catalogue.filter((/** @type {{group: string}} */ row) => row.group !== DIALECT_GROUP)
const added = writeDialectSets(kept, await readDialectInputs(OUT), OUT, OpenCC.Converter({ from: 'tw', to: 'cn' }))
writeFileSync(join(OUT, 'index.json'), JSON.stringify(kept, null, 2) + '\n')
console.log(added.map(set => `${set.label} ${set.chars}${set.unencoded ? ` + ${set.unencoded} IDS` : ''}`).join('\n'))
