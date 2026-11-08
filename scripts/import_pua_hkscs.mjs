// bun scripts/import_pua_hkscs.mjs [hkscs-2008-big5-iso.txt]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const URL = 'https://www.ccli.gov.hk/doc/hkscs-2008-big5-iso.txt'
const SHA256 = 'f52001a4452cc2c790ac5f255b26be3d8d6e24c9a3867f0d271e21f4359bb266'

/** PUA code points of ISO/IEC 10646-1:1993 to the Unicode 2003 character. @param {string} body */
export function parseHkscs(body) {
  /** @type {Record<string, string>} */
  const mappings = {}
  for (const line of body.split('\n')) {
    if (!/^[0-9A-F]/.test(line)) continue
    const [big5, iso93, , iso03] = line.trim().split(/\s+/)
    if (!big5 || !/^[0-9A-F]{4}$/.test(iso93) || !/^[0-9A-F]{4,6}$/.test(iso03)) continue
    const from = parseInt(iso93, 16)
    const to = parseInt(iso03, 16)
    if (from < 0xE000 || from > 0xF8FF || (to >= 0xE000 && to <= 0xF8FF) || to > 0x10FFFF) continue
    mappings[String.fromCodePoint(from)] = String.fromCodePoint(to)
  }
  return Object.fromEntries(Object.entries(mappings).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))))
}

if (import.meta.main) {
  const input = process.argv[2]
  const body = input ? readFileSync(input, 'utf8') : await (await fetch(URL)).text()
  const sha256 = createHash('sha256').update(body).digest('hex')
  if (sha256 !== SHA256) throw new Error('the HKSCS table changed; review it before importing')
  const data = {
    source: {
      name: 'HKSCS-2008 mapping table',
      url: 'https://www.ccli.gov.hk/en/archive/mapping_table_2008.html',
      dataUrl: URL,
      retrieved: '2026-11-08',
      sha256,
      licence: 'Government of the Hong Kong SAR. The CCLI Terms of Use grant use and restrict copying, adaptation and distribution; the code-point mapping is used here as factual data.',
    },
    mappings: parseHkscs(body),
  }
  writeFileSync(join(import.meta.dirname, '..', 'data', 'hkscs-pua.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.mappings).length} HKSCS PUA mappings`)
}
