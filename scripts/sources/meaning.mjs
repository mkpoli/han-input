// The meaning index: a word to the characters whose gloss uses it. Dictionaries feed this and
// nothing else; a reader goes elsewhere for the entries themselves.
const STOP = new Set('a an and are as at be by for from in is it of on or that the to with used also see same one etc'.split(' '))

/** The words of an English gloss. @param {string} gloss */
const english = gloss => gloss.toLowerCase().match(/[a-z][a-z-]+/g)?.filter(word => !STOP.has(word)) ?? []

/** @param {Map<string, Map<string, string>>} fields @returns {Promise<Map<string, string[]>>} */
export async function meaningWords(fields) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map()
  /** @param {string} word @param {string} char */
  const add = (word, char) => {
    let set = index.get(word)
    if (!set) index.set(word, set = new Set())
    set.add(char)
  }
  for (const [char, gloss] of fields.get('kDefinition') ?? []) for (const word of english(gloss)) add(word, char)
  return new Map([...index].map(([word, set]) => [word, [...set]]))
}
