// Spellings that name the same part. IWDS groups the forms a source may write for one component;
// the search tries each of them so a character is not lost to the spelling a source happened to use.

/** @typedef {{ component: string, group: string }} ComponentVariant */
/** @typedef {{ char: string, relation: string, sources: string[], group?: string }} CharacterVariant */
/** @typedef {{ sources: { name: string, sha256?: string, licence: string, retrieved?: string }[], codes: Record<string, string>, labels: Record<string, string>, character: Record<string, string> }} SourcedVariants */
/** @typedef {{ sources: { name: string, url: string, licence: string, retrieved?: string }[], component: Record<string, ComponentVariant[]>, character: Record<string, CharacterVariant[]>, fuzzy?: Record<string, ComponentVariant[]> }} Variants */

/** Every spelling of a run of parts, the run itself first. @param {string[]} parts @param {Variants} variants @param {number} [cap] */
export function spellings(parts, variants, cap = 32) {
  /** @type {string[][]} */
  let runs = [parts]
  for (let at = 0; at < parts.length && runs.length < cap; at++) {
    const others = (variants.component[parts[at]] ?? []).map(row => row.component)
      .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    if (!others.length) continue
    /** @type {string[][]} */
    const next = []
    for (const run of runs) {
      next.push(run)
      for (const other of others) {
        if (next.length >= cap) break
        next.push([...run.slice(0, at), other, ...run.slice(at + 1)])
      }
    }
    runs = next
  }
  return runs
}

/** @param {string} char @param {Variants} variants @returns {CharacterVariant[]} */
export const characterVariants = (char, variants) => variants.character[char] ?? []

/** Parts that resemble this one without being it. @param {string} part @param {Variants} variants @returns {ComponentVariant[]} */
export const fuzzyComponents = (part, variants) => variants.fuzzy?.[part] ?? []

/** What a source id is called where the data names no label. */
export const BASE_LABELS = { iwds: 'IWDS', unicode: 'Unicode' }

const RELATIONS = /** @type {Record<string, string>} */ ({ v: 'variant', s: 'simplified', t: 'traditional' })

/**
 * The relations of the variant database for a character. Each entry is the other character, a
 * relation letter and the source codes (see scripts/import_sourced_variants.mjs).
 * @param {string} char @param {SourcedVariants} sourced @returns {CharacterVariant[]}
 */
export function sourcedVariants(char, sourced) {
  const line = sourced.character[char]
  if (!line) return []
  return line.split(' ').map(entry => {
    const [other] = entry
    const rest = entry.slice(other.length)
    return { char: other, relation: RELATIONS[rest[0]] ?? 'variant', sources: [...rest.slice(1)].map(code => sourced.codes[code] ?? code) }
  })
}

/** Every relation for a character; the same pair and relation from two places becomes one row. @param {string} char @param {Variants} variants @param {SourcedVariants} sourced @returns {CharacterVariant[]} */
export function allVariants(char, variants, sourced) {
  /** @type {Map<string, CharacterVariant>} */
  const rows = new Map()
  for (const row of [...characterVariants(char, variants), ...sourcedVariants(char, sourced)]) {
    const key = `${row.char} ${row.relation}`
    const have = rows.get(key)
    if (!have) rows.set(key, { ...row, sources: [...row.sources] })
    else have.sources.push(...row.sources.filter(id => !have.sources.includes(id)))
  }
  return [...rows.values()]
}
