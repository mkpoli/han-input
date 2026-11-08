import moe from '../data/moe-pua.json' with { type: 'json' }
import hkscs from '../data/hkscs-pua.json' with { type: 'json' }
import hanyang from '../data/hanyang-pua.json' with { type: 'json' }
import variants from '../data/moe-pua-variants.json' with { type: 'json' }

export const MOE_PUA = /** @type {{ source: typeof moe.source, mappings: Record<string, string> }} */ (moe)
export const HKSCS_PUA = /** @type {{ source: typeof hkscs.source, mappings: Record<string, string> }} */ (hkscs)
export const HANYANG_PUA = /** @type {{ source: typeof hanyang.source, mappings: Record<string, string> }} */ (hanyang)
export const MOE_PUA_VARIANTS = /** @type {{ source: typeof variants.source, byChar: Record<string, { char: string, relation: string }[]> }} */ (variants)

export const PUA_SOURCES = [
  { id: 'moe', source: MOE_PUA.source, mappings: MOE_PUA.mappings },
  { id: 'hkscs', source: HKSCS_PUA.source, mappings: HKSCS_PUA.mappings },
  { id: 'hanyang', source: HANYANG_PUA.source, mappings: HANYANG_PUA.mappings },
]

/** @param {string} id */
export const puaSource = id => PUA_SOURCES.find(source => source.id === id)

/** @param {string} id */
export const puaEntries = id => Object.entries(puaSource(id)?.mappings ?? {})

/** Every row of one source, or of all sources. @param {string} id */
export function puaTable(id) {
  const sources = id === 'all' ? PUA_SOURCES : PUA_SOURCES.filter(source => source.id === id)
  return sources.flatMap(source => Object.entries(source.mappings).map(([legacy, standard]) => ({ legacy, standard, source: source.id })))
    .sort((a, b) => /** @type {number} */ (a.legacy.codePointAt(0)) - /** @type {number} */ (b.legacy.codePointAt(0)) || a.source.localeCompare(b.source))
}

/** A character's code point. @param {string} char */
export const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** Every code point of a string. @param {string} text */
export const codePoints = text => [...text].map(codePoint).join(' ')

/** The characters a PUA code stands for, one per source. @param {string} hex */
export function puaChars(hex) {
  if (!/^[0-9a-f]{4,6}$/i.test(hex)) return []
  const point = parseInt(hex, 16)
  if (point > 0x10FFFF) return []
  const code = String.fromCodePoint(point)
  return PUA_SOURCES.filter(source => code in source.mappings && [...source.mappings[code]].length === 1).map(source => ({ char: source.mappings[code], source: source.id }))
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

/** Convert one source, or every source where they agree. @param {string} text @param {string} [sourceId] */
export function convertPua(text, sourceId = 'moe') {
  const sources = sourceId === 'all' ? PUA_SOURCES : PUA_SOURCES.filter(source => source.id === sourceId)
  let converted = 0
  let unmapped = 0
  let ambiguous = 0
  let output = ''
  for (const char of text) {
    const targets = new Set(sources.map(source => source.mappings[char]).filter(Boolean))
    const [target] = targets
    if (targets.size === 1) { output += target; converted++ }
    else if (targets.size === 0) {
      output += char
      if (/\p{Co}/u.test(char)) unmapped++
    } else {
      output += char
      ambiguous++
    }
  }
  return { text: output, converted, unmapped, ambiguous }
}
