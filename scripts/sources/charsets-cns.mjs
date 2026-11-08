// CNS_source.txt defines the source recorded when a CNS code was registered.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

/** @param {string} text */
function rows(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(line => {
    const row = line.split('\t')
    if (row.length !== 2 || !row[0] || !row[1]) throw new Error('Invalid CNS table row')
    return row
  })
}

/** @param {string} input */
function cnsKey(input) {
  const match = input.match(/^([1-9]\d*)-([0-9A-F]{2})([0-9A-F]{2})$/i)
  if (!match || [match[2], match[3]].some(hex => parseInt(hex, 16) < 0x21 || parseInt(hex, 16) > 0x7E)) throw new Error('Invalid CNS grid code')
  return `${match[1]}-${match[2].toUpperCase()}${match[3].toUpperCase()}`
}

/** @param {number} point */
function isPrivateUse(point) {
  return point >= 0xE000 && point <= 0xF8FF
    || point >= 0xF0000 && point <= 0xFFFFD
    || point >= 0x100000 && point <= 0x10FFFD
}

/** The plane prefix in Unihan's kIRG_TSource: T1…T9, TA…TF. @param {string} cns */
function sourceKey(cns) {
  const [plane, code] = cns.split('-')
  const number = Number(plane)
  return number >= 1 && number <= 15 ? `T${number.toString(16).toUpperCase()}-${code}` : ''
}

/** Unihan kIRG_TSource as CNS source code to Unicode hex.
 * @param {string} text @returns {Map<string,string>} */
export function unihanTSources(text) {
  /** @type {Map<string,string>} */
  const sources = new Map()
  for (const line of text.split('\n')) {
    if (!line.startsWith('U+')) continue
    const [code, field, value] = line.split('\t')
    if (field !== 'kIRG_TSource' || !value) continue
    const hex = code.slice(2).toUpperCase()
    for (const id of value.trim().split(/\s+/)) {
      if (/^T[0-9A-F]-[0-9A-F]{4}$/i.test(id)) sources.set(id.toUpperCase(), hex)
    }
  }
  return sources
}

/**
 * Every row of a CNS source label is a record. A row joins the set as its assigned scalar(s); a row
 * whose only mappings are private-use joins as those glyph slots. Unihan's T source supplies the
 * scalar for a row that the bulk release still maps to private use (for example TB-7D29 → U+324D6).
 * @param {string} sourceText @param {string[]} mappings
 * @param {Map<string,string>} [unihan] @param {Set<number>} [assigned]
 */
export function cnsSourceSets(sourceText, mappings, unihan = new Map(), assigned = undefined) {
  /** @type {Map<string,Set<string>>} */
  const unicode = new Map()
  for (const text of mappings) for (const [rawCns, hex] of rows(text)) {
    const cns = cnsKey(rawCns)
    const cp = parseInt(hex, 16)
    if (!/^[0-9A-F]{4,6}$/i.test(hex) || cp > 0x10FFFF || cp >= 0xD800 && cp <= 0xDFFF) throw new Error('Invalid CNS Unicode mapping')
    if (!unicode.has(cns)) unicode.set(cns, new Set())
    unicode.get(cns)?.add(hex.toUpperCase())
  }
  /** @type {Map<string, {cns:string,unicode:string[],crosswalk?:string}[]>} */
  const categories = new Map()
  for (const [rawCns, label] of rows(sourceText)) {
    const cns = cnsKey(rawCns)
    if (!categories.has(label)) categories.set(label, [])
    categories.get(label)?.push({ cns, unicode: [...unicode.get(cns) ?? []] })
  }
  const assignedPoint = assigned
    ? (/** @type {number} */ point) => assigned.has(point)
    : (/** @type {number} */ point) => /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Nushu}/u.test(String.fromCodePoint(point))
  return [...categories].map(([label, records]) => {
    const chars = new Set()
    for (const record of records) {
      const scalar = (/** @type {string} */ hex) => {
        const point = parseInt(hex, 16)
        if (point > 0x10FFFF || point >= 0xD800 && point <= 0xDFFF) throw new Error('Invalid Unicode scalar')
        return point
      }
      let real = record.unicode.map(scalar).filter(point => !isPrivateUse(point) && assignedPoint(point))
      if (!real.length && unihan.size) {
        const crosswalk = unihan.get(sourceKey(record.cns))
        if (crosswalk) {
          record.crosswalk = crosswalk
          const point = scalar(crosswalk)
          if (!isPrivateUse(point) && assignedPoint(point)) real = [point]
        }
      }
      const glyphs = real.length ? real : record.unicode.map(scalar).filter(isPrivateUse)
      for (const point of glyphs) chars.add(String.fromCodePoint(point))
    }
    const members = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')
    return { id: `cns_source_${createHash('sha256').update(label).digest('hex').slice(0, 12)}`, label, members, records }
  }).sort((a, b) => [...b.members].length - [...a.members].length || b.records.length - a.records.length || a.label.localeCompare(b.label))
}

/** @param {string} properties @param {string} mapping @param {string} [unihan] @param {Set<number>} [assigned] */
export function readCnsSourceSets(properties, mapping, unihan, assigned) {
  const text = (/** @type {string} */ zip, /** @type {string} */ member) => execFileSync('unzip', ['-p', zip, member], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return cnsSourceSets(
    text(properties, 'CNS_source.txt'),
    ['BMP', '2', '3', '15'].map(plane => text(mapping, `Unicode/CNS2UNICODE_Unicode ${plane}.txt`)),
    unihan ? unihanTSources(unihan) : new Map(),
    assigned,
  )
}
