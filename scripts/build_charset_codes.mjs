// Adds each set's own code beside its members, from the pinned payloads already in cache/.
// The full build writes the same files; this step refreshes them without refetching the catalogue.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE } from './lib.mjs'
import { cnsRowCodes, codeText, evidenceCodes, proposalCodes, rowCodes } from './charset-codes.mjs'
import { GB12052_UNENCODED, gb12052Members, readGb12052 } from './sources/charsets-gb12052.mjs'

const OUT = join(import.meta.dirname, '../app/public/charsets')
/** @type {import('../app/lib/charsets.js').Charset[]} */
const catalogue = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
const metadata = JSON.parse(readFileSync(join(CACHE, 'zi.tools_api_ma_ma_metadata.json'), 'utf8')).meta
/** @type {Map<string, {index?: string, source?: string}>} */
const metaById = new Map(metadata.map(/** @param {{id: string}} entry */ entry => [entry.id, entry]))

for (const entry of catalogue) {
  const members = new Set(readFileSync(join(OUT, `${entry.id}.txt`), 'utf8').split('\n').filter(Boolean))
  /** @type {{char: string, code: string}[]} */
  let codes = []
  if (entry.id === 'gk') {
    codes = gb12052Members(await readGb12052(), new Set(GB12052_UNENCODED)).codes
  } else if (entry.group === 'CNS sources') {
    const text = readFileSync(join(OUT, `${entry.id}.tsv`), 'utf8')
    const records = text.split('\n').filter(line => line && !line.startsWith('#') && !line.startsWith('CNS\t')).map(line => {
      const [cns, unicode = ''] = line.split('\t')
      return { cns, unicode: unicode.split(/\s+/).filter(Boolean).map(token => token.slice(2)) }
    })
    codes = cnsRowCodes(records, members)
  } else if (entry.group === 'Unicode blocks') {
    codes = [...members].map(char => ({ char, code: `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}` }))
  } else if (entry.id === 'iwds') {
    codes = evidenceCodes(JSON.parse(readFileSync(join(OUT, 'iwds-evidence.json'), 'utf8')), members)
  } else if (entry.group === 'Proposals') {
    if (entry.records) {
      const records = JSON.parse(readFileSync(join(OUT, entry.records.file.replace('/charsets/', '')), 'utf8')).records
      codes = proposalCodes(records, members)
    }
  } else {
    const meta = metaById.get(entry.id)
    const path = join(CACHE, `zi.tools_api_ma_ma_${entry.id}.json`)
    if (meta && existsSync(path)) {
      codes = rowCodes(JSON.parse(readFileSync(path, 'utf8')).rows, meta, members)
    }
  }
  if (codes.length) {
    writeFileSync(join(OUT, `${entry.id}.codes.tsv`), codeText(codes))
    entry.codes = `/charsets/${entry.id}.codes.tsv`
  } else {
    delete entry.codes
  }
  const missing = members.size - codes.length
  if (codes.length && missing) console.warn(`${entry.id}: ${missing} members without a code`)
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(catalogue, null, 2) + '\n')
console.log(`coded ${catalogue.filter(entry => entry.codes).length} of ${catalogue.length} sets`)
