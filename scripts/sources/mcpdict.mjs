// The shape tables carried in 漢字音典 (MCPDict), read from the database in its release APK.
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { CACHE } from '../lib.mjs'

const SOURCE = (/** @type {string} */ file, /** @type {string} */ upstream) => ({
  name: `${file}, as carried by 漢字音典 (MCPDict) 20261104`,
  url: upstream,
  licence: 'MCPDict repository MIT; no separate terms checked for this table',
  attribution: 'osfans and contributors, from the upstream linked here',
})
const WUBI = 'https://github.com/CNMan/UnicodeCJK-WuBi'
const MCPDICT = 'https://github.com/osfans/MCPDict'

/** @type {[string, string, string, string, string, string][]} id, column, English, 漢字 name, file, upstream */
const COLUMNS = [
  ['wubihua', 'c13', 'Five-stroke order', '五筆畫', 'wb.csv', WUBI],
  ['wubi98', 'c15', 'Wubi 98', '五筆字型 98', 'wb.csv', WUBI],
  ['wubi06', 'c16', 'Wubi 06', '五筆字型 06', 'wb.csv', WUBI],
  ['cangjie3', 'c17', 'Cangjie 3', '倉頡三代', 'cj3.txt', MCPDICT],
  ['cangjie6', 'c19', 'Cangjie 6', '倉頡六代', 'cangjie6.dict.yaml', MCPDICT],
  ['shanren', 'c20', 'Shanren', '山人', 'ShanRenMaLTS.words.dict.yaml', 'https://github.com/siuze/ShanRenMaLTS'],
  ['liangfen', 'c10', 'Liangfen', '兩分', 'liangfen.dict.yaml', MCPDICT],
]

/** @returns {import('../lib.mjs').Method[]} */
export function mcpdictMethods() {
  const db = new Database(join(CACHE, 'mcpdict/x/assets/databases/mcpdict.db'), { readonly: true })
  return COLUMNS.map(([id, column, en, zh, file, upstream]) => ({
    id, family: /** @type {const} */ ('shape'), names: { en, zh }, source: SOURCE(file, upstream),
    entries: /** @type {{ c0: string, code: string | null }[]} */ (db.query(`select c0, ${column} as code from mcpdict_content where ${column} is not null`).all())
      .flatMap(row => (row.code ?? '').split(/\s+/).filter(Boolean).map(code => /** @type {[string, string]} */ ([code, row.c0]))),
  }))
}
