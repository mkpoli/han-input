// One private-use code point means different things in different schemes: a font's own slots, a
// standard's table, a corpus's reserved range. Each scheme maps its slots to Unicode where it can and,
// where it names its slots, gives each one the scheme's own code (a CNS code, a CB code). Every scheme
// is kept apart, so a slot two schemes share keeps both readings.

/** @typedef {{ name: string, url: string, dataUrl?: string, retrieved?: string, sha256?: string, licence?: string, version?: string }} PuaSource */
/** @typedef {{ id: string, source: PuaSource, mappings: Record<string, string>, records?: string }} PuaScheme */
/** @typedef {{ source: string, slot: string, code: string, char: string, records?: string }} PuaReading */

const SCHEMES = [
  { id: 'moe', load: () => import('../data/moe-pua.json') },
  { id: 'hkscs', load: () => import('../data/hkscs-pua.json') },
  { id: 'hanyang', load: () => import('../data/hanyang-pua.json') },
  { id: 'cns', load: () => import('../data/cns-pua.json'), codes: () => import('../data/cns-pua-codes.json') },
  { id: 'gb18030', load: () => import('../data/gb18030-pua.json') },
  // CBETA reserves U+F0000 plus a CB code's number; a slot without a Unicode character is a record of
  // the CBETA缺字 character set.
  { id: 'cbeta', load: () => import('../data/cbeta-pua.json'), codes: () => import('../data/cbeta-pua-codes.json'), records: 'cbeta_gaiji' },
]

export const PUA_SCHEME_IDS = SCHEMES.map(scheme => scheme.id)

/** Whether a code point is in one of the three private-use areas. @param {number} point */
export const isPuaPoint = point => (point >= 0xE000 && point <= 0xF8FF) || (point >= 0xF0000 && point <= 0xFFFFD) || (point >= 0x100000 && point <= 0x10FFFD)

/** Whether a string is one private-use character. @param {string} text */
export const isPuaChar = text => [...text].length === 1 && isPuaPoint(/** @type {number} */ (text.codePointAt(0)))

/** A character's code point. @param {string} char */
export const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/** Every code point of a string. @param {string} text */
export const codePoints = text => [...text].map(codePoint).join(' ')

/** The private-use character a hex code names, or ''. @param {string} hex */
export function puaSlot(hex) {
  const match = hex.match(/^(?:[uU]\+?)?([0-9a-fA-F]{4,6})$/)
  if (!match) return ''
  const point = parseInt(match[1], 16)
  return isPuaPoint(point) ? String.fromCodePoint(point) : ''
}

/**
 * The lookups over a set of loaded schemes. Pure, so tests and scripts can build one from the files.
 * @param {PuaScheme[]} schemes
 * @param {{ byChar: Record<string, { char: string, relation: string }[]> }} variants
 */
