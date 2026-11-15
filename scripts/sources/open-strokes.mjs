// Stroke orders for the characters CNS 全字庫 gives none, from IDS Workshop's open release: written
// from the components of a character's description, borrowed from another source, read inside the
// characters a radical form is written in, or entered by hand. In CNS's numbering, 1–5.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fetchOnce, sha256 } from '../lib.mjs'

/** The release as the sibling project's repository holds it at this commit, each file by its SHA-256. */
const COMMIT = '68da026c07b78aecb165212863dd06a3291c9cd0'
const FILES = /** @type {const} */ ({
  'induced.tsv.gz': '9438691aa59b80b208bacaae129f2c2b4125b86bc1097745f8994827d6542cb4',
  'entered.tsv': 'aa9a3207a46ff1a4393b29f0a331ad984c6c441329a53e33045d119ae38306d2',
})
const SOURCE = {
  name: 'IDS Workshop, open stroke orders: the rows of induced.tsv.gz and entered.tsv written for CNS 全字庫',
  url: `https://github.com/mkpoli/ids-input/tree/${COMMIT}/data/open-strokes`,
  licence: 'Each row keeps the terms of what it is written from: CNS 全字庫 under the Open Government Data License 1.0, Rime’s stroke dictionary under LGPL-3.0 and KanjiVG under CC BY-SA 3.0 where a row borrows from them; entered rows CC0-1.0',
  attribution: '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。 Rime stroke dictionary: 四季的風, 雪齋, Kunki Chou, 宋天. KanjiVG, https://kanjivg.tagaini.net, © Ulrich Apel.',
  version: COMMIT.slice(0, 12),
  note: 'Predictions and hand-entered readings, not records: the release’s README gives each basis and how often the rules agree with the sources.',
}

/**
 * The orders written for one source, each code with its character. Both files open with a header
 * row; `orders` holds one code per way of writing the character, separated by a space.
 * @param {string} induced `char codepoint orders basis from source ids lent`
 * @param {string} entered `char codepoint orders basis by source date`
 * @param {string} [source]
 * @returns {[string, string][]}
 */
export function openStrokeRows(induced, entered, source = 'cns11643') {
  /** @type {[string, string][]} */
  const out = []
  for (const text of [induced, entered]) {
    for (const line of text.split('\n').slice(1)) {
      const cells = line.split('\t')
      if (cells[5] !== source || !cells[0] || !cells[2]) continue
      for (const code of cells[2].split(' ')) out.push([code, cells[0]])
    }
  }
  return out
}

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function openStrokeMethods() {
  /** @type {Record<string, Buffer>} */
  const files = {}
  for (const [name, digest] of Object.entries(FILES)) {
    const path = await fetchOnce(`https://raw.githubusercontent.com/mkpoli/ids-input/${COMMIT}/data/open-strokes/${name}`, `ids-input-open-strokes-${COMMIT.slice(0, 12)}-${name}`)
    if (sha256(path) !== digest) throw new Error(`${name} is not the file pinned for the open stroke orders`)
    files[name] = readFileSync(path)
  }
  return [{
    id: 'open-stroke-order', family: 'index', keys: '1–5',
    names: { en: 'Stroke order (IDS Workshop, beyond CNS 全字庫)', zh: '筆順（IDS工坊，全字庫未收字）', ja: '筆順（IDS工房、全字庫にない字）' },
    about: 'Strokes in writing order for the characters CNS 全字庫 leaves out: 1 horizontal, 2 vertical, 3 left-falling, 4 dot, 5 turning. Each order is induced from the character’s parts, borrowed from Rime or KanjiVG, or entered by hand.',
    source: SOURCE,
    entries: openStrokeRows(gunzipSync(files['induced.tsv.gz']).toString('utf8'), files['entered.tsv'].toString('utf8')),
  }]
}
