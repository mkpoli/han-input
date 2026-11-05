// The meaning index: a word to the characters whose gloss uses it. Dictionaries feed this and
// nothing else; a reader goes elsewhere for the entries themselves.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE } from '../lib.mjs'

const STOP = new Set('a an and are as at be by for from in is it its of on or that the this to with used also see same one etc not any such which who has have was were form variant alternative character'.split(' '))

/**
 * The searchable words of a gloss: English words near its start, and runs of Han or kana cut into
 * two-character pieces, since those languages have no spaces.
 * @param {string} gloss @returns {string[]}
 */
export function glossWords(gloss) {
  const words = (gloss.toLowerCase().match(/[a-z][a-z-]+/g) ?? []).filter(word => !STOP.has(word)).slice(0, 12)
  const plain = words.flatMap(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? [word, word.slice(0, -1)] : [word]))
  const pieces = (gloss.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) ?? []).flatMap(run => {
    const chars = [...run]
    return chars.slice(0, -1).map((char, i) => char + chars[i + 1])
  }).slice(0, 24)
  return [...new Set([...plain, ...pieces])]
}

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
  for (const [char, gloss] of fields.get('kDefinition') ?? []) for (const word of glossWords(gloss)) add(word, char)
  // Wiktionary, once scripts/build_wiktionary.mjs has run. Unihan's characters stay first.
  const path = join(CACHE, 'meaning.tsv')
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const [word, chars] = line.split('\t')
      if (chars) for (const char of chars) add(word, char)
    }
  }
  return new Map([...index].map(([word, set]) => [word, [...set]]))
}
