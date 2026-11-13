// bun scripts/import_pua_cns.mjs
// Every CNS row the bulk release maps to a private-use code point, with its CNS code; Unihan's T source
// gives the Unicode character for the rows assigned since.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchOnce } from './lib.mjs'

const URL = 'https://www.cns11643.gov.tw/opendata/MapingTables.zip'
const TABLE = 'Unicode/CNS2UNICODE_Unicode 15.txt'
const SHA256 = '4502fcf7b433d679dee51127298929543ec7f4aa99be93cd219df1552bc3d2bf'
const UNIHAN_SHA256 = 'e2c484cd22b54f7e0ce896ebb02f33e092b92325accf0fd55e0e14e3863869eb'

/** @param {number} point */
export const isPua = point => (point >= 0xE000 && point <= 0xF8FF) || (point >= 0xF0000 && point <= 0xFFFFD) || (point >= 0x100000 && point <= 0x10FFFD)

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
  /** @type {Record<string, string>} */
  const codes = {}
  for (const line of table.split('\n')) {
    const [cns, unicode] = line.trim().split(/\s+/)
    if (!cns || !unicode) continue
    const point = parseInt(unicode, 16)
    if (!isPua(point)) continue
    const slot = String.fromCodePoint(point)
    if (slot in codes) throw new Error(`${unicode} is mapped twice`)
    codes[slot] = cns
    const char = tSources.get(`t${cns.toLowerCase()}`)
    if (char) mappings[slot] = char
  }
  return { mappings, codes }
}

/** @param {Record<string, string>} record */
const sorted = record => Object.fromEntries(Object.entries(record).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))))

if (import.meta.main) {
  const zip = await fetchOnce(URL)
  if (createHash('sha256').update(readFileSync(zip)).digest('hex') !== SHA256) throw new Error('the CNS mapping archive changed; review it before importing')
  const table = execFileSync('unzip', ['-p', zip, TABLE], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const irg = readFileSync(join(import.meta.dirname, '..', 'cache', 'unihan', 'Unihan_IRGSources.txt'), 'utf8')
  if (createHash('sha256').update(irg).digest('hex') !== UNIHAN_SHA256) throw new Error('Unihan_IRGSources.txt changed; review it before importing')
  const { mappings, codes } = parseCns(table, irg)
  const data = {
    source: {
      name: 'CNS 11643 bulk release 20260805, Unicode plane 15 table, crossed with Unihan kIRG_TSource',
      url: 'https://www.cns11643.gov.tw/',
      dataUrl: URL,
      retrieved: '2026-11-14',
      sha256: SHA256,
      unihanSha256: UNIHAN_SHA256,
      licence: 'Open Government Data License 1.0 for the 全字庫 dataset; Unicode License v3 for Unihan.',
    },
    mappings: sorted(mappings),
  }
  writeFileSync(join(import.meta.dirname, '..', 'data', 'cns-pua.json'), JSON.stringify(data, null, 2) + '\n')
  writeFileSync(join(import.meta.dirname, '..', 'data', 'cns-pua-codes.json'), JSON.stringify({ codes: sorted(codes) }) + '\n')
  console.log(`${Object.keys(codes).length} CNS private-use rows, ${Object.keys(mappings).length} with a Unicode character`)
}
