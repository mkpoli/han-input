// CNS_source.txt defines the source recorded when a CNS code was registered.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isEncodedGlyph } from '../charset-members.mjs'

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

/** @param {string} sourceText @param {string[]} mappings */
export function cnsSourceSets(sourceText, mappings) {
  /** @type {Map<string,Set<string>>} */
  const unicode = new Map()
  for (const text of mappings) for (const [rawCns, hex] of rows(text)) {
    const cns = cnsKey(rawCns)
    const cp = parseInt(hex, 16)
    if (!/^[0-9A-F]{4,6}$/i.test(hex) || cp > 0x10FFFF || cp >= 0xD800 && cp <= 0xDFFF) throw new Error('Invalid CNS Unicode mapping')
    if (!unicode.has(cns)) unicode.set(cns, new Set())
    unicode.get(cns)?.add(hex.toUpperCase())
  }
  /** @type {Map<string, {cns:string,unicode:string[]}[]>} */
  const categories = new Map()
  for (const [rawCns, label] of rows(sourceText)) {
    const cns = cnsKey(rawCns)
    if (!categories.has(label)) categories.set(label, [])
    categories.get(label)?.push({ cns, unicode: [...unicode.get(cns) ?? []] })
  }
  return [...categories].map(([label, records]) => {
    const chars = new Set()
    for (const record of records) for (const hex of record.unicode) {
      const cp = parseInt(hex, 16)
      if (cp > 0x10FFFF || cp >= 0xD800 && cp <= 0xDFFF) throw new Error('Invalid Unicode scalar')
      const glyph = String.fromCodePoint(cp)
      if (isEncodedGlyph(glyph)) chars.add(glyph)
    }
    const members = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')
    return { id: `cns_source_${createHash('sha256').update(label).digest('hex').slice(0, 12)}`, label, members, records }
  }).sort((a, b) => [...b.members].length - [...a.members].length || b.records.length - a.records.length || a.label.localeCompare(b.label))
}

/** @param {string} properties @param {string} mapping */
export function readCnsSourceSets(properties, mapping) {
  const text = (/** @type {string} */ zip, /** @type {string} */ member) => execFileSync('unzip', ['-p', zip, member], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return cnsSourceSets(text(properties, 'CNS_source.txt'), ['BMP', '2', '3', '15'].map(plane => text(mapping, `Unicode/CNS2UNICODE_Unicode ${plane}.txt`)))
}
