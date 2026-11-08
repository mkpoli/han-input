import moe from '../data/moe-pua.json' with { type: 'json' }
import hkscs from '../data/hkscs-pua.json' with { type: 'json' }
import variants from '../data/moe-pua-variants.json' with { type: 'json' }

export const MOE_PUA = /** @type {{ source: typeof moe.source, mappings: Record<string, string> }} */ (moe)
export const HKSCS_PUA = /** @type {{ source: typeof hkscs.source, mappings: Record<string, string> }} */ (hkscs)
export const MOE_PUA_VARIANTS = /** @type {{ source: typeof variants.source, byChar: Record<string, { char: string, relation: string }[]> }} */ (variants)

export const PUA_SOURCES = [
  { id: 'moe', source: MOE_PUA.source, mappings: MOE_PUA.mappings },
  { id: 'hkscs', source: HKSCS_PUA.source, mappings: HKSCS_PUA.mappings },
]

/** @param {string} id */
export const puaSource = id => PUA_SOURCES.find(source => source.id === id)

/** @param {string} id */
export const puaEntries = id => Object.entries(puaSource(id)?.mappings ?? {})

/** A character's code point. @param {string} char */
export const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** The characters a PUA code stands for, one per source. @param {string} hex */
export function puaChars(hex) {
  if (!/^[0-9a-f]{4,6}$/i.test(hex)) return []
  const point = parseInt(hex, 16)
  if (point > 0x10FFFF) return []
  const code = String.fromCodePoint(point)
  return PUA_SOURCES.filter(source => code in source.mappings).map(source => ({ char: source.mappings[code], source: source.id }))
}

/** The first character a PUA code stands for. @param {string} hex */
export const puaChar = hex => puaChars(hex)[0]?.char ?? ''

/** @type {Map<string, { code: string, source: string }[]>} */
const BY_CHAR = new Map()
for (const source of PUA_SOURCES) {
  for (const [pua, char] of Object.entries(source.mappings)) {
    const list = BY_CHAR.get(char)
    if (list) list.push({ code: pua, source: source.id })
    else BY_CHAR.set(char, [{ code: pua, source: source.id }])
  }
}

/**
 * A character's PUA codes: its own, then its variants'.
 * @param {string} char
 * @returns {{ code: string, char: string, relation: string, source: string, relationSource?: string }[]}
 */
export function puaOf(char) {
  const own = (BY_CHAR.get(char) ?? []).map(({ code, source }) => ({ code: codePoint(code), char, relation: 'own', source }))
  const related = (MOE_PUA_VARIANTS.byChar[char] ?? []).flatMap(({ char: variant, relation }) =>
    (BY_CHAR.get(variant) ?? []).map(({ code, source }) => ({ code: codePoint(code), char: variant, relation, source, relationSource: 'unihan' })))
  return [...own, ...related]
}

/** Convert one source's assignments, leaving other text as it is. @param {string} text @param {string} [sourceId] */
export function convertPua(text, sourceId = 'moe') {
  const mappings = puaSource(sourceId)?.mappings ?? MOE_PUA.mappings
  let converted = 0
  let unmapped = 0
  let output = ''
  for (const char of text) {
    const mapped = mappings[char]
    if (mapped) { output += mapped; converted++ }
    else {
      output += char
      if (/\p{Co}/u.test(char)) unmapped++
    }
  }
  return { text: output, converted, unmapped }
}
