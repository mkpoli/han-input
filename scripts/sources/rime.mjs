// Tables from the Rime project and its neighbours: one code column per character.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'

/** The rows of a Rime dictionary: character, code, optional weight, after the `...` that ends the header. @param {string} text */
export function* readRimeDict(text) {
  let body = !/^---/m.test(text)
  let columns = ['text', 'code', 'weight']
  /** @type {string[] | null} */
  let reading = null
  for (const line of text.split(/\r?\n/)) {
    if (!body) {
      if (line.trim() === '...') { body = true; if (reading?.length) columns = reading; continue }
      if (/^columns:/.test(line)) { reading = []; continue }
      const item = line.match(/^\s+-\s*(\w+)/)
      if (item && reading) reading.push(item[1])
      else if (reading && !item && reading.length) { columns = reading; reading = null }
      continue
    }
    if (!line || line.startsWith('#')) continue
    const cells = line.split('\t')
    const char = cells[columns.indexOf('text')]
    const code = cells[columns.indexOf('code')]
    if (!char || !code || [...char].length !== 1) continue
    yield { char, code, weight: parseFloat(cells[columns.indexOf('weight')]) || 0 }
  }
}

/**
 * Rime's spelling algebra, the rules that turn a table's syllables into what is typed. Double pinyin
 * and the bopomofo keyboards are these rules over a pinyin table.
 * @param {string} schema the schema.yaml text
 * @returns {((code: string) => string[])}
 */
export function algebraOf(schema) {
  // Only the speller's own list: a schema's other rules, such as preedit_format, undo these for display.
  const lines = schema.split(/\r?\n/)
  const speller = lines.findIndex(line => /^speller:/.test(line))
  const start = lines.findIndex((line, i) => i > speller && /^\s+algebra:/.test(line))
  /** @type {string[]} */
  const list = []
  if (speller >= 0 && start >= 0) {
    for (const line of lines.slice(start + 1)) {
      if (/^\s*#/.test(line) || !line.trim()) continue
      const item = line.match(/^\s+-\s*(.+?)\s*(?:#.*)?$/)
      if (!item) break
      list.push(item[1].replace(/^["']|["']$/g, ''))
    }
  }
  const rules = list.filter(rule => /^(xform|derive|xlit|erase|abbrev|fuzz)\W/.test(rule)).map(rule => {
    const separator = rule.match(/^\w+(\W)/)?.[1] ?? '/'
    const [op, from, to] = rule.split(separator)
    if (op === 'xlit') {
      const a = [...from]
      const b = [...to]
      return { op, map: new Map(a.map((c, i) => [c, b[i]])) }
    }
    return { op, from: new RegExp(from, 'g'), to: (to ?? '').replace(/\\(\d)/g, '$$$1') }
  })
  return code => {
    let forms = new Set([code])
    for (const rule of rules) {
      const next = new Set(rule.op === 'derive' || rule.op === 'abbrev' || rule.op === 'fuzz' ? forms : [])
      for (const form of forms) {
        if (rule.op === 'xlit') { next.add([...form].map(c => rule.map?.get(c) ?? c).join('')); continue }
        const pattern = /** @type {RegExp} */ (rule.from)
        pattern.lastIndex = 0
        if (rule.op === 'erase') { pattern.lastIndex = 0; if (!pattern.test(form)) next.add(form); continue }
        if (rule.op === 'abbrev') continue
        next.add(form.replace(pattern, /** @type {string} */ (rule.to)))
      }
      forms = next
    }
    return [...forms].filter(Boolean)
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

/**
 * A method spelled from a pinyin table by a schema's algebra.
 * @param {{ repo: string, schema: string, id: string, en: string, zh: string, table: Iterable<{ char: string, code: string, weight: number }>, licence: string, tableName: string }} t
 * @returns {Promise<import('../lib.mjs').Method>}
 */
export async function algebraMethod(t) {
  const url = `https://raw.githubusercontent.com/${t.repo}/HEAD/${t.schema}`
  const spell = algebraOf(readFileSync(await fetchOnce(url), 'utf8'))
  /** @type {[string, string][]} */
  const rows = []
  for (const row of t.table) for (const form of spell(row.code.replace(/\s+/g, ''))) rows.push([form, row.char])
  return {
    id: t.id, family: 'reading', names: { en: t.en, zh: t.zh },
    source: { name: `${t.repo}, ${t.schema}, over ${t.tableName}`, url: `https://github.com/${t.repo}/blob/HEAD/${t.schema}`, licence: t.licence },
    about: 'The schema’s spelling rules applied to the pinyin table.',
    entries: rows,
  }
}

/** @param {{ repo: string, ref?: string, file: string | string[], id: string, en: string, zh: string, family?: import('../lib.mjs').Family, ja?: string, licence: string, attribution?: string, keys?: string }} t @returns {Promise<import('../lib.mjs').Method>} */
export async function rimeMethod(t) {
  const files = [t.file].flat()
  const urls = files.map(file => `https://raw.githubusercontent.com/${t.repo}/${t.ref ?? 'HEAD'}/${file}`)
  const rows = []
  for (const url of urls) rows.push(...readRimeDict(readFileSync(await fetchOnce(url), 'utf8')))
  return {
    id: t.id, family: t.family ?? 'shape', keys: t.keys,
    names: { en: t.en, zh: t.zh, ja: t.ja },
    source: { name: `${t.repo}, ${files.join(', ')}`, url: urls[0], licence: t.licence, attribution: t.attribution },
    entries: byWeight(rows),
  }
}
