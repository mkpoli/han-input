// One private-use code point means different things in different schemes: a font's own slots, a
// standard's table, a corpus's reserved range. Each scheme maps its slots to Unicode where it can and,
// where it names its slots, gives each one the scheme's own code (a CNS code, a CB code). Every scheme
// is kept apart, so a slot two schemes share keeps both readings.

/** @typedef {{ name: string, url: string, dataUrl?: string, retrieved?: string, sha256?: string, licence?: string, version?: string }} PuaSource */
/** @typedef {{ id: string, source: PuaSource, mappings: Record<string, string>, records?: string, set?: string, font?: boolean }} PuaScheme */
/** @typedef {{ source: string, slot: string, code: string, char: string, ids?: string, records?: string, set?: string, font?: boolean }} PuaReading */
/** What a scheme names its slots by: its own codes, and IDS for slots it describes only by shape. An
 * empty IDS still claims the slot. @typedef {Map<string, { codes: Record<string, string>, ids: Record<string, string> }>} PuaNames */

const SCHEMES = [
  { id: 'moe', load: () => import('../data/moe-pua.json') },
  { id: 'hkscs', load: () => import('../data/hkscs-pua.json') },
  { id: 'hanyang', load: () => import('../data/hanyang-pua.json') },
  // The site's CNS PUA font draws the CNS rows at their own slots.
  { id: 'cns', load: () => import('../data/cns-pua.json'), codes: () => import('../data/cns-pua-codes.json'), font: true },
  { id: 'gb18030', load: () => import('../data/gb18030-pua.json') },
  // CBETA reserves U+F0000 plus a CB code's number; a slot without a Unicode character is a record of
  // the CBETA缺字 character set.
  { id: 'cbeta', load: () => import('../data/cbeta-pua.json'), codes: () => import('../data/cbeta-pua-codes.json'), records: 'cbeta_gaiji', set: 'cbeta_gaiji' },
  // The 中华书局宋 font's plane 15 slots, named by a Unicode character or by an IDS.
  { id: 'zhonghua', load: () => import('../data/zhonghua-pua.json'), codes: () => import('../data/zhonghua-pua-codes.json'), set: 'gzhs' },
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
    /**
     * Convert one scheme, or every scheme where they agree. A scheme that names a slot without a Unicode
     * character for it claims the slot as it is, so it conflicts with a scheme that converts it.
     * @param {string} text @param {string} [id] @param {PuaNames} [names]
     */
    convert(text, id = 'moe', names = new Map()) {
      const sources = chosen(id)
      let converted = 0
      let unmapped = 0
      let ambiguous = 0
      let output = ''
      /** @type {{ code: string, options: { char: string, source: string, ids?: string }[] }[]} */
      const conflicts = []
      for (const char of text) {
        const options = sources.flatMap(scheme => char in scheme.mappings ? [{ char: scheme.mappings[char], source: scheme.id }]
          : claims(names, scheme.id, char) ? [{ char, source: scheme.id, ...(names.get(scheme.id)?.ids[char] ? { ids: names.get(scheme.id)?.ids[char] } : {}) }] : [])
        const targets = new Set(options.map(option => option.char))
        const [target] = targets
        if (targets.size === 1 && target !== char) { output += target; converted++ }
        else if (targets.size === 1) {
          output += char
          unmapped++
        }
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

/** Whether a scheme names a slot by a code or an IDS. @param {PuaNames} names @param {string} id @param {string} slot */
const claims = (names, id, slot) => Boolean(names.get(id)?.codes[slot]) || names.get(id)?.ids[slot] !== undefined

/**
 * Each scheme's reading of one private-use slot: the scheme's code for it, its Unicode character, and
 * the IDS a scheme describes it by. A scheme that names the slot without a character leaves `char` empty.
 * @param {Pua} pua @param {PuaNames} names @param {string} slot
 * @returns {PuaReading[]}
 */
export function readingsOf(pua, names, slot) {
  return pua.schemes.flatMap(scheme => {
    const code = names.get(scheme.id)?.codes[slot] ?? ''
    const ids = names.get(scheme.id)?.ids[slot]
    const char = scheme.mappings[slot] ?? ''
    if (!code && !char && ids === undefined) return []
    return [{ source: scheme.id, slot, code, char, ...(ids ? { ids } : {}), ...(scheme.records ? { records: scheme.records } : {}), ...(scheme.set ? { set: scheme.set } : {}), ...(scheme.font ? { font: true } : {}) }]
  })
}

/** The slots a scheme code names, in every scheme. @param {PuaNames} names @param {string} code */
export function slotsOfCode(names, code) {
  const wanted = code.toUpperCase()
  return [...names].flatMap(([source, { codes }]) => Object.entries(codes).filter(([, value]) => value.toUpperCase() === wanted).map(([slot]) => ({ source, slot })))
}

/**
 * A codes file lists each slot's code, or, for a scheme that numbers its slots from a base, the numbers;
 * it may also describe slots by IDS.
 * @param {{ codes?: Record<string, string>, formula?: { base: number, prefix: string, digits: number }, numbers?: number[], ids?: Record<string, string> }} data
 * @returns {{ codes: Record<string, string>, ids: Record<string, string> }}
 */
export function expandCodes(data) {
  const ids = data.ids ?? {}
  if (data.codes) return { codes: data.codes, ids }
  if (!data.formula) return { codes: {}, ids }
  const { base, prefix, digits } = data.formula
  return { codes: Object.fromEntries((data.numbers ?? []).map(number => [String.fromCodePoint(base + number), `${prefix}${String(number).padStart(digits, '0')}`])), ids }
}

/** @param {any} module */
const json = module => /** @type {any} */ (module.default ?? module)

/** @type {Promise<Pua> | null} */
let loaded = null
/** Every scheme's mappings, loaded once. */
export function loadPua() {
  loaded ??= Promise.all([
    Promise.all(SCHEMES.map(async ({ id, load, records, set, font }) => {
      const data = json(await load())
      return /** @type {PuaScheme} */ ({ id, source: data.source, mappings: data.mappings, ...(records ? { records } : {}), ...(set ? { set } : {}), ...(font ? { font } : {}) })
    })),
    import('../data/moe-pua-variants.json').then(json),
  ]).then(([schemes, variants]) => makePua(schemes, variants)).catch(error => { loaded = null; throw error })
  return loaded
}

/** @type {Promise<PuaNames> | null} */
let loadedCodes = null
/** The codes and IDS of every named slot, loaded once. */
export function loadPuaCodes() {
  loadedCodes ??= Promise.all(SCHEMES.filter(scheme => scheme.codes).map(async scheme => /** @type {[string, { codes: Record<string, string>, ids: Record<string, string> }]} */ ([scheme.id, expandCodes(json(await /** @type {() => Promise<any>} */ (scheme.codes)()))])))
    .then(entries => new Map(entries))
    .catch(error => { loadedCodes = null; throw error })
  return loadedCodes
}
