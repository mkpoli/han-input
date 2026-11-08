// Spellings that name the same part. IWDS groups the forms a source may write for one component;
// the search tries each of them so a character is not lost to the spelling a source happened to use.

/** @typedef {{ component: string, group: string }} ComponentVariant */
/** @typedef {{ char: string, relation: string, source: string, group?: string }} CharacterVariant */
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
