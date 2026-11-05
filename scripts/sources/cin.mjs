// The .cin tables of chinese-opendesktop/cin-tables. Each file's own header is the statement of its
// terms; the names and kinds are in cin-tables.json.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'
import { byWeight, readCin } from './rime.mjs'
import TABLES from './cin-tables.json' with { type: 'json' }

const REPO = 'https://github.com/chinese-opendesktop/cin-tables'
const TERMS = /授權|版權|著作權|licen[cs]e|copyright|免費供/i

/** The header's line about terms, or the repository's licence where the file has none. @param {string} text */
function termsOf(text) {
  for (const line of text.split(/\r?\n/)) {
    if (/^%chardef/i.test(line)) break
    if (line.startsWith('#') && TERMS.test(line)) return line.replace(/^#+\s*/, '').slice(0, 140)
  }
  return 'None stated in the file; the repository as a whole is CC0-1.0'
}

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function cinMethods() {
  /** @type {import('../lib.mjs').Method[]} */
  const out = []
  for (const table of TABLES) {
    const url = `https://raw.githubusercontent.com/chinese-opendesktop/cin-tables/HEAD/${table.file}.cin`
    const text = readFileSync(await fetchOnce(url), 'utf8')
    out.push({
      id: `cin-${table.file.replace(/[^\w-]/g, '_')}`, family: /** @type {import('../lib.mjs').Family} */ (table.family),
      names: { en: table.en, zh: table.zh },
      source: { name: `${table.file}.cin, cin-tables`, url: `${REPO}/blob/HEAD/${table.file}.cin`, licence: termsOf(text) },
      entries: byWeight(readCin(text)),
    })
  }
  return out
}
