// BabelStone's IDS: which characters each part is written in, the part's own parts included.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'

export const IDS_SOURCE = {
  name: 'BabelStone IDS.TXT',
  url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
  licence: 'Freely available; terms stated in the file header',
  attribution: 'Andrew West',
}

/** @returns {Promise<Map<string, string[]>>} a part to the characters containing it, at any depth */
export async function buildParts() {
  const text = readFileSync(await fetchOnce(IDS_SOURCE.url, 'babelstone-IDS.TXT'), 'utf8')
  /** @type {Map<string, Set<string>>} */
  const direct = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('U+')) continue
    const [, char, ...sequences] = line.split('\t')
    const parts = new Set()
    for (const sequence of sequences) {
      for (const c of sequence.replace(/\$.*$/, '')) {
        if (/\p{Script=Han}|[⺀-⿟㇀-㇯]/u.test(c) && c !== char) parts.add(c)
      }
    }
    if (parts.size) direct.set(char, parts)
  }
  /** @type {Map<string, Set<string>>} */
  const memo = new Map()
  /** @param {string} char @param {Set<string>} path */
  const expand = (char, path) => {
    const known = memo.get(char)
    if (known) return known
    const all = new Set()
    for (const part of direct.get(char) ?? []) {
      if (path.has(part)) continue
      all.add(part)
      path.add(part)
      for (const deeper of expand(part, path)) all.add(deeper)
      path.delete(part)
    }
    memo.set(char, all)
    return all
  }
  /** @type {Map<string, string[]>} */
  const inverted = new Map()
  for (const char of direct.keys()) {
    for (const part of expand(char, new Set([char]))) {
      if (!inverted.has(part)) inverted.set(part, [])
      ;/** @type {string[]} */ (inverted.get(part)).push(char)
    }
  }
  return inverted
}
