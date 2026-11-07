import snapshot from '../data/moe-pua.json' with { type: 'json' }
import variants from '../data/moe-pua-variants.json' with { type: 'json' }

export const MOE_PUA = /** @type {{ source: typeof snapshot.source, mappings: Record<string, string> }} */ (snapshot)
export const MOE_PUA_VARIANTS = /** @type {{ source: typeof variants.source, byChar: Record<string, { char: string, relation: string }[]> }} */ (variants)

/** A character's code point. @param {string} char */
export const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** The character a PUA code stands for, from hex without U+. @param {string} hex */
export function puaChar(hex) {
  if (!/^[0-9a-f]{4,6}$/i.test(hex)) return ''
  const point = parseInt(hex, 16)
  if (point > 0x10FFFF) return ''
  return MOE_PUA.mappings[String.fromCodePoint(point)] ?? ''
}

/** @type {Map<string, string[]>} */
const BY_CHAR = new Map()
for (const [pua, char] of Object.entries(MOE_PUA.mappings)) {
  const list = BY_CHAR.get(char)
  if (list) list.push(pua)
  else BY_CHAR.set(char, [pua])
}

/**
 * A character's PUA codes: its own, then its variants'.
 * @param {string} char
 * @returns {{ code: string, char: string, relation: 'own' | string }[]}
 */
export function puaOf(char) {
  const own = (BY_CHAR.get(char) ?? []).map(code => ({ code: codePoint(code), char, relation: 'own' }))
  const related = (MOE_PUA_VARIANTS.byChar[char] ?? []).flatMap(({ char: variant, relation }) =>
    (BY_CHAR.get(variant) ?? []).map(code => ({ code: codePoint(code), char: variant, relation })))
  return [...own, ...related]
}

/** Convert the MOE assignments, leaving other text as it is. @param {string} text */
export function convertMoePua(text) {
  let converted = 0
  let unmapped = 0
  let output = ''
  for (const char of text) {
    const mapped = MOE_PUA.mappings[char]
    if (mapped) { output += mapped; converted++ }
    else {
      output += char
      if (/\p{Co}/u.test(char)) unmapped++
    }
  }
  return { text: output, converted, unmapped }
}
