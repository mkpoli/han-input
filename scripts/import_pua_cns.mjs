// bun scripts/import_pua_cns.mjs [CNS2UNICODE.txt] [Unihan_IRGSources.txt]
// CNS plane 15 characters carry PUA-A code points; Unihan's T source gives the Unicode character.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://raw.githubusercontent.com/qundao/backup-cns11643/HEAD/Tables/MapingTables/Unicode/CNS2UNICODE_Unicode%2015.txt'
const SHA256 = 'baf46bb1606872b59ad90e580e0d729d250a1bc3ff3c9f9d47ef8b7e89e73893'
const UNIHAN_SHA256 = 'e2c484cd22b54f7e0ce896ebb02f33e092b92325accf0fd55e0e14e3863869eb'

/** @param {string} table @param {string} irg */
export function parseCns(table, irg) {
  /** @type {Map<string, string>} */
  const tSources = new Map()
  for (const line of irg.split('\n')) {
    if (!line.startsWith('U+')) continue
    const [cp, field, value] = line.split('\t')
    if (field !== 'kIRG_TSource') continue
    for (const id of value.trim().split(/\s+/)) tSources.set(id.toLowerCase(), String.fromCodePoint(parseInt(cp.slice(2), 16)))
  }
  /** @type {Record<string, string>} */
  const mappings = {}
  for (const line of table.split('\n')) {
    const [cns, unicode] = line.trim().split(/\s+/)
    if (!cns || !unicode) continue
    const point = parseInt(unicode, 16)
    const pua = (point >= 0xE000 && point <= 0xF8FF) || (point >= 0xF0000 && point <= 0xFFFFD) || (point >= 0x100000 && point <= 0x10FFFD)
    if (!pua) continue
    const char = tSources.get(`t${cns.toLowerCase()}`)
    if (char) mappings[String.fromCodePoint(point)] = char
  }
  return mappings
}

if (import.meta.main) {
  const [tableArg, irgArg] = process.argv.slice(2)
  const table = tableArg ? readFileSync(tableArg, 'utf8') : await (await fetch(URL)).text()
  const irg = readFileSync(irgArg ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'cache', 'unihan', 'Unihan_IRGSources.txt'), 'utf8')
  if (createHash('sha256').update(table).digest('hex') !== SHA256) throw new Error('the CNS table changed; review it before importing')
  if (createHash('sha256').update(irg).digest('hex') !== UNIHAN_SHA256) throw new Error('Unihan_IRGSources.txt changed; review it before importing')
  const data = {
    source: {
      name: 'CNS 11643 open data, plane 15 PUA table, crossed with Unihan kIRG_TSource',
      url: 'https://data.gov.tw/dataset/5961',
      dataUrl: URL,
      retrieved: '2026-11-08',
      sha256: createHash('sha256').update(table).digest('hex'),
      unihanSha256: createHash('sha256').update(irg).digest('hex'),
      licence: 'Open Government Data License 1.0 for the 全字庫 dataset; Unicode License v3 for Unihan.',
    },
    mappings: Object.fromEntries(Object.entries(parseCns(table, irg)).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0)))),
  }
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'cns-pua.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.mappings).length} CNS PUA mappings`)
}
