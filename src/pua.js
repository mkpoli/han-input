import snapshot from '../data/moe-pua.json' with { type: 'json' }

export const MOE_PUA = /** @type {{ source: typeof snapshot.source, mappings: Record<string, string> }} */ (snapshot)

/** A character's Unicode code point. @param {string} char */
export const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** Convert only the MOE font assignments; preserve all other text exactly. @param {string} text */
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
