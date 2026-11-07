// bun scripts/import_moe_pua.mjs [downloaded wordbooks.js]
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const URL = 'https://happyhakka.moe.edu.tw/crechar/wordbooks.js'
const SHA256 = '685336386d696c30114ab779ebafef2bbb56a098f22de60f1f6ef68475d16923'

/** Parse the official data as JSON without executing its JavaScript. @param {string} body */
export function parseMoeWordbooks(body) {
  const match = body.match(/^\s*var wordbooks\s*=\s*(\[[\s\S]*\])\s*;?\s*$/)
  if (!match) throw new Error('Unrecognized MOE wordbooks format')
  /** @type {{ str: string, str2: string | null, str3: string | null }[]} */
  const rows = JSON.parse(match[1])
  /** @type {Record<string, string>} */
  const mappings = {}
  for (const row of rows) {
    if (typeof row.str !== 'string' || [...row.str].length !== 1 || /\p{Co}/u.test(row.str)) throw new Error('Invalid Unicode target')
    for (const alias of [row.str2, row.str3]) {
      if (alias === null) continue
      if (typeof alias !== 'string' || !/^\p{Co}$/u.test(alias)) throw new Error('Invalid PUA alias')
      if (mappings[alias] && mappings[alias] !== row.str) throw new Error('Conflicting PUA alias')
      mappings[alias] = row.str
    }
  }
  return Object.fromEntries(Object.entries(mappings).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))))
}

if (import.meta.main) {
  const response = process.argv[2] ? null : await fetch(URL)
  if (response && !response.ok) throw new Error(`MOE download failed: ${response.status}`)
  const body = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await /** @type {Response} */ (response).text()
  if (createHash('sha256').update(body).digest('hex') !== SHA256) throw new Error('MOE source checksum changed; review before importing')
  const data = {
    source: {
      name: '教育部・自造字轉換字碼工具',
      url: 'https://happyhakka.moe.edu.tw/crechar/index.html',
      dataUrl: URL,
      retrieved: '2026-11-07',
      sha256: SHA256,
      licence: '©2024 Ministry of Education, R.O.C. All rights reserved. No separate data licence stated.',
    },
    mappings: parseMoeWordbooks(body),
  }
  mkdirSync(new globalThis.URL('../data/', import.meta.url), { recursive: true })
  writeFileSync(new globalThis.URL('../data/moe-pua.json', import.meta.url), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.mappings).length} MOE PUA mappings`)
}
