// Tables from the Rime project and its neighbours: one code column per character.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'

/** The rows of a Rime dictionary: character, code, optional weight, after the `...` that ends the header. @param {string} text */
export function* readRimeDict(text) {
  let body = !/^---/m.test(text)
  for (const line of text.split(/\r?\n/)) {
    if (!body) { if (line.trim() === '...') body = true; continue }
    if (!line || line.startsWith('#')) continue
    const [char, code, weight] = line.split('\t')
    if (!char || !code || [...char].length !== 1) continue
    yield { char, code, weight: parseFloat(weight) || 0 }
  }
}

/** The rows of a .cin table between %chardef begin and end. @param {string} text */
export function* readCin(text) {
  let body = false
  for (const line of text.split(/\r?\n/)) {
    if (/^%chardef\s+begin/i.test(line)) { body = true; continue }
    if (/^%chardef\s+end/i.test(line)) { body = false; continue }
    if (!body || !line) continue
    const [code, char] = line.split(/\s+/)
    if (code && char && [...char].length === 1) yield { char, code, weight: 0 }
  }
}

/** Rows by descending weight, so the likelier character comes first under its code. @param {Iterable<{ char: string, code: string, weight: number }>} rows @returns {[string, string][]} */
export const byWeight = rows => [...rows].sort((a, b) => b.weight - a.weight).map(row => [row.code, row.char])

/** @param {{ repo: string, ref?: string, file: string | string[], id: string, en: string, zh: string, family?: import('../lib.mjs').Family, ja?: string, licence: string, attribution?: string, keys?: string }} t @returns {Promise<import('../lib.mjs').Method>} */
export async function rimeMethod(t) {
  const files = [t.file].flat()
  const urls = files.map(file => `https://raw.githubusercontent.com/${t.repo}/${t.ref ?? 'master'}/${file}`)
  const rows = []
  for (const url of urls) rows.push(...readRimeDict(readFileSync(await fetchOnce(url), 'utf8')))
  return {
    id: t.id, family: t.family ?? 'shape', keys: t.keys,
    names: { en: t.en, zh: t.zh, ja: t.ja },
    source: { name: `${t.repo}, ${files.join(', ')}`, url: urls[0], licence: t.licence, attribution: t.attribution },
    entries: byWeight(rows),
  }
}