export function makePua(schemes, variants) {
  /** @type {Map<string, { code: string, source: string }[]>} */
  const byChar = new Map()
  for (const scheme of schemes) {
    for (const [slot, char] of Object.entries(scheme.mappings)) {
      const list = byChar.get(char)
      if (list) list.push({ code: slot, source: scheme.id })
      else byChar.set(char, [{ code: slot, source: scheme.id }])
    }
  }
  /** @param {string} id */
  const chosen = id => id === 'all' ? schemes : schemes.filter(scheme => scheme.id === id)

  return {
    schemes,
    variants,
    /** @param {string} id */
    scheme: id => schemes.find(scheme => scheme.id === id),
    /** The characters a private-use code stands for, one per scheme. @param {string} hex */
    chars(hex) {
      const slot = puaSlot(hex)
      return slot ? schemes.filter(scheme => slot in scheme.mappings && [...scheme.mappings[slot]].length === 1).map(scheme => ({ char: scheme.mappings[slot], source: scheme.id })) : []
    },
    /**
     * A character's private-use codes: its own, then its variants'.
     * @param {string} char
     * @returns {{ code: string, char: string, relation: string, source: string, relationSource?: string }[]}
     */
    of(char) {
      const own = (byChar.get(char) ?? []).map(({ code, source }) => ({ code: codePoint(code), char, relation: 'own', source }))
      const related = (variants.byChar[char] ?? []).flatMap(({ char: variant, relation }) =>
        (byChar.get(variant) ?? []).map(({ code, source }) => ({ code: codePoint(code), char: variant, relation, source, relationSource: 'unihan' })))
      return [...own, ...related]
    },
    /** Every row of one scheme, or of all. @param {string} id */
    table(id) {
      return chosen(id).flatMap(scheme => Object.entries(scheme.mappings).map(([legacy, standard]) => ({ legacy, standard, source: scheme.id })))
        .sort((a, b) => /** @type {number} */ (a.legacy.codePointAt(0)) - /** @type {number} */ (b.legacy.codePointAt(0)) || a.source.localeCompare(b.source))
    },
    /** Convert one scheme, or every scheme where they agree. @param {string} text @param {string} [id] */
    convert(text, id = 'moe') {
      const sources = chosen(id)
      let converted = 0
      let unmapped = 0
      let ambiguous = 0
      let output = ''
      /** @type {{ code: string, options: { char: string, source: string }[] }[]} */
      const conflicts = []
      for (const char of text) {
        const options = sources.flatMap(scheme => char in scheme.mappings ? [{ char: scheme.mappings[char], source: scheme.id }] : [])
        const targets = new Set(options.map(option => option.char))
        const [target] = targets
        if (targets.size === 1) { output += target; converted++ }
        else if (targets.size === 0) {
          output += char
          if (/\p{Co}/u.test(char)) unmapped++
        } else {
          output += char
          ambiguous++
          conflicts.push({ code: char, options })
        }
      }
      return { text: output, converted, unmapped, ambiguous, conflicts }
    },
  }
}

/** @typedef {ReturnType<typeof makePua>} Pua */

/**
 * Each scheme's reading of one private-use slot: the scheme's code for it and its Unicode character.
 * A scheme that names the slot but has no character for it leaves `char` empty.
 * @param {Pua} pua @param {Map<string, Record<string, string>>} codes @param {string} slot
 * @returns {PuaReading[]}
 */
export function readingsOf(pua, codes, slot) {
  return pua.schemes.flatMap(scheme => {
    const code = codes.get(scheme.id)?.[slot] ?? ''
    const char = scheme.mappings[slot] ?? ''
    if (!code && !char) return []
    return [{ source: scheme.id, slot, code, char, ...(scheme.records ? { records: scheme.records } : {}) }]
  })
}

/** The slots a scheme code names, in every scheme. @param {Map<string, Record<string, string>>} codes @param {string} code */
export function slotsOfCode(codes, code) {
  const wanted = code.toUpperCase()
  return [...codes].flatMap(([source, table]) => Object.entries(table).filter(([, value]) => value.toUpperCase() === wanted).map(([slot]) => ({ source, slot })))
}

/** @param {any} module */
const json = module => /** @type {any} */ (module.default ?? module)

/** @type {Promise<Pua> | null} */
let loaded = null
/** Every scheme's mappings, loaded once. */
export function loadPua() {
  loaded ??= Promise.all([
    Promise.all(SCHEMES.map(async ({ id, load, records }) => {
      const data = json(await load())
      return /** @type {PuaScheme} */ ({ id, source: data.source, mappings: data.mappings, ...(records ? { records } : {}) })
    })),
    import('../data/moe-pua-variants.json').then(json),
  ]).then(([schemes, variants]) => makePua(schemes, variants))
  return loaded
}

/** @type {Promise<Map<string, Record<string, string>>> | null} */
let loadedCodes = null
/** The scheme codes of every named slot, loaded once. */
export function loadPuaCodes() {
  loadedCodes ??= Promise.all(SCHEMES.filter(scheme => scheme.codes).map(async scheme => /** @type {[string, Record<string, string>]} */ ([scheme.id, json(await /** @type {() => Promise<any>} */ (scheme.codes)()).codes])))
    .then(entries => new Map(entries))
  return loadedCodes
}
