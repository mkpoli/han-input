// 字統's row index is local to its source; only the glyph column can establish membership.
import { inScope } from '../src/fold.js'
/** @param {unknown} input */
export function mappedMembers(input) {
  if (!input || typeof input !== 'object' || !('rows' in input) || !Array.isArray(input.rows)) throw new Error('Invalid character-set rows')
  const members = new Set()
  for (const row of input.rows) {
    if (!Array.isArray(row) || typeof row[1] !== 'string') throw new Error('Invalid character-set member')
    const glyph = row[1]
    // IDS strings, variation sequences, replacement markers and PUA slots have no scalar membership.
    if ([...glyph].length !== 1 || !isEncodedGlyph(glyph)) continue
    members.add(glyph)
  }
  return { members: [...members].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join(''), total: input.rows.length }
}

/** Explicit example glyphs in IWDS; components expressed as IDS are not whole characters.
 * @param {string} xml */
export function iwdsMembers(xml) {
  const rows = []
  const evidence = []
  for (const entry of xml.matchAll(/<entry\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/entry>/g)) {
    for (const field of entry[2].matchAll(/<(components|unified|disunified|compatibles|SourceCodeSeparation|single)\b([^>]*)>([^<]*)<\/\1>/g)) {
      const value = `${field[2].match(/char="([^"]+)"/)?.[1] ?? ''}${field[3]}`
      for (const glyph of scalarExpressions(value)) {
        rows.push([entry[1], glyph])
        evidence.push({ entry: entry[1], role: field[1], char: glyph })
      }
    }
  }
  return { ...mappedMembers({ rows }), evidence, total: [...xml.matchAll(/<entry\b/g)].length }
}

/** Top-level scalar forms only: an IDS operand is not a member of its enclosing glyph.
 * @param {string} value */
export function scalarExpressions(value) {
  const glyphs = [...value.matchAll(/.[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]?/gu)].map(match => match[0])
  /** @param {number} at @returns {number} */
  function skip(at) {
    const cp = glyphs[at]?.codePointAt(0) ?? 0
    const arity = cp === 0x2FF2 || cp === 0x2FF3 ? 3 : cp === 0x2FFC || cp === 0x2FFD ? 1
      : cp >= 0x2FF0 && cp <= 0x2FFF || cp === 0x31EF ? 2 : 0
    let end = at + 1
    for (let i = 0; i < arity && end < glyphs.length; i++) end = skip(end)
    return end
  }
  const forms = []
  for (let i = 0; i < glyphs.length;) {
    const end = skip(i)
    if (end === i + 1 && [...glyphs[i]].length === 1 && isEncodedGlyph(glyphs[i])) forms.push(glyphs[i])
    i = end
  }
  return forms
}

/** @param {string} glyph */
export function isEncodedGlyph(glyph) {
  const cp = glyph.codePointAt(0) ?? 0
  return inScope(glyph) || cp >= 0x2E80 && cp <= 0x2FDF || cp >= 0x31C0 && cp <= 0x31E5
}
